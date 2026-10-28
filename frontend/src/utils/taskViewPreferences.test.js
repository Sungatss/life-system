import test from 'node:test';
import assert from 'node:assert/strict';
import { readTaskViewSettings, writeTaskViewSettings } from './taskViewPreferences.js';

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test('pinned settings restore independently for Tasks and Today, then unpin clears the default', () => {
  const store = storage();
  const pinned = { status: 'active', priorities: ['high'], area: 'Work', sortBy: 'priority-high', pinned: true };
  writeTaskViewSettings('tasks', pinned, store);

  assert.deepEqual(readTaskViewSettings('tasks', 'active', store), pinned);
  assert.deepEqual(readTaskViewSettings('today', 'all', store), {
    status: 'all', priorities: [], area: '', sortBy: 'newest', pinned: false,
  });

  writeTaskViewSettings('tasks', { ...pinned, pinned: false }, store);
  assert.deepEqual(readTaskViewSettings('tasks', 'active', store), {
    status: 'active', priorities: [], area: '', sortBy: 'newest', pinned: false,
  });
});

test('invalid saved choices cannot break the controls', () => {
  const store = storage();
  writeTaskViewSettings('today', {
    status: 'unknown', priorities: ['high', 'invalid', 'high'], area: 123,
    sortBy: 'unknown', pinned: true,
  }, store);

  assert.deepEqual(readTaskViewSettings('today', 'all', store), {
    status: 'all', priorities: ['high'], area: '', sortBy: 'newest', pinned: true,
  });
});
