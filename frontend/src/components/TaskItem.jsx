import React, { useState } from 'react';
import { Check, Trash2, Edit2, Calendar } from 'lucide-react';
import TaskEditModal from './TaskEditModal';
import { getLocalDateStr } from '../utils/date';

export default function TaskItem({ task, onToggle, onDelete, onUpdate }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

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
          <span
            className="task-title"
            onClick={() => setIsModalOpen(true)}
            style={{ cursor: 'pointer' }}
            title="Click to edit task"
          >
            {task.title}
          </span>
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
              onClick={() => setIsModalOpen(true)}
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

      <TaskEditModal
        task={task}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
}
