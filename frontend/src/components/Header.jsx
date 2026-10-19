import { useEffect, useRef, useState } from 'react';
import { Check, Palette, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { themes } from '../theme';

export default function Header({ theme, onSelectTheme, soundEnabled, onToggleSound, onOpenAssistant, assistantOpen }) {
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
      <div className="header-actions" ref={menuRef}>
        <button type="button" className="assistant-header-button" onClick={onOpenAssistant} aria-haspopup="dialog" aria-expanded={assistantOpen} aria-controls={assistantOpen ? 'ask-lock-in-panel' : undefined}>
          <Sparkles size={16} aria-hidden="true" /> <span>Ask Lock In</span>
        </button>
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
