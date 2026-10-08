from sqlalchemy import inspect, text


def add_task_description_if_missing(engine):
    """Keep existing task rows usable after adding optional descriptions."""
    columns = {column["name"] for column in inspect(engine).get_columns("tasks")}
    if "description" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT ''"))
