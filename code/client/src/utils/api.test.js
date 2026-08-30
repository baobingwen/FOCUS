import { describe, it, expect, afterEach, vi } from 'vitest';

// 分发入口测试：验证 VITE_DATA_LAYER 不同值导出不同数据层实现
// vi.resetModules + 动态 import 让模块按当前环境变量重新求值

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('api 分发入口', () => {
  it('默认（未设置 VITE_DATA_LAYER）导出 REST 实现：调用走 fetch', async () => {
    vi.stubEnv('VITE_DATA_LAYER', '');
    vi.resetModules();
    const api = await import('./api');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    });
    await api.recordsApi.list();
    expect(fetch).toHaveBeenCalledWith('/api/records', expect.any(Object));
  });

  it('VITE_DATA_LAYER=local 导出本地实现：调用不经过 fetch', async () => {
    vi.stubEnv('VITE_DATA_LAYER', 'local');
    vi.resetModules();
    const api = await import('./api');

    globalThis.fetch = vi.fn();
    // 本地实现走 IndexedDB（测试环境无 indexedDB，调用会抛错）——只验证不触碰 fetch
    await api.subjectsApi.list().catch(() => {});
    expect(fetch).not.toHaveBeenCalled();
  });
});
