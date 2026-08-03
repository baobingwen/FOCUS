// code/server/routes/tags.js
import { Router } from 'express';
import { getDb } from '../database.js';

/**
 * @import { Tag } from '../types.js'
 * @import { Request, Response } from 'express'
 */

/** 标签名长度上限（中文按字计） */
export const TAG_NAME_MAX_LENGTH = 12;

/** @type {Router} */
export const tagsRouter = Router();

/**
 * 校验并解析标签名数组（判别联合返回）
 * ok:true 时 names 为已 trim、去空、去重后的字符串数组；tags 未提供时 names 为 null
 * ok:false 时 error 为校验失败原因
 * @param {unknown} value - 原始 tags 输入
 * @returns {{ ok: true, names: string[] | null } | { ok: false, error: string }}
 */
export function parseTagNames(value) {
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
 * 幂等创建标签（重名直接返回已有），返回标签对象
 * @param {import('better-sqlite3').Database} db - 数据库实例
 * @param {string} name - 已 trim 的标签名
 * @returns {Tag}
 */
export function findOrCreateTag(db, name) {
  /** @type {Tag | undefined} */
  const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
  if (existing) return existing;
  const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
  /** @type {Tag} */
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * 整组替换一条记录的标签关联（先清空再插入；标签不存在则幂等创建）
 * @param {import('better-sqlite3').Database} db - 数据库实例
 * @param {number} recordId - 记录 id
 * @param {string[]} tagNames - 已校验的标签名数组（空数组 = 清空全部标签）
 * @returns {void}
 */
export function replaceRecordTags(db, recordId, tagNames) {
  db.prepare('DELETE FROM record_tags WHERE record_id = ?').run(recordId);
  const insert = db.prepare('INSERT OR IGNORE INTO record_tags (record_id, tag_id) VALUES (?, ?)');
  for (const name of tagNames) {
    const tag = findOrCreateTag(db, name);
    insert.run(recordId, tag.id);
  }
}

/**
 * 读取一条记录的标签名数组（按关联顺序）
 * @param {import('better-sqlite3').Database} db - 数据库实例
 * @param {number} recordId - 记录 id
 * @returns {string[]}
 */
export function getRecordTags(db, recordId) {
  return db.prepare(`
    SELECT t.name FROM tags t
    JOIN record_tags rt ON rt.tag_id = t.id
    WHERE rt.record_id = ?
    ORDER BY rt.rowid
  `).all(recordId).map(r => r.name);
}

/**
 * 获取所有标签
 * @route GET /
 * @param {Request} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {Promise<void>}
 */
tagsRouter.get('/', (req, res) => {
  try {
    const db = getDb();
    const tags = db.prepare('SELECT * FROM tags ORDER BY id').all();
    res.json(tags);
  } catch (err) {
    console.error('获取标签失败:', err);
    res.status(500).json({ error: '获取标签失败' });
  }
});

/**
 * 创建标签（幂等：重名直接复用已有标签）
 * @route POST /
 * @param {Request<{}, {}, { name?: string }>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {Promise<void>}
 */
tagsRouter.post('/', (req, res) => {
  try {
    const db = getDb();
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!name) {
      return res.status(400).json({ error: '标签名不能为空' });
    }
    if (name.length > TAG_NAME_MAX_LENGTH) {
      return res.status(400).json({ error: `标签名不能超过 ${TAG_NAME_MAX_LENGTH} 字` });
    }

    // 幂等复用：同名标签直接返回已有，不建重复
    /** @type {Tag | undefined} */
    const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
    if (existing) {
      return res.json(existing);
    }

    const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
    /** @type {Tag} */
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(tag);
  } catch (err) {
    console.error('创建标签失败:', err);
    res.status(500).json({ error: '创建标签失败' });
  }
});

/**
 * 删除标签（级联清除所有记录的关联）
 * @route DELETE /:id
 * @param {Request<{ id: string }>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {Promise<void>}
 */
tagsRouter.delete('/:id', (req, res) => {
  try {
    const db = getDb();

    const idStr = req.params.id;
    if (!/^\d+$/.test(idStr)) {
      return res.status(404).json({ error: '标签不存在' });
    }
    const id = Number(idStr);

    /** @type {Tag | undefined} */
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    if (!tag) {
      return res.status(404).json({ error: '标签不存在' });
    }

    // record_tags 通过外键 ON DELETE CASCADE 自动清除关联
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('删除标签失败:', err);
    res.status(500).json({ error: '删除标签失败' });
  }
});
