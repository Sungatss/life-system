import { Check, CheckCheck, LogOut } from 'lucide-react';
import ReminderSettings from '../components/ReminderSettings';
import { themes } from '../theme';
import { fonts } from '../fonts';
import { hideablePages } from '../utils/navigationPreferences';
import './SettingsPage.css';

const sections = ['Appearance', 'Reminders', 'Experience', 'Navigation'];

function Toggle({ id, title, description, checked, onChange }) {
  return (
    <label className="settings-row" htmlFor={id}>
      <span className="settings-row-copy"><span className="settings-row-title" id={`${id}-title`}>{title}</span>{description && <span className="settings-row-description" id={`${id}-description`}>{description}</span>}</span>
      <input className="settings-switch" id={id} type="checkbox" role="switch" checked={checked} onChange={onChange} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} />
    </label>
  );
}

export default function SettingsPage({ theme, onSelectTheme, font, onSelectFont, asciiPaused, onToggleAscii, soundEnabled, onToggleSound, showCat, onToggleCatVisibility, sidebarCollapsed, onToggleSidebar, hiddenPages, onTogglePageVisibility, onSignOut }) {
  return (
    <div className="settings-page">
      <header className="settings-page-heading">
        <div><h1>Settings</h1><p>Make Lock In feel like your space.</p></div>
        <span className="settings-save-note"><CheckCheck size={15} aria-hidden="true" /> Preferences save automatically</span>
      </header>

      <nav className="settings-section-links" aria-label="Settings sections">
        {sections.map((section) => <button type="button" key={section} onClick={() => document.getElementById(`settings-${section.toLowerCase()}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>{section}</button>)}
      </nav>

      <section className="settings-section" id="settings-appearance" aria-labelledby="settings-appearance-title">
        <div className="settings-section-heading"><h2 id="settings-appearance-title">Appearance</h2><p>A familiar look, or a fresh perspective.</p></div>
        <fieldset className="settings-theme-field"><legend>Theme</legend>
          <div className="settings-theme-grid">
            {themes.map((option) => (
              <label className={`settings-theme-option${theme === option.id ? ' is-selected' : ''}`} key={option.id}>
                <input type="radio" name="theme" value={option.id} checked={theme === option.id} onChange={() => onSelectTheme(option.id)} />
                <span className="settings-theme-preview" style={{ '--preview-bg': option.background, '--preview-accent': option.accent }} aria-hidden="true">
                  <span className="settings-preview-sidebar"><i /><i /><i /></span>
                  <span className="settings-preview-content"><i /><i /><i /></span>
                  {theme === option.id && <span className="settings-theme-check"><Check size={13} /></span>}
                </span>
                <span className="settings-theme-name">{option.label.split(' · ')[0]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="settings-row settings-font-row">
          <label className="settings-row-copy" htmlFor="settings-font"><span className="settings-row-title">Font</span><span className="settings-row-description">Choose the typeface used throughout the app.</span></label>
          <select id="settings-font" value={font} onChange={(event) => onSelectFont(event.target.value)}>{fonts.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
        </div>
        <Toggle id="settings-ascii-paused" title="Pause ASCII animation" description={theme === 'ascii-ink' ? 'Keep the background still. Reduced motion preferences are always respected.' : 'Applies when the ASCII Ink theme is selected.'} checked={asciiPaused} onChange={onToggleAscii} />
      </section>

      <div className="settings-section settings-reminders" id="settings-reminders"><ReminderSettings /></div>

      <section className="settings-section" id="settings-experience" aria-labelledby="settings-experience-title">
        <div className="settings-section-heading"><h2 id="settings-experience-title">Experience</h2><p>Small details that help you settle in.</p></div>
        <Toggle id="settings-sound" title="Sound effects" description="Play a sound when you complete tasks and habits." checked={soundEnabled} onChange={onToggleSound} />
        <Toggle id="settings-companion" title="Show Yuki" description="Keep your cat companion around while you work." checked={showCat} onChange={onToggleCatVisibility} />
      </section>

      <section className="settings-section" id="settings-navigation" aria-labelledby="settings-navigation-title">
        <div className="settings-section-heading"><h2 id="settings-navigation-title">Navigation</h2><p>Keep the pages you use close at hand.</p></div>
        <Toggle id="settings-sidebar" title="Keep sidebar expanded" description="Show page names on desktop. You can also use the sidebar’s collapse button." checked={!sidebarCollapsed} onChange={onToggleSidebar} />
        <div className="settings-navigation-heading"><h3>Visible pages</h3><p>Hidden pages and their data are still available through direct links. Today, Settings, and Profile are always within reach.</p></div>
        <div className="settings-navigation-grid">{hideablePages.map(({ id, label }) => <Toggle key={id} id={`settings-show-${id}`} title={label} checked={!hiddenPages.includes(id)} onChange={() => onTogglePageVisibility(id)} />)}</div>
      </section>

      <section className="settings-section settings-account" aria-labelledby="settings-account-title">
        <div><h2 id="settings-account-title">Account</h2><p>Appearance and experience preferences are saved on this device.</p></div>
        <button type="button" className="btn-secondary" onClick={onSignOut}><LogOut size={16} aria-hidden="true" /> Sign out</button>
      </section>
    </div>
  );
}
