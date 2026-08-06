// code/server/routes/records.js
import { Router } from 'express';
import { getDb } from '../database.js';
import { parseTagNames, replaceRecordTags, getRecordTags } from './tags.js';

/**
 * @import { Record, InsertRecordParams } from '../types.js'
 * @import { Request, Response } from 'express'
 */

/** @type {Router} */
export const recordsRouter = Router();

/**
 * 保存一条记录
 * @route POST /
 * @param {Request<{}, {}, InsertRecordParams>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {Promise<void>}
 */

/**
 * 解析数据库记录中的 segments 字段（JSON 字符串 → 数组）
 * @param {Record} row
 * @returns {Record}
 */
function parseSegments(row) {
  if (row && row.segments && typeof row.segments === 'string') {
    try { row.segments = JSON.parse(row.segments); } catch { /* 保持原样 */ }
  }
  return row;
}

recordsRouter.post('/', (req, res) => {
  try {
    const db = getDb();
    const { mode, subject, duration_ms, notes, segments, paused_ms } = req.body;

    if (!mode || !['study', 'rest'].includes(mode)) {
      return res.status(400).json({ error: '无效的 mode，必须为 study 或 rest' });
    }
    if (typeof duration_ms !== 'number' || duration_ms <= 0) {
      return res.status(400).json({ error: '无效的 duration_ms' });
    }
    if (mode === 'study' && !subject) {
      return res.status(400).json({ error: '学习模式需要指定 subject' });
    }

    const segmentsStr = segments ? JSON.stringify(segments) : null;
    const pausedMs = (mode === 'study' && typeof paused_ms === 'number' && paused_ms > 0) ? paused_ms : 0;

    // 校验并解析标签（仅学习记录有标签概念，休息记录忽略）
    const parsed = parseTagNames(req.body?.tags);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const tags = mode === 'study' ? (parsed.names ?? []) : [];

    // 校验页数（选填）：必须为 1~9999 的整数，仅学习记录有效，休息记录无条件忽略
    const pages = req.body?.pages;
    if (mode === 'study' && pages !== undefined && pages !== null && (!Number.isInteger(pages) || pages < 1 || pages > 9999)) {
      return res.status(400).json({ error: '无效的 pages，必须为 1~9999 的整数' });
    }
    const recordPages = (mode === 'study' && Number.isInteger(pages) && pages > 0) ? pages : null;

    const result = db.prepare(`
      INSERT INTO records (mode, subject, duration_ms, notes, segments, paused_ms, pages)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(mode, mode === 'study' ? subject : null, duration_ms, notes || '', segmentsStr, pausedMs, recordPages);

    const recordId = Number(result.lastInsertRowid);
    if (tags.length > 0) {
      replaceRecordTags(db, recordId, tags);
    }

    const row = /** @type {Record} */ (db.prepare('SELECT * FROM records WHERE id = ?').get(recordId));
    row.tags = getRecordTags(db, recordId);
    res.json(parseSegments(row));
  } catch (err) {
    console.error('保存记录失败:', err);
    res.status(500).json({ error: '保存记录失败' });
  }
});

/**
 * 批量附加标签到记录数组（单次查询，避免 N+1）
 * @param {Record[]} records - 记录数组（原地修改，附加 tags 字段）
 * @returns {void}
 */
function attachTags(records) {
  if (records.length === 0) return;
  const db = getDb();
  const ids = records.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const tagRows = /** @type {Array<{ record_id: number, name: string }>} */ (db.prepare(`
    SELECT rt.record_id, t.name
    FROM record_tags rt JOIN tags t ON t.id = rt.tag_id
    WHERE rt.record_id IN (${placeholders})
    ORDER BY rt.rowid
  `).all(...ids));

  /** @type {Map<number, string[]>} */
  const byRecord = new Map();
  for (const row of tagRows) {
    const list = byRecord.get(row.record_id) || [];
    list.push(row.name);
    byRecord.set(row.record_id, list);
  }
  for (const r of records) {
    r.tags = byRecord.get(r.id) || [];
  }
}

/**
 * 获取指定日期的记录
 * @route GET /
 * @param {Request<{}, {}, {}, { date?: string }>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {Promise<void>}
 */
recordsRouter.get('/', (req, res) => {
  try {
    const db = getDb();
    const { date } = req.query;

    let rows;
    if (date) {
      rows = /** @type {Record[]} */ (db.prepare(`
        SELECT * FROM records
        WHERE DATE(created_at) = DATE(?)
        ORDER BY created_at DESC
      `).all(date));
    } else {
      rows = /** @type {Record[]} */ (db.prepare(`
        SELECT * FROM records
        ORDER BY created_at DESC
        LIMIT 200
      `).all());
    }

    const records = rows.map(parseSegments);
    attachTags(records);
    res.json({ records });
  } catch (err) {
    console.error('获取记录失败:', err);
    res.status(500).json({ error: '获取记录失败' });
  }
});

/**
 * 修改学习记录的备注
 * @route PATCH /:id
 * @param {Request<{ id: string }, {}, { notes?: unknown }>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {void}
 */
recordsRouter.patch('/:id', (req, res) => {
  try {
    const db = getDb();

    // id 非正整数（含非数字）视为不存在
    const idStr = req.params.id;
    if (!/^\d+$/.test(idStr)) {
      return res.status(404).json({ error: '记录不存在' });
    }
    const id = Number(idStr);

    const row = /** @type {Record | undefined} */ (db.prepare('SELECT * FROM records WHERE id = ?').get(id));
    if (!row) {
      return res.status(404).json({ error: '记录不存在' });
    }

    // 只允许修改学习记录（休息记录无备注/标签概念）
    if (row.mode !== 'study') {
      return res.status(400).json({ error: '仅学习记录可修改备注或标签' });
    }

    // 校验 notes（选填）：提供时必须为字符串；空串合法，等价于清空备注
    const notes = req.body?.notes;
    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: '无效的 notes，必须为字符串' });
    }

    // 校验 tags（选填）：提供时必须为字符串数组，整组替换
    const parsed = parseTagNames(req.body?.tags);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    // 校验 pages（选填）：提供时必须为 1~9999 整数，或 null 表示清空
    const pages = req.body?.pages;
    if (pages !== undefined && pages !== null && (!Number.isInteger(pages) || pages < 1 || pages > 9999)) {
      return res.status(400).json({ error: '无效的 pages，必须为 1~9999 的整数' });
    }

    if (notes !== undefined) {
      db.prepare('UPDATE records SET notes = ? WHERE id = ?').run(notes.trim(), id);
    }
    if (parsed.names !== null) {
      replaceRecordTags(db, id, parsed.names);
    }
    if (pages !== undefined) {
      db.prepare('UPDATE records SET pages = ? WHERE id = ?').run(pages, id);
    }

    const updated = /** @type {Record} */ (db.prepare('SELECT * FROM records WHERE id = ?').get(id));
    updated.tags = getRecordTags(db, id);
    res.json(parseSegments(updated));
  } catch (err) {
    console.error('修改备注失败:', err);
    res.status(500).json({ error: '修改备注失败' });
  }
});

/**
 * 删除单条记录（学习/休息均可，硬删除不可恢复）
 * 关联的 record_tags 由外键 ON DELETE CASCADE 自动清除，标签库条目保留
 * @route DELETE /:id
 * @param {Request<{ id: string }>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {void}
 */
recordsRouter.delete('/:id', (req, res) => {
  try {
    const db = getDb();

    // id 非正整数（含非数字）视为不存在
    const idStr = req.params.id;
    if (!/^\d+$/.test(idStr)) {
      return res.status(404).json({ error: '记录不存在' });
    }
    const id = Number(idStr);

    const result = db.prepare('DELETE FROM records WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('删除记录失败:', err);
    res.status(500).json({ error: '删除记录失败' });
  }
});

/**
 * 今日概览数据结构
 * @typedef {Object} TodayOverview
 * @property {string} date - 日期
 * @property {number} total_study_ms - 总学习时长（毫秒）
 * @property {number} total_rest_ms - 总休息时长（毫秒）
 * @property {number} total_records - 总记录数
 * @property {Array<{ subject: string | null, total_ms: number, count: number }>} by_subject - 按科目分组
 */

/**
 * 获取今日概览
 * @route GET /today
 * @param {Request} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {Promise<void>}
 */
recordsRouter.get('/today', (_req, res) => {
  try {
    const db = getDb();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    /**
     * 总学习时长
     * @type {{ total_ms: number }}
     */
    const totalStudy = /** @type {{ total_ms: number }} */ (db.prepare(`
      SELECT COALESCE(SUM(duration_ms), 0) as total_ms
      FROM records
      WHERE DATE(created_at) = ? AND mode = 'study'
    `).get(today));

    /**
     * 今日总页数（仅学习记录有 pages，SUM 自动忽略 NULL）
     * @type {{ total_pages: number }}
     */
    const totalPages = /** @type {{ total_pages: number }} */ (db.prepare(`
      SELECT COALESCE(SUM(pages), 0) as total_pages
      FROM records
      WHERE DATE(created_at) = ? AND mode = 'study'
    `).get(today));

    /**
     * 按科目分组的学习时长
     * @type {Array<{ subject: string | null, total_ms: number, count: number, total_pages: number }>}
     */
    const bySubject = /** @type {Array<{ subject: string | null, total_ms: number, count: number, total_pages: number }>} */ (db.prepare(`
      SELECT subject, SUM(duration_ms) as total_ms, COUNT(*) as count, COALESCE(SUM(pages), 0) as total_pages
      FROM records
      WHERE DATE(created_at) = ? AND mode = 'study'
      GROUP BY subject
      ORDER BY total_ms DESC
    `).all(today));

    /**
     * 今日休息总时长 = 手动 rest 记录的时长 + 学习记录中的暂停时长
     * 注意：SUM(duration_ms) 只统计 mode='rest' 的记录，避免把学习时长也算进去
     * @type {{ total_ms: number }}
     */
    const totalRest = /** @type {{ total_ms: number }} */ (db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN mode = 'rest' THEN duration_ms ELSE 0 END), 0)
           + COALESCE(SUM(paused_ms), 0) as total_ms
      FROM records
      WHERE DATE(created_at) = ? AND (mode = 'rest' OR paused_ms > 0)
    `).get(today));

    /**
     * @type {{ count: number }}
     */
    const totalCount = /** @type {{ count: number }} */ (db.prepare(`
      SELECT COUNT(*) as count
      FROM records
      WHERE DATE(created_at) = ?
    `).get(today));

    res.json({
      date: today,
      total_study_ms: totalStudy.total_ms,
      total_rest_ms: totalRest.total_ms,
      total_records: totalCount.count,
      total_pages: totalPages.total_pages,
      by_subject: bySubject,
    });
  } catch (err) {
    console.error('获取今日概览失败:', err);
    res.status(500).json({ error: '获取今日概览失败' });
  }
});
