import React, { useState } from 'react';
import { Check, Edit2, Trash2 } from 'lucide-react';

export default function HabitItem({ habit, todayDate, onToggleToday, onUpdate, onDelete, daysHistory = 14 }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(habit.name);

  // Generate date array for the history grid (from (today - days + 1) up to today)
  const historyDates = [];
  const baseDate = new Date(todayDate);
  for (let i = daysHistory - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    historyDates.push(d.toISOString().split('T')[0]);
  }

  const isCompletedToday = Boolean(habit.completed_today);

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    onUpdate(habit.id, { name: editName.trim() });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="habit-card">
        <form onSubmit={handleSaveEdit} style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <input
            type="text"
            className="task-input-field"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-primary">
            Save
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setEditName(habit.name);
              setIsEditing(false);
            }}
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="habit-card">
      <div className="habit-info">
        <span className="habit-name">{habit.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
          {/* Recent days history grid */}
          <div className="history-grid-container" title="Recent consistency">
            {historyDates.map((dateStr) => {
              const completed = Boolean(habit.recent_history && habit.recent_history[dateStr]);
              const isToday = dateStr === todayDate;
              return (
                <div
                  key={dateStr}
                  className={`history-day-cell ${completed ? 'active' : ''}`}
                  title={`${dateStr}${isToday ? ' (Today)' : ''}: ${completed ? 'Completed' : 'Not completed'}`}
                  style={isToday ? { outline: '1px solid var(--border-strong)' } : {}}
                />
              );
            })}
          </div>
          <span className="habit-status-text">
            {isCompletedToday ? 'Done today' : 'Pending'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className={`habit-check-btn ${isCompletedToday ? 'completed' : ''}`}
          onClick={() => onToggleToday(habit.id, !isCompletedToday)}
          aria-label={isCompletedToday ? 'Mark habit incomplete' : 'Mark habit complete'}
        >
          <Check size={14} strokeWidth={isCompletedToday ? 3 : 2} />
          <span>{isCompletedToday ? 'Completed' : 'Mark complete'}</span>
        </button>

        <div className="task-actions">
          <button
            type="button"
            className="action-btn-subtle"
            onClick={() => setIsEditing(true)}
            title="Edit habit"
            aria-label="Edit habit"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            className="action-btn-subtle danger"
            onClick={() => onDelete(habit.id)}
            title="Delete habit"
            aria-label="Delete habit"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
