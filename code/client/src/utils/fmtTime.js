// code/client/src/utils/fmtTime.js
/**
 * 将 ms 格式化为中文时长显示
 * @param {number} ms
 * @returns {string} 格式化后的时长（如 "1小时30分" 或 "45分"）
 */
export function fmtTime(ms) {
  if (!ms || ms <= 0) return '0分';
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分`;
}