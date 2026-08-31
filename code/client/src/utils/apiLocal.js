// code/client/src/utils/apiLocal.js
// IndexedDB 数据层实现（纯静态版）
// 与 apiRest.js 保持完全一致的接口签名、返回形态与错误语义（组件零改动）
import { validatePayload, validateImportRows, intOr, strOr } from '@shared/importValidation';

const DB_NAME = 'focus-db';
const DB_VERSION = 1;
const STORES = ['records', 'subjects', 'tags', 'record_tags', 'reminder_items'];
const TAG_NAME_MAX_LENGTH = 12;
const REMINDER_MAX_LENGTH = 200;
const DEFAULT_SUBJECTS = [
  { name: '数学', sort_order: 0 },
  { name: '英语', sort_order: 1 },
  { name: '专业课', sort_order: 2 },
];

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null;

// ============================================================
// IndexedDB 底层封装
// ============================================================

/**
 * 打开数据库（首次建库：五仓库 + tags.name 唯一索引 + 默认科目种子）
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      /** @type {IDBOpenDBRequest} */
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        if (!db.objectStoreNames.contains('records')) {
          db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('tags')) {
          const store = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: true });
        }
        if (!db.objectStoreNames.contains('record_tags')) {
          const store = db.createObjectStore('record_tags', { keyPath: 'id', autoIncrement: true });
          store.createIndex('record_id', 'record_id', { unique: false });
          store.createIndex('tag_id', 'tag_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('reminder_items')) {
          db.createObjectStore('reminder_items', { keyPath: 'id', autoIncrement: true });
        }
        // 首次建库（oldVersion === 0）写入默认科目
        if (event.oldVersion === 0) {
          const subjects = req.transaction.objectStore('subjects');
          for (const s of DEFAULT_SUBJECTS) subjects.add(s);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

/**
 * 仅供测试使用：关闭数据库连接并清空缓存（配合 deleteDatabase 重置）
 * @returns {void}
 */
export function __closeLocalDb() {
  const p = dbPromise;
  dbPromise = null;
  if (p) {
    p.then((db) => { try { db.close(); } catch { /* 忽略 */ } }).catch(() => {});
  }
}

/**
 * 读取仓库全部记录（结构化克隆，修改返回值不影响存储）
 * @param {string} storeName - 仓库名
 * @returns {Promise<Array<Record<string, any>>>}
 */
function getAll(storeName) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

/**
 * 读取单条记录
 * @param {string} storeName - 仓库名
 * @param {number} id - 主键
 * @returns {Promise<Record<string, any> | undefined>}
 */
function getOne(storeName, id) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

/**
 * 新增一条记录（自增 id），返回新主键
 * @param {string} storeName - 仓库名
 * @param {Record<string, any>} value - 记录
 * @returns {Promise<number>}
 */
function addOne(storeName, value) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).add(value);
    let key;
    req.onsuccess = () => { key = req.result; };
    tx.oncomplete = () => resolve(key);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('事务已中止'));
  }));
}

/**
 * 覆盖写入一条记录（保留 id）
 * @param {string} storeName - 仓库名
 * @param {Record<string, any>} value - 记录（含 id）
 * @returns {Promise<void>}
 */
function putOne(storeName, value) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('事务已中止'));
  }));
}

/**
 * 按主键删除一条记录
 * @param {string} storeName - 仓库名
 * @param {number} id - 主键
 * @returns {Promise<void>}
 */
function deleteOne(storeName, id) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('事务已中止'));
  }));
}

/**
 * 按索引值删除全部匹配记录（用于级联清理 record_tags）
 * @param {string} storeName - 仓库名
 * @param {string} indexName - 索引名
 * @param {number} value - 索引值
 * @returns {Promise<void>}
 */
function deleteByIndex(storeName, indexName, value) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.index(indexName).openKeyCursor(IDBKeyRange.only(value));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('事务已中止'));
  }));
}

// ============================================================
// 通用辅助
// ============================================================

/**
 * 格式化本地时间为 'YYYY-MM-DD HH:MM:SS'（与后端 SQLite DATETIME 存储格式一致）
 * @param {Date} date - 时间
 * @returns {string}
 */
function formatLocalDateTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/**
 * 文件时间戳 'YYYYMMDD-HHMMSS'（与后端导出文件名一致）
 * @param {Date} date - 时间
 * @returns {string}
 */
function stamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

