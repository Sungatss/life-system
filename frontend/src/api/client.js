const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = response.statusText || `${response.status}`;
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // Today overview
  getToday: (date) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/api/today${query}`);
  },

  // Daily note
  getNote: (date) => request(`/api/notes/${encodeURIComponent(date)}`),
  saveNote: (date, content) =>
    request(`/api/notes/${encodeURIComponent(date)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  // Tasks
  getTasks: (filter, category) => {
    const params = new URLSearchParams();
    if (filter) params.append('filter', filter);
    if (category) params.append('category', category);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/tasks${query}`);
  },
  createTask: (data) =>
    request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTask: (id, data) =>
    request(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTask: (id) =>
    request(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),

  // Habits
  getHabits: (days = 14, date) => {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    if (date) params.append('date', date);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/habits${query}`);
  },
  createHabit: (name) =>
    request('/api/habits', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  updateHabit: (id, data) =>
    request(`/api/habits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteHabit: (id) =>
    request(`/api/habits/${id}`, {
      method: 'DELETE',
    }),
  toggleHabit: (id, date, completed = null) =>
    request(`/api/habits/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ date, completed }),
    }),

  // Contributions
  getContributions: (days = 112, date) => {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    if (date) params.append('date', date);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/contributions${query}`);
  },
};
