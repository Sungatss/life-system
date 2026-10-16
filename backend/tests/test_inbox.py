import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from backend.app import main, migrations, schemas
from backend.app.database import Base


class InboxTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_capture_edit_and_delete_survive_a_new_session(self):
        self.assertEqual(main.read_inbox(self.db), [])
        first = main.create_inbox_entry(schemas.InboxEntryContent(content='  Call Alex\nAsk about plans  '), self.db)
        second = main.create_inbox_entry(schemas.InboxEntryContent(content='A thought'), self.db)
        self.assertEqual(first.content, 'Call Alex\nAsk about plans')
        self.assertEqual([entry.id for entry in main.read_inbox(self.db)], [second.id, first.id])

        updated = main.update_inbox_entry(first.id, schemas.InboxEntryContent(content='  Updated thought  '), self.db)
        self.assertEqual(updated.content, 'Updated thought')
        with Session(self.engine) as fresh_db:
            entries = main.read_inbox(fresh_db)
            self.assertEqual([entry.content for entry in entries], ['A thought', 'Updated thought'])
            self.assertEqual(schemas.InboxEntryResponse.model_validate(entries[1]).content, 'Updated thought')

        self.assertIsNone(main.delete_inbox_entry(second.id, self.db))
        with Session(self.engine) as fresh_db:
            self.assertEqual([entry.id for entry in main.read_inbox(fresh_db)], [first.id])

    def test_blank_and_missing_entries_are_rejected(self):
        with self.assertRaises(HTTPException) as error:
            main.create_inbox_entry(schemas.InboxEntryContent(content=' \n '), self.db)
        self.assertEqual(error.exception.status_code, 400)
        with self.assertRaises(HTTPException) as error:
            main.update_inbox_entry(9, schemas.InboxEntryContent(content=' '), self.db)
        self.assertEqual(error.exception.status_code, 400)
        with self.assertRaises(HTTPException) as error:
            main.update_inbox_entry(9, schemas.InboxEntryContent(content='Present'), self.db)
        self.assertEqual(error.exception.status_code, 404)
        with self.assertRaises(HTTPException) as error:
            main.delete_inbox_entry(9, self.db)
        self.assertEqual(error.exception.status_code, 404)

    def test_retired_daily_notes_table_is_removed_without_affecting_inbox(self):
        engine = create_engine('sqlite:///:memory:')
        with engine.begin() as connection:
            connection.execute(text('CREATE TABLE daily_notes (id INTEGER PRIMARY KEY, date TEXT, content TEXT)'))
            connection.execute(text("INSERT INTO daily_notes (id, date, content) VALUES (1, '2026-10-11', 'Existing note')"))
        Base.metadata.create_all(engine)
        migrations.drop_daily_notes_if_present(engine)
        self.assertIn('inbox_entries', inspect(engine).get_table_names())
        self.assertNotIn('daily_notes', inspect(engine).get_table_names())
        with engine.connect() as connection:
            self.assertEqual(connection.execute(text('SELECT COUNT(*) FROM inbox_entries')).scalar_one(), 0)
        engine.dispose()


if __name__ == '__main__':
    unittest.main()
