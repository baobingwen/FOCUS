import { Router } from 'express';
import { getDb } from '../database.js';

export const recordsRouter = Router();

// 保存一条记录
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

    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(result.lastInsertRowid);
    res.json(record);
  } catch (err) {
    console.error('保存记录失败:', err);
    res.status(500).json({ error: '保存记录失败' });
  }
});

// 获取指定日期的记录
recordsRouter.get('/', (req, res) => {
  try {
    const db = getDb();
    const { date } = req.query;

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

// 获取今日概览
recordsRouter.get('/today', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    // 总学习时长
    const totalStudy = db.prepare(`
      SELECT COALESCE(SUM(duration_ms), 0) as total_ms
      FROM records
      WHERE DATE(created_at) = ? AND mode = 'study'
    `).get(today);

    // 按科目分组的学习时长
    const bySubject = db.prepare(`
      SELECT subject, SUM(duration_ms) as total_ms, COUNT(*) as count
      FROM records
      WHERE DATE(created_at) = ? AND mode = 'study'
      GROUP BY subject
      ORDER BY total_ms DESC
    `).all(today);

    // 今日休息总时长
    const totalRest = db.prepare(`
      SELECT COALESCE(SUM(duration_ms), 0) as total_ms
      FROM records
      WHERE DATE(created_at) = ? AND mode = 'rest'
    `).get(today);

    // 总记录数
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
