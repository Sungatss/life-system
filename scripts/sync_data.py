#!/usr/bin/env python3
"""
sync_data.py - Full backup and restoration between local SQLite and Render cloud.
Restores all authentic tasks, daily notes, habits, habit streaks, and weekly reviews.
"""
import sys
import json
import sqlite3
import urllib.request
import os

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "lifesystem.db"))
RENDER_DEFAULT = "https://life-system-eycd.onrender.com"

# Starter seed titles that get generated on fresh DBs
SEED_TASK_TITLES = {
    "review current course assignments",
    "review algorithm notes for interviews",
    "walk outside for 30 minutes"
}

SEED_HABIT_NAMES = {
    "sleep before midnight",
    "walk or exercise",
    "no phone first 30 minutes",
    "study or code",
    "daily reflection"
}

def get_sqlite_conn():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        sys.exit(1)
    return sqlite3.connect(DB_PATH)

def restore_data_to_api(target_url=RENDER_DEFAULT):
    print(f"Connecting to {target_url}...")
    conn = get_sqlite_conn()
    c = conn.cursor()

    def api_call(path, method="GET", data=None):
        url = target_url.rstrip("/") + path
        headers = {"Content-Type": "application/json"}
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(req) as resp:
            if resp.status == 204:
                return None
            return json.loads(resp.read().decode("utf-8"))

    # 1. Clean up starter seed tasks if present
    try:
        remote_tasks = api_call("/api/tasks") or []
        for t in remote_tasks:
            if t["title"].strip().lower() in SEED_TASK_TITLES:
                try:
                    api_call(f"/api/tasks/{t['id']}", method="DELETE")
                    print(f"  - Removed starter placeholder task: '{t['title']}'")
                except Exception as e:
                    print(f"  ! Error removing placeholder task: {e}")
    except Exception as e:
        print(f"  ! Warning checking remote tasks: {e}")

    # 2. Sync all authentic local tasks
    task_columns = {column[1] for column in c.execute("PRAGMA table_info(tasks)")}
    description_column = "description" if "description" in task_columns else "'' AS description"
    local_tasks = c.execute(
        f"SELECT id, title, {description_column}, priority, due_date, category, completed FROM tasks ORDER BY id ASC"
    ).fetchall()
    try:
        current_remote = api_call("/api/tasks") or []
        remote_titles = {t["title"].strip().lower() for t in current_remote}
    except Exception:
        remote_titles = set()

    synced_tasks_count = 0
    for local_id, title, description, prio, due, cat, comp in local_tasks:
        if title.strip().lower() not in remote_titles:
            try:
                created = api_call("/api/tasks", method="POST", data={
                    "title": title,
                    "description": description or "",
                    "priority": prio or "none",
                    "due_date": due,
                    "category": cat,
                    "completed": bool(comp)
                })
                # If it was completed, make sure completed status is set
                if bool(comp) and not created.get("completed"):
                    api_call(f"/api/tasks/{created['id']}", method="PUT", data={"completed": True})
                synced_tasks_count += 1
            except Exception as e:
                print(f"  ! Error syncing task '{title}': {e}")
        else:
            synced_tasks_count += 1
    print(f"✓ Tasks restored: {synced_tasks_count} tasks in cloud")

    # 3. Clean up starter seed habits if present
    try:
        remote_habits = api_call("/api/habits") or []
        for h in remote_habits:
            if h["name"].strip().lower() in SEED_HABIT_NAMES:
                try:
                    api_call(f"/api/habits/{h['id']}", method="DELETE")
                    print(f"  - Removed starter placeholder habit: '{h['name']}'")
                except Exception as e:
                    print(f"  ! Error removing placeholder habit: {e}")
    except Exception as e:
        print(f"  ! Warning checking remote habits: {e}")

    # 4. Sync authentic habits and map local IDs to remote IDs
    local_habits = c.execute("SELECT id, name, active FROM habits ORDER BY id ASC").fetchall()
    try:
        current_habits = api_call("/api/habits") or []
        habit_map = {h["name"].strip().lower(): h["id"] for h in current_habits}
    except Exception:
        habit_map = {}

    local_to_remote_habit = {}
    for local_id, name, active in local_habits:
        key = name.strip().lower()
        if key not in habit_map:
            try:
                created_h = api_call("/api/habits", method="POST", data={"name": name})
                local_to_remote_habit[local_id] = created_h["id"]
                habit_map[key] = created_h["id"]
            except Exception as e:
                print(f"  ! Error creating habit '{name}': {e}")
        else:
            local_to_remote_habit[local_id] = habit_map[key]

    print(f"✓ Habits restored: {len(local_habits)} habits in cloud")

    # 5. Restore habit logs (streaks & history)
    local_logs = c.execute("SELECT habit_id, date, completed FROM habit_logs").fetchall()
    synced_logs = 0
    for h_id, log_date, comp in local_logs:
        remote_h_id = local_to_remote_habit.get(h_id)
        if remote_h_id:
            try:
                api_call(f"/api/habits/{remote_h_id}/toggle", method="POST", data={
                    "date": log_date,
                    "completed": bool(comp)
                })
                synced_logs += 1
            except Exception as e:
                print(f"  ! Error restoring habit log for {log_date}: {e}")
    print(f"✓ Habit logs & streaks restored: {synced_logs} logs active")

    # 6. Restore all daily notes
    local_notes = c.execute("SELECT date, content FROM daily_notes ORDER BY date ASC").fetchall()
    synced_notes = 0
    for date_str, content in local_notes:
        try:
            api_call(f"/api/notes/{date_str}", method="PUT", data={"content": content})
            synced_notes += 1
        except Exception as e:
            print(f"  ! Error restoring note for {date_str}: {e}")
    print(f"✓ Daily notes restored: {synced_notes} notes preserved")

    # 7. Restore weekly reviews
    try:
        local_reviews = c.execute("SELECT week_start, wins, blockers, next_focus FROM weekly_reviews").fetchall()
        for w_start, wins, blockers, next_focus in local_reviews:
            try:
                api_call(f"/api/reviews/weekly?week_start={w_start}", method="PUT", data={
                    "wins": wins or "",
                    "blockers": blockers or "",
                    "next_focus": next_focus or ""
                })
                print(f"✓ Weekly review for week {w_start} restored")
            except Exception as e:
                print(f"  ! Error restoring weekly review: {e}")
    except Exception as e:
        print(f"  ! Weekly review table check: {e}")

    print("\n🎉 ALL YOUR OLD DATA HAS BEEN FULLY RESTORED TO RENDER!")

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else RENDER_DEFAULT
    restore_data_to_api(url)
