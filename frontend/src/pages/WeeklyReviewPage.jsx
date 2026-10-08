import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { getLocalDateStr, addDays, formatFriendlyDate } from '../utils/date';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Flame,
  Activity,
  BookOpen,
  Sparkles,
  Target,
  AlertCircle,
  Trophy,
  Save,
  Check,
} from 'lucide-react';
import { marked } from 'marked';

export default function WeeklyReviewPage() {
  const todayStr = getLocalDateStr();
  const [referenceDate, setReferenceDate] = useState(todayStr);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reflection form state
  const [wins, setWins] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [activePreview, setActivePreview] = useState(false);

  const saveTimerRef = useRef(null);
  const draftRef = useRef({ wins: '', blockers: '', next_focus: '' });
  const dirtyRef = useRef(false);
  const weekRef = useRef(null);
  const flushRef = useRef(() => {});
  const loadIdRef = useRef(0);

  // Fetch cockpit data
  const loadCockpit = async (date) => {
    const loadId = ++loadIdRef.current;
    try {
      setLoading(true);
      setError(null);
      setData(null);
      const res = await api.getWeeklyCockpit(date);
      if (loadId !== loadIdRef.current) return;
      setData(res);
      weekRef.current = res.week_start;

      // Load saved reflection if available
      const draft = {
        wins: res.review?.wins || '',
        blockers: res.review?.blockers || '',
        next_focus: res.review?.next_focus || '',
      };
      draftRef.current = draft;
      dirtyRef.current = false;
      if (res.review) {
        setWins(draft.wins);
        setBlockers(draft.blockers);
        setNextFocus(draft.next_focus);
      } else {
        setWins('');
        setBlockers('');
        setNextFocus('');
      }
      setSaveStatus('saved');
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      console.error('Failed to load weekly review cockpit:', err);
      setError('Could not load weekly review. Check your connection.');
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadCockpit(referenceDate);
  }, [referenceDate]);

  // Handle reflection changes with auto-save
  const handleFieldChange = (field, setter) => (e) => {
    setter(e.target.value);
    draftRef.current = { ...draftRef.current, [field]: e.target.value };
    dirtyRef.current = true;
    setSaveStatus('unsaved');

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      triggerSave(weekRef.current, { ...draftRef.current });
    }, 1200);
  };

  const triggerSave = async (weekStart = weekRef.current, draft = { ...draftRef.current }, background = false) => {
    if (!weekStart) return;
    if (weekRef.current === weekStart) dirtyRef.current = false;
    try {
      if (!background) setSaveStatus('saving');
      const updated = await api.saveWeeklyReview(weekStart, draft);
      setData((prev) => (prev?.week_start === weekStart ? { ...prev, review: updated } : prev));
      if (!background && weekRef.current === weekStart && !dirtyRef.current) setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save weekly review:', err);
      if (weekRef.current === weekStart) {
        dirtyRef.current = true;
        setSaveStatus('unsaved');
      }
    }
  };

  const flushPendingSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (dirtyRef.current && weekRef.current) {
      triggerSave(weekRef.current, { ...draftRef.current }, true);
    }
  };
  useEffect(() => {
    flushRef.current = flushPendingSave;
  });

  useEffect(() => () => flushRef.current(), []);

  const handleManualSave = (e) => {
    e.preventDefault();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    triggerSave(weekRef.current, { ...draftRef.current });
  };

  // Week navigation
  const handlePrevWeek = () => {
    flushPendingSave();
    weekRef.current = null;
    setReferenceDate((prev) => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    flushPendingSave();
    weekRef.current = null;
    setReferenceDate((prev) => addDays(prev, 7));
  };

  const handleCurrentWeek = () => {
    flushPendingSave();
    weekRef.current = null;
    setReferenceDate(todayStr);
  };

  const isCurrentWeek = data?.week_start && data?.week_end && todayStr >= data.week_start && todayStr <= data.week_end;

  // Render markdown helper
  const renderMarkdown = (content) => {
    if (!content.trim()) return '<p class="preview-empty">No reflection written yet.</p>';
    try {
      return marked.parse(content, { breaks: true, gfm: true });
    } catch {
      return content;
    }
  };

  return (
    <div className="weekly-review-page">
      {/* 1. Header with Week Navigator */}
      <section className="cockpit-section review-nav-section" aria-label="Week navigation">
        <div className="review-nav-container">
          <div className="review-nav-left">
            <span className="section-badge" style={{ color: '#06b6d4', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
              Weekly overview
            </span>
            <h1 className="review-title">Weekly review</h1>
            <p className="review-subtitle">
              See what you completed, reflect on the week, and choose what to focus on next.
            </p>
          </div>

          <div className="review-nav-controls">
            <button
              type="button"
              className="action-btn-subtle"
              onClick={handlePrevWeek}
              title="Previous Week"
              id="weekly-prev-btn"
            >
              <ChevronLeft size={16} />
              <span>Prev Week</span>
            </button>

            {!isCurrentWeek && (
              <button
                type="button"
                className="btn-today-pill"
                onClick={handleCurrentWeek}
                title="Jump to current week"
                id="weekly-current-btn"
              >
                Current Week
              </button>
            )}

            <button
              type="button"
              className="action-btn-subtle"
              onClick={handleNextWeek}
              title="Next Week"
              id="weekly-next-btn"
            >
              <span>Next Week</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {data && (
          <div className="review-week-range-bar">
            <div className="week-range-badge">
              <Calendar size={14} />
              <span>
                Week: {formatFriendlyDate(data.week_start)} — {formatFriendlyDate(data.week_end)}
              </span>
            </div>
            {isCurrentWeek && <span className="active-week-indicator">Active Week (In Progress)</span>}
          </div>
        )}
      </section>

      {loading && !data && (
        <div className="empty-state">
          <p>Analyzing weekly performance...</p>
        </div>
      )}

      {error && !data && (
        <div className="empty-state" style={{ color: 'var(--danger)' }}>
          <p>{error}</p>
          <button className="btn-primary" style={{ marginTop: '12px' }} onClick={() => loadCockpit(referenceDate)}>
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          {/* 2. Four Sleek Summary KPI Cards */}
          <div className="weekly-kpi-grid">
            {/* Card 1: Tasks Completed */}
            <div className="weekly-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">TASKS FINISHED</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="kpi-number">{data.total_tasks_completed}</div>
              <div className="kpi-caption">
                {data.total_tasks_completed === 1 ? '1 task completed' : `${data.total_tasks_completed} tasks completed this week`}
              </div>
            </div>

            {/* Card 2: Habit Consistency Rate */}
            <div className="weekly-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">HABIT CONSISTENCY</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                  <Flame size={18} />
                </div>
              </div>
              <div className="kpi-number">{data.habit_consistency_rate}%</div>
              <div className="kpi-caption">
                {data.total_habits_completed} of {data.total_habits_possible} habit logs completed
              </div>
            </div>

            {/* Card 3: Days Active */}
            <div className="weekly-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">DAYS ACTIVE</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                  <Activity size={18} />
                </div>
              </div>
              <div className="kpi-number">
                {data.days_active} <span className="kpi-sub-total">/ 7</span>
              </div>
              <div className="kpi-caption">
                {data.days_active >= 5 ? 'High daily engagement ⚡' : 'Days with logged notes or habits'}
              </div>
            </div>

            {/* Card 4: Reflection & Journal Volume */}
            <div className="weekly-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">REFLECTION VOLUME</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
                  <BookOpen size={18} />
                </div>
              </div>
              <div className="kpi-number">{data.total_words_written}</div>
              <div className="kpi-caption">Total words captured in daily notes</div>
            </div>
          </div>

          {/* 3. 7-Day Day-by-Day Performance Breakdown */}
          <section className="cockpit-section" aria-label="Day by day breakdown">
            <div className="section-header">
              <div className="section-title-wrap">
                <Calendar size={16} />
                <h2 className="section-title">7-Day Execution Breakdown</h2>
              </div>
              <span className="section-badge">Mon – Sun</span>
            </div>

            <div className="weekly-days-grid">
              {data.day_breakdown.map((day) => {
                const isToday = day.date === todayStr;
                const habitPct = day.total_habits > 0 ? Math.round((day.habits_completed / day.total_habits) * 100) : 0;
                const isComplete = day.tasks_completed > 0 || day.habits_completed > 0 || day.has_note;

                return (
                  <div
                    key={day.date}
                    className={`weekly-day-card ${isToday ? 'current-day' : ''} ${isComplete ? 'active-day' : ''}`}
                  >
                    <div className="day-card-header">
                      <span className="day-name">{day.day_name}</span>
                      <span className="day-date">{formatFriendlyDate(day.date)}</span>
                    </div>

                    <div className="day-card-metrics">
                      <div className="day-metric-row">
                        <span className="day-metric-label">Tasks:</span>
                        <span className="day-metric-value">
                          {day.tasks_completed > 0 ? (
                            <strong style={{ color: '#10b981' }}>{day.tasks_completed} done</strong>
                          ) : (
                            <span className="text-dim">0</span>
                          )}
                        </span>
                      </div>

                      <div className="day-metric-row">
                        <span className="day-metric-label">Habits:</span>
                        <span className="day-metric-value">
                          {day.total_habits > 0 ? (
                            <span>
                              {day.habits_completed}/{day.total_habits} ({habitPct}%)
                            </span>
                          ) : (
                            <span className="text-dim">—</span>
                          )}
                        </span>
                      </div>

                      <div className="day-metric-row">
                        <span className="day-metric-label">Note:</span>
                        <span className="day-metric-value">
                          {day.has_note ? (
                            <span style={{ color: 'var(--accent)' }}>{day.note_words} words</span>
                          ) : (
                            <span className="text-dim">None</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Progress strip indicator */}
                    <div className="day-progress-bar">
                      <div
                        className="day-progress-fill"
                        style={{
                          width: `${Math.max(habitPct, day.tasks_completed > 0 ? 50 : 0)}%`,
                          backgroundColor: habitPct === 100 ? '#10b981' : habitPct > 0 ? '#3b82f6' : 'transparent',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. Sunday Reflection Journal */}
          <section className="cockpit-section reflection-section" aria-label="Weekly reflection journal">
            <div className="section-header">
              <div className="section-title-wrap">
                <Sparkles size={16} style={{ color: '#f59e0b' }} />
                <h2 className="section-title">Weekly reflection</h2>
              </div>
              <div className="section-header-actions">
                <button
                  type="button"
                  className={`btn-note-search ${activePreview ? 'active' : ''}`}
                  onClick={() => setActivePreview((prev) => !prev)}
                  title="Toggle Markdown Preview"
                >
                  <BookOpen size={13} />
                  <span>{activePreview ? 'Edit Prompts' : 'Preview'}</span>
                </button>

                <div className="save-status-indicator">
                  {saveStatus === 'saving' && <span className="status-saving">Saving...</span>}
                  {saveStatus === 'saved' && (
                    <span className="status-saved">
                      <Check size={12} /> Saved
                    </span>
                  )}
                  {saveStatus === 'unsaved' && <span className="status-unsaved">Unsaved changes</span>}
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleManualSave}
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  id="save-weekly-review-btn"
                >
                  <Save size={14} />
                  <span>Save</span>
                </button>
              </div>
            </div>

            {activePreview ? (
              <div className="reflection-preview-container">
                <div className="preview-block">
                  <h3 className="preview-title">
                    <Trophy size={16} color="#10b981" /> 1. Wins & Highlights
                  </h3>
                  <div
                    className="markdown-body preview-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(wins) }}
                  />
                </div>

                <div className="preview-block">
                  <h3 className="preview-title">
                    <AlertCircle size={16} color="#ef4444" /> 2. Blockers, Friction & Lessons
                  </h3>
                  <div
                    className="markdown-body preview-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(blockers) }}
                  />
                </div>

                <div className="preview-block">
                  <h3 className="preview-title">
                    <Target size={16} color="#3b82f6" /> 3. Next Week's #1 Focus (The Lever)
                  </h3>
                  <div
                    className="markdown-body preview-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(nextFocus) }}
                  />
                </div>
              </div>
            ) : (
              <div className="reflection-prompts-container">
                {/* Prompt 1 */}
                <div className="reflection-prompt-card">
                  <div className="prompt-header">
                    <div className="prompt-badge win-badge">
                      <Trophy size={14} />
                      <span>1. Wins & Breakthroughs</span>
                    </div>
                    <span className="prompt-hint">What went exceptionally well? What progress are you proud of?</span>
                  </div>
                  <textarea
                    className="reflection-textarea"
                    placeholder="e.g. Completed the core feature ahead of schedule, stuck to morning workouts 4 times, shipped the release..."
                    value={wins}
                    onChange={handleFieldChange('wins', setWins)}
                    rows={4}
                    id="weekly-wins-input"
                  />
                </div>

                {/* Prompt 2 */}
                <div className="reflection-prompt-card">
                  <div className="prompt-header">
                    <div className="prompt-badge blocker-badge">
                      <AlertCircle size={14} />
                      <span>2. Friction & Lessons Learned</span>
                    </div>
                    <span className="prompt-hint">Where did you procrastinate, hit resistance, or lose momentum?</span>
                  </div>
                  <textarea
                    className="reflection-textarea"
                    placeholder="e.g. Got distracted on social media on Wednesday afternoon, skipped reading before bed, need to time-box email..."
                    value={blockers}
                    onChange={handleFieldChange('blockers', setBlockers)}
                    rows={4}
                    id="weekly-blockers-input"
                  />
                </div>

                {/* Prompt 3 */}
                <div className="reflection-prompt-card highlight-focus">
                  <div className="prompt-header">
                    <div className="prompt-badge focus-badge">
                      <Target size={14} />
                      <span>3. Next Week's #1 Non-Negotiable Lever</span>
                    </div>
                    <span className="prompt-hint">If you only accomplished one high-leverage outcome, what must it be?</span>
                  </div>
                  <textarea
                    className="reflection-textarea focus-textarea"
                    placeholder="e.g. Ship the customer dashboard by Thursday 5pm, maintain a 7-day workout streak..."
                    value={nextFocus}
                    onChange={handleFieldChange('next_focus', setNextFocus)}
                    rows={3}
                    id="weekly-focus-input"
                  />
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
