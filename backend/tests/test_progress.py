import datetime
import unittest
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app import crud, main, models, progress, schemas
from backend.app.database import Base

UTC = datetime.timezone.utc
NOW = datetime.datetime(2026, 10, 10, 12, tzinfo=UTC)


class ProgressTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def read(self, zone='UTC', now=NOW):
        self.db.commit()
        return progress.get_progress(self.db, ZoneInfo(zone), now)

    def task(self, day=10, hour=9, **kwargs):
        task = models.Task(title='Example', completed=True,
                           completed_at=datetime.datetime(2026, 10, day, hour, tzinfo=UTC), **kwargs)
        self.db.add(task)
        return task

    def habit(self, days, active=True):
        habit = models.Habit(name='Walk', active=active)
        habit.logs = [models.HabitLog(date=f'2026-10-{day:02}', completed=True) for day in days]
        self.db.add(habit)
        return habit

    def test_empty_and_invalid_timezone(self):
        result = self.read()
        self.assertEqual((result.total_xp, result.today_xp, result.streak, result.level), (0, 0, 0, 1))
        self.assertEqual(result.xp_to_next_level, 100)
        with self.assertRaises(HTTPException) as error:
            main.get_progress('invalid/timezone', self.db)
        self.assertEqual(error.exception.status_code, 400)

    def test_tasks_and_habits_share_goal_and_history_survives_reload(self):
        self.task()
        self.habit([8, 9, 10])
        self.habit([10])
        result = self.read()
        self.assertEqual((result.total_xp, result.today_xp, result.daily_goal, result.streak), (50, 30, 30, 3))
        with Session(self.engine) as db:
            self.assertEqual(progress.get_progress(db, ZoneInfo('UTC'), NOW), result)

    def test_yesterday_streak_survives_until_today_ends_and_gap_resets(self):
        self.habit([7, 8, 9])
        result = self.read()
        self.assertEqual((result.streak, result.today_xp), (3, 0))
        self.assertEqual(self.read(now=NOW + datetime.timedelta(days=1)).streak, 0)
        self.task(day=11)
        self.assertEqual(self.read(now=NOW + datetime.timedelta(days=1)).streak, 1)

    def test_local_midnight_and_dst_use_completion_time_not_due_date(self):
        self.task(day=9, hour=22, due_date='2026-10-01')
        self.assertEqual(self.read('Asia/Almaty').today_xp, 10)
        self.assertEqual(self.read('UTC').today_xp, 0)
        # New York still observes daylight saving time on this date (UTC-4).
        self.task(day=10, hour=4)
        self.assertEqual(self.read('America/New_York').today_xp, 10)

    def test_local_day_not_server_day(self):
        self.habit([10])
        result = self.read('Asia/Almaty', datetime.datetime(2026, 10, 9, 22, tzinfo=UTC))
        self.assertEqual((result.date, result.today_xp), ('2026-10-10', 10))

    def test_undo_repeated_completion_and_delete_do_not_inflate_xp(self):
        task = crud.create_task(self.db, schemas.TaskCreate(title='Task', completed=True))
        first = progress.get_progress(self.db, ZoneInfo('UTC'))
        crud.update_task(self.db, task.id, schemas.TaskUpdate(completed=True))
        self.assertEqual(progress.get_progress(self.db, ZoneInfo('UTC')).total_xp, first.total_xp)
        crud.update_task(self.db, task.id, schemas.TaskUpdate(completed=False))
        self.assertEqual(progress.get_progress(self.db, ZoneInfo('UTC')).total_xp, 0)
        crud.update_task(self.db, task.id, schemas.TaskUpdate(completed=True))
        self.assertEqual(progress.get_progress(self.db, ZoneInfo('UTC')).total_xp, 10)
        crud.delete_task(self.db, task.id)
        self.assertEqual(progress.get_progress(self.db, ZoneInfo('UTC')).total_xp, 0)

    def test_archived_habits_keep_xp_future_and_undone_logs_do_not(self):
        habit = self.habit([9, 10, 11], active=False)
        self.assertEqual(self.read().total_xp, 20)
        crud.toggle_habit_log(self.db, habit.id, '2026-10-10', False)
        self.assertEqual(self.read().total_xp, 10)
        crud.toggle_habit_log(self.db, habit.id, '2026-10-10', True)
        crud.toggle_habit_log(self.db, habit.id, '2026-10-10', True)
        self.assertEqual(self.read().total_xp, 20)
        crud.delete_habit(self.db, habit.id)
        self.assertEqual(self.read().total_xp, 0)

    def test_level_thresholds_subtasks_and_legacy_tasks(self):
        for _ in range(9):
            self.task()
        task = models.Task(title='Legacy', completed=True, due_date='2026-10-09')
        task.subtasks = [models.Subtask(title='Step', completed=True)]
        self.db.add_all([task, models.Task(title='Unknown date', completed=True),
                         models.Task(title='Bad legacy date', completed=True, due_date='bad-date')])
        result = self.read()
        self.assertEqual((result.total_xp, result.level, result.xp_to_next_level), (100, 2, 100))
        self.assertEqual(result.today_xp, 90)
        self.assertEqual(result.daily_goal, 30)


if __name__ == '__main__':
    unittest.main()
