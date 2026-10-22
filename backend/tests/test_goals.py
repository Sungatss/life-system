import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app import main, models, schemas
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


if __name__ == "__main__":
    unittest.main()
