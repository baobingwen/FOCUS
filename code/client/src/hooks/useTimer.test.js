import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTimer from './useTimer';
import { loadTimerSnapshot } from '../utils/timerStorage';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
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

  // ──── 计时快照持久化/恢复测试 ────

  const SNAPSHOT_KEY = 'focus:timer:snapshot';

  /** 构造一份合法 studying 快照（相对当前 fake 时钟时刻） */
  function makeStudySnapshot() {
    const base = Date.now();
    return {
      version: 1,
      phase: 'studying',
      segmentStart: base - 5000,
      accumulatedStudy: 10000,
      accumulatedPause: 0,
      segments: [{ type: 'study', duration_ms: 10000 }],
      subject: { id: 1, name: '数学' },
      notes: '复习笔记',
      tags: ['高数'],
      pages: 3,
      updatedAt: base - 1000,
    };
  }

  it('startStudy 写入计时快照（phase=studying）', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });

    const snap = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
    expect(snap.phase).toBe('studying');
    expect(snap.accumulatedStudy).toBe(0);
    expect(typeof snap.segmentStart).toBe('number');
    expect(typeof snap.updatedAt).toBe('number');
  });

  it('updateNotes / toggleTag / addPages 时同步更新快照', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { result.current.updateNotes('背单词'); });
    act(() => { result.current.toggleTag('高数'); });
    act(() => { result.current.addPages(5); });

    const snap = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
    expect(snap.notes).toBe('背单词');
    expect(snap.tags).toEqual(['高数']);
    expect(snap.pages).toBe(5);
  });

  it('endStudy / skipRest / endRest 清空快照（rest_prompt 不持久化）', () => {
    const { result } = renderHook(() => useTimer());

    // endStudy → 清空
    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(localStorage.getItem(SNAPSHOT_KEY)).not.toBeNull();
    act(() => { result.current.endStudy(); });
    expect(result.current.phase).toBe('rest_prompt');
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();

    // skipRest → 清空
    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.endStudy(); });
    act(() => { result.current.skipRest(); });
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();

    // endRest → 清空
    act(() => { result.current.startStudy(); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.endStudy(); });
    act(() => { result.current.startRest(); });
    expect(localStorage.getItem(SNAPSHOT_KEY)).not.toBeNull();
    act(() => { result.current.endRest(); });
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });

  it('从快照水合恢复 studying：第一帧即恢复态，计时继续累计', () => {
    const { result } = renderHook(() => useTimer(makeStudySnapshot()));

    expect(result.current.restored).toBe(true);
    expect(result.current.phase).toBe('studying');
    expect(result.current.selectedSubject).toEqual({ id: 1, name: '数学' });
    expect(result.current.notes).toBe('复习笔记');
    expect(result.current.tags).toEqual(['高数']);
    expect(result.current.pages).toBe(3);
    // 恢复瞬间 elapsed = 10000 + (now − segmentStart) = 10000 + 5000
    expect(result.current.elapsed).toBe(15000);
    expect(result.current.restoreInfo).toEqual({
      phase: 'studying',
      subjectName: '数学',
      elapsedAtClose: 14000, // 关页面前已学 = 10000 + (updatedAt − segmentStart)
      awayMs: 1000,          // 离开 = now − updatedAt
    });

    // 计时继续累计（绝对时间戳咬合）
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.elapsed).toBe(17000);
  });

  it('ignoreAwayTime 忽略离开时间：elapsed 回到关页面前的瞬间值；countAwayTime 切回计入', () => {
    const { result } = renderHook(() => useTimer(makeStudySnapshot()));
    expect(result.current.elapsed).toBe(15000); // 含 1s 离开缺口

    act(() => { result.current.ignoreAwayTime(); });
    // 段起点前移 1s → elapsed 回到 14000（关页面前的瞬间值）
    expect(result.current.awayIgnored).toBe(true);
    expect(result.current.elapsed).toBe(14000);

    // 切回计入：缺口重新计入
    act(() => { result.current.countAwayTime(); });
    expect(result.current.awayIgnored).toBe(false);
    expect(result.current.elapsed).toBe(15000);
  });

  it('从快照水合恢复 paused / resting', () => {
    const base = Date.now();

    // paused：elapsed 停在累计学习时长，pausedElapsed 从段起点推导
    const paused = renderHook(() => useTimer({
      version: 1, phase: 'paused',
      segmentStart: base - 3000, accumulatedStudy: 8000, accumulatedPause: 0,
      segments: [{ type: 'study', duration_ms: 8000 }],
      subject: { id: 1, name: '英语' }, notes: '', tags: [], pages: null,
      updatedAt: base - 500,
    }));
    expect(paused.result.current.phase).toBe('paused');
    expect(paused.result.current.elapsed).toBe(8000);
    expect(paused.result.current.pausedElapsed).toBe(3000);

    // resting：elapsed 从段起点推导
    const resting = renderHook(() => useTimer({
      version: 1, phase: 'resting',
      segmentStart: base - 4000, accumulatedStudy: 0, accumulatedPause: 0,
      segments: [], subject: null, notes: '', tags: [], pages: null,
      updatedAt: base - 1000,
    }));
    expect(resting.result.current.phase).toBe('resting');
    expect(resting.result.current.elapsed).toBe(4000);
  });

  it('discardRestore 清快照回 idle', () => {
    const { result } = renderHook(() => useTimer(makeStudySnapshot()));

    act(() => { result.current.discardRestore(); });

    expect(result.current.phase).toBe('idle');
    expect(result.current.restored).toBe(false);
    expect(result.current.restoreInfo).toBeNull();
    expect(result.current.selectedSubject).toBeNull();
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });

  it('dismissRestore 仅隐藏提示条：快照保留、计时继续', () => {
    // 模拟 App 真实流程：快照先存在于 localStorage，经 loadTimerSnapshot 水合
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(makeStudySnapshot()));
    const { result } = renderHook(() => useTimer(loadTimerSnapshot()));

    act(() => { result.current.dismissRestore(); });

    expect(result.current.restored).toBe(false);
    expect(result.current.phase).toBe('studying');
    // 快照保留（下次刷新仍可恢复）
    expect(localStorage.getItem(SNAPSHOT_KEY)).not.toBeNull();
    // 计时继续（绝对时间戳咬合）
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.elapsed).toBe(17000);
  });

  it('pagehide 事件最后时刻补写快照', () => {
    const { result } = renderHook(() => useTimer());

    act(() => { result.current.startStudy(); });
    act(() => { window.dispatchEvent(new Event('pagehide')); });

    const snap = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
    expect(snap.phase).toBe('studying');
    expect(snap.updatedAt).toBeLessThanOrEqual(Date.now());
  });

  it('无快照时正常 idle，不进入恢复态', () => {
    const { result } = renderHook(() => useTimer());

    expect(result.current.restored).toBe(false);
    expect(result.current.restoreInfo).toBeNull();
    expect(result.current.phase).toBe('idle');
  });

  it('非法快照被 loadTimerSnapshot 拒绝 → null（不崩溃、回 idle）', () => {
    // phase 非法（idle 不在活跃三态）
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      version: 1, phase: 'idle', segmentStart: Date.now(), accumulatedStudy: 0,
      accumulatedPause: 0, segments: [], subject: null, notes: '', tags: [], pages: null, updatedAt: Date.now(),
    }));
    expect(loadTimerSnapshot()).toBeNull();

    // JSON 损坏
    localStorage.setItem(SNAPSHOT_KEY, 'not-json{{{');
    expect(loadTimerSnapshot()).toBeNull();

    // version 不符
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ version: 99, phase: 'studying' }));
    expect(loadTimerSnapshot()).toBeNull();

    // 无快照
    localStorage.removeItem(SNAPSHOT_KEY);
    expect(loadTimerSnapshot()).toBeNull();
  });
});
