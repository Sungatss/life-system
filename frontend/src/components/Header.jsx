import { Sun, Moon, CheckSquare } from 'lucide-react';

export default function Header({ onNavigate, theme, onToggleTheme }) {
  return (
    <header className="app-header">
      <button type="button" className="brand" onClick={() => onNavigate('today')} aria-label="Life System home">
        <CheckSquare className="brand-icon" />
        <span>Life System</span>
      </button>

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
