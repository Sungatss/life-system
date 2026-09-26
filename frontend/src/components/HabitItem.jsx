import React, { useState } from 'react';
import { Check, Edit2, Trash2 } from 'lucide-react';
import HabitEditModal from './HabitEditModal';

export default function HabitItem({
  habit,
  todayDate,
  onToggleToday,
  onUpdate,
  onDelete,
  daysHistory = 14,
  showHistory = true,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Generate date array for the history grid (from (today - days + 1) up to today)
  const historyDates = [];
  const baseDate = new Date(todayDate);
  for (let i = daysHistory - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    historyDates.push(d.toISOString().split('T')[0]);
  }

  const isCompletedToday = Boolean(habit.completed_today);

  return (
    <>
      <div className="habit-card">
        <div className="habit-info">
          <span
            className="habit-name"
            onClick={() => setIsModalOpen(true)}
            style={{ cursor: 'pointer' }}
            title="Click to edit habit"
          >
            {habit.name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            {showHistory && (
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
            )}
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

          <div className="task-actions" style={{ opacity: 1 }}>
            <button
              type="button"
              className="action-btn-subtle"
              onClick={() => setIsModalOpen(true)}
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

      <HabitEditModal
        habit={habit}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
}
