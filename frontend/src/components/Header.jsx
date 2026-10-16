import { useEffect, useRef, useState } from 'react';
import { Check, Palette, Volume2, VolumeX } from 'lucide-react';
import { themes } from '../theme';
import TopNav from './TopNav';

export default function Header({ activeTab, onNavigate, theme, onSelectTheme, soundEnabled, onToggleSound }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const selectTheme = (id) => {
    onSelectTheme(id);
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <header className="app-header">
      <button type="button" className="brand" onClick={() => onNavigate('today')} aria-label="Lock In home">
        <img className="brand-avatar" src="/lock-in-logo.png" alt="" width="32" height="32" />
        <span>Lock In</span>
      </button>

      <TopNav activeTab={activeTab} onNavigate={onNavigate} />

      <div className="header-actions" ref={menuRef}>
        <button
          className="icon-btn sound-toggle"
          onClick={() => { setMenuOpen(false); onToggleSound(); }}
          type="button"
          title={soundEnabled ? 'Mute sound effects' : 'Turn on sound effects'}
          aria-label="Sound effects"
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
        </button>
        <button
          className="icon-btn"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
          title="Choose theme"
          aria-label="Choose theme"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? 'theme-menu' : undefined}
          ref={triggerRef}
        >
          <Palette size={17} aria-hidden="true" />
        </button>
        {menuOpen && (
          <div className="theme-menu" id="theme-menu" role="group" aria-label="Color theme">
            {themes.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`theme-option${theme === option.id ? ' active' : ''}`}
                aria-pressed={theme === option.id}
                onClick={() => selectTheme(option.id)}
              >
                <span className="theme-swatch" style={{ '--swatch-bg': option.background, '--swatch-accent': option.accent }} aria-hidden="true"><i /></span>
                <span>{option.label}</span>
                {theme === option.id && <Check size={16} className="theme-option-check" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
