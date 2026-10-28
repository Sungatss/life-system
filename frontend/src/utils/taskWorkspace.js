export function searchTasks(tasks, query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return tasks;
  return tasks.filter((task) => [
    task.title,
    task.description,
    task.category,
    task.project_name,
    ...(task.subtasks || []).map((step) => step.title),
  ].some((value) => String(value || '').toLocaleLowerCase().includes(needle)));
}

export function getTaskSummary(tasks, today) {
  const active = tasks.filter((task) => !task.completed);
  return {
    open: active.length,
    dueToday: active.filter((task) => task.due_date === today).length,
    overdue: active.filter((task) => task.due_date && task.due_date < today).length,
    completed: tasks.length - active.length,
  };
}

export function getTaskListSections(tasks, today, sortBy = 'newest') {
  const completed = tasks.filter((task) => task.completed);
  const active = tasks.filter((task) => !task.completed);
  const completedSection = { id: 'completed', title: 'Completed', tasks: completed };

  if (sortBy === 'priority-high' || sortBy === 'priority-low') {
    const columns = getTaskBoardColumns(active);
    const order = sortBy === 'priority-low' ? ['low', 'medium', 'high', 'none'] : ['high', 'medium', 'low', 'none'];
    return [...order.map((id) => columns.find((column) => column.id === id)), completedSection]
      .filter((section) => section.tasks.length > 0);
  }

  if (sortBy === 'area-asc' || sortBy === 'area-desc') {
    const groups = new Map();
    active.forEach((task) => {
      const name = task.category || 'No area';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(task);
    });
    return [...[...groups].map(([title, items], index) => ({ id: `area-${index}`, title, tasks: items })), completedSection]
      .filter((section) => section.tasks.length > 0);
  }

  const sections = [
    { id: 'overdue', title: 'Overdue', tasks: [] },
    { id: 'today', title: 'Today', tasks: [] },
    { id: 'upcoming', title: 'Upcoming', tasks: [] },
    { id: 'no-date', title: 'No due date', tasks: [] },
    completedSection,
  ];
  const byId = Object.fromEntries(sections.map((section) => [section.id, section]));
  active.forEach((task) => {
    const id = !task.due_date ? 'no-date'
        : task.due_date < today ? 'overdue'
          : task.due_date === today ? 'today' : 'upcoming';
    byId[id].tasks.push(task);
  });
  if (sortBy === 'deadline-late') {
    return [byId.upcoming, byId.today, byId.overdue, byId['no-date'], completedSection]
      .filter((section) => section.tasks.length > 0);
  }
  return sections.filter((section) => section.tasks.length > 0);
}

export function getTaskBoardColumns(tasks) {
  const columns = [
    { id: 'high', title: 'High priority', tasks: [] },
    { id: 'medium', title: 'Medium priority', tasks: [] },
    { id: 'low', title: 'Low priority', tasks: [] },
    { id: 'none', title: 'No priority', tasks: [] },
  ];
  const byId = Object.fromEntries(columns.map((column) => [column.id, column]));
  tasks.filter((task) => !task.completed).forEach((task) => {
    (byId[task.priority] || byId.none).tasks.push(task);
  });
  return columns;
}
