import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { TASK_PRIORITIES, TASK_SORT_OPTIONS } from '../utils/taskFilters';

export default function TaskControls({ status, onStatusChange, priorities, onPrioritiesChange, area, onAreaChange, areas, hasUnassignedArea, sortBy, onSortChange, onReset, visibleCount, totalCount }) {
  const [open, setOpen] = useState(false);
  const activeCount = Number(status !== 'all') + Number(priorities.length > 0) + Number(Boolean(area));

  const togglePriority = (priority) => {
    onPrioritiesChange(priorities.includes(priority)
      ? priorities.filter((selected) => selected !== priority)
      : [...priorities, priority]);
  };

  return (
    <div className="task-controls">
      <div className="task-controls-bar">
        <button type="button" className={`task-controls-toggle${activeCount || sortBy !== 'newest' ? ' configured' : ''}`}
          onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls="task-filter-settings">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filter &amp; sort
          {activeCount > 0 && <span className="task-controls-count" aria-label={`${activeCount} active filters`}>{activeCount}</span>}
          <ChevronDown size={15} className={open ? 'rotated' : ''} aria-hidden="true" />
        </button>
        <span className="task-results-count" role="status">{visibleCount} of {totalCount} tasks</span>
      </div>

      <div id="task-filter-settings" className="task-settings-panel" aria-label="Task filter and sort settings" hidden={!open}>
          <div className="task-settings-grid">
            <div className="task-settings-field">
              <label htmlFor="task-status-filter">Status</label>
              <select id="task-status-filter" className="select-compact" value={status} onChange={(event) => onStatusChange(event.target.value)}>
                <option value="all">All tasks</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="task-settings-field">
              <label htmlFor="task-area-filter">Area</label>
              <select id="task-area-filter" className="select-compact" value={area} onChange={(event) => onAreaChange(event.target.value)}>
                <option value="">All areas</option>
                {[...new Set([...areas, area])].filter((name) => name && name !== '__none__').map((name) => <option key={name} value={name}>{name}</option>)}
                {(hasUnassignedArea || area === '__none__') && <option value="__none__">No area</option>}
              </select>
            </div>

            <div className="task-settings-field">
              <label htmlFor="task-sort-order">Sort by</label>
              <select id="task-sort-order" className="select-compact" value={sortBy} onChange={(event) => onSortChange(event.target.value)}>
                {TASK_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>

          <fieldset className="task-priority-filter">
            <legend>Priority</legend>
            <div className="task-priority-options">
              {TASK_PRIORITIES.map(({ value, label }) => (
                <label key={value} className={`task-priority-option${priorities.includes(value) ? ' selected' : ''}`}>
                  <input type="checkbox" checked={priorities.includes(value)} onChange={() => togglePriority(value)} />
                  {label}
                </label>
              ))}
            </div>
            <p>Select any combination. Leave all unchecked to show every priority.</p>
          </fieldset>

          <button type="button" className="task-settings-reset" onClick={onReset} disabled={!activeCount && sortBy === 'newest'}>
            Reset settings
          </button>
      </div>
    </div>
  );
}
