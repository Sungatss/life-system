from contextlib import contextmanager

from sqlalchemy import func, inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from . import models


PROJECTS_TO_GOALS_MIGRATION = "copy_projects_to_goals_2026_10_22"


@contextmanager
def _transaction(bind):
    if isinstance(bind, Connection):
        yield bind
    else:
        with bind.begin() as connection:
            yield connection


def drop_daily_notes_if_present(engine):
    """Remove the retired daily-note feature and its stored records."""
    if inspect(engine).has_table("daily_notes"):
        with _transaction(engine) as connection:
            connection.execute(text("DROP TABLE daily_notes"))


def add_task_description_if_missing(engine):
    """Keep existing task rows usable after adding optional descriptions."""
    columns = {column["name"] for column in inspect(engine).get_columns("tasks")}
    if "description" not in columns:
        with _transaction(engine) as connection:
            connection.execute(text("ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT ''"))


def add_task_project_if_missing(engine):
    """Link existing tasks to projects without changing their current data."""
    columns = {column["name"] for column in inspect(engine).get_columns("tasks")}
    if "project_id" not in columns:
        with _transaction(engine) as connection:
            connection.execute(text("ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_project_id ON tasks (project_id)"))


def add_user_bio_if_missing(engine):
    """Preserve existing profile rows when adding the optional bio."""
    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    if "bio" not in columns:
        with _transaction(engine) as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''"))


def add_finance_buffer_target_if_missing(engine):
    """Preserve existing finance settings when adding the first-buffer goal."""
    if not inspect(engine).has_table("finance_settings"):
        return
    columns = {column["name"] for column in inspect(engine).get_columns("finance_settings")}
    if "emergency_buffer_target_minor" not in columns:
        with _transaction(engine) as connection:
            connection.execute(text(
                "ALTER TABLE finance_settings ADD COLUMN emergency_buffer_target_minor BIGINT NOT NULL DEFAULT 0"
            ))


def copy_projects_to_goals_once(bind):
    """Copy saved project names and plans into Goals without changing projects or tasks.

    The marker and copies commit together. Reusing an exact matching goal avoids
    duplicates; a same-name goal with a different plan is kept and gets a
    separate copy so neither plan is overwritten.
    """
    with _transaction(bind) as connection:
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            if db.get(models.DataMigration, PROJECTS_TO_GOALS_MIGRATION):
                return None

            new_areas = 0
            new_goals = 0
            projects = db.query(models.Project).order_by(models.Project.id).all()
            for project in projects:
                area = db.query(models.GoalArea).filter(
                    func.lower(models.GoalArea.name) == project.name.lower()
                ).order_by(models.GoalArea.id).first()
                if area is None:
                    area = models.GoalArea(name=project.name, created_at=project.created_at)
                    db.add(area)
                    db.flush()
                    new_areas += 1

                matching_goal = db.query(models.Goal).filter(
                    models.Goal.area_id == area.id,
                    func.lower(models.Goal.name) == project.name.lower(),
                    models.Goal.plan == project.plan,
                ).first()
                if matching_goal is None:
                    db.add(models.Goal(
                        area_id=area.id,
                        name=project.name,
                        plan=project.plan,
                        created_at=project.created_at,
                        updated_at=project.updated_at,
                    ))
                    new_goals += 1

            db.add(models.DataMigration(name=PROJECTS_TO_GOALS_MIGRATION))
            db.commit()
            return len(projects), new_areas, new_goals
