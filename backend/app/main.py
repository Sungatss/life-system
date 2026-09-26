import os
import datetime
from typing import Optional, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from sqlalchemy.orm import Session

from . import models, schemas, crud
from .database import engine, get_db, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize tables
    Base.metadata.create_all(bind=engine)
    # Seed starter defaults if brand new db
    with Session(bind=engine) as db:
        crud.seed_default_data_if_empty(db)
    yield


app = FastAPI(
    title="Life System API",
    description="Minimalist personal productivity backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup for local dev and custom domain deployment
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "life-system-api"}


# Today Overview
@app.get("/api/today", response_model=schemas.TodayOverview)
def get_today_overview(
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    target_date = date or datetime.date.today().isoformat()

    note = crud.get_daily_note_by_date(db, target_date)
    today_tasks = crud.get_today_tasks(db, target_date)
    habits = crud.get_habits_with_history(db, active_only=True, days=7, reference_date_str=target_date)

    return schemas.TodayOverview(
        date=target_date,
        daily_note=schemas.DailyNoteResponse.model_validate(note) if note else None,
        tasks=[schemas.TaskResponse.model_validate(t) for t in today_tasks],
        habits=habits
    )


# Daily Notes
@app.get("/api/notes/{date_str}", response_model=schemas.DailyNoteResponse)
def get_note(date_str: str, db: Session = Depends(get_db)):
    note = crud.get_daily_note_by_date(db, date_str)
    if not note:
        return schemas.DailyNoteResponse(
            id=0,
            date=date_str,
            content="",
            created_at=datetime.datetime.now(datetime.timezone.utc),
            updated_at=datetime.datetime.now(datetime.timezone.utc)
        )
    return schemas.DailyNoteResponse.model_validate(note)


@app.put("/api/notes/{date_str}", response_model=schemas.DailyNoteResponse)
def save_note(date_str: str, update: schemas.DailyNoteUpdate, db: Session = Depends(get_db)):
    note = crud.upsert_daily_note(db, date_str, update.content)
    return schemas.DailyNoteResponse.model_validate(note)


# Tasks
@app.get("/api/tasks", response_model=List[schemas.TaskResponse])
def read_tasks(
    filter: Optional[str] = Query(None, description="all, active, completed, today, overdue, high"),
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    tasks = crud.get_tasks(db, filter_type=filter, category=category)
    return [schemas.TaskResponse.model_validate(t) for t in tasks]


@app.post("/api/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_new_task(task_in: schemas.TaskCreate, db: Session = Depends(get_db)):
    if not task_in.title.strip():
        raise HTTPException(status_code=400, detail="Task title cannot be empty")
    task = crud.create_task(db, task_in)
    return schemas.TaskResponse.model_validate(task)


@app.get("/api/tasks/{task_id}", response_model=schemas.TaskResponse)
def read_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return schemas.TaskResponse.model_validate(task)


@app.put("/api/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task_item(task_id: int, task_in: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = crud.update_task(db, task_id, task_in)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return schemas.TaskResponse.model_validate(task)


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_task(task_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_task(db, task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return None


# Habits
@app.get("/api/habits", response_model=List[schemas.HabitItemResponse])
def read_habits(
    days: int = Query(14, ge=1, le=60),
    active_only: bool = True,
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_habits_with_history(db, active_only=active_only, days=days, reference_date_str=date)


@app.post("/api/habits", response_model=schemas.HabitItemResponse, status_code=status.HTTP_201_CREATED)
def create_new_habit(habit_in: schemas.HabitCreate, db: Session = Depends(get_db)):
    if not habit_in.name.strip():
        raise HTTPException(status_code=400, detail="Habit name cannot be empty")
    habit = crud.create_habit(db, habit_in)
    return schemas.HabitItemResponse(
        id=habit.id,
        name=habit.name,
        active=habit.active,
        created_at=habit.created_at,
        completed_today=False,
        recent_history={}
    )


@app.put("/api/habits/{habit_id}", response_model=schemas.HabitItemResponse)
def update_habit_item(habit_id: int, habit_in: schemas.HabitUpdate, db: Session = Depends(get_db)):
    habit = crud.update_habit(db, habit_id, habit_in)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    history_list = crud.get_habits_with_history(db, active_only=False, days=14)
    item = next((h for h in history_list if h.id == habit.id), None)
    if item:
        return item
    return schemas.HabitItemResponse(
        id=habit.id,
        name=habit.name,
        active=habit.active,
        created_at=habit.created_at,
        completed_today=False,
        recent_history={}
    )


@app.delete("/api/habits/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_habit(habit_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_habit(db, habit_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Habit not found")
    return None


@app.post("/api/habits/{habit_id}/toggle")
def toggle_habit(
    habit_id: int,
    toggle_req: schemas.HabitToggleRequest,
    db: Session = Depends(get_db)
):
    habit = crud.get_habit(db, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    new_status = crud.toggle_habit_log(db, habit_id, toggle_req.date, toggle_req.completed)
    return {
        "habit_id": habit_id,
        "date": toggle_req.date,
        "completed": new_status
    }


# Frontend static files integration (Single-container / custom domain deployment)
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.isdir(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API route not found")
        target_file = os.path.join(frontend_dist, full_path)
        if os.path.isfile(target_file):
            return FileResponse(target_file)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Page not found")
