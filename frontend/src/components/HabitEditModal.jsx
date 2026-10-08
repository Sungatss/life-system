import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { trapDialogFocus } from '../utils/dialog';

export default function HabitEditModal({ habit, isOpen, onClose, onSave, onDelete }) {
  if (!isOpen || !habit) return null;

  return <HabitEditForm key={habit.id} habit={habit} onClose={onClose} onSave={onSave} onDelete={onDelete} />;
}

function HabitEditForm({ habit, onClose, onSave, onDelete }) {
  const [name, setName] = useState(habit.name || '');
  const [active, setActive] = useState(habit.active !== undefined ? habit.active : true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setFormError('');
    try {
      await onSave(habit.id, { name: name.trim(), active });
      onClose();
    } catch {
      setFormError('Could not save this habit. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await onDelete(habit.id);
      onClose();
    } catch {
      setFormError('Could not delete this habit. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-habit-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} onKeyDown={trapDialogFocus}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="modal-habit-title" className="modal-title">Edit habit</h2>
          <button
            type="button"
            className="action-btn-subtle"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="edit-habit-name">Habit name</label>
            <input
              id="edit-habit-name"
              type="text"
              className="task-input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Study or code, Walk or exercise"
              required
              autoFocus
            />
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <input
              id="edit-habit-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="edit-habit-active" style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              Active (show in daily habit checklist)
            </label>
          </div>

          {formError && <p className="form-error" role="alert">{formError}</p>}

          <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: '8px' }}>
            <button
              type="button"
              className={`btn-secondary ${confirmDelete ? 'priority-high' : ''}`}
              style={confirmDelete ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}}
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 size={13} style={{ marginRight: '4px' }} />
              {confirmDelete ? 'Click to confirm delete' : 'Delete habit'}
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!name.trim() || busy}>
                Save changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