/**
 * 校验并解析标签名数组（与后端 parseTagNames 一致）
 * @param {unknown} value - 原始 tags 输入
 * @returns {{ ok: true, names: string[] | null } | { ok: false, error: string }}
 */
function parseTagNames(value) {
  if (value === undefined || value === null) return { ok: true, names: null };
  if (!Array.isArray(value)) return { ok: false, error: '无效的 tags，必须为字符串数组' };

  const seen = new Set();
  /** @type {string[]} */
  const names = [];
  for (const item of value) {
    if (typeof item !== 'string') return { ok: false, error: '无效的 tags，必须为字符串数组' };
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > TAG_NAME_MAX_LENGTH) {
      return { ok: false, error: `标签名不能超过 ${TAG_NAME_MAX_LENGTH} 字` };
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    names.push(trimmed);
  }
  return { ok: true, names };
}

/**
 * 按名字查标签（无则幂等创建，排末尾），与后端 findOrCreateTag 一致
 * @param {string} name - 已 trim 的标签名
 * @returns {Promise<{ id: number, name: string, sort_order: number }>}
 */
async function findOrCreateTag(name) {
  const all = await getAll('tags');
  const existing = all.find((t) => t.name === name);
  if (existing) return existing;
  const maxOrder = Math.max(-1, ...all.map((t) => t.sort_order));
  const id = await addOne('tags', { name, sort_order: maxOrder + 1 });
  return { id, name, sort_order: maxOrder + 1 };
}

/**
 * 读取一条记录的标签名数组（按关联插入顺序）
 * @param {number} recordId - 记录 id
 * @returns {Promise<string[]>}
 */
