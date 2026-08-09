// code/client/src/hooks/useMultiTap.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMultiTap from './useMultiTap';

// 连点检测依赖 Date.now()，fake 日期以便精确控制点击间隔
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-07T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMultiTap', () => {
  it('默认连点 5 下触发 onComplete', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useMultiTap(onComplete));

    for (let i = 0; i < 4; i++) {
      act(() => result.current());
      expect(onComplete).not.toHaveBeenCalled();
    }
    act(() => result.current());
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('触发后计数重置：继续连点可再次触发', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useMultiTap(onComplete));

    for (let i = 0; i < 5; i++) act(() => result.current());
    expect(onComplete).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i++) act(() => result.current());
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('两次点击间隔超过 windowMs（默认 2s）计数重置', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useMultiTap(onComplete));

    // 点 4 下：未触发
    for (let i = 0; i < 4; i++) act(() => result.current());
    expect(onComplete).not.toHaveBeenCalled();

    // 推进 3 秒后点第 5 下：超时重置（计数归 1），仍未触发
    vi.setSystemTime(new Date('2026-07-07T12:00:03'));
    act(() => result.current());
    expect(onComplete).not.toHaveBeenCalled();

    // 再补 4 下凑满 5 次：触发
    for (let i = 0; i < 4; i++) act(() => result.current());
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('自定义 count 与 windowMs', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useMultiTap(onComplete, { count: 3, windowMs: 1000 }));

    for (let i = 0; i < 2; i++) act(() => result.current());
    expect(onComplete).not.toHaveBeenCalled();
    act(() => result.current());
    expect(onComplete).toHaveBeenCalledTimes(1);

    // 超时窗口改为 1s：推进 2s 后点击重置
    vi.setSystemTime(new Date('2026-07-07T12:00:02'));
    act(() => result.current());
    for (let i = 0; i < 2; i++) act(() => result.current());
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('onComplete 变化后使用最新回调', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useMultiTap(cb), { initialProps: { cb: first } });

    rerender({ cb: second });
    for (let i = 0; i < 5; i++) act(() => result.current());

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
