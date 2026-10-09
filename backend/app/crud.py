import datetime
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from . import models, schemas


def get_daily_note_by_date(db: Session, date_str: str) -> Optional[models.DailyNote]:
    return db.query(models.DailyNote).filter(models.DailyNote.date == date_str).first()


def upsert_daily_note(db: Session, date_str: str, content: str) -> models.DailyNote:
    note = get_daily_note_by_date(db, date_str)
    now = models.utcnow()
    if note:
        note.content = content
        note.updated_at = now
    else:
        note = models.DailyNote(date=date_str, content=content, created_at=now, updated_at=now)
        db.add(note)
    db.commit()
    db.refresh(note)
    return note


def search_daily_notes(db: Session, query_str: str, limit: int = 50) -> List[schemas.DailyNoteSearchResult]:
    cleaned = query_str.strip()
    if not cleaned:
        return []
    pattern = f"%{cleaned}%"
    notes = db.query(models.DailyNote).filter(
        models.DailyNote.content.ilike(pattern)
    ).order_by(desc(models.DailyNote.date)).limit(limit).all()

    results = []
    for note in notes:
        content = note.content or ""
        lower_content = content.lower()
        idx = lower_content.find(cleaned.lower())
        if idx == -1:
            idx = 0
        start = max(0, idx - 40)
        end = min(len(content), idx + len(cleaned) + 60)
        snippet = ("..." if start > 0 else "") + content[start:end].strip() + ("..." if end < len(content) else "")
        words = len(content.split())
        results.append(
            schemas.DailyNoteSearchResult(
                id=note.id,
                date=note.date,
                snippet=snippet,
                content=content,
                word_count=words,
                updated_at=note.updated_at or note.created_at
            )
        )
    return results



def get_tasks(
    db: Session,
    filter_type: Optional[str] = None,
    category: Optional[str] = None
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

    # Query notes in range
    notes = db.query(models.DailyNote).filter(
        models.DailyNote.date >= start_str,
        models.DailyNote.date <= end_str
    ).all()
    notes_map = {}
    for n in notes:
        text = (n.content or "").strip()
        words = len(text.split()) if text else 0
        if words > 0:
            notes_map[n.date] = words

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
    total_notes = 0
    total_habits = 0
    total_tasks = 0

    while curr <= end_date:
        d_str = curr.isoformat()
        has_note = d_str in notes_map
        words = notes_map.get(d_str, 0)
        h_completed = habits_map.get(d_str, 0)
        t_completed = tasks_map.get(d_str, 0)

        if has_note:
            total_notes += 1
        total_habits += h_completed
        total_tasks += t_completed

        day_list.append(
            schemas.ContributionDay(
                date=d_str,
                has_note=has_note,
                note_words=words,
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
        total_notes_written=total_notes,
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


def get_weekly_cockpit(db: Session, reference_date_str: Optional[str] = None) -> schemas.WeeklyCockpitResponse:
    if reference_date_str:
        ref_date = datetime.date.fromisoformat(reference_date_str)
    else:
        ref_date = datetime.date.today()

    # Monday of the week (weekday 0)
    monday = ref_date - datetime.timedelta(days=ref_date.weekday())
    sunday = monday + datetime.timedelta(days=6)
    monday_str = monday.isoformat()
    sunday_str = sunday.isoformat()

    # 1. Saved review reflection
    review_model = get_weekly_review(db, monday_str)
    review_schema = schemas.WeeklyReviewResponse.model_validate(review_model) if review_model else None

    # 2. Daily notes in this week
    notes = db.query(models.DailyNote).filter(
        models.DailyNote.date >= monday_str,
        models.DailyNote.date <= sunday_str
    ).all()
    notes_map = {n.date: len(n.content.split()) for n in notes if n.content}

    # 3. Active habits & logs in this week
    active_habits = get_habits(db, active_only=True)
    habit_ids = [h.id for h in active_habits]
    active_habits_count = len(active_habits)

    habit_logs = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id.in_(habit_ids),
        models.HabitLog.date >= monday_str,
        models.HabitLog.date <= sunday_str,
        models.HabitLog.completed == True
    ).all() if habit_ids else []

    habits_by_day = {}
    for log in habit_logs:
        habits_by_day[log.date] = habits_by_day.get(log.date, 0) + 1

    # 4. Completed tasks in this week
    tasks = db.query(models.Task).filter(
        models.Task.completed == True
    ).all()

    tasks_by_day = {}
    for t in tasks:
        t_date = None
        if t.completed_at:
            t_date = t.completed_at.strftime("%Y-%m-%d")
        elif t.due_date:
            t_date = t.due_date
        if t_date and monday_str <= t_date <= sunday_str:
            tasks_by_day[t_date] = tasks_by_day.get(t_date, 0) + 1

    # 5. Build 7-day breakdown (Mon-Sun)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    days_breakdown = []
    total_tasks_completed = 0
    total_habits_completed = 0
    total_words_written = 0
    days_active_count = 0

    for i in range(7):
        curr_d = monday + datetime.timedelta(days=i)
        curr_str = curr_d.isoformat()
        t_count = tasks_by_day.get(curr_str, 0)
        h_count = habits_by_day.get(curr_str, 0)
        has_note = curr_str in notes_map
        words = notes_map.get(curr_str, 0)

        total_tasks_completed += t_count
        total_habits_completed += h_count
        total_words_written += words
        if t_count > 0 or h_count > 0 or has_note:
            days_active_count += 1

        days_breakdown.append(
            schemas.WeeklyDayStat(
                date=curr_str,
                day_name=day_names[i],
                tasks_completed=t_count,
                habits_completed=h_count,
                total_habits=active_habits_count,
                has_note=has_note,
                note_words=words
            )
        )

    total_possible_habits = active_habits_count * 7
    consistency_rate = round((total_habits_completed / total_possible_habits) * 100) if total_possible_habits > 0 else 0

    return schemas.WeeklyCockpitResponse(
        week_start=monday_str,
        week_end=sunday_str,
        total_tasks_completed=total_tasks_completed,
        total_habits_completed=total_habits_completed,
        total_habits_possible=total_possible_habits,
        habit_consistency_rate=consistency_rate,
        days_active=days_active_count,
        total_words_written=total_words_written,
        day_breakdown=days_breakdown,
        review=review_schema
    )
