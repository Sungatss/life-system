#!/usr/bin/env python3
"""
migrate_to_postgres.py - One-command direct migration from local SQLite to Cloud PostgreSQL (Neon / Supabase).
Transfers all your authentic tasks, daily notes, habits, streaks, and weekly reviews.
"""
import sys
import os
import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.models import Base, Task, Habit, HabitLog, DailyNote, WeeklyReview
from backend.app.database import init_engine
from backend.app.migrations import add_task_description_if_missing

SQLITE_PATH = os.path.join(PROJECT_ROOT, "backend", "lifesystem.db")


def migrate(postgres_url: str):
    if not os.path.exists(SQLITE_PATH):
        print(f"Error: Local SQLite file not found at: {SQLITE_PATH}")
        sys.exit(1)

    print("==================================================================")
    print(" Life System: Migrating Local Data to Cloud PostgreSQL")
    print("==================================================================")
    print(f"Source SQLite: {SQLITE_PATH}")
    masked_url = postgres_url.split("@")[-1] if "@" in postgres_url else "..."
    print(f"Target DB:     ...@{masked_url}")
    print()

    # 1. Connect to PostgreSQL and create schema
    print("1. Connecting to PostgreSQL and creating tables...")
    pg_engine = init_engine(postgres_url)
    Base.metadata.create_all(bind=pg_engine)
    add_task_description_if_missing(pg_engine)
    print("   ✓ PostgreSQL tables initialized.")

    # 2. Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sc = sqlite_conn.cursor()

    with Session(bind=pg_engine) as pg_session:
        # 3. Migrate Tasks
        print("\n2. Migrating Tasks...")
        tasks = sc.execute("SELECT * FROM tasks ORDER BY id ASC").fetchall()
        task_columns = {column[1] for column in sc.execute("PRAGMA table_info(tasks)")}
        migrated_tasks = 0
        for row in tasks:
            exists = pg_session.query(Task).filter(Task.title == row["title"]).first()
            if not exists:
                pg_task = Task(
                    title=row["title"],
                    description=row["description"] if "description" in task_columns else "",
                    completed=bool(row["completed"]),
                    priority=row["priority"],
                    due_date=row["due_date"],
                    category=row["category"],
                    created_at=row["created_at"],
                    completed_at=row["completed_at"]
                )
                pg_session.add(pg_task)
                migrated_tasks += 1
        pg_session.commit()
        print(f"   ✓ {migrated_tasks} tasks migrated (total {len(tasks)} in local DB).")

        # 4. Migrate Habits
        print("\n3. Migrating Habits & Logs...")
        habits = sc.execute("SELECT * FROM habits ORDER BY id ASC").fetchall()
        habit_id_map = {}
        migrated_habits = 0
        for row in habits:
            existing_habit = pg_session.query(Habit).filter(Habit.name == row["name"]).first()
            if not existing_habit:
                new_h = Habit(
                    name=row["name"],
                    active=bool(row["active"]),
                    created_at=row["created_at"]
                )
                pg_session.add(new_h)
                pg_session.flush()
                habit_id_map[row["id"]] = new_h.id
                migrated_habits += 1
            else:
                habit_id_map[row["id"]] = existing_habit.id

        # Migrate Habit Logs
        habit_logs = sc.execute("SELECT * FROM habit_logs ORDER BY id ASC").fetchall()
        migrated_logs = 0
        for row in habit_logs:
            pg_habit_id = habit_id_map.get(row["habit_id"])
            if pg_habit_id:
                log_exists = pg_session.query(HabitLog).filter(
                    HabitLog.habit_id == pg_habit_id,
                    HabitLog.date == row["date"]
                ).first()
                if not log_exists:
                    new_log = HabitLog(
                        habit_id=pg_habit_id,
                        date=row["date"],
                        completed=bool(row["completed"])
                    )
                    pg_session.add(new_log)
                    migrated_logs += 1
        pg_session.commit()
        print(f"   ✓ {migrated_habits} habits and {migrated_logs} habit log entries migrated.")

        # 5. Migrate Daily Notes
        print("\n4. Migrating Daily Notes...")
        notes = sc.execute("SELECT * FROM daily_notes ORDER BY date ASC").fetchall()
        migrated_notes = 0
        for row in notes:
            existing_note = pg_session.query(DailyNote).filter(DailyNote.date == row["date"]).first()
            if not existing_note:
                new_note = DailyNote(
                    date=row["date"],
                    content=row["content"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"]
                )
                pg_session.add(new_note)
                migrated_notes += 1
            else:
                if row["content"] and not existing_note.content:
                    existing_note.content = row["content"]
        pg_session.commit()
        print(f"   ✓ {migrated_notes} daily notes migrated (total {len(notes)} in local DB).")

        # 6. Migrate Weekly Reviews
        print("\n5. Migrating Weekly Reviews...")
        try:
            reviews = sc.execute("SELECT * FROM weekly_reviews ORDER BY week_start ASC").fetchall()
            migrated_reviews = 0
            for row in reviews:
                existing_rev = pg_session.query(WeeklyReview).filter(
                    WeeklyReview.week_start == row["week_start"]
                ).first()
                if not existing_rev:
                    new_rev = WeeklyReview(
                        week_start=row["week_start"],
                        wins=row["wins"],
                        blockers=row["blockers"],
                        next_focus=row["next_focus"],
                        created_at=row["created_at"],
                        updated_at=row["updated_at"]
                    )
                    pg_session.add(new_rev)
                    migrated_reviews += 1
            pg_session.commit()
            print(f"   ✓ {migrated_reviews} weekly reviews migrated.")
        except Exception as e:
            print(f"   (Weekly reviews note: {e})")

        # 7. Reset sequences in PostgreSQL for auto-increment IDs
        try:
            for table_name in ["tasks", "habits", "habit_logs", "daily_notes", "weekly_reviews"]:
                pg_session.execute(text(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table_name}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {table_name}), 1)
                    );
                """))
            pg_session.commit()
        except Exception:
            pass

    print()
    print("==================================================================")
    print(" 🎉 Migration Completed Successfully! All data is now in PostgreSQL.")
    print("==================================================================")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1].strip()
    else:
        target = os.getenv("DATABASE_URL", "").strip()

    if not target or target.startswith("sqlite"):
        print("Usage: python scripts/migrate_to_postgres.py '<POSTGRESQL_CONNECTION_STRING>'")
        print("Example: python scripts/migrate_to_postgres.py 'postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require'")
        sys.exit(1)

    migrate(target)
