"""Dashboard arithmetic, receipts, bills, and additive upgrade regression checks."""
import datetime as dt
import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app import finance, migrations, models
from backend.app.database import Base, get_db

TODAY = dt.date(2026, 10, 29)


def seed_fixture():
    """Synthetic examples only; personal seed values stay in ignored local data."""
    return {'currency': 'KZT', 'obligations': [
        {'title': 'Starter loan', 'kind': 'debt', 'initial_minor': 500000},
        {'title': 'Device plan', 'kind': 'debt', 'initial_minor': 500000, 'recurrence': 'monthly',
         'schedule': [{'label': f'Payment {i + 1}', 'amount_minor': 125000} for i in range(4)]},
        {'title': 'Store plan', 'kind': 'debt', 'initial_minor': 1500000,
         'schedule': [{'label': f'Payment {i + 1}', 'amount_minor': (i + 1) * 100000} for i in range(5)]},
        {'title': 'Connectivity', 'kind': 'bill', 'initial_minor': 50000, 'recurrence': 'monthly'},
        {'title': 'Study fees', 'kind': 'tuition', 'initial_minor': 10000000, 'historical_paid_minor': 2000000},
    ], 'income_sources': [{'title': 'Monthly employment', 'amount_minor': 9000000,
                          'frequency': 'monthly', 'arrival_note': 'End of month'}]}


class FinanceDashboardTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.clock = patch('backend.app.finance.finance_today', return_value=TODAY)
        self.clock.start()

    def tearDown(self):
        self.clock.stop()
        self.db.close()
        self.engine.dispose()

    def summary(self, month='2026-10'):
        self.db.expire_all()
        return finance.overview(month, TODAY, self.db)

    def seed(self):
        migrations.upgrade_finance_dashboard(self.engine)
        migrations.seed_finance_data_once(self.engine, seed_fixture())
        self.db.expire_all()

    def obligation(self, **kwargs):
        return finance.create_obligation(finance.ObligationInput(
            **{'title': 'Loan', 'kind': 'debt', 'initial_minor': 10000, **kwargs}), self.db)

    def transaction(self, kind='expense', amount=1000, **kwargs):
        return finance.create_transaction(finance.TransactionInput(**{
            'title': 'Entry', 'date': '2026-10-17', 'kind': kind, 'amount_minor': amount,
            'classification': 'essential' if kind == 'expense' else None, **kwargs}), self.db)

    def budget(self, amount=2000, **kwargs):
        return finance.create_budget_item(finance.BudgetInput(**{
            'title': 'Groceries', 'category': 'Groceries', 'amount_minor': amount,
            'month': '2026-10', 'classification': 'essential', **kwargs}), self.db)

    def pay(self, obligation, amount, **kwargs):
        return finance.pay_obligation(obligation.id, finance.PaymentInput(**{
            'date': '2026-10-17', 'amount_minor': amount, **kwargs}), self.db)

    def test_seeded_values_are_exact_idempotent_and_do_not_change_cash(self):
        self.seed()
        self.seed()
        summary = self.summary()
        self.assertEqual(len(summary['obligations']), 5)
        self.assertEqual(len(summary['income_sources']), 1)
        self.assertEqual(self.db.query(models.FinanceTransaction).count(), 0)
        self.assertEqual(summary['balances_minor']['cash'], 0)
        rows = {o['title']: o for o in summary['obligations']}
        self.assertEqual(rows['Study fees']['remaining_minor'], 8000000)
        self.assertEqual(rows['Study fees']['historical_paid_minor'], 2000000)
        self.assertEqual(rows['Device plan']['remaining_minor'], 500000)
        self.assertEqual([p['amount_minor'] for p in rows['Store plan']['schedule']],
                         [100000, 200000, 300000, 400000, 500000])
        self.assertEqual(sum(o['remaining_minor'] for o in summary['obligations'] if o['kind'] == 'debt'), 2500000)
        self.assertEqual(rows['Connectivity']['kind'], 'bill')
        self.assertTrue(all(not p['due_date'] for p in summary['schedule']))
        self.assertTrue(all(not o['terms'] for o in summary['obligations']))
        self.assertEqual(summary['income_sources'][0]['received_minor'], 0)
        self.assertEqual(summary['budget']['expected_income_minor'], 9000000)
        self.assertEqual(summary['reserved_minor'], 10550000)

    def test_deleting_or_editing_seeded_data_does_not_reseed(self):
        self.seed()
        row = self.db.query(models.FinanceObligation).filter_by(title='Starter loan').one()
        finance.update_obligation(row.id, finance.ObligationInput(title='Edited loan', kind='debt', initial_minor=70000), self.db)
        source = self.db.query(models.FinanceIncomeSource).one()
        finance.delete_income_source(source.id, self.db)
        self.seed()
        self.assertEqual(self.db.query(models.FinanceIncomeSource).count(), 0)
        self.assertEqual(self.db.get(models.FinanceObligation, row.id).initial_minor, 70000)

    def test_seed_does_not_overwrite_matching_existing_obligation(self):
        row = self.obligation(title='Starter loan', initial_minor=9000)
        self.seed()
        self.assertEqual(self.db.query(models.FinanceObligation).filter_by(title='Starter loan').count(), 1)
        self.assertEqual(self.db.get(models.FinanceObligation, row.id).remaining_minor, 9000)

    def test_existing_foreign_currency_is_never_relabelled_or_mixed(self):
        finance.update_settings(finance.SettingsInput(currency='USD', opening_cash_minor=12345), self.db)
        self.seed()
        summary = self.summary()
        self.assertEqual(summary['settings']['currency'], 'USD')
        self.assertEqual(summary['balances_minor']['cash'], 12345)
        self.assertEqual(summary['obligations'], [])
        self.assertEqual(summary['income_sources'], [])

    def test_expected_income_receipt_is_explicit_unique_editable_and_reversible(self):
        self.seed()
        source = self.db.query(models.FinanceIncomeSource).one()
        payload = finance.IncomeReceiptInput(date='2026-10-29', period='2026-10', amount_minor=9000000)
        received = finance.receive_income(source.id, payload, self.db)
        self.assertEqual(self.summary()['balances_minor']['cash'], 9000000)
        self.assertEqual(self.summary()['income_sources'][0]['received_minor'], 9000000)
        with self.assertRaises(HTTPException) as error:
            finance.receive_income(source.id, payload, self.db)
        self.assertEqual(error.exception.status_code, 409)
        finance.update_transaction(received.id, finance.TransactionInput(date='2026-10-29', kind='income',
            title=source.title, amount_minor=8000000), self.db)
        self.assertEqual(self.summary()['balances_minor']['cash'], 8000000)
        self.assertEqual(self.summary()['income_sources'][0]['received_minor'], 8000000)
        self.assertEqual(self.summary('2026-11')['income_sources'][0]['received_minor'], 0)
        finance.delete_transaction(received.id, self.db)
        self.assertEqual(self.summary()['balances_minor']['cash'], 0)
        self.assertEqual(self.summary()['income_sources'][0]['received_minor'], 0)
        finance.receive_income(source.id, payload, self.db)
        self.assertEqual(self.db.query(models.FinanceTransaction).count(), 1)

    def test_one_time_receipts_cannot_repeat_in_another_month(self):
        source = finance.create_income_source(finance.IncomeSourceInput(title='Grant', amount_minor=10000, frequency='one_time'), self.db)
        finance.receive_income(source['id'], finance.IncomeReceiptInput(date='2026-10-29', period='2026-10', amount_minor=10000), self.db)
        with self.assertRaises(HTTPException):
            finance.receive_income(source['id'], finance.IncomeReceiptInput(date='2026-10-29', period='2026-09', amount_minor=10000), self.db)
        self.assertEqual(self.summary('2026-11')['budget']['expected_income_minor'], 0)

    def test_historical_tuition_changes_never_affect_cash(self):
        row = self.obligation(kind='tuition', initial_minor=10000000, historical_paid_minor=2000000)
        self.assertEqual(row.remaining_minor, 8000000)
        self.pay(row, 1000000)
        finance.update_obligation(row.id, finance.ObligationInput(title='Tuition', kind='tuition',
            initial_minor=10000000, historical_paid_minor=2500000), self.db)
        self.assertEqual(self.summary()['balances_minor']['cash'], -1000000)
        self.assertEqual(self.db.get(models.FinanceObligation, row.id).remaining_minor, 6500000)

    def test_installment_partial_full_overpayment_and_reversal(self):
        row = self.obligation(schedule=[{'label': 'First', 'amount_minor': 3000}, {'label': 'Second', 'amount_minor': 7000}])
        parts = self.db.query(models.FinanceScheduleItem).filter_by(obligation_id=row.id).all()
        payment = self.pay(row, 1000, schedule_item_id=parts[0].id)
        summary = self.summary()
        self.assertEqual(summary['month']['expenses_minor'], 1000)
        self.assertEqual(summary['month']['obligation_paid_minor'], 1000)
        self.assertEqual(summary['balances_minor']['cash'], -1000)
        self.assertEqual(summary['obligations'][0]['remaining_minor'], 9000)
        self.assertEqual(summary['obligations'][0]['schedule'][0]['remaining_minor'], 2000)
        with self.assertRaises(HTTPException):
            self.pay(row, 2001, schedule_item_id=parts[0].id)
        self.pay(row, 2000, schedule_item_id=parts[0].id)
        self.assertEqual(self.summary()['obligations'][0]['schedule'][0]['status'], 'paid')
        finance.delete_transaction(payment.id, self.db)
        self.assertEqual(self.summary()['obligations'][0]['remaining_minor'], 8000)
        self.assertEqual(self.summary()['obligations'][0]['schedule'][0]['remaining_minor'], 1000)

    def test_installment_must_belong_to_the_correct_debt(self):
        first = self.obligation(schedule=[{'amount_minor': 10000}])
        second = self.obligation(title='Second')
        part = self.db.query(models.FinanceScheduleItem).one()
        with self.assertRaises(HTTPException):
            self.pay(first, 1000)
        with self.assertRaises(HTTPException):
            self.pay(second, 1000, schedule_item_id=part.id)

    def test_paid_installment_cannot_be_removed_or_shrunk(self):
        row = self.obligation(schedule=[{'label': 'First', 'amount_minor': 3000}, {'label': 'Second', 'amount_minor': 7000}])
        part = self.db.query(models.FinanceScheduleItem).first()
        self.pay(row, 2000, schedule_item_id=part.id)
        with self.assertRaises(HTTPException):
            finance.update_obligation(row.id, finance.ObligationInput(title='Loan', kind='debt', initial_minor=10000, schedule=[]), self.db)

    def test_bill_cycles_repeat_from_anchor_and_do_not_become_debt(self):
        bill = self.obligation(title='Data', kind='bill', initial_minor=50000, recurrence='monthly', due_date='2026-08-31')
        summary = self.summary()
        self.assertEqual([p['due_date'] for p in summary['schedule']], ['2026-08-31', '2026-09-30', '2026-10-31'])
        payment = self.pay(bill, 20000, bill_month='2026-09')
        summary = self.summary()
        september = next(p for p in summary['schedule'] if p['bill_month'] == '2026-09')
        self.assertEqual(september['remaining_minor'], 30000)
        self.pay(bill, 30000, bill_month='2026-09')
        self.assertEqual(next(p for p in self.summary()['schedule'] if p['bill_month'] == '2026-09')['status'], 'paid')
        with self.assertRaises(HTTPException):
            self.pay(bill, 1, bill_month='2026-09')
        self.assertEqual(self.summary()['month']['expenses_minor'], 50000)
        finance.delete_transaction(payment.id, self.db)
        self.assertEqual(next(p for p in self.summary()['schedule'] if p['bill_month'] == '2026-09')['remaining_minor'], 20000)
        self.assertEqual(finance.cycle_date('2026-01-31', '2028-02'), '2028-02-29')
        self.assertEqual(finance.cycle_date('2026-01-31', '2026-03'), '2026-03-31')

    def test_undated_bill_reserves_one_month_without_inventing_deadline(self):
        bill = self.obligation(kind='bill', initial_minor=50000, recurrence='monthly')
        summary = self.summary()
        self.assertEqual(len(summary['schedule']), 1)
        self.assertIsNone(summary['schedule'][0]['due_date'])
        self.assertEqual(summary['budget']['minimum_required_minor'], 50000)
        self.pay(bill, 50000, bill_month='2026-10')
        self.assertEqual(self.summary()['reserved_minor'], 0)
        self.assertEqual(self.summary()['budget']['planned_minor'], 50000)
        november = self.summary('2026-11')
        self.assertEqual(november['schedule'][0]['remaining_minor'], 50000)
        self.assertEqual(november['balances_minor']['cash'], -50000)

    def test_budget_is_month_specific_and_spending_is_matched_once(self):
        line = self.budget(amount=5000)
        self.budget(amount=9000, month='2026-11')
        self.transaction(amount=1500, category='groceries')
        summary = self.summary()
        self.assertEqual(summary['budget']['items'][0]['actual_minor'], 1500)
        self.assertEqual(summary['budget']['remaining_minor'], 3500)
        self.assertEqual(self.summary('2026-11')['budget']['planned_minor'], 9000)
        finance.update_budget_item(line.id, finance.BudgetInput(title='Groceries', category='Groceries', amount_minor=6000,
            month='2026-10', classification='essential'), self.db)
        self.assertEqual(self.summary()['budget']['remaining_minor'], 4500)
        finance.delete_budget_item(line.id, self.db)
        self.assertEqual(self.summary()['budget']['actual_minor'], 1500)
        self.assertEqual(self.summary('2026-11')['budget']['planned_minor'], 9000)

    def test_duplicate_category_and_repayment_allocations_are_rejected(self):
        self.budget()
        with self.assertRaises(HTTPException):
            self.budget(title='Another name', category=' GROCERIES ', allocation='other')
        self.budget(title='Debt', category='', allocation='debt')
        with self.assertRaises(HTTPException):
            self.budget(title='Another debt', allocation='debt')
        self.budget(classification='optional')
        self.assertEqual(len(self.summary()['budget']['items']), 3)

    def test_duplicate_legacy_budget_rows_distribute_actual_spending_once(self):
        for _ in range(2):
            self.db.add(models.FinanceBudgetItem(title='Groceries', category='Groceries',
                month='2026-10', amount_minor=2000, classification='essential', allocation='living'))
        self.db.commit()
        self.transaction(amount=2500, category='Groceries')
        summary = self.summary()
        self.assertEqual([item['actual_minor'] for item in summary['budget']['items']], [2000, 500])
        self.assertEqual(summary['budget']['essential_remaining_minor'], 1500)

    def test_deadline_reminders_use_exact_seven_day_boundary_and_keep_unknown_dates(self):
        self.obligation(title='Late', due_date='2026-10-28')
        self.obligation(title='Today', due_date='2026-10-29')
        self.obligation(title='Next week', due_date='2026-11-05')
        self.obligation(title='Later', due_date='2026-11-06')
        self.obligation(title='Unknown')
        statuses = {p['title']: p['status'] for p in self.summary()['schedule']}
        self.assertEqual(statuses, {'Late': 'overdue', 'Today': 'upcoming', 'Next week': 'upcoming',
                                    'Later': 'scheduled', 'Unknown': 'undated'})

    def test_monthly_expected_dates_repeat_without_counting_income_before_first_month(self):
        finance.create_income_source(finance.IncomeSourceInput(title='Salary', amount_minor=9000000,
            expected_date='2026-10-31'), self.db)
        self.assertEqual(self.summary('2026-09')['budget']['expected_income_minor'], 0)
        source = self.summary('2026-11')['income_sources'][0]
        self.assertEqual(source['occurrence_date'], '2026-11-30')
        self.assertEqual(self.summary('2026-11')['balances_minor']['cash'], 0)

    def test_safe_spending_reserves_essentials_and_obligations_without_overlap(self):
        finance.update_settings(finance.SettingsInput(opening_cash_minor=100000), self.db)
        self.budget(amount=20000)
        debt = self.obligation(initial_minor=30000, due_date='2026-10-30')
        self.budget(title='Debt', amount=30000, allocation='debt')
        self.transaction(amount=5000, category='Groceries')
        self.pay(debt, 10000)
        summary = self.summary()
        self.assertEqual(summary['balances_minor']['cash'], 85000)
        self.assertEqual(summary['reserved_minor'], 35000)  # 15000 essentials + 20000 debt
        self.assertEqual(summary['safe_to_spend_minor'], 50000)
        self.assertEqual(summary['budget']['planned_minor'], 50000)
        self.assertEqual(summary['budget']['actual_minor'], 15000)
        self.assertEqual(summary['budget']['minimum_required_minor'], 50000)

    def test_undated_debt_and_debt_allocation_are_reserved_once(self):
        finance.update_settings(finance.SettingsInput(opening_cash_minor=100000), self.db)
        self.obligation(initial_minor=30000)
        self.budget(title='Debt', amount=20000, allocation='debt')
        summary = self.summary()
        self.assertEqual(summary['reserved_minor'], 30000)
        self.assertEqual(summary['safe_to_spend_minor'], 70000)
        self.assertEqual(summary['undated_reserve_minor'], 30000)

    def test_future_month_plan_does_not_change_current_safe_spend(self):
        finance.update_settings(finance.SettingsInput(opening_cash_minor=10000), self.db)
        self.budget(amount=2000)
        self.budget(amount=90000, month='2026-11')
        self.assertEqual(self.summary()['safe_to_spend_minor'], 8000)
        self.assertEqual(self.summary('2026-11')['safe_to_spend_minor'], 8000)
        self.assertEqual(self.summary('2026-11')['budget']['planned_minor'], 90000)

    def test_paid_later_scheduled_amount_stays_in_its_original_month_plan(self):
        row = self.obligation(initial_minor=3000, due_date='2026-09-30')
        self.pay(row, 3000)
        september = self.summary('2026-09')
        self.assertEqual(september['budget']['planned_minor'], 3000)
        self.assertEqual(september['budget']['actual_minor'], 0)
        self.assertEqual(september['budget']['remaining_minor'], 3000)
        self.assertEqual(self.summary()['month']['expenses_minor'], 3000)

    def test_transaction_edit_delete_totals_and_filters_cover_entire_month(self):
        for _ in range(55):
            self.transaction(amount=100, category='Food')
        income = self.transaction(kind='income', amount=9000, category='Salary')
        self.assertEqual(len(finance.list_transactions('2026-10', 0, 50, self.db, kind='income')), 1)
        self.assertEqual(len(finance.list_transactions('2026-10', 50, 50, self.db, category='food')), 5)
        self.assertEqual(self.summary()['month']['categories'], [{'name': 'Food', 'amount_minor': 5500}])
        finance.update_transaction(income.id, finance.TransactionInput(date='2026-10-18', kind='income', title='Salary', amount_minor=10000), self.db)
        self.assertEqual(self.summary()['balances_minor']['cash'], 4500)
        finance.delete_transaction(income.id, self.db)
        self.assertEqual(self.summary()['balances_minor']['cash'], -5500)
        self.assertEqual(len(self.summary()['recent_transactions']), 6)

    def test_future_recorded_money_is_rejected_and_legacy_future_income_is_excluded(self):
        with self.assertRaises(HTTPException):
            self.transaction(kind='income', date='2026-10-30')
        self.db.add(models.FinanceTransaction(kind='income', date='2026-11-01', title='Old future record', amount_minor=9999, account='cash'))
        self.db.commit()
        self.assertEqual(self.summary()['balances_minor']['cash'], 0)
        self.assertEqual(self.summary('2026-11')['month']['income_minor'], 0)

    def test_income_plan_zero_and_overspending_warning_do_not_change_cash(self):
        self.seed()
        finance.save_month_plan('2026-10', finance.MonthPlanInput(expected_income_minor=0), self.db)
        self.assertEqual(self.summary()['budget']['expected_income_minor'], 0)
        self.assertEqual(self.summary()['balances_minor']['cash'], 0)
        self.assertEqual(self.summary()['budget']['over_income_minor'], 50000)
        self.assertEqual(self.summary('2026-11')['budget']['expected_income_minor'], 9000000)

    def test_invalid_schedule_and_historical_paid_are_rejected(self):
        for args in [dict(initial_minor=1000, historical_paid_minor=1001),
                     dict(initial_minor=1000, schedule=[{'amount_minor': 999}]),
                     dict(kind='bill', initial_minor=1000),
                     dict(kind='bill', initial_minor=1000, recurrence='monthly', historical_paid_minor=1)]:
            with self.subTest(args=args), self.assertRaises(ValidationError):
                finance.ObligationInput(**{'title': 'Invalid', 'kind': 'debt', **args})

    def test_http_contract_serializes_new_models_and_validates_input(self):
        app = FastAPI()
        app.include_router(finance.router)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[finance.limit_finance_requests] = lambda: None
        self.seed()
        with TestClient(app) as client:
            overview = client.get('/api/finance/overview', params={'month': '2026-10', 'today': '2026-10-29'})
            self.assertEqual(overview.status_code, 200, overview.text)
            self.assertEqual(overview.json()['income_sources'][0]['arrival_note'], 'End of month')
            debt = client.post('/api/finance/obligations', json={'title': 'Test loan', 'kind': 'debt', 'initial_minor': 1000})
            self.assertEqual(debt.status_code, 201, debt.text)
            payment = client.post(f"/api/finance/obligations/{debt.json()['id']}/payments", json={'amount_minor': 400, 'date': '2026-10-29'})
            self.assertEqual(payment.status_code, 201, payment.text)
            self.assertEqual(client.get('/api/finance/transactions', params={'month': '2026-10', 'kind': 'expense'}).status_code, 200)
            invalid = client.post('/api/finance/transactions', json={'title': 'No amount', 'date': '2026-10-29', 'kind': 'expense', 'amount_minor': -1})
            self.assertEqual(invalid.status_code, 422)
            self.assertEqual(client.put('/api/finance/budget/month/2026-10', json={'expected_income_minor': 5000}).status_code, 200)

    def test_legacy_upgrade_preserves_original_columns_and_rows(self):
        old = create_engine('sqlite:///:memory:')
        legacy_statements = [
            "CREATE TABLE finance_transactions (id INTEGER PRIMARY KEY, date VARCHAR(10), kind VARCHAR(16), title VARCHAR(255), amount_minor BIGINT, category VARCHAR(100), classification VARCHAR(16), account VARCHAR(16), transfer_to VARCHAR(16), obligation_id INTEGER, created_at DATETIME)",
            "CREATE TABLE finance_budget_items (id INTEGER PRIMARY KEY, title VARCHAR(255), amount_minor BIGINT, classification VARCHAR(16))",
            "CREATE TABLE finance_obligations (id INTEGER PRIMARY KEY, title VARCHAR(255), kind VARCHAR(16), initial_minor BIGINT, remaining_minor BIGINT, due_date VARCHAR(10), urgent BOOLEAN, created_at DATETIME)",
            "INSERT INTO finance_transactions VALUES (1, '2026-10-01', 'income', 'Saved salary', 250000, 'Salary', NULL, 'cash', NULL, NULL, '2026-10-01')",
            "INSERT INTO finance_budget_items VALUES (1, 'Saved rent', 100000, 'essential')",
            "INSERT INTO finance_obligations VALUES (1, 'Saved loan', 'debt', 500000, 500000, NULL, 0, '2026-10-01')",
        ]
        try:
            with old.begin() as conn:
                for statement in legacy_statements:
                    conn.execute(text(statement))
                before = {table: (list(conn.execute(text(f'SELECT * FROM {table}')).keys()), conn.execute(text(f'SELECT * FROM {table}')).fetchall()) for table in ['finance_transactions', 'finance_budget_items', 'finance_obligations']}
            Base.metadata.create_all(old)
            migrations.upgrade_finance_dashboard(old)
            migrations.upgrade_finance_dashboard(old)
            with old.connect() as conn:
                for table, (columns, rows) in before.items():
                    after = conn.execute(text(f"SELECT {', '.join(columns)} FROM {table} WHERE id = 1")).fetchall()
                    self.assertEqual(after, rows)
                self.assertIn('income_source_id', {c['name'] for c in inspect(conn).get_columns('finance_transactions')})
        finally:
            old.dispose()


if __name__ == '__main__':
    unittest.main()