async function getRecordTags(recordId) {
  const db = await openDb();
  const rels = await new Promise((resolve, reject) => {
    const tx = db.transaction('record_tags', 'readonly');
    const req = tx.objectStore('record_tags').index('record_id').getAll(recordId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (rels.length === 0) return [];
  const tags = await getAll('tags');
  const byId = new Map(tags.map((t) => [t.id, t.name]));
  return rels.map((r) => byId.get(r.tag_id)).filter((n) => n !== undefined);
}

/**
 * 整组替换一条记录的标签关联（先清空再插入；标签不存在则幂等创建）
 * @param {number} recordId - 记录 id
 * @param {string[]} tagNames - 已校验的标签名数组（空数组 = 清空全部标签）
 * @returns {Promise<void>}
 */
async function replaceRecordTags(recordId, tagNames) {
  await deleteByIndex('record_tags', 'record_id', recordId);
  for (const name of tagNames) {
    const tag = await findOrCreateTag(name);
    await addOne('record_tags', { record_id: recordId, tag_id: tag.id });
  }
}

/**
 * 计算下一个排序值（新条目排末尾）
 * @param {string} storeName - 仓库名
 * @returns {Promise<number>}
 */
async function nextSortOrder(storeName) {
  const all = await getAll(storeName);
  return Math.max(-1, ...all.map((r) => r.sort_order)) + 1;
}

// ============================================================
// recordsApi
// ============================================================

export const recordsApi = {
  /**
   * 保存一条记录（可带 tags、pages），返回完整记录（含 tags 名称数组、segments 数组）
   * @param {object} data - 记录数据
   * @returns {Promise<object>}
   */
  create: async (data) => {
    const mode = data.mode;
    if (!mode || !['study', 'rest'].includes(mode)) {
      throw new Error('无效的 mode，必须为 study 或 rest');
    }
    if (typeof data.duration_ms !== 'number' || data.duration_ms <= 0) {
      throw new Error('无效的 duration_ms');
    }
    if (mode === 'study' && !data.subject) {
      throw new Error('学习模式需要指定 subject');
    }

    const parsed = parseTagNames(data.tags);
    if (!parsed.ok) throw new Error(parsed.error);
    const tags = mode === 'study' ? (parsed.names ?? []) : [];

    const pages = data.pages;
    if (mode === 'study' && pages !== undefined && pages !== null
      && (!Number.isInteger(pages) || pages < 1 || pages > 9999)) {
      throw new Error('无效的 pages，必须为 1~9999 的整数');
    }
    const recordPages = (mode === 'study' && Number.isInteger(pages) && pages > 0) ? pages : null;

    const record = {
      mode,
      subject: mode === 'study' ? data.subject : null,
      duration_ms: data.duration_ms,
      notes: data.notes || '',
      segments: Array.isArray(data.segments) ? data.segments : null,
      paused_ms: (mode === 'study' && typeof data.paused_ms === 'number' && data.paused_ms > 0) ? data.paused_ms : 0,
      pages: recordPages,
      created_at: formatLocalDateTime(new Date()),
    };

    const recordId = await addOne('records', record);
    if (tags.length > 0) {
      await replaceRecordTags(recordId, tags);
    }
    const row = await getOne('records', recordId);
    row.tags = await getRecordTags(recordId);
    return row;
  },

  /**
   * 修改学习记录的备注、标签和页数（整组替换，仅学习记录）
   * @param {number} id - 记录 id
   * @param {object} data - 修改内容
   * @returns {Promise<object>}
   */
  update: async (id, data) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error('记录不存在');
    const row = await getOne('records', id);
    if (!row) throw new Error('记录不存在');
    if (row.mode !== 'study') throw new Error('仅学习记录可修改备注或标签');

    if (data.notes !== undefined) {
      if (typeof data.notes !== 'string') throw new Error('无效的 notes，必须为字符串');
      row.notes = data.notes.trim();
    }
    if (data.tags !== undefined) {
      const parsed = parseTagNames(data.tags);
      if (!parsed.ok) throw new Error(parsed.error);
      if (parsed.names !== null) {
        await replaceRecordTags(id, parsed.names);
      }
    }
    if (data.pages !== undefined) {
      if (data.pages !== null && (!Number.isInteger(data.pages) || data.pages < 1 || data.pages > 9999)) {
        throw new Error('无效的 pages，必须为 1~9999 的整数');
      }
      row.pages = data.pages;
    }

    await putOne('records', row);
    const updated = await getOne('records', id);
    updated.tags = await getRecordTags(id);
    return updated;
  },

  /**
   * 删除单条记录（学习/休息均可，硬删除；级联清 record_tags，标签库保留）
   * @param {number} id - 记录 id
   * @returns {Promise<{ success: boolean }>}
   */
  remove: async (id) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error('记录不存在');
    const row = await getOne('records', id);
    if (!row) throw new Error('记录不存在');
    await deleteOne('records', id);
    await deleteByIndex('record_tags', 'record_id', id);
    return { success: true };
  },

  /**
   * 获取记录（带 date 按日期查询并按 created_at 倒序；不带 date 取最近 200 条）
   * @param {string} [date] - 日期 YYYY-MM-DD
   * @returns {Promise<{ records: object[] }>}
   */
  list: async (date) => {
    const rows = await getAll('records');
    let filtered = rows;
    if (date) {
      const d = String(date).slice(0, 10);
      filtered = rows.filter((r) => String(r.created_at).slice(0, 10) === d);
    }
    filtered.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (!date) filtered = filtered.slice(0, 200);

    const records = [];
    for (const r of filtered) {
      const row = { ...r };
      row.tags = await getRecordTags(r.id);
      records.push(row);
    }
    return { records };
  },

  /**
   * 获取今日概览（总学习/休息时长、总页数、按科目分组，与后端 /today 形态一致）
   * @returns {Promise<object>}
   */
  todayOverview: async () => {
    const rows = await getAll('records');
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    const todayRows = rows.filter((r) => String(r.created_at).slice(0, 10) === today);

    let totalStudyMs = 0;
    let totalPages = 0;
    let totalRestMs = 0;
    /** @type {Map<string, { subject: string | null, total_ms: number, count: number, total_pages: number }>} */
    const bySubjectMap = new Map();

    for (const r of todayRows) {
      if (r.mode === 'study') {
        totalStudyMs += r.duration_ms;
        totalPages += (r.pages || 0);
        const key = String(r.subject);
        const entry = bySubjectMap.get(key) || { subject: r.subject, total_ms: 0, count: 0, total_pages: 0 };
        entry.total_ms += r.duration_ms;
        entry.count += 1;
        entry.total_pages += (r.pages || 0);
        bySubjectMap.set(key, entry);
      }
      if (r.mode === 'rest') totalRestMs += r.duration_ms;
      totalRestMs += (Number.isInteger(r.paused_ms) ? r.paused_ms : 0);
    }

    const bySubject = [...bySubjectMap.values()].sort((a, b) => b.total_ms - a.total_ms);
    return {
      date: today,
      total_study_ms: totalStudyMs,
      total_rest_ms: totalRestMs,
      total_records: todayRows.length,
      total_pages: totalPages,
      by_subject: bySubject,
    };
  },
};

// ============================================================
// subjectsApi
// ============================================================

export const subjectsApi = {
  /** 获取所有科目（按 sort_order, id） */
  list: async () => {
    const rows = await getAll('subjects');
    return rows.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  },

  /** 创建新科目（重名抛错，排末尾） */
  create: async (name) => {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new Error('科目名不能为空');
    const all = await getAll('subjects');
    if (all.some((s) => s.name === trimmed)) throw new Error('科目已存在');
    const sortOrder = Math.max(-1, ...all.map((s) => s.sort_order)) + 1;
    const id = await addOne('subjects', { name: trimmed, sort_order: sortOrder });
    return { id, name: trimmed, sort_order: sortOrder };
  },

  /** 删除科目（默认科目不可删） */
  delete: async (id) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error('科目不存在');
    const row = await getOne('subjects', id);
    if (!row) throw new Error('科目不存在');
    if (['数学', '英语', '专业课'].includes(row.name)) throw new Error('不能删除默认科目');
    await deleteOne('subjects', id);
    return { success: true };
  },
};

