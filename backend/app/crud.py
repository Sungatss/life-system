import datetime
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_, func
from zoneinfo import ZoneInfo
from . import models, schemas
from .progress import XP_PER_COMPLETION


def get_projects(db: Session) -> List[models.Project]:
    return db.query(models.Project).order_by(models.Project.id.desc()).all()


def get_project(db: Session, project_id: int) -> Optional[models.Project]:
    return db.get(models.Project, project_id)


def project_name_taken(db: Session, name: str, except_id: Optional[int] = None) -> bool:
    query = db.query(models.Project).filter(func.lower(models.Project.name) == name.strip().lower())
    if except_id is not None:
        query = query.filter(models.Project.id != except_id)
    return query.first() is not None


def create_project(db: Session, project_in: schemas.ProjectCreate) -> models.Project:
    now = models.utcnow()
    project = models.Project(name=project_in.name.strip(), plan=project_in.plan.strip(), created_at=now, updated_at=now)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, project: models.Project, project_in: schemas.ProjectUpdate) -> models.Project:
    project.name = project_in.name.strip()
    project.plan = project_in.plan.strip()
    project.updated_at = models.utcnow()
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: models.Project) -> None:
    # Keep existing tasks and their steps when the enclosing plan is removed.
    db.query(models.Task).filter(models.Task.project_id == project.id).update({models.Task.project_id: None}, synchronize_session=False)
    db.delete(project)
    db.commit()


def get_inbox_entries(db: Session) -> List[models.InboxEntry]:
    return db.query(models.InboxEntry).order_by(models.InboxEntry.id.desc()).all()


def create_inbox_entry(db: Session, content: str) -> models.InboxEntry:
    now = models.utcnow()
    entry = models.InboxEntry(content=content.strip(), created_at=now, updated_at=now)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def update_inbox_entry(db: Session, entry_id: int, content: str) -> Optional[models.InboxEntry]:
    entry = db.get(models.InboxEntry, entry_id)
    if not entry:
        return None
    entry.content = content.strip()
    entry.updated_at = models.utcnow()
    db.commit()
    db.refresh(entry)
    return entry


def delete_inbox_entry(db: Session, entry_id: int) -> bool:
    entry = db.get(models.InboxEntry, entry_id)
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True


def get_tasks(
    db: Session,
    filter_type: Optional[str] = None,
    category: Optional[str] = None,
    project_id: Optional[int] = None
) -> List[models.Task]:
    query = db.query(models.Task)

    today_str = datetime.date.today().isoformat()

    if filter_type == "active":
        query = query.filter(models.Task.completed == False)
    elif filter_type == "completed":
        query = query.filter(models.Task.completed == True)
    elif filter_type == "today":
        # Tasks explicitly due today or completed today or active and due today
        query = query.filter(
            (models.Task.due_date == today_str) |
            (models.Task.completed_at >= datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0))
        )
    elif filter_type == "overdue":
        query = query.filter(
            models.Task.completed == False,
            models.Task.due_date.isnot(None),
            models.Task.due_date < today_str
        )
    elif filter_type == "high":
        query = query.filter(
            models.Task.priority == "high",
            models.Task.completed == False
        )

    if category:
        query = query.filter(models.Task.category == category)
    if project_id is not None:
        query = query.filter(models.Task.project_id == project_id)

    # Order: incomplete first, then by priority (high, medium, low, none), then created_at desc
    # In SQLite we can order by completed asc, created_at desc
    return query.order_by(models.Task.completed.asc(), desc(models.Task.created_at)).all()


def get_today_tasks(db: Session, today_str: str) -> List[models.Task]:
    """
    Returns tasks relevant for Today:
    1. Tasks with due_date == today_str
    2. Overdue incomplete tasks (due_date < today_str and not completed)
    3. High priority active tasks without a future due date
    4. Tasks completed today
    """
    # Query tasks due today or overdue incomplete
    tasks = db.query(models.Task).filter(
        (models.Task.due_date == today_str) |
        (and_(models.Task.completed == False, models.Task.due_date.isnot(None), models.Task.due_date <= today_str)) |
        (and_(models.Task.completed == False, models.Task.priority == "high", models.Task.due_date.is_(None))) |
        (and_(models.Task.completed == True, models.Task.due_date == today_str))
    ).order_by(models.Task.completed.asc(), desc(models.Task.created_at)).all()

    return tasks


