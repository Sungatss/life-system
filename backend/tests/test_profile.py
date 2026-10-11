import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from backend.app import main, migrations, models, schemas
from backend.app.database import Base


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_profile_persists_without_affecting_activity(self):
        initial = main.get_profile(self.db)
        self.assertEqual(initial.bio, '')
        saved = main.update_profile(schemas.ProfileUpdate(name='  Sungat  ', bio='  My focus  '), self.db)
        self.assertEqual((saved.id, saved.name, saved.bio), (initial.id, 'Sungat', 'My focus'))
        with Session(self.engine) as another_session:
            reloaded = main.get_profile(another_session)
            self.assertEqual((reloaded.name, reloaded.bio), ('Sungat', 'My focus'))
        self.assertEqual(self.db.query(models.User).count(), 1)

    def test_empty_name_is_rejected_without_overwriting_profile(self):
        initial = main.get_profile(self.db)
        with self.assertRaises(HTTPException) as error:
            main.update_profile(schemas.ProfileUpdate(name='  ', bio='changed'), self.db)
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(main.get_profile(self.db).name, initial.name)

    def test_legacy_user_gets_bio_column(self):
        old_engine = create_engine('sqlite:///:memory:')
        try:
            with old_engine.begin() as connection:
                connection.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL, created_at DATETIME)'))
                connection.execute(text("INSERT INTO users (id, name) VALUES (1, 'Existing name')"))
            migrations.add_user_bio_if_missing(old_engine)
            migrations.add_user_bio_if_missing(old_engine)
            with old_engine.connect() as connection:
                row = connection.execute(text('SELECT name, bio FROM users WHERE id = 1')).one()
            self.assertEqual(row, ('Existing name', ''))
        finally:
            old_engine.dispose()


if __name__ == '__main__':
    unittest.main()
