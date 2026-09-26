import React, { useState } from 'react';
import { Check, Trash2, Edit2, Calendar } from 'lucide-react';

export default function TaskItem({ task, onToggle, onDelete, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState(task.priority || 'none');
  const [editDueDate, setEditDueDate] = useState(task.due_date || '');
  const [editCategory, setEditCategory] = useState(task.category || '');

  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = !task.completed && task.due_date && task.due_date < todayStr;
  const isDueToday = task.due_date === todayStr;

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    onUpdate(task.id, {
      title: editTitle.trim(),
      priority: editPriority,
      due_date: editDueDate || null,
      category: editCategory.trim() || null,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(task.title);
    setEditPriority(task.priority || 'none');
    setEditDueDate(task.due_date || '');
    setEditCategory(task.category || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="task-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="text"
            className="task-input-field"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <select
              className="select-compact"
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
            >
              <option value="none">Priority: None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input
              type="date"
              className="select-compact"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
            />
            <input
              type="text"
              className="select-compact"
              placeholder="Project or category"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={handleCancelEdit}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`task-card ${task.completed ? 'completed' : ''}`}>
      <div className="task-left">
        <button
          type="button"
          className={`custom-checkbox ${task.completed ? 'checked' : ''}`}
          onClick={() => onToggle(task.id, !task.completed)}
          aria-label={task.completed ? 'Mark task active' : 'Mark task completed'}
        >
          {task.completed && <Check size={12} strokeWidth={3} />}
        </button>
        <span className="task-title">{task.title}</span>
      </div>

      <div className="task-meta">
        {task.priority && task.priority !== 'none' && (
          <span className={`priority-tag priority-${task.priority}`}>
            {task.priority}
          </span>
        )}

        {task.category && (
          <span className="category-tag">
            {task.category}
          </span>
        )}

        {task.due_date && (
          <span className={`due-tag ${isOverdue ? 'overdue' : ''}`}>
            <Calendar size={12} />
            {isDueToday ? 'Today' : task.due_date}
          </span>
        )}

        <div className="task-actions">
          <button
            type="button"
            className="action-btn-subtle"
            onClick={() => setIsEditing(true)}
            title="Edit task"
            aria-label="Edit task"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            className="action-btn-subtle danger"
            onClick={() => onDelete(task.id)}
            title="Delete task"
            aria-label="Delete task"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
