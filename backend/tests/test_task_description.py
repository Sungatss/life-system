import unittest

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from backend.app import crud, migrations, schemas
from backend.app.database import Base


class TaskDescriptionTests(unittest.TestCase):
    def test_create_update_and_clear_description(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as db:
            task = crud.create_task(
                db, schemas.TaskCreate(title="Main task", description="First detail\nSecond detail")
            )
            self.assertEqual(task.description, "First detail\nSecond detail")
            self.assertEqual(schemas.TaskResponse.model_validate(task).description, task.description)

            task = crud.update_task(
                db, task.id, schemas.TaskUpdate(description="Updated detail")
            )
            self.assertEqual(task.description, "Updated detail")
            task_id = task.id

        with Session(engine) as db:
            task = crud.get_task(db, task_id)
            self.assertEqual(task.description, "Updated detail")

            task = crud.update_task(db, task.id, schemas.TaskUpdate(description=None))
            self.assertEqual(task.description, "")

    def test_existing_tasks_gain_empty_descriptions(self):
        engine = create_engine("sqlite:///:memory:")
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL)"))
            connection.execute(text("INSERT INTO tasks (id, title) VALUES (1, 'Existing task')"))

        migrations.add_task_description_if_missing(engine)
        migrations.add_task_description_if_missing(engine)

        self.assertIn("description", {column["name"] for column in inspect(engine).get_columns("tasks")})
        with engine.connect() as connection:
            description = connection.execute(text("SELECT description FROM tasks WHERE id = 1")).scalar_one()
        self.assertEqual(description, "")


if __name__ == "__main__":
    unittest.main()
