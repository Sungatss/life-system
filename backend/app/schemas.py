import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict


# Daily Note Schemas
class DailyNoteBase(BaseModel):
    content: str = ""


class DailyNoteCreate(DailyNoteBase):
    date: str  # YYYY-MM-DD


class DailyNoteUpdate(BaseModel):
    content: str


class DailyNoteResponse(DailyNoteBase):
    id: int
    date: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# Task Schemas
class TaskBase(BaseModel):
    title: str
    priority: Optional[str] = "none"  # "none", "low", "medium", "high"
    due_date: Optional[str] = None    # YYYY-MM-DD or None
    category: Optional[str] = None    # Optional project/category tag


class TaskCreate(TaskBase):
    completed: Optional[bool] = False


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    category: Optional[str] = None


class TaskResponse(TaskBase):
    id: int
    completed: bool
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Habit Schemas
class HabitBase(BaseModel):
    name: str
    active: Optional[bool] = True


class HabitCreate(BaseModel):
    name: str


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None


class HabitLogResponse(BaseModel):
    id: int
    habit_id: int
    date: str
    completed: bool

    model_config = ConfigDict(from_attributes=True)


class HabitItemResponse(BaseModel):
    id: int
    name: str
    active: bool
    created_at: datetime.datetime
    completed_today: bool = False
    recent_history: Dict[str, bool] = {}  # date -> completed

    model_config = ConfigDict(from_attributes=True)


class HabitToggleRequest(BaseModel):
    date: str
    completed: Optional[bool] = None  # None for toggle


# Today Overview
class TodayOverview(BaseModel):
    date: str
    daily_note: Optional[DailyNoteResponse] = None
    tasks: List[TaskResponse] = []
    habits: List[HabitItemResponse] = []
