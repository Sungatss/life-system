import React, { useState } from 'react';
import { Plus, AlignLeft, ChevronDown } from 'lucide-react';

export default function QuickTaskInput({ onAddTask, defaultDueDate = null }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [priority, setPriority] = useState('none');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onAddTask({
        title: title.trim(),
        description: description.trim(),
        priority: priority !== 'none' ? priority : 'none',
        due_date: dueDate || null,
        category: category.trim() || null,
        completed: false,
      });
      setTitle('');
      setDescription('');
      setCategory('');
      setShowDetails(false);
      setPriority('none');
      if (!defaultDueDate) {
        setDueDate('');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      setSubmitError('Could not add the task. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="quick-task-form task-capture-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="task-input-field"
        placeholder="Add a task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isSubmitting}
        id="quick-task-input"
      />

      <div className="quick-options">
        <select
          className="select-compact"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          title="Priority"
          aria-label="Priority"
        >
          <option value="none">Priority: None</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <input
          type="date"
          className="select-compact"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          title="Due date"
          aria-label="Due date"
        />

        <button
          type="submit"
          className="btn-primary"
          disabled={!title.trim() || isSubmitting}
          id="quick-task-submit-btn"
        >
          <Plus size={16} />
          <span>Add</span>
        </button>
      </div>

      <button
        type="button"
        className="task-details-toggle"
        onClick={() => setShowDetails((open) => !open)}
        aria-expanded={showDetails}
      >
        <AlignLeft size={14} />
        {showDetails ? 'Hide details' : 'Add details or project'}
        <ChevronDown size={13} className={showDetails ? 'rotated' : ''} />
      </button>

      {showDetails && (
        <div className="task-details-fields">
          <textarea
            className="task-input-field task-description-input"
            placeholder="Description (optional)"
            aria-label="Task description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            rows={2}
          />
          <input
            type="text"
            className="task-input-field"
            placeholder="Project or category (optional)"
            aria-label="Task project or category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      )}
      {submitError && <p className="form-error" role="alert">{submitError}</p>}
    </form>
  );
}
