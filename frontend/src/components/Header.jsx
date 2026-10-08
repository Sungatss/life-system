import React from 'react';
import { Sun, Moon, CheckSquare, Calendar, ListTodo, Flame, BarChart2 } from 'lucide-react';

export default function Header({ activeTab, onNavigate, theme, onToggleTheme }) {
  return (
    <header className="app-header">
      <button type="button" className="brand" onClick={() => onNavigate('today')} aria-label="Life System home">
        <CheckSquare className="brand-icon" />
        <span>Life System</span>
      </button>

      <nav className="nav-links" aria-label="Main Navigation">
        <button
          className={`nav-button ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => onNavigate('today')}
          aria-current={activeTab === 'today' ? 'page' : undefined}
          id="nav-today-btn"
        >
          <Calendar size={16} />
          <span>Today</span>
        </button>
        <button
          className={`nav-button ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => onNavigate('tasks')}
          aria-current={activeTab === 'tasks' ? 'page' : undefined}
          id="nav-tasks-btn"
        >
          <ListTodo size={16} />
          <span>Tasks</span>
        </button>
        <button
          className={`nav-button ${activeTab === 'habits' ? 'active' : ''}`}
          onClick={() => onNavigate('habits')}
          aria-current={activeTab === 'habits' ? 'page' : undefined}
          id="nav-habits-btn"
        >
          <Flame size={16} />
          <span>Habits</span>
        </button>
        <button
          className={`nav-button ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => onNavigate('review')}
          aria-current={activeTab === 'review' ? 'page' : undefined}
          id="nav-review-btn"
        >
          <BarChart2 size={16} />
          <span>Review</span>
        </button>
      </nav>

      <div className="header-actions">
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
