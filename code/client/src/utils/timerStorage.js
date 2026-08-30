// code/client/src/utils/timerStorage.js
/**
 * 计时快照存取（计时状态持久化专用）
 *
 * 把进行中的学习/休息计时（studying / paused / resting 三态）的关键状态
 * 写入 localStorage，供页面刷新、误关标签页、浏览器崩溃后自动恢复。
 *
 * 快照是 UI 运行状态而非业务数据：不进五张业务表/五仓库、不参与导出/导入。
 * elapsed 不落盘——恢复后由 `accumulated + (now − segmentStart)` 绝对时间戳推导。
 */

const STORAGE_KEY = 'focus:timer:snapshot';
const SNAPSHOT_VERSION = 1;
const ACTIVE_PHASES = ['studying', 'paused', 'resting'];

/**
 * 校验快照结构是否合法（任一字段类型不符即视为非法，忽略该快照）
 * @param {unknown} s - 解析后的快照对象
 * @returns {boolean}
 */
function isValidSnapshot(s) {
  if (!s || typeof s !== 'object') return false;
  if (s.version !== SNAPSHOT_VERSION) return false;
  if (!ACTIVE_PHASES.includes(s.phase)) return false;
  if (typeof s.segmentStart !== 'number' || !Number.isFinite(s.segmentStart)) return false;
  if (typeof s.accumulatedStudy !== 'number' || !Number.isFinite(s.accumulatedStudy)) return false;
  if (typeof s.accumulatedPause !== 'number' || !Number.isFinite(s.accumulatedPause)) return false;
  if (!Array.isArray(s.segments)) return false;
  if (!s.segments.every(seg => seg && typeof seg === 'object' && (seg.type === 'study' || seg.type === 'pause') && typeof seg.duration_ms === 'number')) return false;
  if (typeof s.notes !== 'string') return false;
  if (!Array.isArray(s.tags) || !s.tags.every(t => typeof t === 'string')) return false;
  if (s.pages !== null && (typeof s.pages !== 'number' || !Number.isInteger(s.pages) || s.pages < 1 || s.pages > 9999)) return false;
  if (s.subject !== null && (!s.subject || typeof s.subject !== 'object' || typeof s.subject.name !== 'string')) return false;
  if (typeof s.updatedAt !== 'number' || !Number.isFinite(s.updatedAt)) return false;
  return true;
}

/**
 * 保存快照（覆盖写入）。存储不可用/配额满时静默忽略，不影响计时功能。
 * @param {Object} data - 快照业务字段（phase/segmentStart/accumulatedStudy/accumulatedPause/segments/subject/notes/tags/pages/updatedAt）
 * @returns {void}
 */
export function saveTimerSnapshot(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SNAPSHOT_VERSION, ...data }));
  } catch {
    // 存储不可用（隐私模式/配额满）时放弃持久化，计时器照常运行
  }
}

/**
 * 读取并校验快照。无快照 / JSON 损坏 / 结构非法 → 返回 null（调用方按无快照处理回 idle）。
 * @returns {Object|null}
 */
export function loadTimerSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 清空快照（会话正常结束 / 放弃恢复时调用）。
 * @returns {void}
 */
export function clearTimerSnapshot() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略存储异常
  }
}
