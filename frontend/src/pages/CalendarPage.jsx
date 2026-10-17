import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus } from 'lucide-react';
import { api } from '../api/client';
import { addDays, getLocalDateStr } from '../utils/date';
import './CalendarPage.css';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function localDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function monthDays(month) {
  const first = `${month}-01`;
  const weekday = (localDate(first).getDay() + 6) % 7;
  const start = addDays(first, -weekday);
  const nextMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1);
  const last = addDays(getLocalDateStr(nextMonth), -1);
  const endOffset = (7 - (localDate(last).getDay() + 6) % 7 - 1) % 7;
  const end = addDays(last, endOffset);
  const days = [];
  for (let date = start; date <= end; date = addDays(date, 1)) days.push(date);
  return { start, end, days };
}

function shiftMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  return getLocalDateStr(new Date(year, number - 1 + offset, 1)).slice(0, 7);
}

function dateLabel(date) {
  return localDate(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function timeLabel(time) {
  if (!time) return 'All day';
  const [hour, minute] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function emptyDraft(date) {
  return { type: 'event', title: '', date, timed: false, start_time: '09:00', end_time: '10:00', notes: '' };
}

function TaskDeadline({ task, onMoved }) {
  const [newDate, setNewDate] = useState(task.due_date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const move = async (event) => {
    event.preventDefault();
    if (!newDate || newDate === task.due_date || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.updateTask(task.id, { due_date: newDate });
      onMoved(newDate);
    } catch (cause) {
      setError(cause.message || 'Could not move this task.');
    } finally {
      setSaving(false);
    }
  };

  return <li className={`calendar-agenda-item calendar-task${task.completed ? ' is-complete' : ''}`}>
    <div className="calendar-agenda-marker" aria-hidden="true" />
    <div className="calendar-agenda-content">
      <div className="calendar-item-heading"><strong>{task.title}</strong><span className="calendar-kind">Task due</span></div>
      {task.project_name && <p className="calendar-item-meta">{task.project_name}</p>}
      {task.completed && <p className="calendar-item-meta">Completed</p>}
      <form className="calendar-reschedule" onSubmit={move}>
        <label htmlFor={`calendar-task-date-${task.id}`}>Move to</label>
        <input id={`calendar-task-date-${task.id}`} type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required disabled={saving} />
        <button type="submit" className="btn-secondary" disabled={saving || !newDate || newDate === task.due_date}>Save</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </li>;
}

export default function CalendarPage() {
  const today = getLocalDateStr();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [feed, setFeed] = useState({ events: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(() => emptyDraft(today));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef(null);
  const range = useMemo(() => monthDays(month), [month]);

  useEffect(() => {
    let active = true;
    api.getCalendar(range.start, range.end).then((result) => {
      if (!active) return;
      setFeed(result);
      setLoadError('');
    }).catch(() => {
      if (active) setLoadError('Could not load your calendar. Check your connection and try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range.start, range.end, refresh]);

  useEffect(() => {
    if (formOpen) titleRef.current?.focus();
  }, [formOpen, editingId]);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const day of range.days) map.set(day, { events: [], tasks: [] });
    for (const item of feed.events) map.get(item.date)?.events.push(item);
    for (const task of feed.tasks) map.get(task.due_date)?.tasks.push(task);
    return map;
  }, [feed, range.days]);
  const selectedItems = byDate.get(selected) || { events: [], tasks: [] };
  const events = [...selectedItems.events].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const changeMonth = (offset) => {
    const next = shiftMonth(month, offset);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
    setLoading(true);
  };

  const selectDay = (date) => {
    setSelected(date);
    if (date.slice(0, 7) !== month) {
      setMonth(date.slice(0, 7));
      setLoading(true);
    }
  };

  const beginCreate = () => {
    setDraft(emptyDraft(selected));
    setEditingId(null);
    setConfirmDelete(false);
    setFormError('');
    setFormOpen(true);
  };

  const beginEdit = (item) => {
    setDraft({ type: item.kind, title: item.title, date: item.date, timed: Boolean(item.start_time), start_time: item.start_time || '09:00', end_time: item.end_time || '10:00', notes: item.notes });
    setEditingId(item.id);
    setConfirmDelete(false);
    setFormError('');
    setFormOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    try {
      if (draft.type === 'task') {
        await api.createTask({ title: draft.title.trim(), due_date: draft.date });
      } else {
        const payload = {
          title: draft.title.trim(), kind: draft.type, date: draft.date,
          start_time: draft.timed ? draft.start_time : null,
          end_time: draft.timed && draft.type === 'event' ? draft.end_time : null,
          notes: draft.notes.trim(),
        };
        if (editingId) await api.updateCalendarEvent(editingId, payload);
        else await api.createCalendarEvent(payload);
      }
      setSelected(draft.date);
      setMonth(draft.date.slice(0, 7));
      setFormOpen(false);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setFormError(cause.message || 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    setFormError('');
    try {
      await api.deleteCalendarEvent(editingId);
      setFormOpen(false);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setFormError(cause.message || 'Could not delete this item.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="calendar-page">
    <div className="calendar-page-head">
      <div><p className="cockpit-weekday">PLAN YOUR TIME</p><h1 className="cockpit-title">Calendar</h1></div>
      <button type="button" className="btn-primary calendar-add" onClick={beginCreate}><Plus size={16} aria-hidden="true" /> Add item</button>
    </div>

    <section className="cockpit-section calendar-board" aria-label="Monthly calendar">
      <div className="calendar-month-head">
        <h2>{localDate(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <div className="calendar-month-actions">
          <button type="button" className="btn-secondary" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); setLoading(true); setRefresh((value) => value + 1); }}>Today</button>
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="calendar-grid" role="grid" aria-label={`${month} calendar`}>
        {weekdays.map((day) => <div key={day} className="calendar-weekday" role="columnheader">{day}</div>)}
        {range.days.map((date) => {
          const items = byDate.get(date) || { events: [], tasks: [] };
          const count = items.events.length + items.tasks.length;
          return <button key={date} type="button" role="gridcell" className={`calendar-day${date.slice(0, 7) !== month ? ' outside' : ''}${date === selected ? ' selected' : ''}${date === today ? ' today' : ''}`} onClick={() => selectDay(date)} aria-label={`${dateLabel(date)}${count ? `, ${items.events.length} events or deadlines, ${items.tasks.length} task deadlines` : ', no items'}`} aria-selected={date === selected}>
            <span className="calendar-day-number">{Number(date.slice(-2))}</span>
            <span className="calendar-day-dots" aria-hidden="true">{items.events.length > 0 && <i className="calendar-dot event" />}{items.tasks.length > 0 && <i className="calendar-dot task" />}</span>
            {count > 0 && <span className="calendar-day-count" aria-hidden="true">{count}</span>}
          </button>;
        })}
      </div>
      {loadError && <div className="calendar-load-error" role="alert">{loadError} <button type="button" className="btn-secondary" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}>Retry</button></div>}
    </section>

    <section className="cockpit-section calendar-agenda" aria-label={`Schedule for ${dateLabel(selected)}`}>
      <div className="calendar-agenda-head"><div><p className="cockpit-weekday">SELECTED DAY</p><h2>{dateLabel(selected)}</h2></div><CalendarDays size={22} aria-hidden="true" /></div>
      {loading ? <p className="calendar-empty" role="status">Loading schedule…</p> : loadError ? null : events.length + selectedItems.tasks.length === 0 ? <p className="calendar-empty">Nothing planned yet. Add an event, deadline, or task due date.</p> : <ul className="calendar-agenda-list">
        {events.map((item) => <li className={`calendar-agenda-item calendar-${item.kind}`} key={item.id}>
          <div className="calendar-agenda-marker" aria-hidden="true" />
          <div className="calendar-agenda-content">
            <div className="calendar-item-heading"><strong>{item.title}</strong><span className="calendar-kind">{item.kind}</span></div>
            <p className="calendar-item-meta"><Clock3 size={13} aria-hidden="true" /> {item.start_time ? `${timeLabel(item.start_time)}${item.end_time ? ` – ${timeLabel(item.end_time)}` : ''}` : 'All day'}</p>
            {item.notes && <p className="calendar-item-notes">{item.notes}</p>}
            <button type="button" className="calendar-text-button" onClick={() => beginEdit(item)}>Edit</button>
          </div>
        </li>)}
        {selectedItems.tasks.map((task) => <TaskDeadline key={task.id} task={task} onMoved={(date) => { setSelected(date); setMonth(date.slice(0, 7)); setRefresh((value) => value + 1); }} />)}
      </ul>}
    </section>

    {formOpen && <section className="cockpit-section calendar-editor" aria-label={editingId ? 'Edit calendar item' : 'Add calendar item'}>
      <div className="section-header"><h2 className="section-title">{editingId ? 'Edit item' : 'Add to calendar'}</h2><button type="button" className="calendar-text-button" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button></div>
      <form onSubmit={save} className="calendar-form">
        {!editingId && <div className="calendar-form-field"><label htmlFor="calendar-type">Type</label><select id="calendar-type" className="select-compact" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value, timed: false })}><option value="event">Event</option><option value="deadline">Deadline</option><option value="task">Task due date</option></select></div>}
        <div className="calendar-form-field"><label htmlFor="calendar-title">Title</label><input ref={titleRef} id="calendar-title" className="task-input-field" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={255} required placeholder={draft.type === 'task' ? 'Task name' : draft.type === 'deadline' ? 'What is due?' : 'What is happening?'} /></div>
        <div className="calendar-form-field"><label htmlFor="calendar-date">Date</label><input id="calendar-date" type="date" className="task-input-field" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required /></div>
        {draft.type !== 'task' && <>
          <label className="calendar-check"><input type="checkbox" checked={!draft.timed} onChange={(event) => setDraft({ ...draft, timed: !event.target.checked })} /> All day</label>
          {draft.timed && <div className="calendar-time-fields"><div className="calendar-form-field"><label htmlFor="calendar-start">{draft.type === 'deadline' ? 'Due at' : 'Starts'}</label><input id="calendar-start" type="time" className="task-input-field" value={draft.start_time} onChange={(event) => setDraft({ ...draft, start_time: event.target.value })} required /></div>{draft.type === 'event' && <div className="calendar-form-field"><label htmlFor="calendar-end">Ends</label><input id="calendar-end" type="time" className="task-input-field" value={draft.end_time} onChange={(event) => setDraft({ ...draft, end_time: event.target.value })} min={draft.start_time} required /></div>}</div>}
          <div className="calendar-form-field"><label htmlFor="calendar-notes">Notes <span>(optional)</span></label><textarea id="calendar-notes" className="task-input-field" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} maxLength={5000} rows={3} /></div>
        </>}
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="calendar-form-actions"><button type="submit" className="btn-primary" disabled={saving || !draft.title.trim() || !draft.date}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add to calendar'}</button>{editingId && <button type="button" className={`calendar-delete${confirmDelete ? ' confirming' : ''}`} onClick={remove} disabled={saving}>{confirmDelete ? 'Confirm delete' : 'Delete item'}</button>}</div>
      </form>
    </section>}
  </div>;
}
