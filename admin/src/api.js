const BASE_URL = '/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/admin/login';
    throw new ApiError('Unauthorized', 401);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Request failed with status ${res.status}`,
      res.status,
      data
    );
  }

  return data;
}

const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request('/auth/me'),

  // Admin - Dashboard
  getDashboard: () => request('/admin/dashboard'),

  // Admin - Users
  getUsers: () => request('/admin/users'),
  getInvites: () => request('/admin/invites'),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  deleteInvite: (id) => request(`/admin/invites/${id}`, { method: 'DELETE' }),
  inviteUser: (email) =>
    request('/admin/invite', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Admin - Settings
  getSettings: () => request('/admin/settings'),
  updateSettings: (settings) =>
    request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }),

  // Admin - Prompts
  getPrompts: () => request('/admin/prompts'),
  createPrompt: (data) =>
    request('/admin/prompts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePrompt: (id, data) =>
    request(`/admin/prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePrompt: (id) =>
    request(`/admin/prompts/${id}`, { method: 'DELETE' }),

  // Folders
  getFolders: () => request('/folders'),
  createFolder: (data) =>
    request('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateFolder: (id, data) =>
    request(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteFolder: (id) =>
    request(`/folders/${id}`, { method: 'DELETE' }),

  // Snippets
  getSnippets: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.folder) qs.set('folder', params.folder);
    if (params.tag) qs.set('tag', params.tag);
    if (params.search) qs.set('search', params.search);
    const query = qs.toString();
    return request(`/snippets${query ? `?${query}` : ''}`);
  },
  createSnippet: (data) =>
    request('/snippets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSnippet: (id, data) =>
    request(`/snippets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSnippet: (id) =>
    request(`/snippets/${id}`, { method: 'DELETE' }),

  // Tags
  getTags: () => request('/tags'),
  createTag: (data) =>
    request('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTag: (id, data) =>
    request(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTag: (id) =>
    request(`/tags/${id}`, { method: 'DELETE' }),
};

export default api;
export { ApiError };