// ============================================================
// tagsApi
// ============================================================

export const tagsApi = {
  /** 获取所有标签（按 sort_order, id） */
  list: async () => {
    const rows = await getAll('tags');
    return rows.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  },

  /** 创建标签（重名幂等复用已有，≤12 字，排末尾） */
  create: async (name) => {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new Error('标签名不能为空');
    if (trimmed.length > TAG_NAME_MAX_LENGTH) {
      throw new Error(`标签名不能超过 ${TAG_NAME_MAX_LENGTH} 字`);
    }
    const existing = await findOrCreateTag(trimmed);
    return existing;
  },

  /** 删除标签（级联清所有记录的关联） */
  delete: async (id) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error('标签不存在');
    const tag = await getOne('tags', id);
    if (!tag) throw new Error('标签不存在');
    await deleteOne('tags', id);
    await deleteByIndex('record_tags', 'tag_id', id);
    return { success: true };
  },

  /** 批量重排标签顺序（全量提交，必须包含全部标签 id） */
  reorder: async (ids) => {
    if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id) && id > 0)) {
      throw new Error('无效的 ids，必须为正整数数组');
    }
    if (new Set(ids).size !== ids.length) throw new Error('ids 不能包含重复');

    const all = await getAll('tags');
    const allIds = all.map((t) => t.id);
    const isFullSet = ids.length === allIds.length && ids.every((id) => allIds.includes(id));
    if (!isFullSet) throw new Error('ids 必须包含全部标签（全量重排）');

    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('tags', 'readwrite');
      const store = tx.objectStore('tags');
      ids.forEach((id, index) => {
        const req = store.get(id);
        req.onsuccess = () => {
          const tag = req.result;
          if (tag) {
            tag.sort_order = index;
            store.put(tag);
          }
        };
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('事务已中止'));
    });
    return { success: true };
  },
};

// ============================================================
// remindersApi
// ============================================================

export const remindersApi = {
  /** 获取全部复习提醒（按 sort_order, id） */
  list: async () => {
    const rows = await getAll('reminder_items');
    return rows.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  },

  /** 新增一条复习提醒（≤200 字，排末尾） */
  create: async (content) => {
    const trimmed = String(content ?? '').trim();
    if (!trimmed) throw new Error('提醒内容不能为空');
    if (trimmed.length > REMINDER_MAX_LENGTH) {
      throw new Error(`提醒内容不能超过 ${REMINDER_MAX_LENGTH} 字`);
    }
    const sortOrder = await nextSortOrder('reminder_items');
    const item = { content: trimmed, sort_order: sortOrder, created_at: formatLocalDateTime(new Date()) };
    const id = await addOne('reminder_items', item);
    return { id, ...item };
  },

  /** 修改一条复习提醒的内容 */
  update: async (id, content) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error('复习提醒不存在');
    const item = await getOne('reminder_items', id);
    if (!item) throw new Error('复习提醒不存在');
    const trimmed = String(content ?? '').trim();
    if (!trimmed) throw new Error('提醒内容不能为空');
    if (trimmed.length > REMINDER_MAX_LENGTH) {
      throw new Error(`提醒内容不能超过 ${REMINDER_MAX_LENGTH} 字`);
    }
    item.content = trimmed;
    await putOne('reminder_items', item);
    return item;
  },

  /** 删除一条复习提醒 */
  delete: async (id) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error('复习提醒不存在');
    const item = await getOne('reminder_items', id);
    if (!item) throw new Error('复习提醒不存在');
    await deleteOne('reminder_items', id);
    return { success: true };
  },
};

