import React from 'react';
import { Sun, Moon, CheckSquare, Calendar, ListTodo, Flame } from 'lucide-react';

export default function Header({ activeTab, onNavigate, theme, onToggleTheme }) {
  return (
    <header className="app-header">
      <div className="brand" onClick={() => onNavigate('today')} style={{ cursor: 'pointer' }}>
        <CheckSquare className="brand-icon" />
        <span>Life System</span>
      </div>

      <nav className="nav-links" aria-label="Main Navigation">
        <button
          className={`nav-button ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => onNavigate('today')}
          id="nav-today-btn"
        >
          <Calendar size={16} />
          <span>Today</span>
        </button>
        <button
          className={`nav-button ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => onNavigate('tasks')}
          id="nav-tasks-btn"
        >
          <ListTodo size={16} />
          <span>Tasks</span>
        </button>
        <button
          className={`nav-button ${activeTab === 'habits' ? 'active' : ''}`}
          onClick={() => onNavigate('habits')}
          id="nav-habits-btn"
        >
          <Flame size={16} />
          <span>Habits</span>
        </button>
      </nav>

      <div className="header-actions">
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle visual theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