def create_task(db: Session, task_in: schemas.TaskCreate) -> models.Task:
    now = models.utcnow()
    completed_at = now if task_in.completed else None
    task = models.Task(
        title=task_in.title.strip(),
        description=task_in.description.strip(),
        completed=bool(task_in.completed),
        priority=task_in.priority or "none",
        due_date=task_in.due_date or None,
        category=task_in.category.strip() if task_in.category else None,
        project_id=task_in.project_id,
        created_at=now,
        completed_at=completed_at
    )
    db.add(task)
    for subtask in task_in.subtasks:
        title = subtask.title.strip()
        if title:
            task.subtasks.append(models.Subtask(title=title, completed=False, created_at=now))
    db.commit()
    db.refresh(task)
    return task


def get_task(db: Session, task_id: int) -> Optional[models.Task]:
    return db.query(models.Task).filter(models.Task.id == task_id).first()


def update_task(db: Session, task_id: int, task_in: schemas.TaskUpdate) -> Optional[models.Task]:
    task = get_task(db, task_id)
    if not task:
        return None

    data = task_in.model_dump(exclude_unset=True)
    if "completed" in data:
        now = models.utcnow()
        if data["completed"] and not task.completed:
            task.completed_at = now
        elif not data["completed"]:
            task.completed_at = None
        task.completed = data["completed"]

    if "title" in data and data["title"] is not None:
        task.title = data["title"].strip()
    if "description" in data:
        task.description = (data["description"] or "").strip()
    if "priority" in data:
        task.priority = data["priority"] or "none"
    if "due_date" in data:
        task.due_date = data["due_date"] or None
    if "category" in data:
        task.category = data["category"].strip() if data["category"] else None
    if "project_id" in data:
        task.project_id = data["project_id"]

    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int) -> bool:
    task = get_task(db, task_id)
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True


def create_subtask(db: Session, task_id: int, title: str) -> Optional[models.Task]:
    task = get_task(db, task_id)
    if not task:
        return None
    task.subtasks.append(models.Subtask(title=title.strip(), completed=False, created_at=models.utcnow()))
    db.commit()
    db.refresh(task)
    return task


def update_subtask(db: Session, task_id: int, subtask_id: int, update: schemas.SubtaskUpdate) -> Optional[models.Task]:
    task = get_task(db, task_id)
    if not task:
        return None
    subtask = next((item for item in task.subtasks if item.id == subtask_id), None)
    if not subtask:
        return None
    data = update.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        subtask.title = data["title"].strip()
    if "completed" in data and data["completed"] is not None:
        subtask.completed = data["completed"]
    db.commit()
    db.refresh(task)
    return task


def delete_subtask(db: Session, task_id: int, subtask_id: int) -> Optional[models.Task]:
    task = get_task(db, task_id)
    if not task:
        return None
    subtask = next((item for item in task.subtasks if item.id == subtask_id), None)
    if not subtask:
        return None
    db.delete(subtask)
    db.commit()
    db.refresh(task)
    return task


def get_habits(db: Session, active_only: bool = True) -> List[models.Habit]:
    query = db.query(models.Habit)
    if active_only:
        query = query.filter(models.Habit.active == True)
    return query.order_by(models.Habit.id.asc()).all()


def get_habit(db: Session, habit_id: int) -> Optional[models.Habit]:
    return db.query(models.Habit).filter(models.Habit.id == habit_id).first()


def create_habit(db: Session, habit_in: schemas.HabitCreate) -> models.Habit:
    habit = models.Habit(name=habit_in.name.strip(), active=True, created_at=models.utcnow())
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def update_habit(db: Session, habit_id: int, habit_in: schemas.HabitUpdate) -> Optional[models.Habit]:
    habit = get_habit(db, habit_id)
    if not habit:
        return None
    data = habit_in.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        habit.name = data["name"].strip()
    if "active" in data and data["active"] is not None:
        habit.active = data["active"]
    db.commit()
    db.refresh(habit)
    return habit


