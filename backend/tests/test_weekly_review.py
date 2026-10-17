"""Weekly statistics use saved records in an isolated database."""

import datetime as dt
import unittest
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app import crud, models, schemas
from backend.app.database import Base


class WeeklyReviewTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_current_week_statistics_and_saved_reflection(self):
        utc = dt.timezone.utc
        first = models.Project(name="First", plan="")
        second = models.Project(name="Second", plan="")
        self.db.add_all([first, second])
        self.db.flush()
        self.db.add_all([
            models.Task(title="Done on time", due_date="2026-10-13", completed=True,
                        completed_at=dt.datetime(2026, 10, 13, 10, tzinfo=utc), project_id=first.id),
            models.Task(title="Still planned", due_date="2026-10-14", completed=False, project_id=second.id),
            models.Task(title="Finished next week", due_date="2026-10-18", completed=True,
                        completed_at=dt.datetime(2026, 10, 20, 10, tzinfo=utc), project_id=second.id),
            models.Task(title="Finished early", due_date="2026-10-15", completed=True,
                        completed_at=dt.datetime(2026, 10, 11, 10, tzinfo=utc), project_id=first.id),
            models.Task(title="Unplanned but finished", completed=True,
                        completed_at=dt.datetime(2026, 10, 14, 10, tzinfo=utc), project_id=second.id),
        ])
        active = models.Habit(name="Active", active=True, created_at=dt.datetime(2026, 10, 13, 8, tzinfo=utc))
        active.logs = [models.HabitLog(date=day, completed=True) for day in ("2026-10-13", "2026-10-14", "2026-10-16")]
        archived = models.Habit(name="Archived", active=False)
        archived.logs = [models.HabitLog(date="2026-10-12", completed=True)]
        self.db.add_all([active, archived])
        self.db.commit()
        crud.upsert_weekly_review(self.db, "2026-10-12", schemas.WeeklyReviewUpdate(
            wins="Kept going", blockers="Interruptions", next_focus="Finish project",
        ))

        result = crud.get_weekly_cockpit(
            self.db, "2026-10-14", "2026-10-14", ZoneInfo("UTC"),
        )
        self.assertEqual((result.week_number, result.week_year), (42, 2026))
        self.assertEqual((result.tasks_planned, result.planned_tasks_completed, result.task_completion_rate), (4, 2, 50))
        self.assertEqual((result.total_tasks_completed, result.projects_moved_forward), (2, 2))
        self.assertEqual((result.total_habits_completed, result.total_habits_possible, result.habit_consistency_rate), (2, 2, 100))
        self.assertEqual((result.days_active, result.xp_earned), (3, 50))
        self.assertEqual([day.has_activity for day in result.day_breakdown], [True, True, True, False, False, False, False])
        self.assertEqual(result.review.wins, "Kept going")
        self.assertEqual(result.review.blockers, "Interruptions")
        self.assertEqual(result.review.next_focus, "Finish project")

    def test_timezone_and_empty_week_have_honest_denominators(self):
        self.db.add(models.Task(title="Late UTC", completed=True,
                                completed_at=dt.datetime(2026, 10, 11, 23, 30, tzinfo=dt.timezone.utc)))
        self.db.commit()
        result = crud.get_weekly_cockpit(
            self.db, "2026-10-12", "2026-10-12", ZoneInfo("Asia/Almaty"),
        )
        self.assertEqual(result.total_tasks_completed, 1)
        self.assertEqual(result.days_active, 1)
        self.assertEqual(result.xp_earned, 10)
        self.assertEqual((result.tasks_planned, result.task_completion_rate, result.total_habits_possible), (0, 0, 0))
        future = crud.get_weekly_cockpit(
            self.db, "2026-10-26", "2026-10-12", ZoneInfo("Asia/Almaty"),
        )
        self.assertEqual((future.days_active, future.total_habits_possible, future.xp_earned), (0, 0, 0))


if __name__ == "__main__":
    unittest.main()
