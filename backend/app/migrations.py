from sqlalchemy import inspect, text


def add_task_description_if_missing(engine):
    """Keep existing task rows usable after adding optional descriptions."""
    columns = {column["name"] for column in inspect(engine).get_columns("tasks")}
    if "description" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT ''"))


def add_task_project_if_missing(engine):
    """Link existing tasks to projects without changing their current data."""
    columns = {column["name"] for column in inspect(engine).get_columns("tasks")}
    if "project_id" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_project_id ON tasks (project_id)"))