def delete_habit(db: Session, habit_id: int) -> bool:
    habit = get_habit(db, habit_id)
    if not habit:
        return False
    db.delete(habit)
    db.commit()
    return True


def toggle_habit_log(
    db: Session,
    habit_id: int,
    date_str: str,
    completed: Optional[bool] = None
) -> bool:
    log = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == habit_id,
        models.HabitLog.date == date_str
    ).first()

    if log:
        if completed is None:
            new_state = not log.completed
        else:
            new_state = completed
        log.completed = new_state
        db.commit()
        return new_state
    else:
        new_state = True if completed is None else completed
        log = models.HabitLog(habit_id=habit_id, date=date_str, completed=new_state)
        db.add(log)
        db.commit()
        return new_state


def get_habits_with_history(
    db: Session,
    active_only: bool = True,
    days: int = 14,
    reference_date_str: Optional[str] = None
) -> List[schemas.HabitItemResponse]:
    habits = get_habits(db, active_only=active_only)

    if reference_date_str:
        today = datetime.date.fromisoformat(reference_date_str)
    else:
        today = datetime.date.today()

    today_str = today.isoformat()
    start_date = today - datetime.timedelta(days=days - 1)
    start_date_str = start_date.isoformat()

    habit_ids = [h.id for h in habits]
    logs = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id.in_(habit_ids),
        models.HabitLog.date >= start_date_str,
        models.HabitLog.date <= today_str
    ).all() if habit_ids else []

    # Map logs by habit_id -> {date: completed}
    log_map: Dict[int, Dict[str, bool]] = {h.id: {} for h in habits}
    for log in logs:
        if log.completed:
            log_map[log.habit_id][log.date] = True

    result = []
    for h in habits:
        history = log_map.get(h.id, {})
        is_completed_today = history.get(today_str, False)
        result.append(
            schemas.HabitItemResponse(
                id=h.id,
                name=h.name,
                active=h.active,
                created_at=h.created_at,
                completed_today=is_completed_today,
                recent_history=history
            )
        )
    return result


def seed_default_data_if_empty(db: Session):
    # Check if any habits exist
    habit_count = db.query(models.Habit).count()
    if habit_count == 0:
        default_habits = [
            "Sleep before midnight",
            "Walk or exercise",
            "No phone first 30 minutes",
            "Study or code",
            "Daily reflection"
        ]
        now = models.utcnow()
        for name in default_habits:
            db.add(models.Habit(name=name, active=True, created_at=now))
        db.commit()

    task_count = db.query(models.Task).count()
    if task_count == 0:
        today_str = datetime.date.today().isoformat()
        sample_tasks = [
            ("Review current course assignments", "high", today_str, "University"),
            ("Review algorithm notes for interviews", "medium", today_str, "Career"),
            ("Walk outside for 30 minutes", "low", today_str, "Health")
        ]
        now = models.utcnow()
        for title, priority, due, cat in sample_tasks:
            db.add(models.Task(
                title=title,
                completed=False,
                priority=priority,
                due_date=due,
                category=cat,
                created_at=now
            ))
        db.commit()


