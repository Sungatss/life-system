"""Opt-in daily Web Push reminders for unfinished tasks and habits."""

import datetime
import hmac
import json
import logging
import os
import threading
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from pywebpush import WebPushException, webpush
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from . import models
from .database import SessionLocal, get_db

router = APIRouter(prefix="/api/reminders", tags=["reminders"])
logger = logging.getLogger("uvicorn.error")


def vapid_config():
    private = os.getenv("VAPID_PRIVATE_KEY", "").strip()
    public = os.getenv("VAPID_PUBLIC_KEY", "").strip()
    subject = os.getenv("VAPID_SUBJECT", "").strip()
    return private, public, subject


class SubscriptionInput(BaseModel):
    endpoint: str = Field(min_length=1, max_length=2048)
    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=255)
    timezone: str = Field(min_length=1, max_length=100)
    hour: int = Field(ge=0, le=23)
    minute: int = Field(ge=0, le=59)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value):
        parsed = urlparse(value)
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
            raise ValueError("Push endpoint must be an HTTPS URL")
        return value

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError, KeyError):
            raise ValueError("Unknown timezone") from None
        return value


@router.get("/config")
def get_config():
    _, public, subject = vapid_config()
    cron_ready = not os.getenv("VERCEL") or len(os.getenv("CRON_SECRET", "")) >= 16
    return {
        "available": bool(public and subject and os.getenv("VAPID_PRIVATE_KEY") and cron_ready),
        "public_key": public,
        "schedule": "daily-almaty" if os.getenv("VERCEL") else "local-time",
    }


@router.get("/cron")
def run_cron(request: Request):
    secret = os.getenv("CRON_SECRET", "")
    if len(secret) < 16 or not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {secret}"):
        raise HTTPException(401, "Invalid cron authorization")
    return {"sent": dispatch_due()}


@router.post("/subscriptions")
def save_subscription(payload: SubscriptionInput, db: Session = Depends(get_db)):
    if not get_config()["available"]:
        raise HTTPException(503, "Push reminders are not configured on the server")
    row = db.query(models.ReminderSubscription).filter_by(endpoint=payload.endpoint).first()
    if row is None:
        row = models.ReminderSubscription(endpoint=payload.endpoint)
        db.add(row)
    row.p256dh = payload.p256dh
    row.auth = payload.auth
    row.timezone = "Asia/Almaty" if os.getenv("VERCEL") else payload.timezone
    row.hour = 19 if os.getenv("VERCEL") else payload.hour
    row.minute = 0 if os.getenv("VERCEL") else payload.minute
    local = datetime.datetime.now(datetime.timezone.utc).astimezone(ZoneInfo(row.timezone))
    if (local.hour, local.minute) >= (row.hour, row.minute):
        row.last_sent_date = local.date().isoformat()
    db.commit()
    return {"enabled": True}


class UnsubscribeInput(BaseModel):
    endpoint: str = Field(min_length=1, max_length=2048)


@router.post("/unsubscribe")
def remove_subscription(payload: UnsubscribeInput, db: Session = Depends(get_db)):
    db.query(models.ReminderSubscription).filter_by(endpoint=payload.endpoint).delete()
    db.commit()
    return {"enabled": False}


def pending_counts(db: Session, day: str):
    tasks = db.query(models.Task).filter(
        models.Task.completed.is_(False), models.Task.due_date.isnot(None), models.Task.due_date <= day,
    ).count()
    done = select(models.HabitLog.habit_id).where(
        models.HabitLog.date == day, models.HabitLog.completed.is_(True),
    )
    habits = db.query(models.Habit).filter(
        models.Habit.active.is_(True), ~models.Habit.id.in_(done),
    ).count()
    return tasks, habits


def dispatch_due(now=None):
    """Called by the in-process timer. Claim each device/day before sending."""
    private, public, subject = vapid_config()
    if not (private and public and subject):
        return 0
    now = now or datetime.datetime.now(datetime.timezone.utc)
    sent = 0
    with SessionLocal() as db:
        ids = [row.id for row in db.query(models.ReminderSubscription.id).all()]
        for subscription_id in ids:
            row = db.get(models.ReminderSubscription, subscription_id)
            if row is None:
                continue
            local = now.astimezone(ZoneInfo(row.timezone))
            day = local.date().isoformat()
            if (local.hour, local.minute) < (row.hour, row.minute) or row.last_sent_date == day:
                continue
            # Claiming in the DB prevents multiple app processes from sending the same reminder.
            claimed = db.execute(update(models.ReminderSubscription).where(
                models.ReminderSubscription.id == subscription_id,
                or_(models.ReminderSubscription.last_sent_date.is_(None), models.ReminderSubscription.last_sent_date != day),
            ).values(last_sent_date=day)).rowcount
            db.commit()
            if not claimed:
                continue
            tasks, habits = pending_counts(db, day)
            if not tasks and not habits:
                continue
            parts = []
            if tasks:
                parts.append(f"{tasks} unfinished task{'s' if tasks != 1 else ''}")
            if habits:
                parts.append(f"{habits} habit{'s' if habits != 1 else ''} to check")
            payload = {"title": "A little progress today?", "body": " · ".join(parts), "url": "/#today"}
            try:
                webpush(
                    subscription_info={"endpoint": row.endpoint, "keys": {"p256dh": row.p256dh, "auth": row.auth}},
                    data=json.dumps(payload), vapid_private_key=private, vapid_claims={"sub": subject}, ttl=3600,
                )
                sent += 1
            except WebPushException as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                if status in (404, 410):
                    db.delete(row)
                else:
                    row.last_sent_date = None  # Retry on the next tick.
                    logger.warning("Reminder delivery failed: %s", status or type(exc).__name__)
                db.commit()
    return sent


def start_scheduler():
    stop = threading.Event()

    def run():
        while not stop.wait(60):
            try:
                dispatch_due()
            except Exception:
                logger.exception("Reminder scheduler failed")

    thread = threading.Thread(target=run, name="reminder-scheduler", daemon=True)
    thread.start()
    return stop
