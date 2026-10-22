const API_BASE = import.meta.env.VITE_API_URL || '';
export const PROGRESS_CHANGED = 'life-system:progress-changed';
let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = token;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    cache: 'no-store',
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      ...options.headers,
    },
  };
  if (options.method && !['GET', 'HEAD'].includes(options.method) && csrfToken && endpoint !== '/api/auth/login') {
    config.headers['X-Lock-In-CSRF'] = csrfToken;
  }

  const response = await fetch(url, config);
  if (!response.ok) {
    if (response.status === 401 && !['/api/auth/login', '/api/auth/session'].includes(endpoint)) {
      setCsrfToken(null);
      window.dispatchEvent(new Event('lock-in:auth-required'));
    }
    let errorDetail = 'Request failed';
    try {
      const errJson = await response.json();
      errorDetail = Array.isArray(errJson.detail)
        ? errJson.detail.map((item) => item.msg || 'Invalid value').join('; ')
        : (errJson.detail || JSON.stringify(errJson));
    } catch {
      errorDetail = response.statusText || `${response.status}`;
    }
    throw new Error(errorDetail);
  }

  const data = response.status === 204 ? null : await response.json();
  if (options.method && options.method !== 'GET' && /^\/api\/(tasks|habits)(\/|$)/.test(endpoint)) {
    window.dispatchEvent(new Event(PROGRESS_CHANGED));
  }
  return data;
}

export const api = {
  getSession: async () => {
    const session = await request('/api/auth/session');
    setCsrfToken(session.csrf);
    return session;
  },
  login: async (password) => {
    const session = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
    setCsrfToken(session.csrf);
    return session;
  },
  logout: async () => {
    try {
      return await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setCsrfToken(null);
    }
  },
  assistantStatus: () => request('/api/assistant/status'),
  askAssistant: (data) => request('/api/assistant/ask', { method: 'POST', body: JSON.stringify(data) }),
  applyAssistantProposal: (id) => request(`/api/assistant/proposals/${encodeURIComponent(id)}/apply`, { method: 'POST' }),
  getProfile: () => request('/api/profile'),
  updateProfile: (data) => request('/api/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getProgress: () => request(`/api/progress?timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}`),
  getInbox: () => request('/api/inbox'),
  createInboxEntry: (content) => request('/api/inbox', {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),
  updateInboxEntry: (id, content) => request(`/api/inbox/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  }),
  deleteInboxEntry: (id) => request(`/api/inbox/${id}`, { method: 'DELETE' }),
  getProjects: () => request('/api/projects'),
  createProject: (data) => request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  getGoalAreas: () => request('/api/goal-areas'),
  createGoalArea: (data) => request('/api/goal-areas', { method: 'POST', body: JSON.stringify(data) }),
  updateGoalArea: (id, data) => request(`/api/goal-areas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGoalArea: (id) => request(`/api/goal-areas/${id}`, { method: 'DELETE' }),
  getGoals: () => request('/api/goals'),
  createGoal: (data) => request('/api/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (id, data) => request(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGoal: (id) => request(`/api/goals/${id}`, { method: 'DELETE' }),
  getCalendar: (start, end) => request(`/api/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  createCalendarEvent: (data) => request('/api/calendar/events', { method: 'POST', body: JSON.stringify(data) }),
  updateCalendarEvent: (id, data) => request(`/api/calendar/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCalendarEvent: (id) => request(`/api/calendar/events/${id}`, { method: 'DELETE' }),
  getFinanceOverview: (month, today) => request(`/api/finance/overview?month=${encodeURIComponent(month)}&today=${encodeURIComponent(today)}`),
  getFinanceTransactions: (month, offset = 0, limit = 50) => request(`/api/finance/transactions?month=${encodeURIComponent(month)}&offset=${offset}&limit=${limit}`),
  saveFinanceSettings: (data) => request('/api/finance/settings', { method: 'PUT', body: JSON.stringify(data) }),
  createFinanceTransaction: (data) => request('/api/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateFinanceTransaction: (id, data) => request(`/api/finance/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFinanceTransaction: (id) => request(`/api/finance/transactions/${id}`, { method: 'DELETE' }),
  createFinanceBudgetItem: (data) => request('/api/finance/budget', { method: 'POST', body: JSON.stringify(data) }),
  updateFinanceBudgetItem: (id, data) => request(`/api/finance/budget/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFinanceBudgetItem: (id) => request(`/api/finance/budget/${id}`, { method: 'DELETE' }),
  createFinanceObligation: (data) => request('/api/finance/obligations', { method: 'POST', body: JSON.stringify(data) }),
  updateFinanceObligation: (id, data) => request(`/api/finance/obligations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFinanceObligation: (id) => request(`/api/finance/obligations/${id}`, { method: 'DELETE' }),
  payFinanceObligation: (id, data) => request(`/api/finance/obligations/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  saveFinanceWeeklyReview: (weekStart, data) => request(`/api/finance/reviews/weekly?week_start=${encodeURIComponent(weekStart)}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Today overview
  getToday: (date) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/api/today${query}`);
  },

  // Tasks
  getTasks: (filter, category, projectId) => {
    const params = new URLSearchParams();
    if (filter) params.append('filter', filter);
    if (category) params.append('category', category);
    if (projectId) params.append('project_id', projectId);
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
  createSubtask: (taskId, title) =>
    request(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  updateSubtask: (taskId, subtaskId, data) =>
    request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSubtask: (taskId, subtaskId) =>
    request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
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

  // Weekly Review Cockpit
  getWeeklyCockpit: (date, today) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (today) params.set('today', today);
    params.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    return request(`/api/reviews/weekly?${params.toString()}`);
  },
  saveWeeklyReview: (weekStart, data) =>
    request(`/api/reviews/weekly?week_start=${encodeURIComponent(weekStart)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
