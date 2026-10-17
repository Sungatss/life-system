"""Single-user cookie authentication and small in-process request limits."""

import base64
import binascii
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from . import models

COOKIE_NAME = "lock_in_session"
SESSION_SECONDS = 7 * 24 * 60 * 60
_attempts = defaultdict(deque)
_assistant_minute = deque()
_assistant_day = deque()
_finance_minute = deque()
_lock = threading.Lock()


def configured():
    return bool(os.getenv("LOCK_IN_PASSWORD_HASH") and len(os.getenv("LOCK_IN_SESSION_SECRET", "")) >= 32)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def make_password_hash(password: str) -> str:
    if len(password) < 12:
        raise ValueError("Use a password with at least 12 characters")
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    return f"scrypt${_b64(salt)}${_b64(digest)}"


def verify_password(password: str) -> bool:
    stored = os.getenv("LOCK_IN_PASSWORD_HASH", "")
    try:
        kind, salt, digest = stored.split("$")
        if kind != "scrypt" or len(password) > 1024:
            return False
        actual = hashlib.scrypt(password.encode(), salt=_unb64(salt), n=16384, r=8, p=1)
        return hmac.compare_digest(actual, _unb64(digest))
    except (ValueError, TypeError, binascii.Error, UnicodeError):
        return False


def issue_session() -> tuple[str, str]:
    csrf = secrets.token_urlsafe(24)
    payload = _b64(json.dumps({"exp": int(time.time()) + SESSION_SECONDS, "csrf": csrf}, separators=(",", ":")).encode())
    signature = _b64(hmac.digest(os.environ["LOCK_IN_SESSION_SECRET"].encode(), payload.encode(), "sha256"))
    return f"{payload}.{signature}", csrf


def read_session(token: str | None) -> dict | None:
    if not configured() or not token or len(token) > 2048:
        return None
    try:
        payload, signature = token.split(".")
        expected = _b64(hmac.digest(os.environ["LOCK_IN_SESSION_SECRET"].encode(), payload.encode(), "sha256"))
        if not hmac.compare_digest(signature, expected):
            return None
        data = json.loads(_unb64(payload))
        if not isinstance(data.get("csrf"), str) or data.get("exp", 0) <= time.time():
            return None
        return data
    except (ValueError, TypeError, KeyError, binascii.Error, UnicodeError, json.JSONDecodeError):
        return None


def _prune(queue, cutoff):
    while queue and queue[0] < cutoff:
        queue.popleft()


def _database_limit(db, key: str, period: int, maximum: int, message: str):
    now = int(time.time())
    window = now // period
    counter_key = f"{key}:{window}"
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        insert = pg_insert(models.RateWindow)
    elif dialect == "sqlite":
        insert = sqlite_insert(models.RateWindow)
    else:
        raise RuntimeError("A supported database is required for shared rate limits")
    statement = insert.values(key=counter_key, count=1).on_conflict_do_update(
        index_elements=[models.RateWindow.key],
        set_={"count": models.RateWindow.count + 1},
    ).returning(models.RateWindow.count)
    count = db.execute(statement).scalar_one()
    db.commit()
    if count > maximum:
        retry = period - now % period
        raise HTTPException(429, message, headers={"Retry-After": str(retry)})


def _login_key(ip: str) -> str:
    return "login:" + hashlib.sha256(ip.encode()).hexdigest()[:32]


def login_limit(ip: str, db=None):
    if os.getenv("VERCEL"):
        if db is None:
            raise RuntimeError("Shared database session is required on Vercel")
        _database_limit(db, _login_key(ip), 15 * 60, 5, "Too many sign-in attempts. Try again in 15 minutes.")
        return
    now = time.monotonic()
    with _lock:
        queue = _attempts[ip]
        _prune(queue, now - 15 * 60)
        if len(queue) >= 5:
            raise HTTPException(429, "Too many sign-in attempts. Try again in 15 minutes.", headers={"Retry-After": "900"})
        queue.append(now)


def clear_login_limit(ip: str, db=None):
    if os.getenv("VERCEL"):
        if db is None:
            raise RuntimeError("Shared database session is required on Vercel")
        key = f"{_login_key(ip)}:{int(time.time()) // (15 * 60)}"
        db.execute(delete(models.RateWindow).where(models.RateWindow.key == key))
        db.commit()
        return
    with _lock:
        _attempts.pop(ip, None)


def assistant_limit(db=None):
    if os.getenv("VERCEL"):
        if db is None:
            raise RuntimeError("Shared database session is required on Vercel")
        _database_limit(db, "assistant:minute", 60, 3, "Assistant limit reached. Wait about a minute and try again.")
        _database_limit(db, "assistant:day", 24 * 60 * 60, 60, "Today's assistant limit is reached. Try again tomorrow.")
        return
    now = time.monotonic()
    with _lock:
        _prune(_assistant_minute, now - 60)
        _prune(_assistant_day, now - 24 * 60 * 60)
        if len(_assistant_minute) >= 3:
            raise HTTPException(429, "Assistant limit reached. Wait about a minute and try again.", headers={"Retry-After": "60"})
        if len(_assistant_day) >= 60:
            raise HTTPException(429, "Today's assistant limit is reached. Try again tomorrow.", headers={"Retry-After": "86400"})
        _assistant_minute.append(now)
        _assistant_day.append(now)


def finance_limit(db=None):
    """Bound access to financial records after the session check."""
    if os.getenv("VERCEL"):
        if db is None:
            raise RuntimeError("Shared database session is required on Vercel")
        _database_limit(db, "finance:minute", 60, 120, "Finance is busy. Wait a minute and try again.")
        return
    now = time.monotonic()
    with _lock:
        _prune(_finance_minute, now - 60)
        if len(_finance_minute) >= 120:
            raise HTTPException(429, "Finance is busy. Wait a minute and try again.", headers={"Retry-After": "60"})
        _finance_minute.append(now)
