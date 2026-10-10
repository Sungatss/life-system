"""Small, reversible rewards derived from saved completions, not a second ledger."""
import datetime
from collections import Counter
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas

XP_PER_COMPLETION = 10
DAILY_GOAL = 30
XP_PER_LEVEL = 100


def get_progress(db: Session, timezone: ZoneInfo, now=None) -> schemas.ProgressResponse:
    now = now or models.utcnow()
    today = now.astimezone(timezone).date()
    completions = Counter()

    # SQLite returns naive timestamps; stored task timestamps are always UTC.
    for completed_at, due_date in db.query(models.Task.completed_at, models.Task.due_date).filter(
        models.Task.completed.is_(True)
    ):
        if completed_at:
            stamp = completed_at if completed_at.tzinfo else completed_at.replace(tzinfo=datetime.timezone.utc)
            completed_day = stamp.astimezone(timezone).date()
        else:
            # Preserve older imports that only recorded a due date.
            try:
                completed_day = datetime.date.fromisoformat(due_date or "")
            except ValueError:
                continue
        if completed_day <= today:
            completions[completed_day] += 1

    # Archived habits still count. Deleted habits cascade-delete their logs.
    logs = db.query(models.HabitLog.date, func.count(models.HabitLog.id)).filter(
        models.HabitLog.completed.is_(True),
        models.HabitLog.date <= today.isoformat(),
    ).group_by(models.HabitLog.date)
    for day, count in logs:
        try:
            completed_day = datetime.date.fromisoformat(day)
        except ValueError:
            continue
        completions[completed_day] += count

    streak = 0
    cursor = today if completions[today] else today - datetime.timedelta(days=1)
    while completions[cursor]:
        streak += 1
        cursor -= datetime.timedelta(days=1)

    total_xp = sum(completions.values()) * XP_PER_COMPLETION
    return schemas.ProgressResponse(
        date=today.isoformat(),
        total_xp=total_xp,
        today_xp=completions[today] * XP_PER_COMPLETION,
        daily_goal=DAILY_GOAL,
        streak=streak,
        level=total_xp // XP_PER_LEVEL + 1,
        xp_to_next_level=XP_PER_LEVEL - total_xp % XP_PER_LEVEL,
    )
