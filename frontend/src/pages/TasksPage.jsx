import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import QuickTaskInput from '../components/QuickTaskInput';
import TaskControls from '../components/TaskControls';
import TaskItem from '../components/TaskItem';
import { filterAndSortTasks, getTaskAreas } from '../utils/taskFilters';
import { CircleAlert } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('active');
  const [priorities, setPriorities] = useState([]);
  const [area, setArea] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const areas = getTaskAreas(tasks);
  const visibleTasks = filterAndSortTasks(tasks, { status, priorities, area, sortBy });
  const hasFilters = status !== 'all' || priorities.length > 0 || Boolean(area);

  const resetSettings = () => {
    setStatus('all');
    setPriorities([]);
    setArea('');
    setSortBy('newest');
  };

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

  return (
    <div className="tasks-page">
      <div className="cockpit-date-banner">
        <h1 className="cockpit-title">Tasks</h1>
      </div>

      <section className="cockpit-section">
        <QuickTaskInput onAddTask={handleAddTask} />

        <TaskControls
          status={status}
          onStatusChange={setStatus}
          priorities={priorities}
          onPrioritiesChange={setPriorities}
          area={area}
          onAreaChange={setArea}
          areas={areas}
          hasUnassignedArea={tasks.some((task) => !task.category)}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onReset={resetSettings}
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
              <button type="button" className="btn-secondary" onClick={resetSettings}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="task-list">
            {visibleTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                onSubtasksChange={(updated) => setTasks((prev) => prev.map((item) => item.id === updated.id ? updated : item))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
