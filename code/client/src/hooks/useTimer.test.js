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

  it('startStudy 后计时，endStudy 返回正确时长和 segments', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });

    act(() => { vi.advanceTimersByTime(5000); });

    let data;
    act(() => {
      data = result.current.endStudy();
    });

    expect(data).toEqual({
      duration_ms: 5000,
      paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 5000 }],
    });
    expect(result.current.phase).toBe('rest_prompt');
  });

  it('endStudy 在无计时时返回 null 并回到 idle', () => {
    const { result } = renderHook(() => useTimer());

    let data;
    act(() => {
      result.current.startStudy();
      data = result.current.endStudy();
    });

    // 没有 advanceTimers，Date.now() 不变 → duration = 0
    expect(data).toBeNull();
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

  // ──── 暂停功能测试 ────

  it('pauseStudy → phase 变为 paused', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(3000); });

    act(() => { result.current.pauseStudy(); });

    expect(result.current.phase).toBe('paused');
  });

  it('pauseStudy → resumeStudy → 继续计时', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(5000); });
    act(() => { result.current.pauseStudy(); });
    // 暂停时 elapsed 停在学习时长
    expect(result.current.elapsed).toBe(5000);

    act(() => { vi.advanceTimersByTime(2000); });
    // 暂停中 elapsed 不变
    expect(result.current.elapsed).toBe(5000);
    // 暂停计时增长
    expect(result.current.pausedElapsed).toBe(2000);

    act(() => { result.current.resumeStudy(); });
    expect(result.current.phase).toBe('studying');

    act(() => { vi.advanceTimersByTime(3000); });
    // 恢复后 elapsed 继续增长
    expect(result.current.elapsed).toBe(8000);
  });

  it('pause → resume → pause → endStudy 返回正确 segments', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(10000); }); // 学 10s
    act(() => { result.current.pauseStudy(); });
    act(() => { vi.advanceTimersByTime(5000); });  // 暂停 5s
    act(() => { result.current.resumeStudy(); });
    act(() => { vi.advanceTimersByTime(15000); }); // 又学 15s

    let data;
    act(() => { data = result.current.endStudy(); });

    expect(data).toEqual({
      duration_ms: 25000,
      paused_ms: 5000,
      segments: [
        { type: 'study', duration_ms: 10000 },
        { type: 'pause', duration_ms: 5000 },
        { type: 'study', duration_ms: 15000 },
      ],
    });
    expect(result.current.phase).toBe('rest_prompt');
  });

  it('在暂停态结束，最后一段暂停计入 paused_ms', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(8000); });
    act(() => { result.current.pauseStudy(); });
    act(() => { vi.advanceTimersByTime(3000); }); // 暂停中

    let data;
    act(() => { data = result.current.endStudy(); });

    expect(data).toEqual({
      duration_ms: 8000,
      paused_ms: 3000,
      segments: [
        { type: 'study', duration_ms: 8000 },
        { type: 'pause', duration_ms: 3000 },
      ],
    });
  });

  it('pauseStudy 在非 studying 态不生效', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.pauseStudy(); });
    expect(result.current.phase).toBe('idle');
  });

  it('resumeStudy 在非 paused 态不生效', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { result.current.resumeStudy(); }); // studying 态调用 resume 无效
    expect(result.current.phase).toBe('studying');
  });

  // ──── 冻结功能测试 ────

  it('freeze → frozen=true, elapsed 冻结不增长', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(5000); });

    act(() => { result.current.freeze(); });

    expect(result.current.frozen).toBe(true);
    expect(result.current.phase).toBe('studying');
    expect(result.current.elapsed).toBe(5000);

    // 冻结期间 elapsed 不变
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.elapsed).toBe(5000);
  });

  it('freeze → thaw → 继续计时，冻结时间不计入', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(5000); });

    act(() => { result.current.freeze(); });
    act(() => { vi.advanceTimersByTime(3000); }); // 冻结 3s（不计入）

    act(() => { result.current.thaw(); });
    act(() => { vi.advanceTimersByTime(2000); }); // 恢复后学 2s

    // 总时长 = 5s + 2s = 7s（冻结 3s 不计算）
    expect(result.current.elapsed).toBe(7000);
    expect(result.current.frozen).toBe(false);
  });

  it('freeze → endStudy → 返回正确 duration，不含冻结时间', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(10000); });

    act(() => { result.current.freeze(); });
    act(() => { vi.advanceTimersByTime(5000); }); // 冻结 5s（不计入）

    let data;
    act(() => { data = result.current.endStudy(); });

    expect(data).toEqual({
      duration_ms: 10000,
      paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 10000 }],
    });
    expect(result.current.phase).toBe('rest_prompt');
  });

  it('freeze 在非 studying 态不生效', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.freeze(); }); // idle 态
    expect(result.current.frozen).toBe(false);
  });

  it('thaw 在非 studying 态不生效', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.pauseStudy(); }); // paused 态

    act(() => { result.current.thaw(); }); // 不应生效
    expect(result.current.phase).toBe('paused');
  });

  it('重复 freeze 幂等', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(5000); });

    act(() => { result.current.freeze(); });
    const elapsedAfterFreeze = result.current.elapsed;

    act(() => { result.current.freeze(); }); // 再次 freeze

    // elapsed 不应变化（第二次 freeze 被 guard 拦截）
    expect(result.current.elapsed).toBe(elapsedAfterFreeze);
    expect(result.current.frozen).toBe(true);
  });

  // ──── 标签功能测试 ────

  it('初始 tags 为空数组', () => {
    const { result } = renderHook(() => useTimer());
    expect(result.current.tags).toEqual([]);
  });

  it('toggleTag 添加/取消标签', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.toggleTag('高数'); });
    expect(result.current.tags).toEqual(['高数']);

    act(() => { result.current.toggleTag('线代'); });
    expect(result.current.tags).toEqual(['高数', '线代']);

    // 再次 toggle 取消
    act(() => { result.current.toggleTag('高数'); });
    expect(result.current.tags).toEqual(['线代']);
  });

  it('startStudy 清空标签', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.toggleTag('高数'); });
    act(() => { result.current.startStudy(); });
    expect(result.current.tags).toEqual([]);
  });

  it('skipRest 清空标签', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.endStudy(); });
    act(() => { result.current.toggleTag('高数'); });
    act(() => { result.current.skipRest(); });
    expect(result.current.tags).toEqual([]);
  });

  it('removeTag 从选中中移除标签', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.toggleTag('高数'); });
    act(() => { result.current.toggleTag('线代'); });
    act(() => { result.current.removeTag('高数'); });
    expect(result.current.tags).toEqual(['线代']);
  });
});
