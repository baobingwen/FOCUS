// code/server/routes/records.js
import { Router } from 'express';
import { getDb } from '../database.js';

/**
 * @import { Record, InsertRecordParams, Subject } from '../types.js'
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
recordsRouter.post('/', (req, res) => {
  try {
    const db = getDb();
    const { mode, subject, duration_ms, notes } = req.body;

    if (!mode || !['study', 'rest'].includes(mode)) {
      return res.status(400).json({ error: '无效的 mode，必须为 study 或 rest' });
    }
    if (typeof duration_ms !== 'number' || duration_ms <= 0) {
      return res.status(400).json({ error: '无效的 duration_ms' });
    }
    if (mode === 'study' && !subject) {
      return res.status(400).json({ error: '学习模式需要指定 subject' });
    }

    const result = db.prepare(`
      INSERT INTO records (mode, subject, duration_ms, notes)
      VALUES (?, ?, ?, ?)
    `).run(mode, mode === 'study' ? subject : null, duration_ms, notes || '');

    /** @type {Record} */
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(result.lastInsertRowid);
    res.json(record);
  } catch (err) {
    console.error('保存记录失败:', err);
    res.status(500).json({ error: '保存记录失败' });
  }
});

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

    /** @type {Record[]} */
    let records;
    if (date) {
      records = db.prepare(`
        SELECT * FROM records
        WHERE DATE(created_at) = DATE(?)
        ORDER BY created_at DESC
      `).all(date);
    } else {
      records = db.prepare(`
        SELECT * FROM records
        ORDER BY created_at DESC
        LIMIT 200
      `).all();
    }

    res.json({ records });
  } catch (err) {
    console.error('获取记录失败:', err);
    res.status(500).json({ error: '获取记录失败' });
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
recordsRouter.get('/today', (req, res) => {
  try {
    const db = getDb();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    /**
     * 总学习时长
     * @type {{ total_ms: number }}
     */
    const totalStudy = db.prepare(`
      SELECT COALESCE(SUM(duration_ms), 0) as total_ms
      FROM records
      WHERE DATE(created_at) = ? AND mode = 'study'
    `).get(today);

    /**
     * 按科目分组的学习时长
     * @type {Array<{ subject: string | null, total_ms: number, count: number }>}
     */
    const bySubject = db.prepare(`
      SELECT subject, SUM(duration_ms) as total_ms, COUNT(*) as count
      FROM records
      WHERE DATE(created_at) = ? AND mode = 'study'
      GROUP BY subject
      ORDER BY total_ms DESC
    `).all(today);

    /**
     * 今日休息总时长
     * @type {{ total_ms: number }}
     */
    const totalRest = db.prepare(`
      SELECT COALESCE(SUM(duration_ms), 0) as total_ms
      FROM records
      WHERE DATE(created_at) = ? AND mode = 'rest'
    `).get(today);

    /**
     * @type {{ count: number }}
     */
    const totalCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM records
      WHERE DATE(created_at) = ?
    `).get(today);

    res.json({
      date: today,
      total_study_ms: totalStudy.total_ms,
      total_rest_ms: totalRest.total_ms,
      total_records: totalCount.count,
      by_subject: bySubject,
    });
  } catch (err) {
    console.error('获取今日概览失败:', err);
    res.status(500).json({ error: '获取今日概览失败' });
  }
});
