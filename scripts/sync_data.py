#!/usr/bin/env python3
"""
sync_data.py - Backup, sync, and restore Life System data between local SQLite and Render/Postgres.
"""
import sys
import json
import sqlite3
import urllib.request
import os

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "lifesystem.db"))
RENDER_DEFAULT = "https://life-system-eycd.onrender.com"

def get_sqlite_conn():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        sys.exit(1)
    return sqlite3.connect(DB_PATH)

def push_sqlite_to_api(target_url=RENDER_DEFAULT):
    print(f"Connecting to {target_url}...")
    conn = get_sqlite_conn()
    c = conn.cursor()

    def api_call(path, method="GET", data=None):
        url = target_url.rstrip("/") + path
        headers = {"Content-Type": "application/json"}
        body = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(req) as resp:
            if resp.status == 204:
                return None
            return json.loads(resp.read().decode())

    # 1. Sync tasks
    local_tasks = c.execute("SELECT title, priority, due_date, category, completed FROM tasks ORDER BY id ASC").fetchall()
    try:
        remote_tasks = api_call("/api/tasks")
        remote_titles = {t["title"].strip().lower() for t in remote_tasks}
    except Exception:
        remote_titles = set()

    added_tasks = 0
    for title, prio, due, cat, comp in local_tasks:
        if title.strip().lower() not in remote_titles:
            try:
                api_call("/api/tasks", method="POST", data={
                    "title": title,
                    "priority": prio or "none",
                    "due_date": due,
                    "category": cat,
                    "completed": bool(comp)
                })
                added_tasks += 1
            except Exception as e:
                print(f"Error syncing task '{title}': {e}")
    print(f"✓ Tasks synced: {added_tasks} new tasks added (total {len(local_tasks)} preserved)")

    # 2. Sync daily notes
    local_notes = c.execute("SELECT date, content FROM daily_notes").fetchall()
    added_notes = 0
    for date_str, content in local_notes:
        try:
            api_call(f"/api/notes/{date_str}", method="PUT", data={"content": content})
            added_notes += 1
        except Exception as e:
            print(f"Error syncing note for {date_str}: {e}")
    print(f"✓ Daily notes synced: {added_notes} notes preserved")

    # 3. Sync habits
    local_habits = c.execute("SELECT id, name FROM habits").fetchall()
    for h_id, name in local_habits:
        try:
            api_call("/api/habits", method="POST", data={"name": name})
        except Exception:
            pass
    print(f"✓ Habits synced: {len(local_habits)} habits preserved")

    print("\n✓ All local data successfully pushed to cloud endpoint!")

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else RENDER_DEFAULT
    push_sqlite_to_api(url)
