import React, { useRef, useState } from 'react';
import { Check, Edit2, Calendar, Plus, Trash2, X } from 'lucide-react';
import TaskEditModal from './TaskEditModal';
import { getLocalDateStr } from '../utils/date';
import { api } from '../api/client';

export default function TaskItem({ task, onToggle, onDelete, onUpdate, onSubtasksChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [editingStepId, setEditingStepId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [stepBusy, setStepBusy] = useState(false);
  const [stepError, setStepError] = useState('');
  const openerRef = useRef(null);
  const openModal = (event) => { openerRef.current = event.currentTarget; setIsModalOpen(true); };
  const closeModal = () => {
    setIsModalOpen(false);
    requestAnimationFrame(() => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
      else document.querySelector('#quick-task-input')?.focus();
    });
  };

  const runStepAction = async (action) => {
    if (stepBusy) return false;
    setStepBusy(true);
    setStepError('');
    try {
      onSubtasksChange(await action());
      return true;
    } catch (err) {
      setStepError(err.message || 'Could not save this step. Try again.');
      return false;
    } finally {
      setStepBusy(false);
    }
  };

  const addStep = async (event) => {
    event.preventDefault();
    const title = newStepTitle.trim();
    if (title && await runStepAction(() => api.createSubtask(task.id, title))) {
      setNewStepTitle('');
      setIsAddingStep(false);
    }
  };
  const saveStep = async (event) => {
    event.preventDefault();
    const title = editingTitle.trim();
    if (title && await runStepAction(() => api.updateSubtask(task.id, editingStepId, { title }))) {
      setEditingStepId(null);
    }
  };
  const deleteStep = async (stepId) => {
    if (confirmDeleteId !== stepId) { setConfirmDeleteId(stepId); return; }
    if (await runStepAction(() => api.deleteSubtask(task.id, stepId))) setConfirmDeleteId(null);
  };

  const todayStr = getLocalDateStr();
  const isOverdue = !task.completed && task.due_date && task.due_date < todayStr;
  const isDueToday = task.due_date === todayStr;
  const subtasks = task.subtasks || [];
  const completedSteps = subtasks.filter((step) => step.completed).length;

  return (
    <>
      <div className={`task-card task-card-with-steps ${task.completed ? 'completed' : ''}`}>
        <div className="task-main-row">
          <div className="task-left">
            <button type="button" className={`custom-checkbox ${task.completed ? 'checked' : ''}`}
              onClick={() => onToggle(task.id, !task.completed)}
              aria-label={task.completed ? `Mark ${task.title} active` : `Mark ${task.title} completed`}
              aria-pressed={task.completed}>
              {task.completed && <Check size={12} strokeWidth={3} />}
            </button>
            <div className="task-copy">
              <button type="button" className="task-title" onClick={openModal} aria-label={`Edit ${task.title}`}>{task.title}</button>
              {task.description && <p className="task-description">{task.description}</p>}
            </div>
          </div>
          <div className="task-meta">
            {task.priority && task.priority !== 'none' && <span className={`priority-tag priority-${task.priority}`}>{task.priority}</span>}
            {task.category && <span className="category-tag">{task.category}</span>}
            {task.due_date && <span className={`due-tag ${isOverdue ? 'overdue' : ''}`}><Calendar size={12} />{isDueToday ? 'Today' : task.due_date}</span>}
            <div className="task-actions">
              <button type="button" className="action-btn-subtle" onClick={openModal} title="Edit task" aria-label={`Edit ${task.title}`}><Edit2 size={13} /></button>
            </div>
          </div>
        </div>

        {subtasks.length > 0 && (
          <div className="subtask-section">
            <div className="subtask-progress" aria-label={`${completedSteps} of ${subtasks.length} steps complete`}>
              {completedSteps} of {subtasks.length} steps
            </div>
            <ul className="subtask-list">
              {subtasks.map((step) => (
                <li key={step.id} className="subtask-row">
                  <button type="button" className={`custom-checkbox subtask-checkbox ${step.completed ? 'checked' : ''}`}
                    onClick={() => runStepAction(() => api.updateSubtask(task.id, step.id, { completed: !step.completed }))}
                    disabled={stepBusy} aria-label={step.completed ? `Mark ${step.title} incomplete` : `Complete ${step.title}`}
                    aria-pressed={step.completed}>{step.completed && <Check size={11} strokeWidth={3} />}</button>
                  {editingStepId === step.id ? (
                    <form className="subtask-edit-form" onSubmit={saveStep}>
                      <input className="task-input-field subtask-input" value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)} aria-label="Edit step title" maxLength={255} autoFocus />
                      <button type="submit" className="action-btn-subtle" disabled={!editingTitle.trim() || stepBusy} aria-label="Save step"><Check size={15} /></button>
                      <button type="button" className="action-btn-subtle" onClick={() => setEditingStepId(null)} aria-label="Cancel editing step"><X size={15} /></button>
                    </form>
                  ) : (
                    <>
                      <span className={`subtask-title ${step.completed ? 'completed' : ''}`}>{step.title}</span>
                      <button type="button" className="action-btn-subtle subtask-action" disabled={stepBusy}
                        onClick={() => { setEditingStepId(step.id); setEditingTitle(step.title); setConfirmDeleteId(null); }}
                        aria-label={`Edit step ${step.title}`}><Edit2 size={13} /></button>
                      <button type="button" className={`action-btn-subtle subtask-action ${confirmDeleteId === step.id ? 'danger' : ''}`}
                        disabled={stepBusy} onClick={() => deleteStep(step.id)}
                        aria-label={confirmDeleteId === step.id ? `Confirm delete step ${step.title}` : `Delete step ${step.title}`}
                        title={confirmDeleteId === step.id ? 'Click again to delete' : 'Delete step'}><Trash2 size={13} /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isAddingStep ? (
          <form className="subtask-add-form" onSubmit={addStep}>
            <input className="task-input-field subtask-input" value={newStepTitle}
              onChange={(event) => setNewStepTitle(event.target.value)} placeholder="Next step..."
              aria-label={`New step for ${task.title}`} maxLength={255} autoFocus />
            <button type="submit" className="btn-secondary" disabled={!newStepTitle.trim() || stepBusy}>Add step</button>
            <button type="button" className="action-btn-subtle" onClick={() => { setIsAddingStep(false); setNewStepTitle(''); }} aria-label="Cancel adding step"><X size={16} /></button>
          </form>
        ) : (
          <button type="button" className="subtask-add-button" onClick={() => setIsAddingStep(true)}><Plus size={14} /> Add step</button>
        )}
        {stepError && <p className="form-error subtask-error" role="alert">{stepError}</p>}
      </div>
      <TaskEditModal task={task} isOpen={isModalOpen} onClose={closeModal} onSave={onUpdate} onDelete={onDelete} />
    </>
  );
}
