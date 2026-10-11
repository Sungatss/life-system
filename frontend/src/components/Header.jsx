import { Sun, Moon, CheckSquare } from 'lucide-react';

export default function Header({ onNavigate, theme, onToggleTheme }) {
  const nextTheme = theme === 'dark' ? 'White & Brown' : 'Dark & Purple';
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
          type="button"
          title={`Switch to ${nextTheme} theme`}
          aria-label={`Switch to ${nextTheme} theme`}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
