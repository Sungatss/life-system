import os
import datetime
import hmac
from typing import Optional, List
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import FastAPI, Depends, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import models, schemas, crud, migrations, progress, auth, assistant
from .database import engine, get_db, Base


db_startup_error = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_startup_error
    try:
        # A single transaction prevents concurrent serverless cold starts from
        # racing to create the same PostgreSQL tables and indexes.
        with engine.begin() as connection:
            if engine.dialect.name == "postgresql":
                connection.execute(text("SELECT pg_advisory_xact_lock(98273, 1)"))
            Base.metadata.create_all(bind=connection)
            migrations.drop_daily_notes_if_present(connection)
            migrations.add_task_description_if_missing(connection)
            migrations.add_task_project_if_missing(connection)
            migrations.add_user_bio_if_missing(connection)
            with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
                crud.seed_default_data_if_empty(db)
        db_startup_error = None
    except Exception as e:
        db_startup_error = str(e)
        import logging
        logging.getLogger("uvicorn.error").error(f"Startup DB Error: {e}")
    yield


app = FastAPI(
    title="Life System API",
    description="Minimalist personal productivity backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup for local dev and custom domain deployment
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip() and origin.strip() != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_single_user_session(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and request.method != "OPTIONS":
        if path == "/api/assistant/ask":
            length = request.headers.get("content-length", "0")
            if not length.isdigit() or int(length) > 16000:
                return JSONResponse({"detail": "Assistant request is too large."}, status_code=413)
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 16000:
                    return JSONResponse({"detail": "Assistant request is too large."}, status_code=413)
            request._body = bytes(body)
        origin = request.headers.get("origin")
        if origin:
            scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
            same_origin = origin == f"{scheme}://{request.headers.get('host')}"
            if not same_origin and origin not in origins:
                return JSONResponse({"detail": "Origin is not allowed"}, status_code=403)
        if path not in ("/api/auth/login", "/api/auth/session"):
            if not auth.configured():
                return JSONResponse({"detail": "Lock In login is not configured on the server."}, status_code=503)
            session = auth.read_session(request.cookies.get(auth.COOKIE_NAME))
            if session is None:
                return JSONResponse({"detail": "Sign in to Lock In first."}, status_code=401)
            if request.method not in ("GET", "HEAD"):
                csrf = request.headers.get("x-lock-in-csrf", "")
                if not hmac.compare_digest(csrf, session["csrf"]):
                    return JSONResponse({"detail": "Session check failed. Refresh and sign in again."}, status_code=403)
            request.state.session = session
    return await call_next(request)


@app.get("/api/auth/session")
def read_login_session(request: Request):
    session = auth.read_session(request.cookies.get(auth.COOKIE_NAME))
    return {"authenticated": session is not None, "configured": auth.configured(), "csrf": session["csrf"] if session else None}


@app.post("/api/auth/login")
def login(credentials: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    if not auth.configured():
        raise HTTPException(503, "Lock In login is not configured on the server.")
    client_ip = request.client.host if request.client else "unknown"
    auth.login_limit(client_ip, db)
    if not auth.verify_password(credentials.password):
        raise HTTPException(401, "Incorrect password.")
    auth.clear_login_limit(client_ip, db)
    token, csrf = auth.issue_session()
    response = JSONResponse({"authenticated": True, "csrf": csrf})
    response.set_cookie(
        auth.COOKIE_NAME, token, max_age=auth.SESSION_SECONDS, httponly=True,
        secure=request.headers.get("x-forwarded-proto") == "https" or request.url.hostname not in ("localhost", "127.0.0.1", "::1"),
        samesite="strict", path="/api",
    )
    return response


@app.post("/api/auth/logout")
def logout():
    response = JSONResponse({"authenticated": False})
    response.delete_cookie(auth.COOKIE_NAME, path="/api", samesite="strict")
    return response


@app.get("/api/assistant/status")
def assistant_status():
    model = os.getenv("GROQ_MODEL", assistant.DEFAULT_MODEL).strip()
    return {"available": bool(os.getenv("GROQ_API_KEY", "").strip()) and model in assistant.FREE_MODELS, "model": model}


@app.post("/api/assistant/ask")
def ask_assistant(payload: assistant.AskRequest, db: Session = Depends(get_db)):
    return assistant.ask(db, payload)


@app.post("/api/assistant/proposals/{proposal_id}/apply")
def apply_assistant_proposal(proposal_id: str, db: Session = Depends(get_db)):
    return assistant.apply(db, proposal_id)


@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response



@app.get("/api/health")
def health_check():
    global db_startup_error
    if db_startup_error:
        return {
            "status": "degraded",
            "service": "life-system-api",
            "db_status": "disconnected",
            "db_error": db_startup_error
        }
    return {
        "status": "ok",
        "service": "life-system-api",
        "db_status": "connected"
    }


@app.get("/api/progress", response_model=schemas.ProgressResponse)
def get_progress(timezone: str = "UTC", db: Session = Depends(get_db)):
    try:
        zone = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=400, detail="Unknown timezone")
    return progress.get_progress(db, zone)


@app.get("/api/profile", response_model=schemas.ProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(models.User).order_by(models.User.id).first()
    if profile is None:
        profile = models.User(name="Your name", bio="")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@app.put("/api/profile", response_model=schemas.ProfileResponse)
def update_profile(profile_in: schemas.ProfileUpdate, db: Session = Depends(get_db)):
    name = profile_in.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    profile = get_profile(db)
    profile.name = name
    profile.bio = profile_in.bio.strip()
    db.commit()
    db.refresh(profile)
    return profile


@app.get("/api/inbox", response_model=List[schemas.InboxEntryResponse])
def read_inbox(db: Session = Depends(get_db)):
    return crud.get_inbox_entries(db)


@app.post("/api/inbox", response_model=schemas.InboxEntryResponse, status_code=status.HTTP_201_CREATED)
def create_inbox_entry(entry_in: schemas.InboxEntryContent, db: Session = Depends(get_db)):
    if not entry_in.content.strip():
        raise HTTPException(status_code=400, detail="Inbox entry cannot be empty")
    return crud.create_inbox_entry(db, entry_in.content)


@app.put("/api/inbox/{entry_id}", response_model=schemas.InboxEntryResponse)
def update_inbox_entry(entry_id: int, entry_in: schemas.InboxEntryContent, db: Session = Depends(get_db)):
    if not entry_in.content.strip():
        raise HTTPException(status_code=400, detail="Inbox entry cannot be empty")
    entry = crud.update_inbox_entry(db, entry_id, entry_in.content)
    if not entry:
        raise HTTPException(status_code=404, detail="Inbox entry not found")
    return entry


@app.delete("/api/inbox/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inbox_entry(entry_id: int, db: Session = Depends(get_db)):
    if not crud.delete_inbox_entry(db, entry_id):
        raise HTTPException(status_code=404, detail="Inbox entry not found")
    return None


@app.get("/api/projects", response_model=List[schemas.ProjectResponse])
def read_projects(db: Session = Depends(get_db)):
    return crud.get_projects(db)


@app.post("/api/projects", response_model=schemas.ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project_in: schemas.ProjectCreate, db: Session = Depends(get_db)):
    if not project_in.name.strip():
        raise HTTPException(status_code=400, detail="Project name cannot be empty")
    if crud.project_name_taken(db, project_in.name):
        raise HTTPException(status_code=409, detail="A project with this name already exists")
    return crud.create_project(db, project_in)


@app.put("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: int, project_in: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project_in.name.strip():
        raise HTTPException(status_code=400, detail="Project name cannot be empty")
    if crud.project_name_taken(db, project_in.name, except_id=project_id):
        raise HTTPException(status_code=409, detail="A project with this name already exists")
    return crud.update_project(db, project, project_in)


@app.delete("/api/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    crud.delete_project(db, project)
    return None


# Today Overview
@app.get("/api/today", response_model=schemas.TodayOverview)
def get_today_overview(
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    target_date = date or datetime.date.today().isoformat()

    today_tasks = crud.get_today_tasks(db, target_date)
    habits = crud.get_habits_with_history(db, active_only=True, days=7, reference_date_str=target_date)

    return schemas.TodayOverview(
        date=target_date,
        tasks=[schemas.TaskResponse.model_validate(t) for t in today_tasks],
        habits=habits
    )


# Tasks
@app.get("/api/tasks", response_model=List[schemas.TaskResponse])
def read_tasks(
    filter: Optional[str] = Query(None, description="all, active, completed, today, overdue, high"),
    category: Optional[str] = None,
    project_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db)
):
    tasks = crud.get_tasks(db, filter_type=filter, category=category, project_id=project_id)
    return [schemas.TaskResponse.model_validate(t) for t in tasks]


@app.post("/api/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_new_task(task_in: schemas.TaskCreate, db: Session = Depends(get_db)):
    if not task_in.title.strip():
        raise HTTPException(status_code=400, detail="Task title cannot be empty")
    if task_in.project_id is not None and not crud.get_project(db, task_in.project_id):
        raise HTTPException(status_code=400, detail="Project not found")
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
    if task_in.project_id is not None and not crud.get_project(db, task_in.project_id):
        raise HTTPException(status_code=400, detail="Project not found")
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


@app.post("/api/tasks/{task_id}/subtasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_new_subtask(task_id: int, subtask_in: schemas.SubtaskCreate, db: Session = Depends(get_db)):
    if not subtask_in.title.strip():
        raise HTTPException(status_code=400, detail="Step title cannot be empty")
    task = crud.create_subtask(db, task_id, subtask_in.title)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return schemas.TaskResponse.model_validate(task)


@app.put("/api/tasks/{task_id}/subtasks/{subtask_id}", response_model=schemas.TaskResponse)
def update_subtask_item(task_id: int, subtask_id: int, subtask_in: schemas.SubtaskUpdate, db: Session = Depends(get_db)):
    if subtask_in.title is not None and not subtask_in.title.strip():
        raise HTTPException(status_code=400, detail="Step title cannot be empty")
    task = crud.update_subtask(db, task_id, subtask_id, subtask_in)
    if not task:
        raise HTTPException(status_code=404, detail="Step not found")
    return schemas.TaskResponse.model_validate(task)


@app.delete("/api/tasks/{task_id}/subtasks/{subtask_id}", response_model=schemas.TaskResponse)
def remove_subtask(task_id: int, subtask_id: int, db: Session = Depends(get_db)):
    task = crud.delete_subtask(db, task_id, subtask_id)
    if not task:
        raise HTTPException(status_code=404, detail="Step not found")
    return schemas.TaskResponse.model_validate(task)


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


# Contributions / Consistency Heatmap
@app.get("/api/contributions", response_model=schemas.ContributionsResponse)
def get_contributions(
    days: int = Query(112, ge=14, le=365),
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_contributions_history(db, days=days, reference_date_str=date)


# Weekly Review & Analytics Cockpit
@app.get("/api/reviews/weekly", response_model=schemas.WeeklyCockpitResponse)
def get_weekly_review_cockpit(
    date: Optional[datetime.date] = None,
    today: Optional[datetime.date] = None,
    timezone: str = Query("UTC", max_length=64),
    db: Session = Depends(get_db)
):
    try:
        zone = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid timezone") from None
    return crud.get_weekly_cockpit(
        db, reference_date_str=date.isoformat() if date else None,
        today_str=today.isoformat() if today else None, timezone=zone,
    )


@app.put("/api/reviews/weekly", response_model=schemas.WeeklyReviewResponse)
def save_weekly_review(
    week_start: str = Query(..., description="Monday of the week (YYYY-MM-DD)"),
    review_in: schemas.WeeklyReviewUpdate = ...,
    db: Session = Depends(get_db)
):
    review = crud.upsert_weekly_review(db, week_start_str=week_start, review_in=review_in)
    return schemas.WeeklyReviewResponse.model_validate(review)



# Frontend static files integration (Single-container / custom domain deployment)
frontend_dist_env = os.getenv("FRONTEND_DIST")
if frontend_dist_env and os.path.isdir(frontend_dist_env):
    frontend_dist = frontend_dist_env
else:
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
    if not os.path.isdir(frontend_dist) and os.path.isdir("/frontend/dist"):
        frontend_dist = "/frontend/dist"

if os.path.isdir(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
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
