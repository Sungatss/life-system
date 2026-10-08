import React from 'react';
import { CheckCircle2, Flame } from 'lucide-react';

export default function TodayProgressRing({ tasks = [], habits = [] }) {
  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;

  const completedHabits = habits.filter((h) => h.completed_today).length;
  const totalHabits = habits.length;

  const totalItems = totalTasks + totalHabits;
  const completedItems = completedTasks + completedHabits;

  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // SVG circular ring metrics
  const size = 92;
  const strokeWidth = 7;
  const center = size / 2;
  const radius = center - strokeWidth - 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Short, factual progress cue.
  let statusBadge = {
    text: 'Nothing planned yet',
    color: 'var(--text-muted)',
    bg: 'var(--bg-subtle)',
  };

  if (totalItems > 0) {
    if (percentage === 100) {
      statusBadge = {
        text: 'Everything complete',
        color: 'var(--success)',
        bg: 'var(--success-subtle)',
      };
    } else if (percentage >= 75) {
      statusBadge = {
        text: 'Almost finished',
        color: 'var(--accent)',
        bg: 'var(--accent-subtle)',
      };
    } else if (percentage >= 50) {
      statusBadge = {
        text: 'More than halfway',
        color: 'var(--accent)',
        bg: 'var(--accent-subtle)',
      };
    } else if (percentage > 0) {
      statusBadge = {
        text: 'In progress',
        color: 'var(--warning)',
        bg: 'var(--bg-subtle)',
      };
    } else {
      statusBadge = {
        text: 'Ready when you are',
        color: 'var(--text-muted)',
        bg: 'var(--bg-subtle)',
      };
    }
  }

  return (
    <section className="cockpit-section progress-ring-section" aria-label="Today completion progress">
      <div className="progress-ring-card">
        {/* Circular Progress Ring */}
        <div className="progress-ring-visual" aria-hidden="true">
          <svg width={size} height={size} className="progress-ring-svg">
            <defs>
              <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--success)" />
              </linearGradient>
            </defs>
            {/* Background Track */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              className="progress-ring-track"
              strokeWidth={strokeWidth}
            />
            {/* Animated Indicator */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              className="progress-ring-indicator"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="url(#ringGradient)"
            />
          </svg>
          <div className="progress-ring-center-content">
            <span className="progress-ring-percent-number">{percentage}%</span>
            <span className="progress-ring-percent-label">done</span>
          </div>
        </div>

        {/* Content & Details */}
        <div className="progress-ring-details">
          <div className="progress-ring-header-row">
            <div className="progress-ring-title-group">
              <span className="progress-ring-kicker">DAILY COMPLETION</span>
              <h3 className="progress-ring-headline">
                {totalItems === 0
                  ? 'No tasks or habits scheduled for today'
                  : `${completedItems} of ${totalItems} tasks and habits complete`}
              </h3>
            </div>
            <div
              className="progress-ring-status-pill"
              style={{ color: statusBadge.color, backgroundColor: statusBadge.bg }}
            >
              {statusBadge.text}
            </div>
          </div>

          {/* Quick breakdown metrics */}
          <div className="progress-ring-breakdown-row">
            <div className="progress-stat-pill">
              <CheckCircle2 size={13} className="stat-pill-icon" />
              <span className="stat-pill-text">
                Tasks: <strong>{completedTasks}</strong>/{totalTasks}
              </span>
            </div>
            <div className="progress-stat-pill">
              <Flame size={13} className="stat-pill-icon" />
              <span className="stat-pill-text">
                Habits: <strong>{completedHabits}</strong>/{totalHabits}
              </span>
            </div>
            {totalItems > 0 && (
              <div className="progress-mini-bar-container" title={`${percentage}% completed`}>
                <div
                  className="progress-mini-bar-fill"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
