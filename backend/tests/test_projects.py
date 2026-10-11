import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from backend.app import crud, main, migrations, models, schemas
from backend.app.database import Base


class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_project_plan_tasks_steps_move_and_delete(self):
        with Session(self.engine) as db:
            exams = main.create_project(schemas.ProjectCreate(name=" Exams ", plan="Prepare\nPractice"), db)
            self.assertEqual((exams.name, exams.plan), ("Exams", "Prepare\nPractice"))
            task = main.create_new_task(schemas.TaskCreate(
                title="Math revision", project_id=exams.id,
                subtasks=[schemas.SubtaskCreate(title="Practice algebra")],
            ), db)
            self.assertEqual((task.project_id, task.project_name), (exams.id, "Exams"))
            self.assertEqual(len(main.read_tasks(project_id=exams.id, db=db)), 1)

            main.update_project(exams.id, schemas.ProjectUpdate(name="Final exams", plan="Week 1\nWeek 2"), db)
            self.assertEqual(main.read_task(task.id, db).project_name, "Final exams")
            second = main.create_project(schemas.ProjectCreate(name="Coursework"), db)
            moved = main.update_task_item(task.id, schemas.TaskUpdate(project_id=second.id), db)
            self.assertEqual((moved.project_id, moved.project_name), (second.id, "Coursework"))
            self.assertEqual(main.read_tasks(project_id=exams.id, db=db), [])
            self.assertEqual(len(main.read_tasks(project_id=second.id, db=db)), 1)

            main.delete_project(second.id, db)
            retained = main.read_task(task.id, db)
            self.assertIsNone(retained.project_id)
            self.assertIsNone(retained.project_name)
            self.assertEqual([step.title for step in retained.subtasks], ["Practice algebra"])

    def test_duplicate_blank_and_unknown_project(self):
        with Session(self.engine) as db:
            main.create_project(schemas.ProjectCreate(name="Exams"), db)
            for name, status in [(" exams ", 409), ("  ", 400)]:
                with self.assertRaises(HTTPException) as raised:
                    main.create_project(schemas.ProjectCreate(name=name), db)
                self.assertEqual(raised.exception.status_code, status)
            with self.assertRaises(HTTPException) as raised:
                main.create_new_task(schemas.TaskCreate(title="Study", project_id=999), db)
            self.assertEqual(raised.exception.status_code, 400)

    def test_existing_tasks_table_is_migrated_without_losing_rows(self):
        legacy = create_engine("sqlite:///:memory:")
        try:
            with legacy.begin() as connection:
                connection.execute(text("CREATE TABLE tasks (id INTEGER PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT NOT NULL DEFAULT '', completed BOOLEAN NOT NULL DEFAULT 0, priority VARCHAR(20) NOT NULL DEFAULT 'none', due_date VARCHAR(10), category VARCHAR(100), created_at DATETIME, completed_at DATETIME)"))
                connection.execute(text("INSERT INTO tasks (id, title) VALUES (1, 'Existing task')"))
            Base.metadata.create_all(legacy)
            migrations.add_task_project_if_missing(legacy)
            migrations.add_task_project_if_missing(legacy)
            self.assertIn("project_id", {column["name"] for column in inspect(legacy).get_columns("tasks")})
            with Session(legacy) as db:
                old = db.get(models.Task, 1)
                self.assertEqual(old.title, "Existing task")
                self.assertIsNone(old.project_id)
        finally:
            legacy.dispose()


if __name__ == "__main__":
    unittest.main()
