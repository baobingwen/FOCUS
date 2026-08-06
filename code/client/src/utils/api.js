// code/client/src/utils/api.js
const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const recordsApi = {
  create: (data) =>
    request('/records', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  remove: (id) =>
    request(`/records/${id}`, { method: 'DELETE' }),

  list: (date) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/records${qs}`);
  },

  todayOverview: () => request('/records/today'),
};

export const subjectsApi = {
  list: () => request('/subjects'),

  create: (name) =>
    request('/subjects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  delete: (id) =>
    request(`/subjects/${id}`, { method: 'DELETE' }),
};

export const tagsApi = {
  list: () => request('/tags'),

  create: (name) =>
    request('/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  delete: (id) =>
    request(`/tags/${id}`, { method: 'DELETE' }),

  reorder: (ids) =>
    request('/tags/order', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    }),
};
