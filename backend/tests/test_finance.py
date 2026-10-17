"""Finance calculations and ledger safeguards use an isolated database."""

import datetime as dt
import unittest

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from backend.app import auth, finance, migrations, models
from backend.app.database import Base


class FinanceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def transaction(self, kind, amount, title, **kwargs):
        payload = finance.TransactionInput(date="2026-10-17", kind=kind, title=title,
                                           amount_minor=amount, **kwargs)
        return finance.create_transaction(payload, self.db)

    def test_balances_budget_week_review_and_optional_spending(self):
        finance.update_settings(finance.SettingsInput(opening_cash_minor=100000,
                                                       opening_emergency_minor=20000), self.db)
        finance.create_budget_item(finance.BudgetInput(title="Rent", amount_minor=60000,
                                                       classification="essential"), self.db)
        finance.create_budget_item(finance.BudgetInput(title="Food", amount_minor=20000,
                                                       classification="essential"), self.db)
        finance.create_budget_item(finance.BudgetInput(title="Entertainment", amount_minor=10000,
                                                       classification="optional"), self.db)
        self.transaction("income", 80000, "Salary")
        self.transaction("expense", 15000, "Groceries", classification="essential", category="Food")
        self.transaction("expense", 5000, "Cinema", classification="optional", category="Entertainment")
        self.transaction("transfer", 10000, "Buffer", account="cash", transfer_to="emergency")
        self.transaction("transfer", 2000, "Invest", account="cash", transfer_to="investment")
        finance.save_weekly_review(dt.date(2026, 10, 12), finance.ReviewInput(
            wins="Logged everything", spending_to_cut="Cinema", next_action="Review bills"), self.db)

        result = finance.overview("2026-10", dt.date(2026, 10, 17), self.db)
        self.assertEqual(result["balances_minor"], {"cash": 148000, "emergency": 30000, "investment": 2000})
        self.assertEqual(result["minimum_monthly_minor"], 80000)
        self.assertEqual(result["optional_plan_minor"], 10000)
        self.assertEqual(result["runway_months"], 2.2)
        self.assertEqual(result["month"]["optional_categories"], [{"name": "Entertainment", "amount_minor": 5000}])
        self.assertEqual((result["week"]["income_minor"], result["week"]["essential_minor"],
                          result["week"]["optional_minor"]), (80000, 15000, 5000))
        self.assertEqual(result["week"]["review"]["next_action"], "Review bills")
        self.assertEqual(len(finance.list_transactions("2026-10", 0, 50, self.db)), 5)

    def test_obligation_payment_is_atomic_and_reversible(self):
        obligation = finance.create_obligation(finance.ObligationInput(
            title="Tuition", kind="tuition", initial_minor=100000,
            due_date="2026-10-21", urgent=True), self.db)
        payment = finance.pay_obligation(obligation.id, finance.PaymentInput(
            amount_minor=30000, date="2026-10-17"), self.db)
        self.assertEqual(self.db.get(models.FinanceObligation, obligation.id).remaining_minor, 70000)
        self.assertEqual(payment.classification, "essential")
        with self.assertRaises(HTTPException) as too_much:
            finance.pay_obligation(obligation.id, finance.PaymentInput(
                amount_minor=70001, date="2026-10-17"), self.db)
        self.assertEqual(too_much.exception.status_code, 409)
        with self.assertRaises(HTTPException):
            finance.update_transaction(payment.id, finance.TransactionInput(
                date="2026-10-17", kind="expense", title="Changed", amount_minor=1,
                classification="essential"), self.db)
        with self.assertRaises(HTTPException):
            finance.delete_obligation(obligation.id, self.db)
        finance.delete_transaction(payment.id, self.db)
        self.assertEqual(self.db.get(models.FinanceObligation, obligation.id).remaining_minor, 100000)
        finance.delete_obligation(obligation.id, self.db)

    def test_validation_and_currency_lock(self):
        for kwargs in [
            {"kind": "expense", "classification": None},
            {"kind": "transfer", "transfer_to": "cash"},
            {"kind": "income", "account": "investment"},
        ]:
            with self.assertRaises(ValidationError):
                finance.TransactionInput(date="2026-10-17", title="Entry", amount_minor=100,
                                         **kwargs)
        finance.update_settings(finance.SettingsInput(currency="USD"), self.db)
        self.transaction("income", 100, "First income")
        with self.assertRaises(HTTPException) as changed:
            finance.update_settings(finance.SettingsInput(currency="KZT"), self.db)
        self.assertEqual(changed.exception.status_code, 409)
        self.assertEqual(finance.settings_data(self.db)["currency"], "USD")

    def test_currency_cannot_relabel_existing_entries_without_settings_row(self):
        self.transaction("income", 100, "First income")
        with self.assertRaises(HTTPException) as changed:
            finance.update_settings(finance.SettingsInput(currency="USD"), self.db)
        self.assertEqual(changed.exception.status_code, 409)
        self.assertEqual(finance.settings_data(self.db)["currency"], "KZT")

    def test_finance_rate_limit_is_independent_of_assistant_quota(self):
        with auth._lock:
            auth._finance_minute.clear()
        for _ in range(120):
            auth.finance_limit()
        with self.assertRaises(HTTPException) as limited:
            auth.finance_limit()
        self.assertEqual(limited.exception.status_code, 429)
        with auth._lock:
            auth._finance_minute.clear()

    def test_additive_tables_preserve_saved_tasks(self):
        old = create_engine("sqlite:///:memory:")
        try:
            Base.metadata.create_all(old, tables=[table for table in Base.metadata.sorted_tables
                                                  if not table.name.startswith("finance_")])
            with Session(old) as db:
                db.add(models.Task(title="Existing task"))
                db.commit()
            Base.metadata.create_all(old)
            self.assertIn("finance_transactions", inspect(old).get_table_names())
            with Session(old) as db:
                self.assertEqual(db.query(models.Task).one().title, "Existing task")
        finally:
            old.dispose()

    def test_existing_finance_settings_keep_balances_when_buffer_goal_is_added(self):
        old = create_engine("sqlite:///:memory:")
        try:
            with old.begin() as connection:
                connection.execute(text("CREATE TABLE finance_settings (id INTEGER PRIMARY KEY, currency VARCHAR(3) NOT NULL, opening_cash_minor BIGINT NOT NULL, opening_emergency_minor BIGINT NOT NULL, opening_investment_minor BIGINT NOT NULL, runway_target_months INTEGER NOT NULL)"))
                connection.execute(text("INSERT INTO finance_settings VALUES (1, 'KZT', 100000, 20000, 5000, 3)"))
            Base.metadata.create_all(old)
            migrations.add_finance_buffer_target_if_missing(old)
            migrations.add_finance_buffer_target_if_missing(old)
            with Session(old) as db:
                settings = db.get(models.FinanceSettings, 1)
                self.assertEqual((settings.opening_cash_minor, settings.opening_emergency_minor,
                                  settings.opening_investment_minor, settings.emergency_buffer_target_minor),
                                 (100000, 20000, 5000, 0))
        finally:
            old.dispose()


if __name__ == "__main__":
    unittest.main()
