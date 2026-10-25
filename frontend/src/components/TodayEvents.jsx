import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock3, Plus } from 'lucide-react';
import { api } from '../api/client';
import './TodayEvents.css';

const emptyDraft = () => ({ title: '', kind: 'event', allDay: true, startTime: '09:00', endTime: '10:00', notes: '' });

function timeLabel(time) {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function scheduleLabel(item) {
  if (!item.start_time) return 'All day';
  if (item.kind === 'deadline') return `Due ${timeLabel(item.start_time)}`;
  return `${timeLabel(item.start_time)} – ${timeLabel(item.end_time)}`;
}

export default function TodayEvents({ date, events, onSaved, onDeleted }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef(null);
  const sortedEvents = [...events].sort((left, right) =>
    (left.start_time || '').localeCompare(right.start_time || '') || left.id - right.id);

  useEffect(() => {
    if (formOpen) titleRef.current?.focus();
  }, [formOpen, editingId]);

  const beginCreate = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setConfirmDelete(false);
    setError('');
    setFormOpen(true);
  };

  const beginEdit = (item) => {
    setDraft({
      title: item.title, kind: item.kind, allDay: !item.start_time,
      startTime: item.start_time || '09:00', endTime: item.end_time || '10:00', notes: item.notes || '',
    });
    setEditingId(item.id);
    setConfirmDelete(false);
    setError('');
    setFormOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.allDay && draft.kind === 'event' && draft.endTime <= draft.startTime) {
      setError('End time must be after start time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: draft.title.trim(), kind: draft.kind, date,
        start_time: draft.allDay ? null : draft.startTime,
        end_time: draft.allDay || draft.kind === 'deadline' ? null : draft.endTime,
        notes: draft.notes.trim(),
      };
      const saved = editingId
        ? await api.updateCalendarEvent(editingId, payload)
        : await api.createCalendarEvent(payload);
      onSaved(saved);
      setFormOpen(false);
    } catch (cause) {
      setError(cause.message || 'Could not save this event. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    setError('');
    try {
      await api.deleteCalendarEvent(editingId);
      onDeleted(editingId, date);
      setFormOpen(false);
    } catch (cause) {
      setError(cause.message || 'Could not delete this event. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="cockpit-section today-events" aria-label="Events and deadlines for the selected day">
      <div className="section-header">
        <div className="section-title-wrap"><CalendarDays size={16} aria-hidden="true" /><h2 className="section-title">Events &amp; deadlines</h2></div>
        <div className="today-events-actions">
          <span className="section-badge">{events.length}</span>
          <button type="button" className="btn-secondary today-add-event" onClick={beginCreate} disabled={saving}>
            <Plus size={15} aria-hidden="true" /> Add event
          </button>
        </div>
      </div>

      {formOpen && (
        <form className="today-event-form" onSubmit={save} aria-label={editingId ? `Edit ${draft.kind}` : 'Add event'}>
          <div className="today-event-field">
            <label htmlFor="today-event-title">{draft.kind === 'deadline' ? 'Deadline' : 'Event'}</label>
            <input ref={titleRef} id="today-event-title" className="task-input-field" value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Meeting, show, appointment…" maxLength={255} required disabled={saving} />
          </div>
          <label className="today-event-all-day">
            <input type="checkbox" checked={draft.allDay} onChange={(event) => setDraft((current) => ({ ...current, allDay: event.target.checked }))} disabled={saving} />
            All day
          </label>
          {!draft.allDay && <div className="today-event-time-fields">
            <div className="today-event-field"><label htmlFor="today-event-start">{draft.kind === 'deadline' ? 'Due at' : 'Starts'}</label><input id="today-event-start" className="task-input-field" type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} required disabled={saving} /></div>
            {draft.kind === 'event' && <div className="today-event-field"><label htmlFor="today-event-end">Ends</label><input id="today-event-end" className="task-input-field" type="time" value={draft.endTime} min={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} required disabled={saving} /></div>}
          </div>}
          <div className="today-event-field"><label htmlFor="today-event-notes">Notes <span>(optional)</span></label><textarea id="today-event-notes" className="task-input-field" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={2} maxLength={5000} disabled={saving} /></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="today-event-form-actions">
            <button type="submit" className="btn-primary" disabled={saving || !draft.title.trim()}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add event'}</button>
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
            {editingId && <button type="button" className={`today-event-delete${confirmDelete ? ' confirming' : ''}`} onClick={remove} disabled={saving}>{confirmDelete ? 'Confirm delete' : 'Delete'}</button>}
          </div>
        </form>
      )}

      {sortedEvents.length === 0 ? <p className="today-events-empty">No events or deadlines for this day.</p> : (
        <ul className="today-event-list">
          {sortedEvents.map((item) => <li key={item.id} className={`today-event-card${item.kind === 'deadline' ? ' is-deadline' : ''}`}>
            <div className="today-event-copy">
              <div className="today-event-heading"><strong>{item.title}</strong>{item.kind === 'deadline' && <span>Deadline</span>}</div>
              <p className="today-event-time"><Clock3 size={13} aria-hidden="true" />{scheduleLabel(item)}</p>
              {item.notes && <p className="today-event-notes">{item.notes}</p>}
            </div>
            <button type="button" className="today-event-edit" onClick={() => beginEdit(item)} aria-label={`Edit ${item.title}`}>Edit</button>
          </li>)}
        </ul>
      )}
    </section>
  );
}
