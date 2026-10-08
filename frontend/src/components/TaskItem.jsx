import React, { useRef, useState } from 'react';
import { Check, Edit2, Calendar } from 'lucide-react';
import TaskEditModal from './TaskEditModal';
import { getLocalDateStr } from '../utils/date';

export default function TaskItem({ task, onToggle, onDelete, onUpdate }) {
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
      else document.querySelector('#quick-task-input')?.focus();
    });
  };

  const todayStr = getLocalDateStr();
  const isOverdue = !task.completed && task.due_date && task.due_date < todayStr;
  const isDueToday = task.due_date === todayStr;

  return (
    <>
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
          <div className="task-copy">
            <button
              type="button"
              className="task-title"
              onClick={openModal}
              aria-label={`Edit ${task.title}`}
            >
              {task.title}
            </button>
            {task.description && <p className="task-description">{task.description}</p>}
          </div>
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

          <div className="task-actions" style={{ opacity: 1 }}>
            <button
              type="button"
              className="action-btn-subtle"
              onClick={openModal}
              title="Edit task"
              aria-label="Edit task"
            >
              <Edit2 size={13} />
            </button>
          </div>
        </div>
      </div>

      <TaskEditModal
        task={task}
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
}
