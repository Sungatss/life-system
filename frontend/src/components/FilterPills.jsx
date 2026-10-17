import React from 'react';
import { taskAreaChoices } from '../utils/taskAreas';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'today', label: 'Today' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'high', label: 'High priority' },
];

export default function FilterPills({ activeFilter, onSelectFilter, categories = [], selectedCategory, onSelectCategory }) {
  const areas = taskAreaChoices(categories);
  return (
    <div className="filter-bar" role="toolbar" aria-label="Task filters">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`filter-pill ${activeFilter === f.id ? 'active' : ''}`}
          onClick={() => onSelectFilter(f.id)}
          aria-pressed={activeFilter === f.id}
          id={`filter-${f.id}`}
        >
          {f.label}
        </button>
      ))}

      {areas.length > 0 && (
        <>
          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />
          <span className="filter-group-label">Areas</span>
          {areas.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => onSelectCategory(selectedCategory === cat ? null : cat)}
              aria-pressed={selectedCategory === cat}
              aria-label={`Area: ${cat}`}
            >
              {cat}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
