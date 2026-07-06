import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 极简计时器 hook
 *
 * 状态机：idle → studying → rest_prompt → resting → idle
 *   idle: 等待用户选择科目后开始
 *   studying: 学习计时中
 *   rest_prompt: 学习结束，询问是否休息
 *   resting: 休息计时中
 *
 * 时间轴使用 Date.now() 绝对时间戳，不依赖累加器，
 * 即使浏览器锁屏/休眠恢复后也能精确咬合真实时间。
 */
export default function useTimer() {
  const [phase, setPhase] = useState('idle'); // idle | studying | rest_prompt | resting
  const [elapsed, setElapsed] = useState(0);   // 当前计时段的已用毫秒数
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [notes, setNotes] = useState('');

  const startRef = useRef(null);   // 当前计时段的起始时间戳
  const intervalRef = useRef(null);
  const tickRef = useRef(null);   // 持有一个稳定的 tick 引用

  // 清理定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // tick 使用 ref 持有，避免闭包陈旧
  useEffect(() => {
    tickRef.current = () => {
      if (!startRef.current) return;
      const now = Date.now();
      const diff = Math.max(0, now - startRef.current);
      setElapsed(diff);
    };
  }, []);

  const startTimer = useCallback(() => {
    const now = Date.now();
    startRef.current = now;
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      tickRef.current();
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // 计算最终时长
    if (startRef.current) {
      const finalElapsed = Math.max(0, Date.now() - startRef.current);
      startRef.current = null;
      setElapsed(finalElapsed);
      return finalElapsed;
    }
    return 0;
  }, []);

  // 开始学习
  const startStudy = useCallback(() => {
    setPhase('studying');
    startTimer();
  }, [startTimer]);

  // 结束学习
  const endStudy = useCallback(() => {
    const duration = stopTimer();
    if (duration <= 0) {
      // 没计时就结束了，回到 idle
      setPhase('idle');
      return null;
    }
    setPhase('rest_prompt');
    return duration;
  }, [stopTimer]);

  // 开始休息
  const startRest = useCallback(() => {
    setNotes('');
    setPhase('resting');
    startTimer();
  }, [startTimer]);

  // 结束休息
  const endRest = useCallback(() => {
    const duration = stopTimer();
    if (duration <= 0) {
      setPhase('idle');
      return null;
    }
    setSelectedSubject(null);
    setNotes('');
    setPhase('idle');
    return duration;
  }, [stopTimer]);

  // 不休息，直接返回 idle
  const skipRest = useCallback(() => {
    setSelectedSubject(null);
    setNotes('');
    setPhase('idle');
  }, []);

  // 选择科目
  const selectSubject = useCallback((subject) => {
    setSelectedSubject(subject);
  }, []);

  // 更新备注
  const updateNotes = useCallback((text) => {
    setNotes(text);
  }, []);

  return {
    phase,
    elapsed,
    selectedSubject,
    notes,
    selectSubject,
    updateNotes,
    startStudy,
    endStudy,
    startRest,
    endRest,
    skipRest,
  };
}
