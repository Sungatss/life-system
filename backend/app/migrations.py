from contextlib import contextmanager

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


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
