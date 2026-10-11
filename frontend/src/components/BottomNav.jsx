import { Calendar, Inbox, FolderKanban, ListTodo, Flame, UserRound } from 'lucide-react';

const items = [
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'habits', label: 'Habits', icon: Flame },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

export default function BottomNav({ activeTab, onNavigate }) {
  return (
    <nav className="nav-links" aria-label="Main navigation">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`nav-button ${activeTab === id ? 'active' : ''}`}
          onClick={() => onNavigate(id)}
          aria-label={label}
          aria-current={activeTab === id ? 'page' : undefined}
          title={label}
          id={`nav-${id}-btn`}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
