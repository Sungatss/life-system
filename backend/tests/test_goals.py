import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app import main, migrations, models, schemas
from backend.app.database import Base


class GoalTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_areas_goals_plans_are_separate_from_tasks(self):
        with Session(self.engine) as db:
            area = main.create_goal_area(schemas.GoalAreaCreate(name=" Health "), db)
            second = main.create_goal_area(schemas.GoalAreaCreate(name="Learning"), db)
            goal = main.create_goal(schemas.GoalCreate(area_id=area.id, name=" Run regularly ", plan="Start twice weekly"), db)
            self.assertEqual((goal.name, goal.plan, goal.area_id), ("Run regularly", "Start twice weekly", area.id))
            self.assertEqual(db.query(models.Task).count(), 0)

            updated = main.update_goal(goal.id, schemas.GoalCreate(area_id=second.id, name="Read", plan="One book a month"), db)
            self.assertEqual((updated.name, updated.plan, updated.area_id), ("Read", "One book a month", second.id))
            main.delete_goal_area(area.id, db)
            self.assertEqual([item.name for item in main.read_goals(db)], ["Read"])
            main.delete_goal_area(second.id, db)
            self.assertEqual(main.read_goals(db), [])

    def test_rejects_blank_duplicate_and_missing_area(self):
        with Session(self.engine) as db:
            area = main.create_goal_area(schemas.GoalAreaCreate(name="Work"), db)
            for name, expected in [(" work ", 409), (" ", 400)]:
                with self.assertRaises(HTTPException) as raised:
                    main.create_goal_area(schemas.GoalAreaCreate(name=name), db)
                self.assertEqual(raised.exception.status_code, expected)
            for goal in [schemas.GoalCreate(area_id=999, name="Plan"), schemas.GoalCreate(area_id=area.id, name=" ")]:
                with self.assertRaises(HTTPException):
                    main.create_goal(goal, db)

    def test_project_copy_preserves_projects_tasks_and_existing_goals(self):
        with Session(self.engine) as db:
            first = models.Project(name="Exams", plan="Study\nPractice")
            second = models.Project(name="Health", plan="Walk daily")
            third = models.Project(name="Learning", plan="Read weekly")
            db.add_all([first, second, third])
            db.flush()
            task = models.Task(title="Revision", project_id=first.id)
            health = models.GoalArea(name="Health")
            learning = models.GoalArea(name="Learning")
            db.add_all([task, health, learning])
            db.flush()
            db.add_all([
                models.Goal(area_id=health.id, name="Health", plan="Walk daily"),
                models.Goal(area_id=learning.id, name="Learning", plan="Existing plan"),
            ])
            db.commit()
            project_ids = [first.id, second.id, third.id]
            task_id = task.id

        self.assertEqual(migrations.copy_projects_to_goals_once(self.engine), (3, 1, 2))
        with Session(self.engine) as db:
            self.assertEqual(db.query(models.Project).count(), 3)
            self.assertEqual(db.get(models.Task, task_id).project_id, project_ids[0])
            self.assertEqual(db.query(models.GoalArea).count(), 3)
            self.assertEqual(
                sorted((area.name, goal.name, goal.plan) for goal in db.query(models.Goal).all() for area in [goal.area]),
                sorted([
                    ("Exams", "Exams", "Study\nPractice"),
                    ("Health", "Health", "Walk daily"),
                    ("Learning", "Learning", "Existing plan"),
                    ("Learning", "Learning", "Read weekly"),
                ]),
            )
            db.get(models.Project, project_ids[0]).plan = "Later change"
            db.commit()

        self.assertIsNone(migrations.copy_projects_to_goals_once(self.engine))
        with Session(self.engine) as db:
            self.assertEqual(db.query(models.Goal).count(), 4)
            self.assertEqual(db.query(models.DataMigration).count(), 1)


if __name__ == "__main__":
    unittest.main()
