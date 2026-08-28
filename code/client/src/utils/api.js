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

export const remindersApi = {
  list: () => request('/reminders'),

  create: (content) =>
    request('/reminders', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  update: (id, content) =>
    request(`/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  delete: (id) =>
    request(`/reminders/${id}`, { method: 'DELETE' }),
};

/**
 * 从 Content-Disposition 响应头解析文件名
 * @param {string} disposition - Content-Disposition 头原文
 * @returns {string | null}
 */
function parseFilename(disposition) {
  const match = disposition.match(/filename="?([^";]+)"?/);
  return match ? match[1] : null;
}

export const importApi = {
  /**
   * 导入全部数据（全量替换，body 为完整导出 JSON 结构）
   * @param {object} payload - 完整导出 JSON（含 app 与 data 五表）
   * @returns {Promise<{ success: boolean, counts: object }>}
   */
  submit: (payload) =>
    request('/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const exportApi = {
  /**
   * 导出全部数据为 JSON 文件（管理模式横幅按钮使用）
   * 返回 blob 与文件名，由调用方触发浏览器下载
   * @returns {Promise<{ blob: Blob, filename: string }>}
   */
  download: async () => {
    const res = await fetch(`${API_BASE}/export`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '导出失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const filename = parseFilename(disposition)
      || `focus-export-${new Date().toISOString().slice(0, 10)}.json`;
    return { blob, filename };
  },
};
