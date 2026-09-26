import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import QuickTaskInput from '../components/QuickTaskInput';
import FilterPills from '../components/FilterPills';
import TaskItem from '../components/TaskItem';
import { ListTodo } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getTasks(filter, selectedCategory);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [filter, selectedCategory]);

  // Extract distinct categories from tasks
  const distinctCategories = Array.from(
    new Set(tasks.map((t) => t.category).filter(Boolean))
  );

  const handleAddTask = async (taskPayload) => {
    const created = await api.createTask(taskPayload);
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
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await api.deleteTask(taskId);
    } catch (err) {
      console.error('Failed to delete task:', err);
      loadTasks();
    }
  };

  return (
    <div className="tasks-page">
      <div className="cockpit-date-banner">
        <div className="cockpit-weekday">Brain dump and task list</div>
        <h1 className="cockpit-title">Tasks</h1>
      </div>

      <section className="cockpit-section">
        <QuickTaskInput onAddTask={handleAddTask} />

        <FilterPills
          activeFilter={filter}
          onSelectFilter={setFilter}
          categories={distinctCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {loading ? (
          <div className="empty-state">
            <p>Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks found in this view.</p>
            <p className="empty-state-sub">
              {filter !== 'all' ? 'Try switching filter or add a new task.' : 'Add your first task above.'}
            </p>
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
