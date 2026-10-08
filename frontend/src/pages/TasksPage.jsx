import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import QuickTaskInput from '../components/QuickTaskInput';
import FilterPills from '../components/FilterPills';
import TaskItem from '../components/TaskItem';
import { CircleAlert } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const requestIdRef = useRef(0);

  const loadTasks = async () => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTasks(filter, selectedCategory);
      if (requestId !== requestIdRef.current) return;
      setTasks(data);
      setCategories((prev) => Array.from(new Set([...prev, ...data.map((task) => task.category).filter(Boolean)])));
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to load tasks:', err);
      setError('Could not load tasks. Check your connection and try again.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    return () => { requestIdRef.current += 1; };
  }, [filter, selectedCategory]);

  const handleAddTask = async (taskPayload) => {
    const created = await api.createTask(taskPayload);
    if (created.category) setCategories((prev) => Array.from(new Set([...prev, created.category])));
    // If the new task matches the active filter or if filter is all/active, append it
    if (filter === 'all' || filter === 'active' || (filter === 'today' && created.due_date)) {
      setTasks((prev) => [created, ...prev]);
    } else {
      loadTasks();
    }
  };

  const handleToggleTask = async (taskId, newCompleted) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: newCompleted } : t))
    );
    try {
      await api.updateTask(taskId, { completed: newCompleted });
      if (filter === 'active' && newCompleted) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } else if (filter === 'completed' && !newCompleted) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
      loadTasks();
    }
  };

  const handleUpdateTask = async (taskId, updateData) => {
    try {
      const updated = await api.updateTask(taskId, updateData);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      if (filter !== 'all' || selectedCategory) loadTasks();
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
        <div className="cockpit-weekday">Brain dump and task list</div>
        <h1 className="cockpit-title">Tasks</h1>
        <p className="page-intro">Capture what matters, then keep your next actions in view.</p>
      </div>

      <section className="cockpit-section">
        <QuickTaskInput onAddTask={handleAddTask} />

        <FilterPills
          activeFilter={filter}
          onSelectFilter={setFilter}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {error ? (
          <div className="empty-state error-state" role="alert">
            <CircleAlert size={24} />
            <p>{error}</p>
            <button type="button" className="btn-secondary" onClick={loadTasks}>Retry</button>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <p>Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks found in this view.</p>
            <p className="empty-state-sub">
              {filter !== 'all' ? 'Try switching filter or add a new task.' : 'Add your first task above.'}
            </p>
            {(filter !== 'all' || selectedCategory) && (
              <button type="button" className="btn-secondary" onClick={() => { setFilter('all'); setSelectedCategory(null); }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
