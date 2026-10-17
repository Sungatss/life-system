export const TASK_AREAS = ['Work', 'University', 'Inbox', 'Learning'];

export function taskAreaChoices(existingAreas = []) {
  const extras = existingAreas
    .filter((area) => area && !TASK_AREAS.includes(area))
    .sort((left, right) => left.localeCompare(right));

  return [...TASK_AREAS, ...new Set(extras)];
}
