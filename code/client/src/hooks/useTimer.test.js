import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTimer from './useTimer';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始状态为 idle，elapsed=0，无选中科目', () => {
    const { result } = renderHook(() => useTimer());

    expect(result.current.phase).toBe('idle');
    expect(result.current.elapsed).toBe(0);
    expect(result.current.selectedSubject).toBe(null);
    expect(result.current.notes).toBe('');
  });

  it('startStudy → phase 变为 studying', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.startStudy();
    });

    expect(result.current.phase).toBe('studying');
  });

  it('startStudy 后计时，endStudy 返回正确时长', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });

    act(() => { vi.advanceTimersByTime(5000); });

    let duration;
    act(() => {
      duration = result.current.endStudy();
    });

    expect(duration).toBe(5000);
    expect(result.current.phase).toBe('rest_prompt');
  });

  it('endStudy 在无计时时返回 null 并回到 idle', () => {
    const { result } = renderHook(() => useTimer());

    let duration;
    act(() => {
      result.current.startStudy();
      duration = result.current.endStudy();
    });

    // 没有 advanceTimers，Date.now() 不变 → duration = 0
    expect(duration).toBeNull();
    expect(result.current.phase).toBe('idle');
  });

  it('skipRest → phase 回到 idle，选中科目和备注被清空', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.endStudy(); });

    // 设置科目和备注
    act(() => { result.current.selectSubject({ name: '数学' }); });
    act(() => { result.current.updateNotes('测试数据'); });

    act(() => { result.current.skipRest(); });

    expect(result.current.phase).toBe('idle');
    expect(result.current.selectedSubject).toBeNull();
    expect(result.current.notes).toBe('');
  });

  it('startRest → phase 变为 resting，备注被清空', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.endStudy(); });

    act(() => { result.current.updateNotes('之前写的备注'); });

    act(() => { result.current.startRest(); });

    expect(result.current.phase).toBe('resting');
    expect(result.current.notes).toBe('');
  });

  it('endRest → phase 回到 idle，选中科目和备注被清空', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.endStudy(); });
    act(() => { result.current.startRest(); });
    act(() => { vi.advanceTimersByTime(2000); });

    let duration;
    act(() => {
      duration = result.current.endRest();
    });

    expect(duration).toBe(2000);
    expect(result.current.phase).toBe('idle');
    expect(result.current.selectedSubject).toBeNull();
    expect(result.current.notes).toBe('');
  });

  it('endRest 在无计时时返回 null 并回到 idle', () => {
    const { result } = renderHook(() => useTimer());

    // 快速走完学习阶段并进入休息
    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { result.current.endStudy(); });
    act(() => { result.current.startRest(); });
    // 立即结束休息，duration=0
    let duration;
    act(() => {
      duration = result.current.endRest();
    });

    expect(duration).toBeNull();
    expect(result.current.phase).toBe('idle');
  });

  it('selectSubject / updateNotes 设置状态', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.selectSubject({ name: '英语' }); });
    act(() => { result.current.updateNotes('背单词'); });

    expect(result.current.selectedSubject).toEqual({ name: '英语' });
    expect(result.current.notes).toBe('背单词');
  });
});
