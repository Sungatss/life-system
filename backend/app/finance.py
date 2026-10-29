"""Single-currency personal finance ledger. Amounts are integer minor units."""

import datetime as dt
import calendar
from typing import Literal
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import auth, models
from .database import get_db


def limit_finance_requests(db: Session = Depends(get_db)):
    auth.finance_limit(db)


router = APIRouter(prefix="/api/finance", tags=["finance"], dependencies=[Depends(limit_finance_requests)])
MAX_MINOR = 10**13
Account = Literal["cash", "emergency", "investment"]
Classification = Literal["essential", "optional"]


def clean_title(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Title cannot be empty")
    return cleaned


class SettingsInput(BaseModel):
    currency: Literal["KZT", "USD", "EUR"] = "KZT"
    opening_cash_minor: int = Field(default=0, ge=-MAX_MINOR, le=MAX_MINOR)
    opening_emergency_minor: int = Field(default=0, ge=0, le=MAX_MINOR)
    opening_investment_minor: int = Field(default=0, ge=0, le=MAX_MINOR)
    emergency_buffer_target_minor: int = Field(default=0, ge=0, le=MAX_MINOR)
    runway_target_months: int = Field(default=3, ge=1, le=24)


class TransactionInput(BaseModel):
    date: dt.date
    kind: Literal["income", "expense", "transfer"]
    title: str = Field(..., min_length=1, max_length=255)
    amount_minor: int = Field(..., gt=0, le=MAX_MINOR)
    category: str = Field(default="", max_length=100)
    classification: Classification | None = None
    account: Account = "cash"
    transfer_to: Account | None = None
    description: str = Field(default="", max_length=2000)

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        return clean_title(value)

    @model_validator(mode="after")
    def valid_entry(self):
        self.category = self.category.strip()
        if self.kind == "expense":
            if self.classification is None or self.transfer_to is not None or self.account == "investment":
                raise ValueError("Expenses need an essential or optional label and a cash or emergency account")
        elif self.kind == "income":
            if self.classification is not None or self.transfer_to is not None or self.account == "investment":
                raise ValueError("Income goes to cash or emergency and has no spending label")
        elif self.transfer_to is None or self.transfer_to == self.account or self.classification is not None:
            raise ValueError("Choose two different accounts for a transfer")
        return self


class TransactionResponse(TransactionInput):
    id: int
    obligation_id: int | None = None
    schedule_item_id: int | None = None
    income_source_id: int | None = None
    income_period: str | None = None
    bill_month: str | None = None
    created_at: dt.datetime
    model_config = ConfigDict(from_attributes=True)


class BudgetInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    amount_minor: int = Field(..., gt=0, le=MAX_MINOR)
    classification: Classification
    month: str | None = Field(default=None, pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$")
    category: str = Field(default="", max_length=100)
    allocation: Literal["living", "debt", "tuition", "bill", "other"] = "living"

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        return clean_title(value)


class BudgetResponse(BudgetInput):
    id: int
    model_config = ConfigDict(from_attributes=True)


class PurchasePlanInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    estimated_minor: int = Field(..., gt=0, le=MAX_MINOR)
    image_url: str = Field(default="", max_length=2048)
    product_url: str = Field(default="", max_length=2048)
    notes: str = Field(default="", max_length=2000)
    target_date: dt.date | None = None

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        return clean_title(value)

    @field_validator("image_url", "product_url")
    @classmethod
    def web_url_only(cls, value: str) -> str:
        cleaned = value.strip()
        if cleaned:
            parsed = urlsplit(cleaned)
            if (parsed.scheme not in ("http", "https") or not parsed.hostname
                    or parsed.username is not None or parsed.password is not None
                    or any(character.isspace() for character in cleaned)):
                raise ValueError("Use an http or https URL without credentials")
        return cleaned

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: str) -> str:
        return value.strip()


class PurchasePlanResponse(PurchasePlanInput):
    id: int
    purchased: bool
    created_at: dt.datetime
    updated_at: dt.datetime
    model_config = ConfigDict(from_attributes=True)


class PurchaseStatusInput(BaseModel):
    purchased: bool


class ScheduleInput(BaseModel):
    id: int | None = None
    label: str = Field(default="Payment", min_length=1, max_length=100)
    amount_minor: int = Field(..., gt=0, le=MAX_MINOR)
    due_date: dt.date | None = None


class ObligationInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    kind: Literal["debt", "tuition", "bill", "other"]
    initial_minor: int = Field(..., gt=0, le=MAX_MINOR)
    due_date: dt.date | None = None
    urgent: bool = False
    historical_paid_minor: int = Field(default=0, ge=0, le=MAX_MINOR)
    recurrence: Literal["monthly"] | None = None
    terms: str = Field(default="", max_length=2000)
    schedule: list[ScheduleInput] = Field(default_factory=list, max_length=240)

    @model_validator(mode="after")
    def valid_schedule(self):
        if self.historical_paid_minor > self.initial_minor:
            raise ValueError("Historical payments exceed the total")
        if self.kind == "bill" and (self.recurrence != "monthly" or self.schedule or self.historical_paid_minor):
            raise ValueError("Monthly bills use an amount per cycle, without installments or historical debt")
        if self.schedule and sum(item.amount_minor for item in self.schedule) != self.initial_minor - self.historical_paid_minor:
            raise ValueError("Installments must total the original amount less historical payments")
        ids = [item.id for item in self.schedule if item.id is not None]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate installment")
        return self

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        return clean_title(value)


class ObligationResponse(ObligationInput):
    id: int
    remaining_minor: int
    created_at: dt.datetime
    model_config = ConfigDict(from_attributes=True)


class PaymentInput(BaseModel):
    amount_minor: int = Field(..., gt=0, le=MAX_MINOR)
    date: dt.date
    account: Literal["cash", "emergency"] = "cash"
    schedule_item_id: int | None = None
    bill_month: str | None = Field(default=None, pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$")


class IncomeSourceInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    amount_minor: int = Field(..., gt=0, le=MAX_MINOR)
    frequency: Literal["monthly", "one_time"] = "monthly"
    expected_date: dt.date | None = None
    arrival_note: str = Field(default="", max_length=255)
    active: bool = True

    @field_validator("title")
    @classmethod
    def title_required(cls, value):
        return clean_title(value)


class IncomeReceiptInput(BaseModel):
    date: dt.date
    period: str = Field(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$")
    amount_minor: int = Field(..., gt=0, le=MAX_MINOR)


class MonthPlanInput(BaseModel):
    expected_income_minor: int = Field(default=0, ge=0, le=MAX_MINOR)


class ReviewInput(BaseModel):
    wins: str = Field(default="", max_length=5000)
    spending_to_cut: str = Field(default="", max_length=5000)
    next_action: str = Field(default="", max_length=5000)


def default_settings() -> dict:
    return SettingsInput().model_dump()


def settings_data(db: Session) -> dict:
    row = db.get(models.FinanceSettings, 1)
    if row is None:
        return default_settings()
    return {field: getattr(row, field) for field in SettingsInput.model_fields}


def require_row(db: Session, model, row_id: int):
    row = db.get(model, row_id)
    if row is None:
        raise HTTPException(404, "Finance item not found")
    return row


def month_bounds(month: str) -> tuple[str, str]:
    try:
        first = dt.date.fromisoformat(month + "-01")
    except ValueError:
        raise HTTPException(400, "Month must be YYYY-MM") from None
    if first.year < 1900 or first.year > 2100:
        raise HTTPException(400, "Month is outside the supported range")
    following = (first.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    return first.isoformat(), (following - dt.timedelta(days=1)).isoformat()


def add_to_balances(balances: dict[str, int], item: models.FinanceTransaction):
    if item.kind == "income":
        balances[item.account] += item.amount_minor
    elif item.kind == "expense":
        balances[item.account] -= item.amount_minor
    else:
        balances[item.account] -= item.amount_minor
        balances[item.transfer_to] += item.amount_minor


def summarize(items: list[models.FinanceTransaction]) -> dict:
    result = {"income_minor": 0, "essential_minor": 0, "optional_minor": 0,
              "obligation_paid_minor": 0, "emergency_added_minor": 0, "investment_added_minor": 0}
    optional_categories: dict[str, int] = {}
    categories: dict[str, int] = {}
    for item in items:
        if item.kind == "income":
            result["income_minor"] += item.amount_minor
        elif item.kind == "expense":
            category = item.category or "Other"
            categories[category] = categories.get(category, 0) + item.amount_minor
            key = "essential_minor" if item.classification == "essential" else "optional_minor"
            result[key] += item.amount_minor
            if item.obligation_id is not None:
                result["obligation_paid_minor"] += item.amount_minor
            if item.classification == "optional":
                category = item.category or "Other"
                optional_categories[category] = optional_categories.get(category, 0) + item.amount_minor
        else:
            if item.transfer_to == "emergency":
                result["emergency_added_minor"] += item.amount_minor
            if item.account == "emergency":
                result["emergency_added_minor"] -= item.amount_minor
            if item.transfer_to == "investment":
                result["investment_added_minor"] += item.amount_minor
            if item.account == "investment":
                result["investment_added_minor"] -= item.amount_minor
    result["optional_categories"] = [
        {"name": name, "amount_minor": amount}
        for name, amount in sorted(optional_categories.items(), key=lambda pair: (-pair[1], pair[0]))
    ]
    result["expenses_minor"] = result["essential_minor"] + result["optional_minor"]
    result["categories"] = [{"name": name, "amount_minor": amount}
        for name, amount in sorted(categories.items(), key=lambda pair: (-pair[1], pair[0]))]
    return result


def finance_today():
    return dt.datetime.now(ZoneInfo("Asia/Almaty")).date()


def recorded_date(date):
    if date > finance_today():
        raise HTTPException(422, "Received income and paid expenses cannot have a future date. Use expected income or a payment due date.")


def cycle_date(anchor: str, month: str) -> str:
    year, number = map(int, month.split("-"))
    day = min(int(anchor[-2:]), calendar.monthrange(year, number)[1])
    return f"{month}-{day:02d}"


def schedule_data(db, obligations, today, through):
    """Finite installments and monthly bill occurrences; reads never create ledger entries."""
    payments = db.query(models.FinanceTransaction).filter(models.FinanceTransaction.obligation_id.is_not(None)).all()
    schedules = db.query(models.FinanceScheduleItem).order_by(models.FinanceScheduleItem.id).all()
    result = []
    for row in obligations:
        linked = [item for item in payments if item.obligation_id == row.id]
        parts = [item for item in schedules if item.obligation_id == row.id]
        entries = []
        if row.kind == "bill":
            start = row.due_date[:7] if row.due_date else through[:7]
            end = max(through[:7], today.strftime("%Y-%m"))
            month = start
            while month <= end:
                due = cycle_date(row.due_date, month) if row.due_date else None
                paid = sum(item.amount_minor for item in linked if item.bill_month == month)
                entries.append({"id": None, "label": f"Monthly bill · {month}", "amount_minor": row.initial_minor,
                                "remaining_minor": max(0, row.initial_minor - paid), "due_date": due, "bill_month": month})
                year, number = map(int, month.split("-"))
                month = f"{year + (number == 12):04d}-{number % 12 + 1:02d}"
        elif parts:
            entries = [{"id": part.id, "label": part.label, "amount_minor": part.amount_minor,
                        "remaining_minor": part.amount_minor - sum(item.amount_minor for item in linked if item.schedule_item_id == part.id),
                        "due_date": part.due_date, "bill_month": None} for part in parts]
        else:
            entries = [{"id": None, "label": "Payment", "amount_minor": row.initial_minor - row.historical_paid_minor,
                        "remaining_minor": row.remaining_minor, "due_date": row.due_date, "bill_month": None}]
        for entry in entries:
            due = entry["due_date"]
            remaining = entry["remaining_minor"]
            days = (dt.date.fromisoformat(due) - today).days if due else None
            status = "paid" if not remaining else "undated" if days is None else "overdue" if days < 0 else "upcoming" if days <= 7 else "scheduled"
            result.append({**entry, "obligation_id": row.id, "title": row.title, "kind": row.kind,
                           "urgent": row.urgent, "status": status})
    return sorted(result, key=lambda item: (item["status"] == "paid", not item["urgent"],
                                            item["due_date"] or "9999", item["obligation_id"], item["id"] or 0))


def budget_data(db, month, items, obligations, schedule):
    first, last = month_bounds(month)
    lines = db.query(models.FinanceBudgetItem).filter(or_(models.FinanceBudgetItem.month == month,
        models.FinanceBudgetItem.month.is_(None))).order_by(models.FinanceBudgetItem.id).all()
    kinds = {row.id: row.kind for row in obligations}
    actual_groups = {group: 0 for group in ("debt", "tuition", "bill")}
    for item in items:
        if item.kind == "expense" and item.obligation_id and kinds.get(item.obligation_id) in actual_groups:
            actual_groups[kinds[item.obligation_id]] += item.amount_minor
    def allocation_key(line):
        return (line.allocation,) if line.allocation in actual_groups else (
            "category", (line.category or line.title).strip().casefold(), line.classification)

    actual_remaining = {}
    line_counts = {}
    for line in lines:
        key = allocation_key(line)
        line_counts[key] = line_counts.get(key, 0) + 1
        if key in actual_remaining:
            continue
        actual_remaining[key] = actual_groups[line.allocation] if line.allocation in actual_groups else sum(
            item.amount_minor for item in items if item.kind == "expense"
            and (not item.obligation_id or kinds.get(item.obligation_id) == "other")
            and (item.category or "Other").strip().casefold() == key[1]
            and item.classification == line.classification)
    rows = []
    for line in lines:
        key = allocation_key(line)
        # Retain duplicate legacy allocations, distributing actual spending once.
        actual = min(line.amount_minor, actual_remaining[key]) if line_counts[key] > 1 else actual_remaining[key]
        actual_remaining[key] -= actual
        line_counts[key] -= 1
        rows.append({**BudgetResponse.model_validate(line).model_dump(), "actual_minor": actual,
                     "remaining_minor": line.amount_minor - actual})
    # Known due payments plus overdue payments. Undated balances are shown separately.
    due_by_kind = {group: 0 for group in actual_groups}
    planned_by_kind = {group: 0 for group in actual_groups}
    undated_by_kind = {group: 0 for group in actual_groups}
    undated = 0
    other_reserve = 0
    for entry in schedule:
        due = entry["due_date"]
        if entry["kind"] == "bill":
            relevant = (due and due <= last) or (not due and entry["bill_month"] == month)
        else:
            relevant = due and due <= last
        if relevant and entry["kind"] in due_by_kind:
            due_by_kind[entry["kind"]] += entry["remaining_minor"]
            if due and due < first:
                planned_by_kind[entry["kind"]] += entry["remaining_minor"]
            else:
                planned_by_kind[entry["kind"]] += entry["amount_minor"]
        elif not due and entry["kind"] != "bill":
            undated += entry["remaining_minor"]
            if entry["kind"] in undated_by_kind:
                undated_by_kind[entry["kind"]] += entry["remaining_minor"]
            else:
                other_reserve += entry["remaining_minor"]
        elif relevant:
            other_reserve += entry["remaining_minor"]
    # Allocations for debt/tuition/bills overlap with schedules: reserve the larger, never both.
    obligation_reserve = other_reserve + sum(max(due_by_kind[group] + undated_by_kind[group],
        sum(max(0, row["remaining_minor"]) for row in rows if row["allocation"] == group)) for group in due_by_kind)
    living_remaining = sum(max(0, row["remaining_minor"]) for row in rows
        if row["classification"] == "essential" and row["allocation"] not in actual_groups)
    living_plan = sum(row["amount_minor"] for row in rows
        if row["classification"] == "essential" and row["allocation"] not in actual_groups)
    minimum = living_plan + sum(max(planned_by_kind[group],
        sum(row["amount_minor"] for row in rows if row["allocation"] == group)) for group in due_by_kind)
    planned = sum(row["amount_minor"] for row in rows if row["allocation"] not in actual_groups) + sum(
        max(planned_by_kind[group], sum(row["amount_minor"] for row in rows
            if row["allocation"] == group)) for group in due_by_kind)
    plan = db.get(models.FinanceMonthPlan, month)
    sources = income_sources_data(db, month)
    expected = plan.expected_income_minor if plan else sum(item["amount_minor"] for item in sources
        if item["active"] and item["applies_to_month"])
    spent = sum(item.amount_minor for item in items if item.kind == "expense")
    received = sum(item.amount_minor for item in items if item.kind == "income")
    return {"items": rows, "expected_income_minor": expected, "planned_minor": planned,
            "actual_minor": spent, "remaining_minor": planned - spent, "minimum_required_minor": minimum,
            "living_essential_minor": living_plan, "essential_remaining_minor": living_remaining,
            "payments_remaining_minor": sum(due_by_kind.values()), "obligation_reserve_minor": obligation_reserve,
            "undated_reserve_minor": undated, "over_income_minor": max(0, planned - max(expected, received))}


def income_sources_data(db, month):
    rows = db.query(models.FinanceIncomeSource).order_by(models.FinanceIncomeSource.id).all()
    receipts = db.query(models.FinanceTransaction).filter(models.FinanceTransaction.income_source_id.is_not(None)).all()
    result = []
    for row in rows:
        linked = [item for item in receipts if item.income_source_id == row.id]
        applies = (not row.expected_date or row.expected_date[:7] <= month) if row.frequency == "monthly" else (
            row.expected_date[:7] == month if row.expected_date else not linked or any(item.income_period == month for item in linked))
        result.append({**IncomeSourceInput.model_validate(row, from_attributes=True).model_dump(mode="json"),
            "id": row.id, "applies_to_month": applies,
            "occurrence_date": cycle_date(row.expected_date, month) if row.expected_date and row.frequency == "monthly" else row.expected_date,
            "received_minor": sum(item.amount_minor for item in linked if row.frequency == "one_time" or item.income_period == month)})
    return result


@router.get("/overview")
def overview(month: str = Query(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),
             today: dt.date = Query(...), db: Session = Depends(get_db)):
    first, last = month_bounds(month)
    settings = settings_data(db)
    balances = {"cash": settings["opening_cash_minor"],
                "emergency": settings["opening_emergency_minor"],
                "investment": settings["opening_investment_minor"]}
    for transaction in db.query(models.FinanceTransaction).filter(models.FinanceTransaction.date <= today.isoformat()).all():
        add_to_balances(balances, transaction)
    month_items = db.query(models.FinanceTransaction).filter(
        models.FinanceTransaction.date.between(first, min(last, today.isoformat()))).all()
    budget = db.query(models.FinanceBudgetItem).filter(or_(models.FinanceBudgetItem.month == month,
        models.FinanceBudgetItem.month.is_(None))).order_by(models.FinanceBudgetItem.id).all()
    obligations = db.query(models.FinanceObligation).order_by(
        models.FinanceObligation.urgent.desc(), models.FinanceObligation.due_date, models.FinanceObligation.id).all()
    minimum = sum(item.amount_minor for item in budget if item.classification == "essential")
    optional_plan = sum(item.amount_minor for item in budget if item.classification == "optional")
    week_start = today - dt.timedelta(days=today.weekday())
    week_end = week_start + dt.timedelta(days=6)
    previous_start = week_start - dt.timedelta(days=7)
    week_items = db.query(models.FinanceTransaction).filter(
        models.FinanceTransaction.date.between(week_start.isoformat(), week_end.isoformat())).all()
    previous_items = db.query(models.FinanceTransaction).filter(
        models.FinanceTransaction.date.between(previous_start.isoformat(), (week_start - dt.timedelta(days=1)).isoformat())).all()
    review = db.query(models.FinanceWeeklyReview).filter_by(week_start=week_start.isoformat()).first()
    liquid = balances["cash"] + balances["emergency"]
    schedule = schedule_data(db, obligations, today, last)
    monthly_budget = budget_data(db, month, month_items, obligations, schedule)
    current_month = today.strftime("%Y-%m")
    if month == current_month:
        current_budget = monthly_budget
    else:
        current_first, current_last = month_bounds(current_month)
        current_items = db.query(models.FinanceTransaction).filter(
            models.FinanceTransaction.date.between(current_first, today.isoformat())).all()
        current_budget = budget_data(db, current_month, current_items, obligations,
                                    schedule_data(db, obligations, today, current_last))
    reserved = current_budget["essential_remaining_minor"] + current_budget["obligation_reserve_minor"]
    obligation_rows = []
    for row in obligations:
        parts = sorted((entry for entry in schedule if entry["obligation_id"] == row.id),
                       key=lambda entry: (entry["id"] or 0, entry["bill_month"] or ""))
        data = ObligationResponse.model_validate(row).model_dump(mode="json")
        data["schedule"] = parts
        if row.kind == "bill":
            data["remaining_minor"] = sum(entry["remaining_minor"] for entry in parts
                if (entry["due_date"] and entry["due_date"] <= last) or entry["bill_month"] == month)
        obligation_rows.append(data)
    return {
        "settings": settings, "balances_minor": balances,
        "minimum_monthly_minor": minimum, "optional_plan_minor": optional_plan,
        "runway_months": round(max(0, liquid) / minimum, 1) if minimum else None,
        "budget_items": [BudgetResponse.model_validate(item) for item in budget],
        "obligations": obligation_rows,
        "schedule": schedule, "budget": monthly_budget, "income_sources": income_sources_data(db, month),
        "safe_to_spend_minor": max(0, balances["cash"] - reserved),
        "reserved_minor": reserved, "shortfall_minor": max(0, reserved - balances["cash"]),
        "undated_reserve_minor": current_budget["undated_reserve_minor"],
        "recent_transactions": [TransactionResponse.model_validate(item) for item in sorted(month_items,
            key=lambda item: (item.date, item.id), reverse=True)[:6]],
        "transaction_categories": sorted({item.category for item in month_items if item.category}),
        "payment_history": [TransactionResponse.model_validate(item) for item in db.query(models.FinanceTransaction)
            .filter(models.FinanceTransaction.obligation_id.is_not(None)).order_by(
                models.FinanceTransaction.date.desc(), models.FinanceTransaction.id.desc()).all()],
        "month": {**summarize(month_items), "label": month},
        "week": {**summarize(week_items), "start": week_start.isoformat(), "end": week_end.isoformat(),
                 "previous_optional_minor": summarize(previous_items)["optional_minor"],
                 "review": ReviewInput.model_validate(review, from_attributes=True).model_dump() if review else ReviewInput().model_dump()},
    }


@router.put("/settings")
def update_settings(payload: SettingsInput, db: Session = Depends(get_db)):
    current = db.get(models.FinanceSettings, 1)
    current_currency = current.currency if current else "KZT"
    if current_currency != payload.currency:
        has_records = any(db.query(model).first() for model in
                          (models.FinanceTransaction, models.FinanceBudgetItem,
                           models.FinancePurchasePlan, models.FinanceObligation,
                           models.FinanceIncomeSource, models.FinanceMonthPlan))
        has_openings = current is not None and any(
            (current.opening_cash_minor, current.opening_emergency_minor,
             current.opening_investment_minor, current.emergency_buffer_target_minor))
        if has_records or has_openings:
            raise HTTPException(409, "Currency cannot change after Finance has amounts. Conversion is not available.")
    if current is None:
        current = models.FinanceSettings(id=1)
        db.add(current)
    for name, value in payload.model_dump().items():
        setattr(current, name, value)
    db.commit()
    return settings_data(db)


@router.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(month: str = Query(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),
                      offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
                      db: Session = Depends(get_db), kind: str | None = None, category: str | None = None):
    first, last = month_bounds(month)
    query = db.query(models.FinanceTransaction).filter(models.FinanceTransaction.date.between(first, last))
    if kind:
        if kind not in ("income", "expense", "transfer", "essential", "optional"):
            raise HTTPException(422, "Invalid transaction type")
        query = query.filter(models.FinanceTransaction.classification == kind) if kind in ("essential", "optional") else query.filter(models.FinanceTransaction.kind == kind)
    if category:
        query = query.filter(func.lower(models.FinanceTransaction.category) == category.strip().lower())
    return query.order_by(
        models.FinanceTransaction.date.desc(), models.FinanceTransaction.id.desc()).offset(offset).limit(limit).all()


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
def create_transaction(payload: TransactionInput, db: Session = Depends(get_db)):
    recorded_date(payload.date)
    row = models.FinanceTransaction(**payload.model_dump(mode="json"))
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
def update_transaction(transaction_id: int, payload: TransactionInput, db: Session = Depends(get_db)):
    row = require_row(db, models.FinanceTransaction, transaction_id)
    if row.obligation_id is not None:
        raise HTTPException(409, "Use the payment reversal to correct an obligation payment.")
    recorded_date(payload.date)
    if row.income_source_id is not None and payload.kind != "income":
        raise HTTPException(409, "Received income must remain an income transaction. Delete it to undo receipt.")
    for name, value in payload.model_dump(mode="json").items():
        setattr(row, name, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    row = require_row(db, models.FinanceTransaction, transaction_id)
    if row.obligation_id is not None:
        obligation = db.query(models.FinanceObligation).filter_by(id=row.obligation_id).with_for_update().first()
        if obligation is None:
            raise HTTPException(409, "The linked obligation is missing.")
        if obligation.kind != "bill":
            obligation.remaining_minor += row.amount_minor
    db.query(models.FinanceIncomeReceipt).filter_by(transaction_id=row.id).delete()
    db.delete(row)
    db.commit()


@router.post("/budget", response_model=BudgetResponse, status_code=201)
def create_budget_item(payload: BudgetInput, db: Session = Depends(get_db)):
    validate_budget_line(db, payload)
    row = models.FinanceBudgetItem(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/budget/{item_id}", response_model=BudgetResponse)
def update_budget_item(item_id: int, payload: BudgetInput, db: Session = Depends(get_db)):
    row = require_row(db, models.FinanceBudgetItem, item_id)
    validate_budget_line(db, payload, item_id)
    for name, value in payload.model_dump().items():
        setattr(row, name, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/budget/{item_id}", status_code=204)
def delete_budget_item(item_id: int, db: Session = Depends(get_db)):
    db.delete(require_row(db, models.FinanceBudgetItem, item_id))
    db.commit()


@router.get("/purchase-plans", response_model=list[PurchasePlanResponse])
def list_purchase_plans(db: Session = Depends(get_db)):
    return db.query(models.FinancePurchasePlan).order_by(
        models.FinancePurchasePlan.purchased, models.FinancePurchasePlan.id.desc()).all()


@router.post("/purchase-plans", response_model=PurchasePlanResponse, status_code=201)
def create_purchase_plan(payload: PurchasePlanInput, db: Session = Depends(get_db)):
    row = models.FinancePurchasePlan(**payload.model_dump(mode="json"))
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/purchase-plans/{item_id}", response_model=PurchasePlanResponse)
def update_purchase_plan(item_id: int, payload: PurchasePlanInput, db: Session = Depends(get_db)):
    row = require_row(db, models.FinancePurchasePlan, item_id)
    for name, value in payload.model_dump(mode="json").items():
        setattr(row, name, value)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/purchase-plans/{item_id}/status", response_model=PurchasePlanResponse)
def set_purchase_plan_status(item_id: int, payload: PurchaseStatusInput, db: Session = Depends(get_db)):
    row = require_row(db, models.FinancePurchasePlan, item_id)
    row.purchased = payload.purchased
    db.commit()
    db.refresh(row)
    return row


@router.delete("/purchase-plans/{item_id}", status_code=204)
def delete_purchase_plan(item_id: int, db: Session = Depends(get_db)):
    db.delete(require_row(db, models.FinancePurchasePlan, item_id))
    db.commit()


@router.post("/obligations", response_model=ObligationResponse, status_code=201)
def create_obligation(payload: ObligationInput, db: Session = Depends(get_db)):
    data = payload.model_dump(mode="json", exclude={"schedule"})
    row = models.FinanceObligation(**data, remaining_minor=payload.initial_minor - payload.historical_paid_minor)
    db.add(row)
    db.flush()
    save_schedule(db, row, payload.schedule)
    db.commit()
    db.refresh(row)
    return row


@router.put("/obligations/{obligation_id}", response_model=ObligationResponse)
def update_obligation(obligation_id: int, payload: ObligationInput, db: Session = Depends(get_db)):
    row = db.query(models.FinanceObligation).filter_by(id=obligation_id).with_for_update().first()
    if row is None:
        raise HTTPException(404, "Finance item not found")
    paid = db.query(func.coalesce(func.sum(models.FinanceTransaction.amount_minor), 0)).filter_by(obligation_id=obligation_id).scalar()
    if row.kind == "bill" and payload.kind != "bill" or row.kind != "bill" and payload.kind == "bill":
        raise HTTPException(409, "Create a separate entry to change between a bill and a debt.")
    if row.kind == "bill":
        largest_cycle = db.query(func.sum(models.FinanceTransaction.amount_minor)).filter_by(
            obligation_id=row.id).group_by(models.FinanceTransaction.bill_month).all()
        if any(total > payload.initial_minor for (total,) in largest_cycle):
            raise HTTPException(409, "Bill amount cannot be below a cycle payment already recorded.")
        paid = 0
    if payload.initial_minor < paid + payload.historical_paid_minor:
        raise HTTPException(409, "Total obligation cannot be below payments already recorded.")
    if "schedule" in payload.model_fields_set:
        save_schedule(db, row, payload.schedule)
    elif db.query(models.FinanceScheduleItem.id).filter_by(obligation_id=row.id).first():
        raise HTTPException(422, "Include the existing installments when editing this obligation.")
    for name, value in payload.model_dump(mode="json", exclude={"schedule"}).items():
        setattr(row, name, value)
    row.remaining_minor = payload.initial_minor - payload.historical_paid_minor - paid
    db.commit()
    db.refresh(row)
    return row


@router.delete("/obligations/{obligation_id}", status_code=204)
def delete_obligation(obligation_id: int, db: Session = Depends(get_db)):
    row = require_row(db, models.FinanceObligation, obligation_id)
    if db.query(models.FinanceTransaction.id).filter_by(obligation_id=obligation_id).first():
        raise HTTPException(409, "This obligation has payments. Reverse its payments before deleting it.")
    db.query(models.FinanceScheduleItem).filter_by(obligation_id=row.id).delete()
    db.delete(row)
    db.commit()


@router.post("/obligations/{obligation_id}/payments", response_model=TransactionResponse, status_code=201)
def pay_obligation(obligation_id: int, payload: PaymentInput, db: Session = Depends(get_db)):
    recorded_date(payload.date)
    row = db.query(models.FinanceObligation).filter_by(id=obligation_id).with_for_update().first()
    if row is None:
        raise HTTPException(404, "Obligation not found")
    remaining = row.remaining_minor
    if row.kind == "bill":
        if not payload.bill_month or payload.schedule_item_id:
            raise HTTPException(422, "Choose the bill month")
        month_bounds(payload.bill_month)
        if row.due_date and payload.bill_month < row.due_date[:7]:
            raise HTTPException(422, "Bill month is before the first bill")
        paid = db.query(func.coalesce(func.sum(models.FinanceTransaction.amount_minor), 0)).filter_by(
            obligation_id=row.id, bill_month=payload.bill_month).scalar()
        remaining = row.initial_minor - paid
    elif payload.bill_month:
        raise HTTPException(422, "Bill month only applies to recurring bills")
    elif db.query(models.FinanceScheduleItem.id).filter_by(obligation_id=row.id).first():
        part = db.get(models.FinanceScheduleItem, payload.schedule_item_id) if payload.schedule_item_id else None
        if part is None or part.obligation_id != row.id:
            raise HTTPException(422, "Choose an installment belonging to this obligation")
        paid = db.query(func.coalesce(func.sum(models.FinanceTransaction.amount_minor), 0)).filter_by(schedule_item_id=part.id).scalar()
        remaining = part.amount_minor - paid
    elif payload.schedule_item_id:
        raise HTTPException(422, "This obligation has no installments")
    if payload.amount_minor > remaining:
        raise HTTPException(409, "Payment exceeds the remaining obligation.")
    # Atomic compare-and-update also protects SQLite, where FOR UPDATE is ignored.
    if row.kind != "bill":
        updated = db.query(models.FinanceObligation).filter_by(id=row.id, remaining_minor=row.remaining_minor).update(
            {"remaining_minor": row.remaining_minor - payload.amount_minor}, synchronize_session=False)
        if not updated:
            db.rollback()
            raise HTTPException(409, "The balance changed. Refresh and try again.")
    payment = models.FinanceTransaction(
        date=payload.date.isoformat(), kind="expense", title=f"Payment: {row.title}",
        amount_minor=payload.amount_minor, category=row.kind.capitalize(), classification="essential",
        account=payload.account, obligation_id=row.id, schedule_item_id=payload.schedule_item_id,
        bill_month=payload.bill_month,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def save_schedule(db, row, entries):
    existing = {item.id: item for item in db.query(models.FinanceScheduleItem).filter_by(obligation_id=row.id).all()}
    supplied = {item.id for item in entries if item.id is not None}
    if supplied - existing.keys():
        raise HTTPException(422, "Unknown installment")
    legacy_paid = db.query(models.FinanceTransaction.id).filter_by(obligation_id=row.id, schedule_item_id=None).first()
    if entries and legacy_paid and row.kind != "bill":
        raise HTTPException(409, "Reverse unscheduled payments before adding an installment schedule.")
    for part in existing.values():
        paid = db.query(func.coalesce(func.sum(models.FinanceTransaction.amount_minor), 0)).filter_by(schedule_item_id=part.id).scalar()
        entry = next((item for item in entries if item.id == part.id), None)
        if paid and (entry is None or entry.amount_minor < paid):
            raise HTTPException(409, "An installment cannot be removed or reduced below its recorded payments.")
        if entry is None:
            db.delete(part)
    for entry in entries:
        part = existing.get(entry.id)
        if part is None:
            part = models.FinanceScheduleItem(obligation_id=row.id)
            db.add(part)
        for name, value in entry.model_dump(mode="json", exclude={"id"}).items():
            setattr(part, name, value)


def validate_budget_line(db, payload, row_id=None):
    if payload.month:
        month_bounds(payload.month)
    lines = db.query(models.FinanceBudgetItem).filter_by(month=payload.month).all()
    category = (payload.category or payload.title).strip().casefold()
    for line in lines:
        if line.id == row_id:
            continue
        if payload.allocation in ("debt", "tuition", "bill"):
            duplicate = payload.allocation == line.allocation
        else:
            duplicate = (line.allocation in ("living", "other") and line.classification == payload.classification
                         and (line.category or line.title).strip().casefold() == category)
        if duplicate:
            raise HTTPException(409, "Edit the existing allocation for this category instead of counting it twice.")


@router.put("/budget/month/{month}")
def save_month_plan(month: str, payload: MonthPlanInput, db: Session = Depends(get_db)):
    month_bounds(month)
    row = db.get(models.FinanceMonthPlan, month)
    if row is None:
        row = models.FinanceMonthPlan(month=month)
        db.add(row)
    row.expected_income_minor = payload.expected_income_minor
    db.commit()
    return payload.model_dump()


@router.post("/income-sources", status_code=201)
def create_income_source(payload: IncomeSourceInput, db: Session = Depends(get_db)):
    row = models.FinanceIncomeSource(**payload.model_dump(mode="json"))
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.put("/income-sources/{source_id}")
def update_income_source(source_id: int, payload: IncomeSourceInput, db: Session = Depends(get_db)):
    row = require_row(db, models.FinanceIncomeSource, source_id)
    if row.frequency != payload.frequency and db.query(models.FinanceIncomeReceipt.source_id).filter_by(source_id=row.id).first():
        raise HTTPException(409, "Keep the frequency for a source with receipts; create a new source if needed.")
    for name, value in payload.model_dump(mode="json").items():
        setattr(row, name, value)
    db.commit()
    return {"id": row.id}


@router.delete("/income-sources/{source_id}", status_code=204)
def delete_income_source(source_id: int, db: Session = Depends(get_db)):
    row = require_row(db, models.FinanceIncomeSource, source_id)
    if db.query(models.FinanceIncomeReceipt.source_id).filter_by(source_id=row.id).first():
        raise HTTPException(409, "This source has received income. Turn it off in Edit to preserve its history.")
    db.delete(row)
    db.commit()


@router.post("/income-sources/{source_id}/receive", response_model=TransactionResponse, status_code=201)
def receive_income(source_id: int, payload: IncomeReceiptInput, db: Session = Depends(get_db)):
    recorded_date(payload.date)
    month_bounds(payload.period)
    row = require_row(db, models.FinanceIncomeSource, source_id)
    if not row.active:
        raise HTTPException(409, "This income source is inactive")
    period = payload.period if row.frequency == "monthly" else "once"
    if db.get(models.FinanceIncomeReceipt, (row.id, period)):
        raise HTTPException(409, "Income already received for this period. Edit its transaction to correct the amount.")
    transaction = models.FinanceTransaction(date=payload.date.isoformat(), kind="income", title=row.title,
        amount_minor=payload.amount_minor, category="Employment", account="cash",
        income_source_id=row.id, income_period=payload.period)
    db.add(transaction)
    try:
        db.flush()
        db.add(models.FinanceIncomeReceipt(source_id=row.id, period=period, transaction_id=transaction.id))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Income already received for this period") from None
    db.refresh(transaction)
    return transaction


@router.put("/reviews/weekly")
def save_weekly_review(week_start: dt.date, payload: ReviewInput, db: Session = Depends(get_db)):
    if week_start.weekday() != 0:
        raise HTTPException(400, "Choose the Monday of the review week.")
    row = db.query(models.FinanceWeeklyReview).filter_by(week_start=week_start.isoformat()).first()
    if row is None:
        row = models.FinanceWeeklyReview(week_start=week_start.isoformat())
        db.add(row)
    for name, value in payload.model_dump().items():
        setattr(row, name, value.strip())
    db.commit()
    return payload.model_dump()