def get_contributions_history(
    db: Session,
    days: int = 120,
    reference_date_str: Optional[str] = None
) -> schemas.ContributionsResponse:
    if reference_date_str:
        end_date = datetime.date.fromisoformat(reference_date_str)
    else:
        end_date = datetime.date.today()

    start_date = end_date - datetime.timedelta(days=days - 1)
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()

    # Query habits in range
    active_habits_count = db.query(models.Habit).filter(models.Habit.active == True).count()
    habit_logs = db.query(models.HabitLog).filter(
        models.HabitLog.date >= start_str,
        models.HabitLog.date <= end_str,
        models.HabitLog.completed == True
    ).all()
    habits_map = {}
    for log in habit_logs:
        habits_map[log.date] = habits_map.get(log.date, 0) + 1

    # Query tasks completed in range
    tasks = db.query(models.Task).filter(
        models.Task.completed == True
    ).all()
    tasks_map = {}
    for t in tasks:
        t_date = None
        if t.completed_at:
            t_date = t.completed_at.strftime("%Y-%m-%d")
        elif t.due_date:
            t_date = t.due_date
        if t_date and start_str <= t_date <= end_str:
            tasks_map[t_date] = tasks_map.get(t_date, 0) + 1

    # Assemble day-by-day sequence
    day_list = []
    curr = start_date
    total_habits = 0
    total_tasks = 0

    while curr <= end_date:
        d_str = curr.isoformat()
        h_completed = habits_map.get(d_str, 0)
        t_completed = tasks_map.get(d_str, 0)

        total_habits += h_completed
        total_tasks += t_completed

        day_list.append(
            schemas.ContributionDay(
                date=d_str,
                habits_completed=h_completed,
                total_habits=active_habits_count,
                tasks_completed=t_completed
            )
        )
        curr += datetime.timedelta(days=1)

    return schemas.ContributionsResponse(
        start_date=start_str,
        end_date=end_str,
        days=day_list,
        total_habits_completed=total_habits,
        total_tasks_completed=total_tasks
    )


# ==============================================================================
# Weekly Review & Cockpit Operations
# ==============================================================================

def get_weekly_review(db: Session, week_start_str: str) -> Optional[models.WeeklyReview]:
    return db.query(models.WeeklyReview).filter(models.WeeklyReview.week_start == week_start_str).first()


def upsert_weekly_review(db: Session, week_start_str: str, review_in: schemas.WeeklyReviewUpdate) -> models.WeeklyReview:
    review = get_weekly_review(db, week_start_str)
    now = models.utcnow()
    if review:
        if review_in.wins is not None:
            review.wins = review_in.wins
        if review_in.blockers is not None:
            review.blockers = review_in.blockers
        if review_in.next_focus is not None:
            review.next_focus = review_in.next_focus
        review.updated_at = now
    else:
        review = models.WeeklyReview(
            week_start=week_start_str,
            wins=review_in.wins or "",
            blockers=review_in.blockers or "",
            next_focus=review_in.next_focus or "",
            created_at=now,
            updated_at=now
        )
        db.add(review)
    db.commit()
    db.refresh(review)
    return review


