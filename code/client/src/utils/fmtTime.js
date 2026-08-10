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

/**
 * 将 ms 格式化为时钟显示（HH:MM:SS或MM:SS格式）
 * @param {number} ms
 * @returns {string} 格式化后的时间字符串
 */
export function fmtClock(ms) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 将 ms 格式化为短时间显示（MM:SS格式）
 * @param {number} ms
 * @returns {string} 格式化后的时间（如 "05:30"）
 */
export function fmtShortClock(ms) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
