const storageKey = 'life-system-hidden-pages';

export const hideablePages = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'goals', label: 'Goals' },
  { id: 'finance', label: 'Finance' },
  { id: 'habits', label: 'Habits' },
  { id: 'calendar', label: 'Calendar' },
];

export function getHiddenPages() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!Array.isArray(saved)) return [];
    const allowed = new Set(hideablePages.map(({ id }) => id));
    return saved.filter((id) => allowed.has(id));
  } catch {
    return [];
  }
}

export function saveHiddenPages(hiddenPages) {
  localStorage.setItem(storageKey, JSON.stringify(hiddenPages));
}
