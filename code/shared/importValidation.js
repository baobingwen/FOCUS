// code/shared/importValidation.js
// 双版本共用导入校验模块（纯函数，零运行时依赖）
// 客户端（code/client）经 Vite resolve.alias（@shared）引用；服务端（code/server）相对路径引用
// 规则与设计见 docs/adr/0013-import-validation-unified.md

/** 导入覆盖的五张业务表（与导出一致，不含 _migrations） */
export const IMPORT_TABLES = ['records', 'subjects', 'tags', 'record_tags', 'reminder_items'];

/**
 * 顶层校验导入文件结构
 * @param {unknown} body - 完整导出 JSON
 * @returns {string | null} 错误信息；null 表示通过
 */
export function validatePayload(body) {
  if (!body || typeof body !== 'object') return '导入数据格式不正确';
  if (body.app !== 'FOCUS') return '不是 FOCUS 导出的数据文件';
  const data = /** @type {Record<string, unknown>} */ (body).data;
  if (!data || typeof data !== 'object') return '导入数据缺少 data 字段';
  for (const table of IMPORT_TABLES) {
    if (!Array.isArray(/** @type {Record<string, unknown>} */ (data)[table])) {
      return `导入数据缺少表: ${table}`;
    }
  }
  return null;
}

/**
 * 行级校验（事务外先行执行，任何一行不合法 → 整体拒绝）
 * 规则与两端底层约束等价，保证「校验放行必然落库成功」：
 * id 正整数 / mode 枚举 / duration_ms > 0 / 名称非空 / 引用存在 / 重复拒绝
 * @param {object} data - 五表数据（validatePayload 已通过）
 * @returns {void}
 * @throws {Error} 任一行不合法时抛出「导入数据不合法: …」
 */
export function validateImportRows(data) {
  // subjects：id 正整数、name 非空、name 不重复（对齐 SQLite UNIQUE，纯静态版无唯一索引靠此拦截）
  const subjectNames = new Set();
  for (const row of data.subjects) {
    if (!Number.isInteger(row.id) || row.id <= 0) throw new Error('导入数据不合法: subjects 行缺少有效 id');
    if (typeof row.name !== 'string' || !row.name.trim()) throw new Error('导入数据不合法: subjects 行 name 缺失');
    if (subjectNames.has(row.name)) throw new Error('导入数据不合法: subjects 行 name 重复');
    subjectNames.add(row.name);
  }
  // tags：id 正整数、name 非空、name 不重复（对齐 SQLite UNIQUE / IndexedDB 唯一索引，前置拦截统一错误消息）
  const tagNames = new Set();
  for (const row of data.tags) {
    if (!Number.isInteger(row.id) || row.id <= 0) throw new Error('导入数据不合法: tags 行缺少有效 id');
    if (typeof row.name !== 'string' || !row.name.trim()) throw new Error('导入数据不合法: tags 行 name 缺失');
    if (tagNames.has(row.name)) throw new Error('导入数据不合法: tags 行 name 重复');
    tagNames.add(row.name);
  }
  // records：id 正整数、mode 枚举、duration_ms > 0（对齐 SQLite CHECK 与本地版既有规则）
  for (const row of data.records) {
    if (!Number.isInteger(row.id) || row.id <= 0) throw new Error('导入数据不合法: records 行缺少有效 id');
    if (!['study', 'rest'].includes(row.mode)) throw new Error('导入数据不合法: records 行 mode 无效');
    if (typeof row.duration_ms !== 'number' || row.duration_ms <= 0) {
      throw new Error('导入数据不合法: records 行 duration_ms 无效');
    }
  }
  // record_tags：正整数、引用必须存在、不重复（对齐复合主键，纯静态版无唯一约束靠此拦截）
  const tagIds = new Set(data.tags.map((t) => t.id));
  const recordIds = new Set(data.records.map((r) => r.id));
  const seenPairs = new Set();
  for (const row of data.record_tags) {
    if (!Number.isInteger(row.record_id) || row.record_id <= 0
      || !Number.isInteger(row.tag_id) || row.tag_id <= 0) {
      throw new Error('导入数据不合法: record_tags 行引用无效');
    }
    if (!recordIds.has(row.record_id) || !tagIds.has(row.tag_id)) {
      throw new Error('导入数据不合法: record_tags 引用的记录或标签不存在');
    }
    const pair = `${row.record_id}:${row.tag_id}`;
    if (seenPairs.has(pair)) throw new Error('导入数据不合法: record_tags 行重复');
    seenPairs.add(pair);
  }
  // reminder_items：id 正整数、content 非空
  for (const row of data.reminder_items) {
    if (!Number.isInteger(row.id) || row.id <= 0) throw new Error('导入数据不合法: reminder_items 行缺少有效 id');
    if (typeof row.content !== 'string' || !row.content.trim()) throw new Error('导入数据不合法: reminder_items 行 content 缺失');
  }
}

/**
 * 整数归一化：非整数（含 null/undefined）→ fallback（默认值归一化双端一致用）
 * @param {unknown} v - 原始值
 * @param {number | null} fallback - 兜底值
 * @returns {number | null}
 */
export function intOr(v, fallback) {
  return Number.isInteger(v) ? /** @type {number} */ (v) : fallback;
}

/**
 * 字符串归一化：非字符串（含 null/undefined）→ fallback
 * @param {unknown} v - 原始值
 * @param {string | null} fallback - 兜底值
 * @returns {string | null}
 */
export function strOr(v, fallback) {
  return typeof v === 'string' ? v : fallback;
}
