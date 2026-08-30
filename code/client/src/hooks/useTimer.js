import { useState, useRef, useCallback, useEffect } from 'react';
import { saveTimerSnapshot, clearTimerSnapshot } from '../utils/timerStorage';

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
 *
 * 计时状态持久化（计时快照，见 utils/timerStorage.js）：
 *   - 接受初始快照水合（App 挂载时从 localStorage 读入），第一帧即恢复态
 *   - 活跃三态（studying/paused/resting）关键状态在状态切换/输入/离开页面/周期兜底时写入
 *   - elapsed 不落盘，恢复后由绝对时间戳推导；rest_prompt 不持久化，会话正常结束清空
 *   - 恢复后可通过 ignoreAwayTime/countAwayTime 切换「忽略/计入离开时间」，discardRestore 放弃恢复
 */
export default function useTimer(initialSnapshot = null) {
  const [phase, setPhase] = useState(initialSnapshot?.phase ?? 'idle'); // idle | studying | paused | rest_prompt | resting
  const [elapsed, setElapsed] = useState(() => {
    if (!initialSnapshot) return 0;
    if (initialSnapshot.phase === 'paused') return initialSnapshot.accumulatedStudy;
    if (initialSnapshot.phase === 'resting') return Math.max(0, Date.now() - initialSnapshot.segmentStart);
    return initialSnapshot.accumulatedStudy + Math.max(0, Date.now() - initialSnapshot.segmentStart);
  });   // 当前总学习时长（毫秒，不含暂停）
  const [pausedElapsed, setPausedElapsed] = useState(() =>
    initialSnapshot?.phase === 'paused' ? Math.max(0, Date.now() - initialSnapshot.segmentStart) : 0
  ); // 当前暂停段时长
  const [selectedSubject, setSelectedSubject] = useState(initialSnapshot?.subject ?? null);
  const [notes, setNotes] = useState(initialSnapshot?.notes ?? '');
  const [tags, setTags] = useState(initialSnapshot?.tags ?? []); // 当前学习时段选中的标签名数组
  const [pages, setPages] = useState(initialSnapshot?.pages ?? null); // 本次学习复习的页数（null = 未填写）
  const [frozen, setFrozen] = useState(false); // 是否处于"离开冻结"态（不计入暂停记录）

  // ── 计时快照恢复状态 ──
  const [restored, setRestored] = useState(() => Boolean(initialSnapshot)); // 本次会话是否由快照恢复
  const [restoreInfo, setRestoreInfo] = useState(() => buildRestoreInfo(initialSnapshot)); // 提示条展示信息
  const [awayIgnored, setAwayIgnored] = useState(false); // 是否已忽略离开时间（提示条按钮态）
  const restoreInfoRef = useRef(restoreInfo);
  useEffect(() => { restoreInfoRef.current = restoreInfo; }, [restoreInfo]);
  const awayShiftRef = useRef(0);     // 已应用的离开位移量（ms），用于切回「计入」
  const awayIgnoredRef = useRef(false);

  const segmentStartRef = useRef(initialSnapshot?.segmentStart ?? null);      // 当前段的起始时间戳
  const accumulatedStudyRef = useRef(initialSnapshot?.accumulatedStudy ?? 0); // 已完成的 study 段总时长
  const accumulatedPauseRef = useRef(initialSnapshot?.accumulatedPause ?? 0); // 已完成的 pause 段总时长
  const segmentsRef = useRef(initialSnapshot?.segments ?? []);                // 已完成的段列表 [{type, duration_ms}]
  const intervalRef = useRef(null);
  const phaseRef = useRef(phase);            // 同步 ref，tick 闭包内读取

  // 持久化读取用 ref（persist 在 setState 同步调用时读取最新值）
  const selectedSubjectRef = useRef(selectedSubject);
  useEffect(() => { selectedSubjectRef.current = selectedSubject; }, [selectedSubject]);
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  const tagsRef = useRef(tags);
  useEffect(() => { tagsRef.current = tags; }, [tags]);
  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

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

  /**
   * 写入计时快照。仅活跃三态（studying/paused/resting）落盘，idle / rest_prompt 不写。
   * overrides 用于在 setState 同一帧内传入最新值（refs 尚未经 effect 同步）。
   * @param {Object} [overrides] - { phase?, subject?, notes?, tags?, pages? }
   */
  const persist = useCallback((overrides = {}) => {
    const p = overrides.phase ?? phaseRef.current;
    if (p !== 'studying' && p !== 'paused' && p !== 'resting') return;
    saveTimerSnapshot({
      phase: p,
      segmentStart: segmentStartRef.current,
      accumulatedStudy: accumulatedStudyRef.current,
      accumulatedPause: accumulatedPauseRef.current,
      segments: segmentsRef.current,
      subject: overrides.subject !== undefined ? overrides.subject : selectedSubjectRef.current,
      notes: overrides.notes !== undefined ? overrides.notes : notesRef.current,
      tags: overrides.tags !== undefined ? overrides.tags : tagsRef.current,
      pages: overrides.pages !== undefined ? overrides.pages : pagesRef.current,
      updatedAt: Date.now(),
    });
  }, []);

  // 快照水合：活跃三态恢复后启动 ticker（paused 也需 tick 更新 pausedElapsed）
  useEffect(() => {
    if (initialSnapshot && initialSnapshot.phase !== 'idle' && initialSnapshot.phase !== 'rest_prompt') {
      startTicker();
    }
    // 仅在挂载时按初始快照启动一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 持久化兜底：pagehide/beforeunload 最后时刻补写 + 活跃态每 10 秒周期写（防浏览器崩溃）
  useEffect(() => {
    const handlePageHide = () => persist();
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    const safetyTimer = setInterval(persist, 10000);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      clearInterval(safetyTimer);
    };
  }, [persist]);

  /** 会话结束：清空快照、退出恢复态（endStudy/skipRest/endRest/放弃恢复共用） */
  const clearSession = useCallback(() => {
    clearTimerSnapshot();
    setRestored(false);
    setRestoreInfo(null);
    awayShiftRef.current = 0;
    awayIgnoredRef.current = false;
    setAwayIgnored(false);
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
    persist({ phase: 'studying', tags: [], pages: null });
  }, [startTicker, persist]);

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
    persist({ phase: 'paused' });
  }, [phase, persist]);

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
    persist({ phase: 'studying' });
  }, [phase, persist]);

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
      clearSession();
      setPhase('idle');
      return null;
    }

    // 返回完整的学习段数据
    const result = {
      duration_ms: accumulatedStudyRef.current,
      paused_ms: accumulatedPauseRef.current,
      segments: segmentsRef.current,
    };

    // rest_prompt 不持久化：结束学习即清空快照（记录已进入保存流程）
    clearSession();
    // phase 切换
    setPhase('rest_prompt');
    return result;
  }, [phase, stopTicker, clearSession]);

  // 开始休息
  const startRest = useCallback(() => {
    setNotes('');
    setTags([]);
    setPages(null);
    setElapsed(0);
    setPhase('resting');
    segmentStartRef.current = Date.now();
    startTicker();
    persist({ phase: 'resting', notes: '', tags: [], pages: null });
  }, [startTicker, persist]);

  // 结束休息
  const endRest = useCallback(() => {
    stopTicker();
    let duration = 0;
    if (segmentStartRef.current) {
      duration = Math.max(0, Date.now() - segmentStartRef.current);
      segmentStartRef.current = null;
    }
    if (duration <= 0) {
      clearSession();
      setPhase('idle');
      return null;
    }
    setSelectedSubject(null);
    setNotes('');
    setTags([]);
    setPages(null);
    clearSession();
    setPhase('idle');
    return duration;
  }, [stopTicker, clearSession]);

  // 不休息，直接返回 idle
  const skipRest = useCallback(() => {
    setSelectedSubject(null);
    setNotes('');
    setTags([]);
    setPages(null);
    clearSession();
    setPhase('idle');
  }, [clearSession]);

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

  // 忽略离开时间 — 当前段起点前移离开时长，缺口不计入（恢复到关页面前的瞬间状态）
  const ignoreAwayTime = useCallback(() => {
    if (awayIgnoredRef.current || !restoreInfoRef.current) return;
    const shift = restoreInfoRef.current.awayMs;
    if (segmentStartRef.current != null) segmentStartRef.current += shift;
    awayShiftRef.current = shift;
    awayIgnoredRef.current = true;
    setAwayIgnored(true);
    tick(); // 立即重算显示（段起点已前移，不等下一次 tick）
    persist();
  }, [persist, tick]);

  // 计入离开时间 — 撤销位移，离开缺口重新计入
  const countAwayTime = useCallback(() => {
    if (!awayIgnoredRef.current) return;
    if (segmentStartRef.current != null) segmentStartRef.current -= awayShiftRef.current;
    awayShiftRef.current = 0;
    awayIgnoredRef.current = false;
    setAwayIgnored(false);
    tick(); // 立即重算显示（缺口重新计入）
    persist();
  }, [persist, tick]);

  // 放弃本次学习 — 清快照回 idle
  const discardRestore = useCallback(() => {
    clearSession();
    stopTicker();
    segmentStartRef.current = null;
    accumulatedStudyRef.current = 0;
    accumulatedPauseRef.current = 0;
    segmentsRef.current = [];
    setSelectedSubject(null);
    setNotes('');
    setTags([]);
    setPages(null);
    setElapsed(0);
    setPausedElapsed(0);
    setPhase('idle');
  }, [clearSession, stopTicker]);

  // 关闭恢复提示条 — 仅隐藏，快照保留、计时继续（下次刷新/崩溃仍可恢复）
  const dismissRestore = useCallback(() => {
    setRestored(false);
  }, []);

  // 选择科目
  const selectSubject = useCallback((subject) => {
    setSelectedSubject(subject);
    persist({ subject });
  }, [persist]);

  // 更新备注
  const updateNotes = useCallback((text) => {
    setNotes(text);
    persist({ notes: text });
  }, [persist]);

  // 切换标签选中状态（学习中点选/取消）
  const toggleTag = useCallback((name) => {
    const next = tags.includes(name) ? tags.filter(t => t !== name) : [...tags, name];
    setTags(next);
    persist({ tags: next });
  }, [tags, persist]);

  // 从当前选中中移除标签（标签被删除后清理）
  const removeTag = useCallback((name) => {
    const next = tags.filter(t => t !== name);
    setTags(next);
    persist({ tags: next });
  }, [tags, persist]);

  // 直接设置页数（输入框；null = 清空）
  const updatePages = useCallback((value) => {
    setPages(value);
    persist({ pages: value });
  }, [persist]);

  // 快捷累加页数（+1/+5/+10 芯片；上限 9999 与服务端一致）
  const addPages = useCallback((n) => {
    const next = Math.min(9999, (pages ?? 0) + n);
    setPages(next);
    persist({ pages: next });
  }, [pages, persist]);

  return {
    phase,
    elapsed,
    pausedElapsed,
    selectedSubject,
    notes,
    tags,
    pages,
    frozen,
    restored,
    restoreInfo,
    awayIgnored,
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
    ignoreAwayTime,
    countAwayTime,
    discardRestore,
    dismissRestore,
  };
}

/**
 * 由快照计算恢复提示条展示信息（水合时计算一次，静态展示）
 * @param {Object|null} snapshot
 * @returns {{ phase: string, subjectName: string|null, elapsedAtClose: number, awayMs: number }|null}
 */
function buildRestoreInfo(snapshot) {
  if (!snapshot) return null;
  const awayMs = Math.max(0, Date.now() - snapshot.updatedAt);
  const elapsedAtClose = snapshot.phase === 'paused'
    ? snapshot.accumulatedStudy
    : snapshot.accumulatedStudy + Math.max(0, snapshot.updatedAt - snapshot.segmentStart);
  return {
    phase: snapshot.phase,
    subjectName: snapshot.subject?.name ?? null,
    elapsedAtClose,
    awayMs,
  };
}