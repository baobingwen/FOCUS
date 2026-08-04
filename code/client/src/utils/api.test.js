import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordsApi, subjectsApi, tagsApi } from './api';

describe('recordsApi', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('create: 发送 POST 请求并返回 JSON', async () => {
    const mockData = { id: 1, mode: 'study', duration_ms: 5000 };
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await recordsApi.create({ mode: 'study', duration_ms: 5000 });
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'study', duration_ms: 5000 }),
    });
  });

  it('create: HTTP 错误时抛出 Error', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: '无效的数据' }),
    });

    await expect(recordsApi.create({})).rejects.toThrow('无效的数据');
  });

  it('create: 非 JSON 响应时 fallback 到默认错误信息', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    });

    await expect(recordsApi.create({})).rejects.toThrow('请求失败');
  });

  it('list: 不带 date 参数时 qs 为空', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    });

    await recordsApi.list();
    expect(fetch).toHaveBeenCalledWith('/api/records', expect.any(Object));
  });

  it('list: 带 date 参数时拼接 qs', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    });

    await recordsApi.list('2026-07-07');
    expect(fetch).toHaveBeenCalledWith(
      '/api/records?date=2026-07-07',
      expect.any(Object),
    );
  });

  it('list: date 参数经过 encodeURIComponent 编码', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    });

    await recordsApi.list('2026/07/07');
    expect(fetch).toHaveBeenCalledWith(
      '/api/records?date=2026%2F07%2F07',
      expect.any(Object),
    );
  });

  it('todayOverview: 返回今日概览数据', async () => {
    const mockData = { total_study_ms: 3600000, total_rest_ms: 300000, by_subject: [] };
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await recordsApi.todayOverview();
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('/api/records/today', expect.any(Object));
  });
});

describe('subjectsApi', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('list: 返回科目列表', async () => {
    const mockSubjects = [{ id: 1, name: '数学' }];
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSubjects),
    });

    const result = await subjectsApi.list();
    expect(result).toEqual(mockSubjects);
    expect(fetch).toHaveBeenCalledWith('/api/subjects', expect.any(Object));
  });

  it('create: 发送 POST 并返回新科目', async () => {
    const mockSubject = { id: 4, name: '政治' };
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSubject),
    });

    const result = await subjectsApi.create('政治');
    expect(result).toEqual(mockSubject);
    expect(fetch).toHaveBeenCalledWith('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '政治' }),
    });
  });

  it('delete: 发送 DELETE 请求', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await subjectsApi.delete(42);
    expect(fetch).toHaveBeenCalledWith('/api/subjects/42', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('HTTP 错误时抛出 Error', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: '科目已存在' }),
    });

    await expect(subjectsApi.create('数学')).rejects.toThrow('科目已存在');
  });
});

describe('tagsApi', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('list: 返回标签列表', async () => {
    const mockTags = [{ id: 1, name: '高数' }];
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTags),
    });

    const result = await tagsApi.list();
    expect(result).toEqual(mockTags);
    expect(fetch).toHaveBeenCalledWith('/api/tags', expect.any(Object));
  });

  it('create: 发送 POST 并返回新标签', async () => {
    const mockTag = { id: 4, name: '高数' };
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTag),
    });

    const result = await tagsApi.create('高数');
    expect(result).toEqual(mockTag);
    expect(fetch).toHaveBeenCalledWith('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '高数' }),
    });
  });

  it('delete: 发送 DELETE 请求', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await tagsApi.delete(42);
    expect(fetch).toHaveBeenCalledWith('/api/tags/42', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('HTTP 错误时抛出 Error', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: '标签名不能为空' }),
    });

    await expect(tagsApi.create('')).rejects.toThrow('标签名不能为空');
  });

  it('reorder: 发送 PUT 请求提交新顺序', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await tagsApi.reorder([3, 1, 2]);
    expect(fetch).toHaveBeenCalledWith('/api/tags/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [3, 1, 2] }),
    });
  });
});
