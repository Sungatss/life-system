import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app import crud, main, models, schemas
from backend.app.database import Base


class SubtaskTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_create_update_delete_and_parent_cascade(self):
        with Session(self.engine) as db:
            task = crud.create_task(db, schemas.TaskCreate(
                title="Build portfolio",
                subtasks=[schemas.SubtaskCreate(title="Design layout"), schemas.SubtaskCreate(title="Write copy")],
            ))
            task_id = task.id
            response = schemas.TaskResponse.model_validate(task)
            self.assertEqual([item.title for item in response.subtasks], ["Design layout", "Write copy"])
            first_id = response.subtasks[0].id
            second_id = response.subtasks[1].id

            updated = crud.update_subtask(db, task_id, first_id, schemas.SubtaskUpdate(completed=True, title="Design pages"))
            self.assertEqual([(item.title, item.completed) for item in updated.subtasks],
                             [("Design pages", True), ("Write copy", False)])
            self.assertFalse(updated.completed)

            updated = crud.delete_subtask(db, task_id, second_id)
            self.assertEqual([item.id for item in updated.subtasks], [first_id])
            self.assertIsNone(crud.update_subtask(db, task_id, second_id, schemas.SubtaskUpdate(completed=True)))

        with Session(self.engine) as db:
            task = crud.get_task(db, task_id)
            self.assertEqual(len(task.subtasks), 1)
            self.assertTrue(task.subtasks[0].completed)
            self.assertTrue(crud.delete_task(db, task_id))
            self.assertEqual(db.query(models.Subtask).count(), 0)

    def test_add_step_and_reject_blank_titles(self):
        with Session(self.engine) as db:
            task = crud.create_task(db, schemas.TaskCreate(title="Main task"))
            updated = main.create_new_subtask(task.id, schemas.SubtaskCreate(title="  First step  "), db)
            self.assertEqual([item.title for item in updated.subtasks], ["First step"])

            with self.assertRaises(HTTPException) as error:
                main.create_new_subtask(task.id, schemas.SubtaskCreate(title="  "), db)
            self.assertEqual(error.exception.status_code, 400)

            with self.assertRaises(HTTPException) as error:
                main.update_subtask_item(task.id, updated.subtasks[0].id, schemas.SubtaskUpdate(title=""), db)
            self.assertEqual(error.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
