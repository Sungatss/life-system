import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import DailyNoteEditor from '../components/DailyNoteEditor';
import QuickTaskInput from '../components/QuickTaskInput';
import TaskItem from '../components/TaskItem';
import HabitItem from '../components/HabitItem';
import ContributionGraph from '../components/ContributionGraph';
import DateNavigator from '../components/DateNavigator';
import NoteSearchModal from '../components/NoteSearchModal';
import { ListTodo, Flame, PenLine, Plus, Search } from 'lucide-react';
import { getLocalDateStr } from '../utils/date';

export default function TodayPage({ onNavigateToTasks, onNavigateToHabits }) {
  const todayStr = getLocalDateStr();
  const [currentDateStr, setCurrentDateStr] = useState(todayStr);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchOpenerRef = useRef(null);
  const openSearch = (event) => {
    searchOpenerRef.current = event.currentTarget;
    setIsSearchOpen(true);
  };
  const closeSearch = () => {
    setIsSearchOpen(false);
    requestAnimationFrame(() => searchOpenerRef.current?.focus());
  };
  const [todayData, setTodayData] = useState(null);
  const [contributions, setContributions] = useState(null);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const loadTodayData = async () => {
    const requestId = ++requestIdRef.current;
    try {
      setError(null);
      const [data, contribData] = await Promise.all([
        api.getToday(currentDateStr),
        api.getContributions(112, currentDateStr),
      ]);
      if (requestId !== requestIdRef.current) return;
      setTodayData(data);
      setContributions(contribData);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to load today data:', err);
      setError('Could not load this day. Check your connection and try again.');
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
    return () => { requestIdRef.current += 1; };
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
      loadTodayData();
    } catch (err) {
      console.error('Failed to update task:', err);
      throw err;
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.deleteTask(taskId);
      setTodayData((prev) => prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev);
    } catch (err) {
      console.error('Failed to delete task:', err);
      throw err;
    }
  };

  const [newHabitName, setNewHabitName] = useState('');
  const [isSubmittingHabit, setIsSubmittingHabit] = useState(false);
  const [habitError, setHabitError] = useState('');

  // Habit actions
  const handleCreateHabit = async (e) => {
    if (e) e.preventDefault();
    if (!newHabitName.trim() || isSubmittingHabit) return;

    setIsSubmittingHabit(true);
    setHabitError('');
    try {
      const created = await api.createHabit(newHabitName.trim());
      setTodayData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          habits: [...prev.habits, created],
        };
      });
      setNewHabitName('');
      refreshContributions();
    } catch (err) {
      console.error('Failed to create habit:', err);
      setHabitError('Could not add the habit. Try again.');
    } finally {
      setIsSubmittingHabit(false);
    }
  };

  const handleUpdateHabit = async (habitId, updateData) => {
    try {
      const updated = await api.updateHabit(habitId, updateData);
      setTodayData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          habits: prev.habits
            .map((h) => (h.id === habitId ? { ...h, ...updated } : h))
            .filter((h) => h.active),
        };
      });
      refreshContributions();
    } catch (err) {
      console.error('Failed to update habit:', err);
      throw err;
    }
  };

  const handleDeleteHabit = async (habitId) => {
    try {
      await api.deleteHabit(habitId);
      setTodayData((prev) => prev ? { ...prev, habits: prev.habits.filter((h) => h.id !== habitId) } : prev);
      refreshContributions();
    } catch (err) {
      console.error('Failed to delete habit:', err);
      throw err;
    }
  };

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

  const hasCurrentData = todayData?.date === currentDateStr;

  if (!hasCurrentData && !error) {
    return (
      <div className="empty-state">
        <p>Loading today...</p>
      </div>
    );
  }

  if (error && !hasCurrentData) {
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

  const tasks = hasCurrentData ? todayData.tasks : [];
  const habits = hasCurrentData ? todayData.habits : [];
  const noteContent = hasCurrentData ? todayData.daily_note?.content || '' : '';

  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const completedHabitsCount = habits.filter((h) => h.completed_today).length;

  return (
    <div className="today-page">
      {/* 1. Interactive Date Navigator */}
      <DateNavigator
        currentDateStr={currentDateStr}
        onDateChange={setCurrentDateStr}
        onOpenSearch={openSearch}
      />

      {/* 3. Daily Note */}
      <section className="cockpit-section" aria-label="Daily note section">
        <div className="section-header">
          <div className="section-title-wrap">
            <PenLine size={16} />
            <h2 className="section-title">Daily note</h2>
          </div>
          <div className="section-header-actions">
            <button
              type="button"
              className="btn-note-search"
              onClick={openSearch}
              title="Search across all notes"
            >
              <Search size={13} />
              <span>Search</span>
            </button>
            <span className="section-badge">Auto-save</span>
          </div>
        </div>
        <DailyNoteEditor
          date={currentDateStr}
          initialContent={noteContent}
          onContentSaved={(newContent) => {
            setTodayData((prev) =>
              prev?.date === currentDateStr
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
                onSubtasksChange={(updated) => setTodayData((prev) => prev ? {
                  ...prev,
                  tasks: prev.tasks.map((item) => item.id === updated.id ? updated : item),
                } : prev)}
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

        <form className="quick-task-form" onSubmit={handleCreateHabit}>
          <input
            type="text"
            className="task-input-field"
            placeholder="Add a habit (e.g. Study or code, Walk or exercise)..."
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            disabled={isSubmittingHabit}
            id="today-new-habit-input"
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!newHabitName.trim() || isSubmittingHabit}
            id="today-new-habit-submit-btn"
          >
            <Plus size={16} />
            <span>Add</span>
          </button>
        </form>
        {habitError && <p className="form-error" role="alert">{habitError}</p>}

        {habits.length === 0 ? (
          <div className="empty-state">
            <p>No habits configured yet.</p>
            <p className="empty-state-sub">Type a habit above to add it to your daily routine.</p>
          </div>
        ) : (
          <div className="habit-list">
            {habits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                todayDate={currentDateStr}
                onToggleToday={handleToggleHabit}
                onUpdate={handleUpdateHabit}
                onDelete={handleDeleteHabit}
                showHistory={false}
              />
            ))}
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

      {/* Note Search Modal */}
      <NoteSearchModal
        isOpen={isSearchOpen}
        onClose={closeSearch}
        onSelectDate={(targetDate) => {
          setCurrentDateStr(targetDate);
        }}
      />
    </div>
  );
}
