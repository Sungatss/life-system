import React, { useRef, useState } from 'react';
import { Check, Edit2 } from 'lucide-react';
import HabitEditModal from './HabitEditModal';
import { addDays } from '../utils/date';

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
  const openerRef = useRef(null);
  const openModal = (event) => {
    openerRef.current = event.currentTarget;
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    requestAnimationFrame(() => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
      else document.querySelector('#new-habit-input, #today-new-habit-input')?.focus();
    });
  };

  // Generate date array for the history grid (from (today - days + 1) up to today)
  const historyDates = [];
  for (let i = daysHistory - 1; i >= 0; i--) {
    historyDates.push(addDays(todayDate, -i));
  }

  const isCompletedToday = Boolean(habit.completed_today);

  return (
    <>
      <div className="habit-card">
        <div className="habit-info">
          <button
            type="button"
            className="habit-name"
            onClick={openModal}
            aria-label={`Edit ${habit.name}`}
          >
            {habit.name}
          </button>
          <div className="habit-history-row">
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

        <div className="habit-card-actions">
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
              onClick={openModal}
              title="Edit habit"
              aria-label="Edit habit"
            >
              <Edit2 size={13} />
            </button>
          </div>
        </div>
      </div>

      <HabitEditModal
        habit={habit}
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
}
