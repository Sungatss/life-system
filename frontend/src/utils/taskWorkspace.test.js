import test from 'node:test';
import assert from 'node:assert/strict';
import { getTaskBoardColumns, getTaskListSections, getTaskSummary, searchTasks } from './taskWorkspace.js';

const tasks = [
  { id: 1, title: 'File report', description: 'Quarterly review', category: 'Work', priority: 'high', due_date: '2026-10-27', completed: false, subtasks: [] },
  { id: 2, title: 'Plan trip', project_name: 'Travel', priority: 'medium', due_date: '2026-10-28', completed: false, subtasks: [{ title: 'Book hotel' }] },
  { id: 3, title: 'Read', priority: 'low', due_date: '2026-11-01', completed: false },
  { id: 4, title: 'Idea', priority: 'none', due_date: null, completed: false },
  { id: 5, title: 'Old task', priority: 'high', due_date: '2026-10-26', completed: true },
];
const ids = (items) => items.map((item) => item.id);

test('search includes task details and steps without changing the original order', () => {
  assert.deepEqual(ids(searchTasks(tasks, '  HOTEL ')), [2]);
  assert.deepEqual(ids(searchTasks(tasks, 'work')), [1]);
  assert.deepEqual(ids(searchTasks(tasks, 'travel')), [2]);
  assert.deepEqual(ids(searchTasks(tasks, '')), [1, 2, 3, 4, 5]);
});

test('list sections put every task in one truthful date group', () => {
  const sections = getTaskListSections(tasks, '2026-10-28');
  assert.deepEqual(sections.map((section) => [section.id, ids(section.tasks)]), [
    ['overdue', [1]], ['today', [2]], ['upcoming', [3]], ['no-date', [4]], ['completed', [5]],
  ]);
  assert.deepEqual(getTaskSummary(tasks, '2026-10-28'), { open: 4, dueToday: 1, overdue: 1, completed: 1 });
});

test('board keeps completed work out of active priority columns', () => {
  assert.deepEqual(getTaskBoardColumns(tasks).map((column) => [column.id, ids(column.tasks)]), [
    ['high', [1]], ['medium', [2]], ['low', [3]], ['none', [4]],
  ]);
});

test('list honors pinned priority and area sorting across groups', () => {
  assert.deepEqual(getTaskListSections(tasks, '2026-10-28', 'priority-high').map((section) => [section.id, ids(section.tasks)]), [
    ['high', [1]], ['medium', [2]], ['low', [3]], ['none', [4]], ['completed', [5]],
  ]);
  assert.deepEqual(getTaskListSections(tasks, '2026-10-28', 'area-asc').map((section) => [section.title, ids(section.tasks)]), [
    ['Work', [1]], ['No area', [2, 3, 4]], ['Completed', [5]],
  ]);
  assert.deepEqual(getTaskListSections(tasks, '2026-10-28', 'deadline-late').map((section) => section.id), [
    'upcoming', 'today', 'overdue', 'no-date', 'completed',
  ]);
});
