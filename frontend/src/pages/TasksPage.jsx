import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import QuickTaskInput from '../components/QuickTaskInput';
import TaskControls from '../components/TaskControls';
import TaskItem from '../components/TaskItem';
import { filterAndSortTasks, getTaskAreas } from '../utils/taskFilters';
import { getTaskBoardColumns, getTaskListSections, getTaskSummary, searchTasks } from '../utils/taskWorkspace';
import { getLocalDateStr } from '../utils/date';
import useTaskViewSettings from '../hooks/useTaskViewSettings';
import { CalendarDays, ChevronDown, CircleAlert, Columns3, List, Plus, Search, X } from 'lucide-react';

export default function TasksPage({ onNavigateToCalendar, showCalendar = true }) {
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState(() => localStorage.getItem('life-system-tasks-view') === 'board' ? 'board' : 'list');
  const [query, setQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({});
  const { settings, change, reset } = useTaskViewSettings('tasks', 'active');
  const { status, priorities, area, sortBy, pinned } = settings;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const searchRef = useRef(null);
  const today = getLocalDateStr();
  const areas = getTaskAreas(tasks);
  const visibleTasks = searchTasks(filterAndSortTasks(tasks, { status, priorities, area, sortBy }), query);
  const hasFilters = status !== 'all' || priorities.length > 0 || Boolean(area) || Boolean(query.trim());
  const summary = getTaskSummary(tasks, today);
  const listSections = getTaskListSections(visibleTasks, today, sortBy);
  const listGrouping = sortBy.startsWith('priority') ? 'priority' : sortBy.startsWith('area') ? 'area' : 'due date';
  const boardColumns = getTaskBoardColumns(visibleTasks);
  const completedTasks = visibleTasks.filter((task) => task.completed);

  const selectView = (nextView) => {
    setView(nextView);
    localStorage.setItem('life-system-tasks-view', nextView);
  };
  const clearFilters = () => { setQuery(''); reset(); };
  const toggleSection = (id) => setCollapsedSections((current) => ({ ...current, [id]: !current[id] }));

  const loadTasks = () => {
    const requestId = ++requestIdRef.current;
    api.getTasks('all')
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        setTasks(data);
        setError(null);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        console.error('Failed to load tasks:', err);
        setError('Could not load tasks. Check your connection and try again.');
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  };

  useEffect(() => {
    loadTasks();
    return () => { requestIdRef.current += 1; };
  }, []);

  const handleAddTask = async (taskPayload) => {
    const created = await api.createTask(taskPayload);
    setTasks((prev) => [created, ...prev]);
  };

  const handleToggleTask = async (taskId, newCompleted) => {
    try {
      const updated = await api.updateTask(taskId, { completed: newCompleted });
      setTasks((prev) => prev.map((task) => task.id === taskId ? updated : task));
      return true;
    } catch (err) {
      console.error('Failed to toggle task:', err);
      throw err;
    }
  };

  const handleUpdateTask = async (taskId, updateData) => {
    try {
      const updated = await api.updateTask(taskId, updateData);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      console.error('Failed to update task:', err);
      throw err;
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
      throw err;
    }
  };

  const renderTask = (task) => (
    <TaskItem
      key={task.id}
      task={task}
      compact
      onToggle={handleToggleTask}
      onDelete={handleDeleteTask}
      onUpdate={handleUpdateTask}
      onSubtasksChange={(updated) => setTasks((prev) => prev.map((item) => item.id === updated.id ? updated : item))}
    />
  );

  const renderSection = (section) => (
    <section className={`task-workspace-section task-section-${section.id}`} key={section.id} aria-label={`${section.title} tasks`}>
      <button type="button" className="task-section-heading" onClick={() => toggleSection(section.id)}
        aria-expanded={!collapsedSections[section.id]}>
        <span className="task-section-name">{section.title}<span className="task-section-count">{section.tasks.length}</span></span>
        <ChevronDown size={17} className={collapsedSections[section.id] ? 'collapsed' : ''} aria-hidden="true" />
      </button>
      {!collapsedSections[section.id] && <div className="task-list">{section.tasks.map(renderTask)}</div>}
    </section>
  );

  return (
    <div className="tasks-page">
      <div className="cockpit-date-banner tasks-workspace-hero">
        <div>
          <h1 className="cockpit-title">Tasks</h1>
          <p className="page-intro">Find what matters, plan the next step, and keep moving.</p>
        </div>
        <button type="button" className="btn-primary tasks-new-button" onClick={() => document.getElementById('quick-task-input')?.focus()}>
          <Plus size={17} aria-hidden="true" /> New task
        </button>
      </div>

      <section className="cockpit-section tasks-workspace" aria-label="Task workspace">
        <div className="task-workspace-topline">
          <div className="task-view-tabs" role="group" aria-label="Task view">
            <button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => selectView('list')}><List size={16} aria-hidden="true" /> List</button>
            <button type="button" className={view === 'board' ? 'active' : ''} aria-pressed={view === 'board'} onClick={() => selectView('board')}><Columns3 size={16} aria-hidden="true" /> Board</button>
            {showCalendar && <button type="button" onClick={onNavigateToCalendar}><CalendarDays size={16} aria-hidden="true" /> Calendar</button>}
          </div>
          <div className="task-workspace-summary" aria-label="Task summary">
            <span><strong>{summary.open}</strong> open</span>
            <span><strong>{summary.dueToday}</strong> today</span>
            {summary.overdue > 0 && <span className="task-summary-overdue"><strong>{summary.overdue}</strong> overdue</span>}
            <span><strong>{summary.completed}</strong> done</span>
          </div>
        </div>

        <div className="task-search-wrap">
          <Search size={17} aria-hidden="true" />
          <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks, steps, areas, projects…" aria-label="Search tasks" />
          {query && <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Clear search"><X size={16} /></button>}
        </div>

        <QuickTaskInput onAddTask={handleAddTask} />

        <TaskControls
          status={status}
          onStatusChange={(value) => change({ status: value })}
          priorities={priorities}
          onPrioritiesChange={(value) => change({ priorities: value })}
          area={area}
          onAreaChange={(value) => change({ area: value })}
          areas={areas}
          hasUnassignedArea={tasks.some((task) => !task.category)}
          sortBy={sortBy}
          onSortChange={(value) => change({ sortBy: value })}
          pinned={pinned}
          onPinnedChange={(value) => change({ pinned: value })}
          onReset={reset}
          visibleCount={visibleTasks.length}
          totalCount={tasks.length}
        />

        {error ? (
          <div className="empty-state error-state" role="alert">
            <CircleAlert size={24} />
            <p>{error}</p>
            <button type="button" className="btn-secondary" onClick={() => { setLoading(true); setError(null); loadTasks(); }}>Retry</button>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <p>Loading tasks...</p>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="empty-state">
            <p>{tasks.length ? 'No tasks match these filters.' : 'No tasks yet.'}</p>
            {tasks.length > 0 && hasFilters && (
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Clear filters and search
              </button>
            )}
          </div>
        ) : (
          view === 'list' ? (
            <div className="task-grouped-list">
              <p className="task-view-note">Grouped by {listGrouping}{sortBy === 'newest' ? ' · newest first within each group' : ''}</p>
              {listSections.map(renderSection)}
            </div>
          ) : (
            <div className="task-board-view">
              <p className="task-view-note">Grouped by priority · sorted within each column</p>
              {visibleTasks.some((task) => !task.completed) && <div className="task-board-grid">
                {boardColumns.filter((column) => column.tasks.length > 0).map((column) => (
                  <section key={column.id} className={`task-board-column task-board-${column.id}`} aria-label={`${column.title} tasks`}>
                    <h2>{column.title}<span>{column.tasks.length}</span></h2>
                    <div className="task-list">{column.tasks.map(renderTask)}</div>
                  </section>
                ))}
              </div>}
              {completedTasks.length > 0 && renderSection({ id: 'completed', title: 'Completed', tasks: completedTasks })}
            </div>
          )
        )}
      </section>
    </div>
  );
}