def get_weekly_cockpit(
    db: Session, reference_date_str: Optional[str] = None,
    today_str: Optional[str] = None, timezone: Optional[ZoneInfo] = None,
) -> schemas.WeeklyCockpitResponse:
    timezone = timezone or ZoneInfo("UTC")
    if reference_date_str:
        ref_date = datetime.date.fromisoformat(reference_date_str)
    else:
        ref_date = datetime.datetime.now(timezone).date()
    today = datetime.date.fromisoformat(today_str) if today_str else datetime.datetime.now(timezone).date()

    # Monday of the week (weekday 0)
    monday = ref_date - datetime.timedelta(days=ref_date.weekday())
    sunday = monday + datetime.timedelta(days=6)
    monday_str = monday.isoformat()
    sunday_str = sunday.isoformat()

    # 1. Saved review reflection
    review_model = get_weekly_review(db, monday_str)
    review_schema = schemas.WeeklyReviewResponse.model_validate(review_model) if review_model else None

    # Current active habits are the tracked set. Creation dates avoid counting
    # them before they existed, and future days do not lower an ongoing week.
    active_habits = get_habits(db, active_only=True)
    habit_ids = {h.id for h in active_habits}
    elapsed_end = min(sunday, today)
    habit_logs = db.query(models.HabitLog).filter(
        models.HabitLog.date >= monday_str,
        models.HabitLog.date <= elapsed_end.isoformat(),
        models.HabitLog.completed.is_(True),
    ).all() if elapsed_end >= monday else []

    habits_by_day, all_habits_by_day, active_log_ids_by_day = {}, {}, {}
    for log in habit_logs:
        all_habits_by_day[log.date] = all_habits_by_day.get(log.date, 0) + 1
        if log.habit_id in habit_ids:
            habits_by_day[log.date] = habits_by_day.get(log.date, 0) + 1
            active_log_ids_by_day.setdefault(log.date, set()).add(log.habit_id)

    # A planned task is one currently due in the chosen week. A completion
    # counts for that plan only if it happened by the end of the chosen week.
    utc_start = datetime.datetime.combine(monday - datetime.timedelta(days=1), datetime.time.min, tzinfo=datetime.timezone.utc)
    utc_end = datetime.datetime.combine(sunday + datetime.timedelta(days=2), datetime.time.min, tzinfo=datetime.timezone.utc)
    tasks = db.query(models.Task).filter(or_(
        models.Task.due_date.between(monday_str, sunday_str),
        and_(models.Task.completed.is_(True), models.Task.completed_at >= utc_start, models.Task.completed_at < utc_end),
    )).all()

    tasks_by_day = {}
    tasks_planned = planned_tasks_completed = 0
    progressed_projects = set()
    for t in tasks:
        t_date = None
        if t.completed and t.completed_at:
            stamp = t.completed_at if t.completed_at.tzinfo else t.completed_at.replace(tzinfo=datetime.timezone.utc)
            t_date = stamp.astimezone(timezone).date().isoformat()
        elif t.completed and t.due_date:
            # Legacy imported completions may have no completion timestamp.
            t_date = t.due_date
        if t.due_date and monday_str <= t.due_date <= sunday_str:
            tasks_planned += 1
            if t.completed and t_date and t_date <= elapsed_end.isoformat():
                planned_tasks_completed += 1
        if t_date and monday_str <= t_date <= elapsed_end.isoformat():
            tasks_by_day[t_date] = tasks_by_day.get(t_date, 0) + 1
            if t.project_id:
                progressed_projects.add(t.project_id)

    # Build 7-day breakdown (Mon-Sun)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    days_breakdown = []
    total_tasks_completed = 0
    total_habits_completed = 0
    days_active_count = 0
    total_habits_possible = 0

    for i in range(7):
        curr_d = monday + datetime.timedelta(days=i)
        curr_str = curr_d.isoformat()
        t_count = tasks_by_day.get(curr_str, 0)
        h_count = habits_by_day.get(curr_str, 0)
        possible = sum(
            1 for habit in active_habits
            if curr_d <= elapsed_end and (
                habit.id in active_log_ids_by_day.get(curr_str, set()) or
                not habit.created_at or
                (habit.created_at if habit.created_at.tzinfo else habit.created_at.replace(tzinfo=datetime.timezone.utc)).astimezone(timezone).date() <= curr_d
            )
        )
        total_tasks_completed += t_count
        total_habits_completed += h_count
        total_habits_possible += possible
        has_activity = t_count > 0 or all_habits_by_day.get(curr_str, 0) > 0
        if has_activity:
            days_active_count += 1

        days_breakdown.append(
            schemas.WeeklyDayStat(
                date=curr_str,
                day_name=day_names[i],
                tasks_completed=t_count,
                habits_completed=h_count,
                total_habits=possible,
                has_activity=has_activity,
            )
        )

    consistency_rate = round((total_habits_completed / total_habits_possible) * 100) if total_habits_possible else 0

    return schemas.WeeklyCockpitResponse(
        week_start=monday_str,
        week_end=sunday_str,
        week_number=monday.isocalendar().week,
        week_year=monday.isocalendar().year,
        tasks_planned=tasks_planned,
        planned_tasks_completed=planned_tasks_completed,
        task_completion_rate=round(planned_tasks_completed / tasks_planned * 100) if tasks_planned else 0,
        total_tasks_completed=total_tasks_completed,
        total_habits_completed=total_habits_completed,
        total_habits_possible=total_habits_possible,
        habit_consistency_rate=consistency_rate,
        days_active=days_active_count,
        projects_moved_forward=len(progressed_projects),
        xp_earned=(total_tasks_completed + sum(all_habits_by_day.values())) * XP_PER_COMPLETION,
        day_breakdown=days_breakdown,
        review=review_schema
    )
