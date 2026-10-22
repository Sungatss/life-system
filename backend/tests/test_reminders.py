import datetime
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app import models, reminders
from backend.app.database import Base


class ReminderTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_pending_counts_ignore_completed_tasks_and_checked_or_inactive_habits(self):
        self.db.add_all([
            models.Task(title='Due', due_date='2026-10-22'),
            models.Task(title='Overdue', due_date='2026-10-21'),
            models.Task(title='Future', due_date='2026-10-23'),
            models.Task(title='Done', due_date='2026-10-22', completed=True),
            models.Habit(name='Walk'),
            models.Habit(name='Read', logs=[models.HabitLog(date='2026-10-22', completed=True)]),
            models.Habit(name='Paused', active=False),
        ])
        self.db.commit()
        self.assertEqual(reminders.pending_counts(self.db, '2026-10-22'), (2, 1))

    def test_dispatch_respects_local_time_and_only_sends_once_per_day(self):
        self.db.add(models.ReminderSubscription(
            endpoint='https://push.example/one', p256dh='key', auth='auth',
            timezone='Asia/Almaty', hour=19, minute=0,
        ))
        self.db.add(models.Task(title='Due', due_date='2026-10-22'))
        self.db.commit()
        now = datetime.datetime(2026, 10, 22, 14, 0, tzinfo=datetime.timezone.utc)
        with patch.object(reminders, 'SessionLocal', sessionmaker(bind=self.engine)), \
             patch.object(reminders, 'vapid_config', return_value=('private', 'public', 'mailto:test@example.com')), \
             patch.object(reminders, 'webpush') as send:
            self.assertEqual(reminders.dispatch_due(now - datetime.timedelta(minutes=1)), 0)
            self.assertEqual(reminders.dispatch_due(now), 1)
            self.assertEqual(reminders.dispatch_due(now + datetime.timedelta(minutes=1)), 0)
            send.assert_called_once()


if __name__ == '__main__':
    unittest.main()
