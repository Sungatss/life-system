import { Calendar, Inbox, FolderKanban, ListTodo, Flame, BarChart2 } from 'lucide-react';

const items = [
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'habits', label: 'Habits', icon: Flame },
  { id: 'review', label: 'Review', icon: BarChart2 },
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
          aria-current={activeTab === id ? 'page' : undefined}
          id={`nav-${id}-btn`}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
