import { useEffect, useState } from 'react';
import { readTaskViewSettings, writeTaskViewSettings } from '../utils/taskViewPreferences';

export default function useTaskViewSettings(view, initialStatus) {
  const [settings, setSettings] = useState(() => readTaskViewSettings(view, initialStatus));

  useEffect(() => {
    writeTaskViewSettings(view, settings);
  }, [view, settings]);

  const change = (patch) => setSettings((current) => ({ ...current, ...patch }));
  const reset = () => setSettings((current) => ({
    ...current, status: 'all', priorities: [], area: '', sortBy: 'newest',
  }));

  return { settings, change, reset };
}
