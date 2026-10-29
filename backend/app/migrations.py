from contextlib import contextmanager
import datetime as dt
import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import func, inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from . import models


PROJECTS_TO_GOALS_MIGRATION = "copy_projects_to_goals_2026_10_22"
FINANCE_DASHBOARD_MIGRATION = "finance_dashboard_2026_10_29"


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


def upgrade_finance_dashboard(bind):
    """Only add columns; keep every ledger row and original amount intact."""
    additions = {
        "finance_transactions": {
            "description": "TEXT NOT NULL DEFAULT ''",
            "schedule_item_id": "INTEGER REFERENCES finance_schedule_items(id) ON DELETE RESTRICT",
            "income_source_id": "INTEGER REFERENCES finance_income_sources(id) ON DELETE RESTRICT",
            "income_period": "VARCHAR(7)", "bill_month": "VARCHAR(7)",
        },
        "finance_budget_items": {
            "month": "VARCHAR(7)", "category": "VARCHAR(100) NOT NULL DEFAULT ''",
            "allocation": "VARCHAR(16) NOT NULL DEFAULT 'living'",
        },
        "finance_obligations": {
            "historical_paid_minor": "BIGINT NOT NULL DEFAULT 0",
            "recurrence": "VARCHAR(16)", "terms": "TEXT NOT NULL DEFAULT ''",
        },
    }
    with _transaction(bind) as connection:
        for table, fields in additions.items():
            columns = {column["name"] for column in inspect(connection).get_columns(table)}
            for field, definition in fields.items():
                if field not in columns:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {field} {definition}"))
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            if db.get(models.DataMigration, FINANCE_DASHBOARD_MIGRATION):
                return
            month = dt.datetime.now(ZoneInfo("Asia/Almaty")).strftime("%Y-%m")
            # Old budgets were timeless. Preserve their values in the upgrade month.
            db.query(models.FinanceBudgetItem).filter_by(month=None).update({"month": month})
            db.add(models.DataMigration(name=FINANCE_DASHBOARD_MIGRATION))
            db.commit()


def seed_finance_data_once(bind, payload=None):
    """Personal seed values are private data, never part of the public source tree.

    Local installs read the ignored data/finance-initial.json; hosted installs can
    provide FINANCE_INITIAL_JSON as a private environment variable. An absent
    payload leaves the ledger empty and does not consume the one-time marker.
    """
    from .finance import IncomeSourceInput, ObligationInput

    marker = "finance_private_initial_data_v1"
    if payload is None:
        raw = os.getenv("FINANCE_INITIAL_JSON", "")
        path = Path(__file__).resolve().parents[2] / "data" / "finance-initial.json"
        if not raw and path.is_file():
            raw = path.read_text()
        if not raw:
            return
        try:
            payload = json.loads(raw)
        except (ValueError, TypeError):
            raise ValueError("Initial finance data must be valid JSON") from None
    try:
        currency = payload.get("currency", "KZT")
        if currency != "KZT":
            raise ValueError("Initial finance data must use KZT")
        obligations = [ObligationInput.model_validate(row) for row in payload.get("obligations", [])]
        sources = [IncomeSourceInput.model_validate(row) for row in payload.get("income_sources", [])]
    except Exception:
        # Startup logs must not echo private payloads from validation exceptions.
        raise ValueError("Initial finance data is invalid; check obligation totals and income fields") from None
    with _transaction(bind) as connection:
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            if db.get(models.DataMigration, marker):
                return
            settings = db.get(models.FinanceSettings, 1)
            if settings is None or settings.currency == currency:
                for item in obligations:
                    if db.query(models.FinanceObligation.id).filter(
                        func.lower(models.FinanceObligation.title) == item.title.lower()).first():
                        continue
                    row = models.FinanceObligation(**item.model_dump(mode="json", exclude={"schedule"}),
                        remaining_minor=item.initial_minor - item.historical_paid_minor)
                    db.add(row)
                    db.flush()
                    for part in item.schedule:
                        db.add(models.FinanceScheduleItem(obligation_id=row.id,
                            **part.model_dump(mode="json", exclude={"id"})))
                for item in sources:
                    if not db.query(models.FinanceIncomeSource.id).filter(
                        func.lower(models.FinanceIncomeSource.title) == item.title.lower()).first():
                        db.add(models.FinanceIncomeSource(**item.model_dump(mode="json")))
            db.add(models.DataMigration(name=marker))
            db.commit()


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
