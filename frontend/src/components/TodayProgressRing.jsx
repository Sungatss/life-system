import React from 'react';
import { CheckCircle2, Flame, Award, ArrowUpRight } from 'lucide-react';

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

  // Motivational message and color theme
  let statusBadge = {
    text: 'Set intentions for the day',
    color: 'var(--text-muted)',
    bg: 'rgba(255, 255, 255, 0.05)',
  };

  if (totalItems > 0) {
    if (percentage === 100) {
      statusBadge = {
        text: 'All priorities cleared! 🏆',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
      };
    } else if (percentage >= 75) {
      statusBadge = {
        text: 'Crushing it! Almost done ⚡',
        color: '#06b6d4',
        bg: 'rgba(6, 182, 212, 0.15)',
      };
    } else if (percentage >= 50) {
      statusBadge = {
        text: 'Great momentum! Keep pushing 🚀',
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.15)',
      };
    } else if (percentage > 0) {
      statusBadge = {
        text: 'Off to a solid start 🌱',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
      };
    } else {
      statusBadge = {
        text: 'Ready to conquer today 🎯',
        color: 'var(--text-muted)',
        bg: 'rgba(255, 255, 255, 0.06)',
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
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="60%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
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
                  : `${completedItems} of ${totalItems} habits & priorities completed today`}
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
