// code/client/src/hooks/useMultiTap.js
import { useRef, useCallback } from 'react';

/**
 * 连点检测 hook：count 次点击（间隔 ≤ windowMs，超时重置）后触发 onComplete
 * 用于管理模式隐藏入口：连点 5 下标题进入，正常使用无感知
 *
 * @param {Function} onComplete - 连点达标后的回调
 * @param {Object} [options] - 配置
 * @param {number} [options.count=5] - 需要的点击次数
 * @param {number} [options.windowMs=2000] - 两次点击的最大间隔，超时重置计数
 * @returns {Function} 点击处理器（每次点击调用一次）
 */
export default function useMultiTap(onComplete, { count = 5, windowMs = 2000 } = {}) {
  // 计数器（{ count, last }，不触发重渲染）
  const tap = useRef({ count: 0, last: 0 });

  return useCallback(() => {
    const now = Date.now();
    const t = tap.current;
    if (now - t.last > windowMs) t.count = 0; // 间隔超时重置
    t.count += 1;
    t.last = now;
    if (t.count >= count) {
      t.count = 0;
      onComplete();
    }
  }, [onComplete, count, windowMs]);
}
