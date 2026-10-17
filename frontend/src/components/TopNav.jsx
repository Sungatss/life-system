import { useEffect, useRef, useState } from 'react';
import { Calendar, CalendarDays, ChevronDown, Flame, FolderKanban, Inbox, ListTodo, Menu, UserRound, Wallet } from 'lucide-react';

const primaryItems = [
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'habits', label: 'Habits', icon: Flame },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

// Add future secondary pages here; they will appear in the same menu.
const moreItems = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
];

export default function TopNav({ activeTab, onNavigate }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onPointerDown = (event) => {
      if (!moreRef.current?.contains(event.target)) setMoreOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const navigate = (id) => {
    setMoreOpen(false);
    onNavigate(id);
  };

  const moreActive = moreItems.some((item) => item.id === activeTab);

  return (
    <nav className="nav-links" aria-label="Main navigation">
      {primaryItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`nav-button${activeTab === id ? ' active' : ''}`}
          onClick={() => navigate(id)}
          aria-label={label}
          aria-current={activeTab === id ? 'page' : undefined}
          title={label}
          id={`nav-${id}-btn`}
        >
          <Icon size={16} aria-hidden="true" />
          <span className="nav-label">{label}</span>
        </button>
      ))}

      <div className="nav-more" ref={moreRef}>
        <button
          type="button"
          className={`nav-button nav-more-trigger${moreActive ? ' active' : ''}`}
          onClick={() => setMoreOpen((open) => !open)}
          aria-label="More pages"
          aria-expanded={moreOpen}
          aria-controls={moreOpen ? 'nav-more-menu' : undefined}
          title="More pages"
          id="nav-more-btn"
          ref={triggerRef}
        >
          <Menu size={17} aria-hidden="true" />
          <span className="nav-label">More</span>
          <ChevronDown className="nav-more-chevron" size={12} aria-hidden="true" />
        </button>
        {moreOpen && (
          <div className="nav-more-menu" id="nav-more-menu" role="group" aria-label="More pages">
            {moreItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`nav-more-item${activeTab === id ? ' active' : ''}`}
                onClick={() => navigate(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                id={`nav-${id}-btn`}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
