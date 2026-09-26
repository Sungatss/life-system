import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import HabitItem from '../components/HabitItem';
import ContributionGraph from '../components/ContributionGraph';
import { Plus, Flame } from 'lucide-react';

export default function HabitsPage() {
  const [habits, setHabits] = useState([]);
  const [contributions, setContributions] = useState(null);
  const [newHabitName, setNewHabitName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    try {
      setLoading(true);
      const [habitsData, contribData] = await Promise.all([
        api.getHabits(14, todayStr),
        api.getContributions(112, todayStr),
      ]);
      setHabits(habitsData);
      setContributions(contribData);
    } catch (err) {
      console.error('Failed to load habits data:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshContributions = async () => {
    try {
      const contribData = await api.getContributions(112, todayStr);
      setContributions(contribData);
    } catch (err) {
      console.error('Failed to refresh contributions:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await api.createHabit(newHabitName.trim());
      setHabits((prev) => [...prev, created]);
      setNewHabitName('');
      refreshContributions();
    } catch (err) {
      console.error('Failed to create habit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleHabitToday = async (habitId, newCompleted) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const newHist = { ...(h.recent_history || {}) };
        if (newCompleted) {
          newHist[todayStr] = true;
        } else {
          delete newHist[todayStr];
        }
        return {
          ...h,
          completed_today: newCompleted,
          recent_history: newHist,
        };
      })
    );

    try {
      await api.toggleHabit(habitId, todayStr, newCompleted);
      refreshContributions();
    } catch (err) {
      console.error('Failed to toggle habit:', err);
      loadData();
    }
  };

  const handleUpdateHabit = async (habitId, updateData) => {
    try {
      const updated = await api.updateHabit(habitId, updateData);
      setHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)));
    } catch (err) {
      console.error('Failed to update habit:', err);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    try {
      await api.deleteHabit(habitId);
      refreshContributions();
    } catch (err) {
      console.error('Failed to delete habit:', err);
      loadData();
    }
  };

  return (
    <div className="habits-page">
      <div className="cockpit-date-banner">
        <div className="cockpit-weekday">Daily consistency</div>
        <h1 className="cockpit-title">Habits</h1>
      </div>

      {/* GitHub-style Contribution Heatmap for Habits & Notes */}
      {contributions && (
        <ContributionGraph
          contributions={contributions}
          title="Habits and daily notes consistency"
          defaultMode="habits"
        />
      )}

      <section className="cockpit-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <Flame size={16} />
            <h2 className="section-title">Habit tracker</h2>
          </div>
          <span className="section-badge">14-day history</span>
        </div>

        <form className="quick-task-form" onSubmit={handleCreateHabit}>
          <input
            type="text"
            className="task-input-field"
            placeholder="Add a habit (e.g. Study or code, Walk or exercise)..."
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            disabled={isSubmitting}
            id="new-habit-input"
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!newHabitName.trim() || isSubmitting}
            id="new-habit-submit-btn"
          >
            <Plus size={16} />
            <span>Add habit</span>
          </button>
        </form>

        {loading ? (
          <div className="empty-state">
            <p>Loading habits...</p>
          </div>
        ) : habits.length === 0 ? (
          <div className="empty-state">
            <p>No habits tracked yet.</p>
            <p className="empty-state-sub">Add a habit above to start tracking daily consistency.</p>
          </div>
        ) : (
          <div className="habit-list">
            {habits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                todayDate={todayStr}
                onToggleToday={handleToggleHabitToday}
                onUpdate={handleUpdateHabit}
                onDelete={handleDeleteHabit}
                daysHistory={14}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
