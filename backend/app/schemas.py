import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=1024)


class ProfileUpdate(BaseModel):
    name: str = Field(..., max_length=100)
    bio: str = Field(default="", max_length=1000)


class ProfileResponse(ProfileUpdate):
    id: int
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class InboxEntryContent(BaseModel):
    content: str = Field(..., max_length=10000)


class InboxEntryResponse(InboxEntryContent):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=100)
    plan: str = Field(default="", max_length=50000)


class ProjectUpdate(BaseModel):
    name: str = Field(..., max_length=100)
    plan: str = Field(..., max_length=50000)


class ProjectResponse(ProjectCreate):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)



# Task Schemas
class SubtaskCreate(BaseModel):
    title: str


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    completed: Optional[bool] = None


class SubtaskResponse(BaseModel):
    id: int
    task_id: int
    title: str
    completed: bool

    model_config = ConfigDict(from_attributes=True)


class TaskBase(BaseModel):
    title: str
    description: str = ""
    priority: Optional[str] = "none"  # "none", "low", "medium", "high"
    due_date: Optional[str] = None    # YYYY-MM-DD or None
    category: Optional[str] = None    # Optional category tag
    project_id: Optional[int] = Field(default=None, ge=1)


class TaskCreate(TaskBase):
    completed: Optional[bool] = False
    subtasks: List[SubtaskCreate] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    category: Optional[str] = None
    project_id: Optional[int] = Field(default=None, ge=1)


class TaskResponse(TaskBase):
    id: int
    completed: bool
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    project_name: Optional[str] = None
    subtasks: List[SubtaskResponse] = Field(default_factory=list)

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
class ProgressResponse(BaseModel):
    date: str
    total_xp: int
    today_xp: int
    daily_goal: int
    streak: int
    level: int
    xp_to_next_level: int


class TodayOverview(BaseModel):
    date: str
    tasks: List[TaskResponse] = []
    habits: List[HabitItemResponse] = []


# GitHub-style Contribution Tracker Schemas
class ContributionDay(BaseModel):
    date: str
    habits_completed: int = 0
    total_habits: int = 0
    tasks_completed: int = 0


class ContributionsResponse(BaseModel):
    start_date: str
    end_date: str
    days: List[ContributionDay]
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


class WeeklyCockpitResponse(BaseModel):
    week_start: str
    week_end: str
    total_tasks_completed: int
    total_habits_completed: int
    total_habits_possible: int
    habit_consistency_rate: int
    days_active: int
    day_breakdown: List[WeeklyDayStat]
    review: Optional[WeeklyReviewResponse] = None
