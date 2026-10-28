import { TASK_PRIORITIES, TASK_SORT_OPTIONS } from './taskFilters.js';

const storageKey = (view) => `life-system-task-controls-${view}-v1`;
const validStatuses = new Set(['all', 'active', 'completed']);
const validPriorities = new Set(TASK_PRIORITIES.map(({ value }) => value));
const validSorts = new Set(TASK_SORT_OPTIONS.map(({ value }) => value));

export const emptyTaskViewSettings = (status = 'all') => ({
  status, priorities: [], area: '', sortBy: 'newest', pinned: false,
});

export function readTaskViewSettings(view, initialStatus, storage = globalThis.localStorage) {
  const fallback = emptyTaskViewSettings(initialStatus);
  try {
    const saved = JSON.parse(storage.getItem(storageKey(view)));
    if (!saved || saved.pinned !== true) return fallback;
    return {
      status: validStatuses.has(saved.status) ? saved.status : fallback.status,
      priorities: Array.isArray(saved.priorities)
        ? [...new Set(saved.priorities.filter((priority) => validPriorities.has(priority)))]
        : [],
      area: typeof saved.area === 'string' ? saved.area : '',
      sortBy: validSorts.has(saved.sortBy) ? saved.sortBy : 'newest',
      pinned: true,
    };
  } catch {
    return fallback;
  }
}

export function writeTaskViewSettings(view, settings, storage = globalThis.localStorage) {
  try {
    if (settings.pinned) storage.setItem(storageKey(view), JSON.stringify(settings));
    else storage.removeItem(storageKey(view));
  } catch {
    // Settings remain usable for this visit when browser storage is unavailable.
  }
}
