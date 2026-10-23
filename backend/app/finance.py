"""Single-currency personal finance ledger. Amounts are integer minor units."""

import datetime as dt
from typing import Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func
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
    created_at: dt.datetime
    model_config = ConfigDict(from_attributes=True)


class BudgetInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    amount_minor: int = Field(..., gt=0, le=MAX_MINOR)
    classification: Classification

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


class ObligationInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    kind: Literal["debt", "tuition", "other"]
    initial_minor: int = Field(..., gt=0, le=MAX_MINOR)
    due_date: dt.date | None = None
    urgent: bool = False

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
    for item in items:
        if item.kind == "income":
            result["income_minor"] += item.amount_minor
        elif item.kind == "expense":
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
    return result


@router.get("/overview")
def overview(month: str = Query(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),
             today: dt.date = Query(...), db: Session = Depends(get_db)):
    first, last = month_bounds(month)
    settings = settings_data(db)
    balances = {"cash": settings["opening_cash_minor"],
                "emergency": settings["opening_emergency_minor"],
                "investment": settings["opening_investment_minor"]}
    for transaction in db.query(models.FinanceTransaction).all():
        add_to_balances(balances, transaction)
    month_items = db.query(models.FinanceTransaction).filter(
        models.FinanceTransaction.date.between(first, last)).all()
    budget = db.query(models.FinanceBudgetItem).order_by(models.FinanceBudgetItem.id).all()
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
    return {
        "settings": settings, "balances_minor": balances,
        "minimum_monthly_minor": minimum, "optional_plan_minor": optional_plan,
        "runway_months": round(max(0, liquid) / minimum, 1) if minimum else None,
        "budget_items": [BudgetResponse.model_validate(item) for item in budget],
        "obligations": [ObligationResponse.model_validate(item) for item in obligations],
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
        has_records = any(db.query(model.id).first() for model in
                          (models.FinanceTransaction, models.FinanceBudgetItem,
                           models.FinancePurchasePlan, models.FinanceObligation))
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
                      db: Session = Depends(get_db)):
    first, last = month_bounds(month)
    return db.query(models.FinanceTransaction).filter(models.FinanceTransaction.date.between(first, last)).order_by(
        models.FinanceTransaction.date.desc(), models.FinanceTransaction.id.desc()).offset(offset).limit(limit).all()


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
def create_transaction(payload: TransactionInput, db: Session = Depends(get_db)):
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
        obligation.remaining_minor += row.amount_minor
    db.delete(row)
    db.commit()


@router.post("/budget", response_model=BudgetResponse, status_code=201)
def create_budget_item(payload: BudgetInput, db: Session = Depends(get_db)):
    row = models.FinanceBudgetItem(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/budget/{item_id}", response_model=BudgetResponse)
def update_budget_item(item_id: int, payload: BudgetInput, db: Session = Depends(get_db)):
    row = require_row(db, models.FinanceBudgetItem, item_id)
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
    data = payload.model_dump(mode="json")
    row = models.FinanceObligation(**data, remaining_minor=payload.initial_minor)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/obligations/{obligation_id}", response_model=ObligationResponse)
def update_obligation(obligation_id: int, payload: ObligationInput, db: Session = Depends(get_db)):
    row = db.query(models.FinanceObligation).filter_by(id=obligation_id).with_for_update().first()
    if row is None:
        raise HTTPException(404, "Finance item not found")
    paid = db.query(func.coalesce(func.sum(models.FinanceTransaction.amount_minor), 0)).filter_by(obligation_id=obligation_id).scalar()
    if payload.initial_minor < paid:
        raise HTTPException(409, "Total obligation cannot be below payments already recorded.")
    for name, value in payload.model_dump(mode="json").items():
        setattr(row, name, value)
    row.remaining_minor = payload.initial_minor - paid
    db.commit()
    db.refresh(row)
    return row


@router.delete("/obligations/{obligation_id}", status_code=204)
def delete_obligation(obligation_id: int, db: Session = Depends(get_db)):
    row = require_row(db, models.FinanceObligation, obligation_id)
    if db.query(models.FinanceTransaction.id).filter_by(obligation_id=obligation_id).first():
        raise HTTPException(409, "This obligation has payments. Reverse its payments before deleting it.")
    db.delete(row)
    db.commit()


@router.post("/obligations/{obligation_id}/payments", response_model=TransactionResponse, status_code=201)
def pay_obligation(obligation_id: int, payload: PaymentInput, db: Session = Depends(get_db)):
    row = db.query(models.FinanceObligation).filter_by(id=obligation_id).with_for_update().first()
    if row is None:
        raise HTTPException(404, "Obligation not found")
    if payload.amount_minor > row.remaining_minor:
        raise HTTPException(409, "Payment exceeds the remaining obligation.")
    payment = models.FinanceTransaction(
        date=payload.date.isoformat(), kind="expense", title=f"Payment: {row.title}",
        amount_minor=payload.amount_minor, category=row.kind.capitalize(), classification="essential",
        account=payload.account, obligation_id=row.id,
    )
    row.remaining_minor -= payload.amount_minor
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


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
