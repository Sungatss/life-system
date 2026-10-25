import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortTasks, getTaskAreas } from './taskFilters.js';

const tasks = [
  { id: 1, completed: false, priority: 'medium', due_date: '2026-10-27', category: 'Work', created_at: '2026-10-20T10:00:00Z' },
  { id: 2, completed: true, priority: 'high', due_date: '2026-10-25', category: 'University', created_at: '2026-10-21T10:00:00Z' },
  { id: 3, completed: false, priority: 'low', due_date: null, category: null, created_at: '2026-10-22T10:00:00Z' },
  { id: 4, completed: false, priority: 'high', due_date: '2026-10-26', category: 'Work', created_at: '2026-10-23T10:00:00Z' },
  { id: 5, completed: true, priority: 'none', due_date: null, category: null, created_at: '2026-10-24T10:00:00Z' },
];
const settings = (overrides = {}) => ({ status: 'all', priorities: [], area: '', sortBy: 'newest', ...overrides });
const ids = (result) => result.map((task) => task.id);

test('status, multiple priorities, and area combine without changing source tasks', () => {
  const original = [...tasks];
  assert.deepEqual(ids(filterAndSortTasks(tasks, settings({ status: 'active', priorities: ['high', 'medium'], area: 'Work' }))), [4, 1]);
  assert.deepEqual(ids(filterAndSortTasks(tasks, settings({ status: 'completed', priorities: ['high', 'none'] }))), [5, 2]);
  assert.deepEqual(ids(filterAndSortTasks(tasks, settings({ area: '__none__' }))), [5, 3]);
  assert.deepEqual(tasks, original);
  assert.deepEqual(getTaskAreas(tasks), ['University', 'Work']);
});

test('priority sorts in both directions with unprioritized tasks last', () => {
  assert.deepEqual(ids(filterAndSortTasks(tasks, settings({ sortBy: 'priority-high' }))), [4, 2, 1, 3, 5]);
  assert.deepEqual(ids(filterAndSortTasks(tasks, settings({ sortBy: 'priority-low' }))), [3, 1, 4, 2, 5]);
});

test('deadline and area sorting keeps missing values last in either direction', () => {
  assert.deepEqual(ids(filterAndSortTasks(tasks, settings({ sortBy: 'deadline-soon' }))), [2, 4, 1, 5, 3]);
  assert.deepEqual(ids(filterAndSortTasks(tasks, settings({ sortBy: 'deadline-late' }))), [1, 4, 2, 5, 3]);
  assert.deepEqual(ids(filterAndSortTasks(tasks, settings({ sortBy: 'area-asc' }))), [2, 4, 1, 5, 3]);
  assert.deepEqual(ids(filterAndSortTasks(tasks, settings({ sortBy: 'area-desc' }))), [4, 1, 2, 5, 3]);
});
