export const TASK_PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'No priority' },
];

export const TASK_SORT_OPTIONS = [
  { value: 'newest', label: 'Recently added' },
  { value: 'priority-high', label: 'Priority: high first' },
  { value: 'priority-low', label: 'Priority: low first' },
  { value: 'deadline-soon', label: 'Deadline: soonest first' },
  { value: 'deadline-late', label: 'Deadline: latest first' },
  { value: 'area-asc', label: 'Area: A to Z' },
  { value: 'area-desc', label: 'Area: Z to A' },
];

const highFirst = { high: 0, medium: 1, low: 2, none: 3 };
const lowFirst = { low: 0, medium: 1, high: 2, none: 3 };
const newestFirst = (left, right) =>
  (Date.parse(right.created_at) || 0) - (Date.parse(left.created_at) || 0) || right.id - left.id;

export function getTaskAreas(tasks) {
  return [...new Set(tasks.map((task) => task.category).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function filterAndSortTasks(tasks, { status, priorities, area, sortBy }) {
  const visible = tasks.filter((task) => {
    if (status === 'active' && task.completed) return false;
    if (status === 'completed' && !task.completed) return false;
    if (priorities.length && !priorities.includes(task.priority || 'none')) return false;
    if (area === '__none__' && task.category) return false;
    if (area && area !== '__none__' && task.category !== area) return false;
    return true;
  });

  return visible.sort((left, right) => {
    if (sortBy === 'priority-high' || sortBy === 'priority-low') {
      const order = sortBy === 'priority-high' ? highFirst : lowFirst;
      return (order[left.priority || 'none'] ?? 3) - (order[right.priority || 'none'] ?? 3) || newestFirst(left, right);
    }
    if (sortBy === 'deadline-soon' || sortBy === 'deadline-late') {
      if (!left.due_date || !right.due_date) return Number(!left.due_date) - Number(!right.due_date) || newestFirst(left, right);
      return sortBy === 'deadline-soon'
        ? left.due_date.localeCompare(right.due_date) || newestFirst(left, right)
        : right.due_date.localeCompare(left.due_date) || newestFirst(left, right);
    }
    if (sortBy === 'area-asc' || sortBy === 'area-desc') {
      if (!left.category || !right.category) return Number(!left.category) - Number(!right.category) || newestFirst(left, right);
      return sortBy === 'area-asc'
        ? left.category.localeCompare(right.category) || newestFirst(left, right)
        : right.category.localeCompare(left.category) || newestFirst(left, right);
    }
    return newestFirst(left, right);
  });
}
