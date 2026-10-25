"""Calendar items and task deadlines use an isolated SQLite database."""

import datetime as dt
import unittest

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

from backend.app import main, models, schemas
from backend.app.database import Base


class CalendarTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_events_deadlines_and_existing_task_due_dates(self):
        project = models.Project(name="Exam prep", plan="")
        self.db.add(project)
        self.db.flush()
        self.db.add(models.Task(title="Revise chapter", due_date="2026-10-20", project_id=project.id))
        self.db.commit()

        event = main.create_calendar_event(schemas.CalendarEventInput(
            title="  Focus session  ", kind="event", date="2026-10-20",
            start_time="09:00", end_time="10:30", notes="Chapter 3",
        ), self.db)
        deadline = main.create_calendar_event(schemas.CalendarEventInput(
            title="Submit draft", kind="deadline", date="2026-10-20", start_time="17:00",
        ), self.db)
        main.create_calendar_event(schemas.CalendarEventInput(
            title="Watch a show", date="2026-10-20",
        ), self.db)
        feed = main.read_calendar(dt.date(2026, 10, 19), dt.date(2026, 10, 25), self.db)
        self.assertEqual([item.title for item in feed["events"]], ["Watch a show", "Focus session", "Submit draft"])
        self.assertEqual([(item.title, item.project_name) for item in feed["tasks"]], [("Revise chapter", "Exam prep")])
        today = main.get_today_overview("2026-10-20", self.db)
        self.assertEqual([item.title for item in today.events], ["Watch a show", "Focus session", "Submit draft"])
        self.assertEqual([item.title for item in today.tasks], ["Revise chapter"])
        self.assertEqual(main.get_today_overview("2026-10-19", self.db).events, [])

        main.update_calendar_event(event.id, schemas.CalendarEventInput(
            title="Focus later", date="2026-10-21", start_time="11:00", end_time="12:00",
        ), self.db)
        self.assertEqual(self.db.get(models.CalendarEvent, event.id).date, "2026-10-21")
        self.assertEqual([item.title for item in main.get_today_overview("2026-10-21", self.db).events], ["Focus later"])
        main.delete_calendar_event(deadline.id, self.db)
        self.assertIsNone(self.db.get(models.CalendarEvent, deadline.id))
        self.assertEqual(self.db.query(models.Task).one().due_date, "2026-10-20")

    def test_invalid_times_and_large_range_are_rejected(self):
        invalid = [
            {"title": " ", "date": "2026-10-20"},
            {"title": "Wrong date", "date": "2026-02-30"},
            {"title": "No end", "date": "2026-10-20", "start_time": "09:00"},
            {"title": "Backwards", "date": "2026-10-20", "start_time": "10:00", "end_time": "09:00"},
            {"title": "Wrong time", "date": "2026-10-20", "start_time": "25:00", "end_time": "26:00"},
            {"title": "Deadline range", "kind": "deadline", "date": "2026-10-20", "start_time": "09:00", "end_time": "10:00"},
        ]
        for payload in invalid:
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                schemas.CalendarEventInput(**payload)
        for first, last in [(dt.date(2026, 10, 21), dt.date(2026, 10, 20)),
                            (dt.date(2026, 10, 1), dt.date(2026, 11, 12))]:
            with self.assertRaises(HTTPException) as raised:
                main.read_calendar(first, last, self.db)
            self.assertEqual(raised.exception.status_code, 400)

    def test_new_table_preserves_existing_rows(self):
        legacy = create_engine("sqlite:///:memory:")
        try:
            Base.metadata.create_all(legacy, tables=[table for table in Base.metadata.sorted_tables if table.name != "calendar_events"])
            with Session(legacy) as db:
                db.add(models.Task(title="Saved before calendar", due_date="2026-10-20"))
                db.commit()
            Base.metadata.create_all(legacy)
            self.assertIn("calendar_events", inspect(legacy).get_table_names())
            with Session(legacy) as db:
                self.assertEqual(db.query(models.Task).one().title, "Saved before calendar")
        finally:
            legacy.dispose()


if __name__ == "__main__":
    unittest.main()
