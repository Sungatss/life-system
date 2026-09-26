import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import DailyNoteEditor from '../components/DailyNoteEditor';
import QuickTaskInput from '../components/QuickTaskInput';
import TaskItem from '../components/TaskItem';
import ContributionGraph from '../components/ContributionGraph';
import { Check, ListTodo, Flame, PenLine } from 'lucide-react';

export default function TodayPage({ onNavigateToTasks, onNavigateToHabits }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [currentDateStr, setCurrentDateStr] = useState(todayStr);
  const [todayData, setTodayData] = useState(null);
  const [contributions, setContributions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Friendly date formatting
  const dateObj = new Date(currentDateStr + 'T00:00:00');
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const loadTodayData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, contribData] = await Promise.all([
        api.getToday(currentDateStr),
        api.getContributions(112, currentDateStr),
      ]);
      setTodayData(data);
      setContributions(contribData);
    } catch (err) {
      console.error('Failed to load today data:', err);
      setError('Could not connect to database. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const refreshContributions = async () => {
    try {
      const contribData = await api.getContributions(112, currentDateStr);
      setContributions(contribData);
    } catch (err) {
      console.error('Failed to refresh contributions:', err);
    }
  };

  useEffect(() => {
    loadTodayData();
  }, [currentDateStr]);

  // Task actions
  const handleAddTask = async (taskPayload) => {
    const created = await api.createTask({
      ...taskPayload,
      due_date: taskPayload.due_date || currentDateStr,
    });
    setTodayData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: [created, ...prev.tasks],
      };
    });
  };

  const handleToggleTask = async (taskId, newCompleted) => {
    // Optimistic update
    setTodayData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, completed: newCompleted } : t)),
      };
    });
    try {
      await api.updateTask(taskId, { completed: newCompleted });
    } catch (err) {
      console.error('Failed to update task:', err);
      loadTodayData();
    }
  };

  const handleUpdateTask = async (taskId, updateData) => {
    try {
      const updated = await api.updateTask(taskId, updateData);
      setTodayData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)),
        };
      });
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    setTodayData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      };
    });
    try {
      await api.deleteTask(taskId);
    } catch (err) {
      console.error('Failed to delete task:', err);
      loadTodayData();
    }
  };

  // Habit actions
  const handleToggleHabit = async (habitId, newCompleted) => {
    // Optimistic update
    setTodayData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        habits: prev.habits.map((h) =>
          h.id === habitId ? { ...h, completed_today: newCompleted } : h
        ),
      };
    });
    try {
      await api.toggleHabit(habitId, currentDateStr, newCompleted);
      refreshContributions();
    } catch (err) {
      console.error('Failed to toggle habit:', err);
      loadTodayData();
    }
  };

  if (loading && !todayData) {
    return (
      <div className="empty-state">
        <p>Loading today...</p>
      </div>
    );
  }

  if (error && !todayData) {
    return (
      <div className="empty-state" style={{ color: 'var(--danger)' }}>
        <p>{error}</p>
        <button
          className="btn-primary"
          style={{ marginTop: '12px' }}
          onClick={loadTodayData}
        >
          Retry
        </button>
      </div>
    );
  }

  const tasks = todayData?.tasks || [];
  const habits = todayData?.habits || [];
  const noteContent = todayData?.daily_note?.content || '';

  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const completedHabitsCount = habits.filter((h) => h.completed_today).length;

  return (
    <div className="today-page">
      {/* 1. Date Header */}
      <div className="cockpit-date-banner">
        <div className="cockpit-weekday">{weekday}</div>
        <h1 className="cockpit-title">{formattedDate}</h1>
      </div>

      {/* 2. Daily Note */}
      <section className="cockpit-section" aria-label="Daily note section">
        <div className="section-header">
          <div className="section-title-wrap">
            <PenLine size={16} />
            <h2 className="section-title">Daily note</h2>
          </div>
          <span className="section-badge">Auto-save</span>
        </div>
        <DailyNoteEditor
          date={currentDateStr}
          initialContent={noteContent}
          onContentSaved={(newContent) => {
            setTodayData((prev) =>
              prev
                ? {
                    ...prev,
                    daily_note: prev.daily_note
                      ? { ...prev.daily_note, content: newContent }
                      : { id: 0, date: currentDateStr, content: newContent, created_at: '', updated_at: '' },
                  }
                : prev
            );
            refreshContributions();
          }}
        />
      </section>

      {/* 3. Today's Tasks */}
      <section className="cockpit-section" aria-label="Today tasks section">
        <div className="section-header">
          <div className="section-title-wrap">
            <ListTodo size={16} />
            <h2 className="section-title">Today's tasks</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="section-badge">
              {completedTasksCount} / {tasks.length}
            </span>
            <button
              type="button"
              className="action-btn-subtle"
              onClick={onNavigateToTasks}
              title="Open full tasks page"
              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              All tasks &rarr;
            </button>
          </div>
        </div>

        <QuickTaskInput
          onAddTask={handleAddTask}
          defaultDueDate={currentDateStr}
        />

        {tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks scheduled for today.</p>
            <p className="empty-state-sub">Type a task above and press Enter to capture it.</p>
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

      {/* 4. Habits */}
      <section className="cockpit-section" aria-label="Habits section">
        <div className="section-header">
          <div className="section-title-wrap">
            <Flame size={16} />
            <h2 className="section-title">Habits</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="section-badge">
              {completedHabitsCount} / {habits.length}
            </span>
            <button
              type="button"
              className="action-btn-subtle"
              onClick={onNavigateToHabits}
              title="Open full habits page"
              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              History &rarr;
            </button>
          </div>
        </div>

        {habits.length === 0 ? (
          <div className="empty-state">
            <p>No habits configured yet.</p>
          </div>
        ) : (
          <div className="habit-list">
            {habits.map((habit) => {
              const isCompleted = Boolean(habit.completed_today);
              return (
                <div key={habit.id} className="habit-card">
                  <div className="habit-info">
                    <span className="habit-name">{habit.name}</span>
                    <span className="habit-status-text">
                      {isCompleted ? 'Completed today' : 'Pending for today'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`habit-check-btn ${isCompleted ? 'completed' : ''}`}
                    onClick={() => handleToggleHabit(habit.id, !isCompleted)}
                    id={`habit-toggle-${habit.id}`}
                  >
                    <Check size={14} strokeWidth={isCompleted ? 3 : 2} />
                    <span>{isCompleted ? 'Completed' : 'Mark complete'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. GitHub-style Contribution Tracker for Daily Notes & Habits */}
      {contributions && (
        <ContributionGraph
          contributions={contributions}
          title="Daily consistency heatmap"
        />
      )}
    </div>
  );
}
