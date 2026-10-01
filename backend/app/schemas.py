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


class DailyNoteSearchResult(BaseModel):
    id: int
    date: str
    snippet: str
    content: str
    word_count: int
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


# GitHub-style Contribution Tracker Schemas
class ContributionDay(BaseModel):
    date: str
    has_note: bool = False
    note_words: int = 0
    habits_completed: int = 0
    total_habits: int = 0
    tasks_completed: int = 0


class ContributionsResponse(BaseModel):
    start_date: str
    end_date: str
    days: List[ContributionDay]
    total_notes_written: int
    total_habits_completed: int
    total_tasks_completed: int


# Weekly Review & Analytics Schemas
class WeeklyReviewUpdate(BaseModel):
    wins: Optional[str] = ""
    blockers: Optional[str] = ""
    next_focus: Optional[str] = ""


class WeeklyReviewResponse(BaseModel):
    id: int
    week_start: str
    wins: str
    blockers: str
    next_focus: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class WeeklyDayStat(BaseModel):
    date: str
    day_name: str
    tasks_completed: int
    habits_completed: int
    total_habits: int
    has_note: bool
    note_words: int


class WeeklyCockpitResponse(BaseModel):
    week_start: str
    week_end: str
    total_tasks_completed: int
    total_habits_completed: int
    total_habits_possible: int
    habit_consistency_rate: int
    days_active: int
    total_words_written: int
    day_breakdown: List[WeeklyDayStat]
    review: Optional[WeeklyReviewResponse] = None


