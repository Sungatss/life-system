import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from .database import Base


def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, default="Default User")
    created_at = Column(DateTime(timezone=True), default=utcnow)


class DailyNote(Base):
    __tablename__ = "daily_notes"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), unique=True, index=True, nullable=False)  # Format: YYYY-MM-DD
    content = Column(Text, default="", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    completed = Column(Boolean, default=False, nullable=False, index=True)
    priority = Column(String(20), default="none", nullable=False)  # "none", "low", "medium", "high"
    due_date = Column(String(10), nullable=True, index=True)  # Format: YYYY-MM-DD or None
    category = Column(String(100), nullable=True)  # Project or category
    created_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")


class HabitLog(Base):
    __tablename__ = "habit_logs"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)  # Format: YYYY-MM-DD
    completed = Column(Boolean, default=True, nullable=False)

    habit = relationship("Habit", back_populates="logs")

    __table_args__ = (
        UniqueConstraint("habit_id", "date", name="uq_habit_date"),
    )
