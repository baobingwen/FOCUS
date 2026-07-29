import { useEffect, useRef } from 'react';

/**
 * 离开页面自动冻结 hook
 *
 * 监听浏览器 visibilitychange / blur / focus 事件，
 * 在页面隐藏时调用 timer.freeze()，页面显示时调用 timer.thaw()。
 *
 * 仅在 studying 阶段生效，冻结不产生 paused_ms / pause segment / 今日休息额度。
 * 通过 ref 追踪最新 timer 状态，避免闭包过期。
 *
 * @param {Object} timer - useTimer() 返回的 timer 对象
 */
export default function useFreezeOnLeave(timer) {
  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => {
    const handleVisibility = () => {
      const { phase, frozen, freeze, thaw } = timerRef.current;
      if (document.hidden && phase === 'studying' && !frozen) {
        freeze();
      } else if (!document.hidden && frozen) {
        thaw();
      }
    };

    const handleBlur = () => {
      const { phase, frozen, freeze } = timerRef.current;
      if (phase === 'studying' && !frozen) {
        freeze();
      }
    };

    const handleFocus = () => {
      const { frozen, thaw } = timerRef.current;
      if (frozen) {
        thaw();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
}
