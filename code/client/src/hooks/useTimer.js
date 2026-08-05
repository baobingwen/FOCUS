import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 极简计时器 hook
 *
 * 状态机：idle → studying → paused → studying → paused → ... → rest_prompt → resting → idle
 *   idle: 等待用户选择科目后开始
 *   studying: 学习计时中，可按暂停
 *   paused: 暂停中，暂停时间计入 paused_ms，可继续或结束
 *   rest_prompt: 学习结束，询问是否休息
 *   resting: 休息计时中
 *
 * 时间轴使用 Date.now() 绝对时间戳，不依赖累加器，
 * 即使浏览器锁屏/休眠恢复后也能精确咬合真实时间。
 * 暂停通过 accumulatedStudyRef 追踪总学习时长，不受暂停段影响。
 */
export default function useTimer() {
  const [phase, setPhase] = useState('idle'); // idle | studying | paused | rest_prompt | resting
  const [elapsed, setElapsed] = useState(0);   // 当前总学习时长（毫秒，不含暂停）
  const [pausedElapsed, setPausedElapsed] = useState(0); // 当前暂停段时长
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]); // 当前学习时段选中的标签名数组
  const [pages, setPages] = useState(null); // 本次学习复习的页数（null = 未填写）
  const [frozen, setFrozen] = useState(false); // 是否处于"离开冻结"态（不计入暂停记录）

  const segmentStartRef = useRef(null);      // 当前段的起始时间戳
  const accumulatedStudyRef = useRef(0);     // 已完成的 study 段总时长
  const accumulatedPauseRef = useRef(0);     // 已完成的 pause 段总时长
  const segmentsRef = useRef([]);            // 已完成的段列表 [{type, duration_ms}]
  const intervalRef = useRef(null);
  const phaseRef = useRef(phase);            // 同步 ref，tick 闭包内读取

  // 同步 phaseRef
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const tick = useCallback(() => {
    if (!segmentStartRef.current) return;
    const now = Date.now();
    const currentSegmentMs = Math.max(0, now - segmentStartRef.current);
    const currentPhase = phaseRef.current;

    if (currentPhase === 'studying') {
      setElapsed(accumulatedStudyRef.current + currentSegmentMs);
    } else if (currentPhase === 'paused') {
      setPausedElapsed(currentSegmentMs);
    } else if (currentPhase === 'resting') {
      setElapsed(currentSegmentMs);
    }
  }, []); // 依赖为空：用 ref 读取最新 phase/accumulated，不依赖 state

  // 启动 tick 定时器（tick 稳定无依赖，startTicker 也只创建一次）
  const startTicker = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 100);
  }, [tick]);

  // 停止 tick 定时器
  const stopTicker = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 开始学习
  const startStudy = useCallback(() => {
    setPhase('studying');
    setElapsed(0);
    setPausedElapsed(0);
    setTags([]);
    setPages(null);
    accumulatedStudyRef.current = 0;
    accumulatedPauseRef.current = 0;
    segmentsRef.current = [];
    segmentStartRef.current = Date.now();
    startTicker();
  }, [startTicker]);

  // 暂停
  const pauseStudy = useCallback(() => {
    if (phase !== 'studying') return;
    // 结束当前学习段
    const studyMs = Math.max(0, Date.now() - segmentStartRef.current);
    accumulatedStudyRef.current += studyMs;
    segmentsRef.current.push({ type: 'study', duration_ms: studyMs });
    setElapsed(accumulatedStudyRef.current);
    // 开始暂停段
    segmentStartRef.current = Date.now();
    setPausedElapsed(0);
    setPhase('paused');
  }, [phase]);

  // 继续学习
  const resumeStudy = useCallback(() => {
    if (phase !== 'paused') return;
    // 结束当前暂停段
    const pauseMs = Math.max(0, Date.now() - segmentStartRef.current);
    accumulatedPauseRef.current += pauseMs;
    segmentsRef.current.push({ type: 'pause', duration_ms: pauseMs });
    // 开始新的学习段
    segmentStartRef.current = Date.now();
    setPhase('studying');
  }, [phase]);

  // 结束学习（返回 { duration_ms, paused_ms, segments }）
  const endStudy = useCallback(() => {
    // 结束当前段（无论学习还是暂停）
    if (segmentStartRef.current) {
      const currentMs = Math.max(0, Date.now() - segmentStartRef.current);
      if (phase === 'studying') {
        accumulatedStudyRef.current += currentMs;
        segmentsRef.current.push({ type: 'study', duration_ms: currentMs });
      } else if (phase === 'paused') {
        accumulatedPauseRef.current += currentMs;
        segmentsRef.current.push({ type: 'pause', duration_ms: currentMs });
      }
    }

    stopTicker();
    segmentStartRef.current = null;

    if (accumulatedStudyRef.current <= 0) {
      setPhase('idle');
      return null;
    }

    // 返回完整的学习段数据
    const result = {
      duration_ms: accumulatedStudyRef.current,
      paused_ms: accumulatedPauseRef.current,
      segments: segmentsRef.current,
    };

    // phase 切换
    setPhase('rest_prompt');
    return result;
  }, [phase, stopTicker]);

  // 开始休息
  const startRest = useCallback(() => {
    setNotes('');
    setTags([]);
    setPages(null);
    setElapsed(0);
    setPhase('resting');
    segmentStartRef.current = Date.now();
    startTicker();
  }, [startTicker]);

  // 结束休息
  const endRest = useCallback(() => {
    stopTicker();
    let duration = 0;
    if (segmentStartRef.current) {
      duration = Math.max(0, Date.now() - segmentStartRef.current);
      segmentStartRef.current = null;
    }
    if (duration <= 0) {
      setPhase('idle');
      return null;
    }
    setSelectedSubject(null);
    setNotes('');
    setTags([]);
    setPages(null);
    setPhase('idle');
    return duration;
  }, [stopTicker]);

  // 不休息，直接返回 idle
  const skipRest = useCallback(() => {
    setSelectedSubject(null);
    setNotes('');
    setTags([]);
    setPages(null);
    setPhase('idle');
  }, []);

  // 冻结 — 离开页面时停止计时，结束时记录学习段但不产生暂停记录
  const freeze = useCallback(() => {
    if (phaseRef.current !== 'studying' || !segmentStartRef.current) return;
    const now = Date.now();
    const duration = Math.max(0, now - segmentStartRef.current);
    accumulatedStudyRef.current += duration;
    segmentsRef.current.push({ type: 'study', duration_ms: duration });
    segmentStartRef.current = null;
    setElapsed(accumulatedStudyRef.current);
    stopTicker();
    setFrozen(true);
  }, [stopTicker]);

  // 解冻 — 回到页面时自动恢复计时
  const thaw = useCallback(() => {
    if (phaseRef.current !== 'studying') return;
    segmentStartRef.current = Date.now();
    startTicker();
    setFrozen(false);
  }, [startTicker]);

  // 选择科目
  const selectSubject = useCallback((subject) => {
    setSelectedSubject(subject);
  }, []);

  // 更新备注
  const updateNotes = useCallback((text) => {
    setNotes(text);
  }, []);

  // 切换标签选中状态（学习中点选/取消）
  const toggleTag = useCallback((name) => {
    setTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);
  }, []);

  // 从当前选中中移除标签（标签被删除后清理）
  const removeTag = useCallback((name) => {
    setTags(prev => prev.filter(t => t !== name));
  }, []);

  // 直接设置页数（输入框；null = 清空）
  const updatePages = useCallback((value) => {
    setPages(value);
  }, []);

  // 快捷累加页数（+1/+5/+10 芯片；上限 9999 与服务端一致）
  const addPages = useCallback((n) => {
    setPages(prev => Math.min(9999, (prev ?? 0) + n));
  }, []);

  return {
    phase,
    elapsed,
    pausedElapsed,
    selectedSubject,
    notes,
    tags,
    pages,
    frozen,
    selectSubject,
    updateNotes,
    toggleTag,
    removeTag,
    updatePages,
    addPages,
    startStudy,
    pauseStudy,
    resumeStudy,
    endStudy,
    startRest,
    endRest,
    skipRest,
    freeze,
    thaw,
  };
}