import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';

export default function TaskEditModal({ task, isOpen, onClose, onSave, onDelete }) {
  if (!isOpen || !task) return null;

  const [title, setTitle] = useState(task.title || '');
  const [priority, setPriority] = useState(task.priority || 'none');
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [category, setCategory] = useState(task.category || '');
  const [completed, setCompleted] = useState(Boolean(task.completed));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave(task.id, {
      title: title.trim(),
      priority,
      due_date: dueDate || null,
      category: category.trim() || null,
      completed,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(task.id);
    onClose();
  };

  const setDueToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDueDate(today);
  };

  const setDueTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDueDate(tomorrow.toISOString().split('T')[0]);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-task-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="modal-task-title" className="modal-title">Edit task</h2>
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
            <label className="form-label" htmlFor="edit-task-title">Task title</label>
            <input
              id="edit-task-title"
              type="text"
              className="task-input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-task-priority">Priority</label>
              <select
                id="edit-task-priority"
                className="select-compact"
                style={{ width: '100%' }}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-task-category">Project / Category</label>
              <input
                id="edit-task-category"
                type="text"
                className="select-compact"
                style={{ width: '100%' }}
                placeholder="e.g. University, Career"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label className="form-label" htmlFor="edit-task-due">Due date</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="filter-pill"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                  onClick={setDueToday}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="filter-pill"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                  onClick={setDueTomorrow}
                >
                  Tomorrow
                </button>
                {dueDate && (
                  <button
                    type="button"
                    className="filter-pill"
                    style={{ padding: '2px 8px', fontSize: '11px' }}
                    onClick={() => setDueDate('')}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <input
              id="edit-task-due"
              type="date"
              className="select-compact"
              style={{ width: '100%' }}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <input
              id="edit-task-completed"
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="edit-task-completed" style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              Mark as completed
            </label>
          </div>

          <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: '8px' }}>
            <button
              type="button"
              className={`btn-secondary ${confirmDelete ? 'priority-high' : ''}`}
              style={confirmDelete ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}}
              onClick={handleDelete}
            >
              <Trash2 size={13} style={{ marginRight: '4px' }} />
              {confirmDelete ? 'Click to confirm delete' : 'Delete'}
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!title.trim()}>
                Save changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
