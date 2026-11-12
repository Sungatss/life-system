import { Calendar, CalendarDays, Flame, FolderKanban, Inbox, ListTodo, PanelLeftClose, PanelLeftOpen, Settings, Sparkles, Target, Wallet } from 'lucide-react';

const items = [
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'habits', label: 'Habits', icon: Flame },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];

export default function Sidebar({ activeTab, expanded, hiddenPages, onNavigate, onToggle, onOpenAssistant, assistantOpen }) {
  return (
    <aside className="app-sidebar" aria-label="Sidebar">
      <div className="sidebar-top">
        <button type="button" className="brand" onClick={() => onNavigate('today')} aria-label="Lock In home" title="Lock In home">
          <span className="brand-label">Lock In</span>
        </button>
        <button
          type="button"
          className="sidebar-toggle icon-btn"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
          aria-controls="sidebar-content"
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
        </button>
      </div>
      <div className="sidebar-content" id="sidebar-content">
      <button type="button" className="sidebar-link sidebar-assistant" aria-label="Ask Lock In" onClick={onOpenAssistant} aria-haspopup="dialog" aria-expanded={assistantOpen} aria-controls={assistantOpen ? 'ask-lock-in-panel' : undefined} title="Ask Lock In">
        <span className="sidebar-assistant-icon"><Sparkles size={17} aria-hidden="true" /></span>
        <span className="sidebar-label">Ask Lock In</span>
      </button>
      <nav className="sidebar-nav" id="main-navigation" aria-label="Main navigation">
        <span className="sidebar-section-label" aria-hidden="true">Workspace</span>
        {items.filter(({ id }) => !hiddenPages.includes(id)).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-link${activeTab === id ? ' active' : ''}`}
            onClick={() => onNavigate(id)}
            aria-label={label}
            aria-current={activeTab === id ? 'page' : undefined}
            title={label}
            id={`nav-${id}-btn`}
          >
            <Icon size={19} aria-hidden="true" />
            <span className="sidebar-label">{label}</span>
          </button>
        ))}
      </nav>
      </div>
      <nav className="sidebar-footer" aria-label="Account navigation">
        <button type="button" className={`sidebar-link${activeTab === 'settings' ? ' active' : ''}`} onClick={() => onNavigate('settings')} aria-label="Settings" aria-current={activeTab === 'settings' ? 'page' : undefined} title="Settings" id="nav-settings-btn">
          <Settings size={19} aria-hidden="true" /><span className="sidebar-label">Settings</span>
        </button>
        <button type="button" className={`sidebar-link sidebar-profile${activeTab === 'profile' ? ' active' : ''}`} onClick={() => onNavigate('profile')} aria-label="Profile" aria-current={activeTab === 'profile' ? 'page' : undefined} title="Profile" id="nav-profile-btn">
          <img src="/profile-avatar.png" alt="" width="30" height="30" />
          <span className="sidebar-label sidebar-profile-label">Your profile<span>Progress & weekly review</span></span>
        </button>
      </nav>
    </aside>
  );
}
