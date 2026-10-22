import { Calendar, Flame, FolderKanban, Inbox, ListTodo, PanelLeftClose, PanelLeftOpen, Target, UserRound, Wallet } from 'lucide-react';

const items = [
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'habits', label: 'Habits', icon: Flame },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

export default function Sidebar({ activeTab, expanded, onNavigate, onToggle }) {
  return (
    <aside className="app-sidebar" aria-label="Sidebar">
      <div className="sidebar-top">
        <button type="button" className="brand" onClick={() => onNavigate('today')} aria-label="Lock In home" title="Lock In home">
          <img className="brand-avatar" src="/lock-in-logo.png" alt="" width="38" height="38" />
          <span className="brand-label">Lock In</span>
        </button>
        <button
          type="button"
          className="sidebar-toggle icon-btn"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
          aria-controls="main-navigation"
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
        </button>
      </div>
      <nav className="sidebar-nav" id="main-navigation" aria-label="Main navigation">
        {items.map(({ id, label, icon: Icon }) => (
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
    </aside>
  );
}
