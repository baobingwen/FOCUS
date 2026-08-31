// code/client/src/utils/pendingRecord.js
/**
 * 待重试记录存取（学习记录保存失败后的重试数据专用）
 *
 * 学习记录 `recordsApi.create` 失败时，把完整提交 payload 写入 localStorage，
 * 供「重试保存 / 放弃记录」与刷新/误关页面后的恢复弹窗使用（数据不随页面丢失）。
 *
 * 待重试记录是 UI 运行状态而非业务数据：不进五张业务表/五仓库、不参与导出/导入。
 * 仅学习记录（mode === 'study'）纳入；休息记录保存失败不产生待重试记录。
 */

const STORAGE_KEY = 'focus:pending-record';
const PENDING_VERSION = 1;

/**
 * 校验待重试记录结构是否合法（任一字段类型不符即视为非法，忽略该记录）
 * @param {unknown} r - 解析后的记录对象
 * @returns {boolean}
 */
function isValidPendingRecord(r) {
  if (!r || typeof r !== 'object') return false;
  if (r.version !== PENDING_VERSION) return false;
  if (r.mode !== 'study') return false;
  if (typeof r.subject !== 'string' || r.subject.trim() === '') return false;
  if (typeof r.duration_ms !== 'number' || !Number.isFinite(r.duration_ms) || r.duration_ms <= 0) return false;
  if (typeof r.paused_ms !== 'number' || !Number.isFinite(r.paused_ms) || r.paused_ms < 0) return false;
  if (!Array.isArray(r.segments)) return false;
  if (!r.segments.every(seg => seg && typeof seg === 'object' && (seg.type === 'study' || seg.type === 'pause') && typeof seg.duration_ms === 'number')) return false;
  if (typeof r.notes !== 'string') return false;
  if (!Array.isArray(r.tags) || !r.tags.every(t => typeof t === 'string')) return false;
  if (r.pages !== null && (typeof r.pages !== 'number' || !Number.isInteger(r.pages) || r.pages < 1 || r.pages > 9999)) return false;
  return true;
}

/**
 * 保存待重试记录（覆盖写入）。存储不可用/配额满时静默忽略，不影响重试流程（内存态仍保留）。
 * @param {Object} record - 提交给 recordsApi.create 的完整 payload（mode/subject/duration_ms/paused_ms/segments/notes/tags/pages）
 * @returns {void}
 */
export function savePendingRecord(record) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: PENDING_VERSION, ...record }));
  } catch {
    // 存储不可用（隐私模式/配额满）时放弃持久化，重试流程照常（仅刷新后不恢复）
  }
}

/**
 * 读取并校验待重试记录。无记录 / JSON 损坏 / 结构非法 → 返回 null。
 * @returns {Object|null}
 */
export function loadPendingRecord() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidPendingRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 清空待重试记录（重试成功 / 放弃记录时调用）。
 * @returns {void}
 */
export function clearPendingRecord() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略存储异常
  }
}