// ============================================================
// exportApi / importApi（纯本地实现，格式与后端完全一致、双版本互通）
// ============================================================

export const exportApi = {
  /**
   * 导出全部数据为 JSON 文件（浏览器端直接生成，不经服务器）
   * @returns {Promise<{ blob: Blob, filename: string }>}
   */
  download: async () => {
    const [records, subjects, tags, recordTags, reminderItems] = await Promise.all([
      getAll('records'),
      getAll('subjects'),
      getAll('tags'),
      getAll('record_tags'),
      getAll('reminder_items'),
    ]);

    const payload = {
      app: 'FOCUS',
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
      exported_at: formatLocalDateTime(new Date()),
      data: {
        records: [...records].sort((a, b) => a.id - b.id),
        subjects: [...subjects].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
        tags: [...tags].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
        // 剥离内部自增 id，与后端 record_tags 行结构（record_id/tag_id）一致
        record_tags: [...recordTags]
          .sort((a, b) => a.record_id - b.record_id || a.tag_id - b.tag_id)
          .map(({ record_id, tag_id }) => ({ record_id, tag_id })),
        reminder_items: [...reminderItems].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json; charset=utf-8' });
    const filename = `focus-export-${stamp(new Date())}.json`;
    return { blob, filename };
  },
};

export const importApi = {
  /**
   * 导入全部数据（全量替换，IndexedDB 事务内清空五仓库后原样插入，任何一行不合法整体回滚）
   * @param {object} payload - 完整导出 JSON（含 app 与 data 五表）
   * @returns {Promise<{ success: boolean, counts: object }>}
   */
  submit: async (payload) => {
    const error = validatePayload(payload);
    if (error) throw new Error(error);

    const data = payload.data;
    validateImportRows(data);

    const db = await openDb();
    const counts = {
      records: data.records.length,
      subjects: data.subjects.length,
      tags: data.tags.length,
      record_tags: data.record_tags.length,
      reminder_items: data.reminder_items.length,
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, 'readwrite');
      // 事务内不再抛业务错误：行已校验，仅约束冲突（重复 id / tags.name 唯一）触发事务回滚
      for (const s of STORES) tx.objectStore(s).clear();

      // 先父后子插入，保证引用关系（与后端顺序一致）
      const insertSubjects = tx.objectStore('subjects');
      for (const row of data.subjects) {
        insertSubjects.add({ id: row.id, name: row.name, sort_order: intOr(row.sort_order, 0) });
      }

      const insertTags = tx.objectStore('tags');
      for (const row of data.tags) {
        insertTags.add({ id: row.id, name: row.name, sort_order: intOr(row.sort_order, 0) });
      }

      const insertRecords = tx.objectStore('records');
      for (const row of data.records) {
        // segments 导出时为数组，原样存储；字符串则解析（防御旧格式）
        let segments = null;
        if (Array.isArray(row.segments)) segments = row.segments;
        else if (typeof row.segments === 'string') {
          try { segments = JSON.parse(row.segments); } catch { segments = null; }
        }
        insertRecords.add({
          id: row.id,
          mode: row.mode,
          subject: row.mode === 'study' ? (row.subject ?? null) : null,
          duration_ms: row.duration_ms,
          notes: strOr(row.notes, ''),
          segments,
          paused_ms: intOr(row.paused_ms, 0),
          pages: intOr(row.pages, null),
          created_at: strOr(row.created_at, null),
        });
      }

      const insertRecordTags = tx.objectStore('record_tags');
      for (const row of data.record_tags) {
        insertRecordTags.add({ record_id: row.record_id, tag_id: row.tag_id });
      }

      const insertReminders = tx.objectStore('reminder_items');
      for (const row of data.reminder_items) {
        insertReminders.add({
          id: row.id,
          content: row.content,
          sort_order: intOr(row.sort_order, 0),
          created_at: strOr(row.created_at, null),
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('导入数据失败'));
    });

    return { success: true, counts };
  },
};
