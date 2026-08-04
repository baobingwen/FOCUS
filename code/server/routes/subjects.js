// code/server/routes/subjects.js
import { Router } from 'express';
import { getDb } from '../database.js';

/**
 * @import { Subject } from '../types.js'
 * @import { Request, Response } from 'express'
 */

/** @type {Router} */
export const subjectsRouter = Router();

/**
 * 获取所有科目
 * @route GET /
 * @param {Request} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {Promise<void>}
 */
subjectsRouter.get('/', (_req, res) => {
  try {
    const db = getDb();
    const subjects = db.prepare('SELECT * FROM subjects ORDER BY sort_order, id').all();
    res.json(subjects);
  } catch (err) {
    console.error('获取科目失败:', err);
    res.status(500).json({ error: '获取科目失败' });
  }
});

/**
 * 创建新科目
 * @route POST /
 * @param {Request} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {Promise<void>}
 */
subjectsRouter.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '科目名不能为空' });
    }

    const trimmed = name.trim();
    const existing = /** @type {{ id: number } | undefined} */ (
      db.prepare('SELECT id FROM subjects WHERE name = ?').get(trimmed)
    );
    if (existing) {
      return res.status(409).json({ error: '科目已存在', id: existing.id });
    }

    /**
     * @type {{ max_order: number | null }}
     */
    const maxOrder = /** @type {{ max_order: number | null }} */ (
      db.prepare('SELECT MAX(sort_order) as max_order FROM subjects').get()
    );
    const sortOrder = (maxOrder?.max_order ?? -1) + 1;

    const result = db.prepare('INSERT INTO subjects (name, sort_order) VALUES (?, ?)').run(trimmed, sortOrder);
    const subject = /** @type {Subject} */ (db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid));
    res.json(subject);
  } catch (err) {
    console.error('创建科目失败:', err);
    res.status(500).json({ error: '创建科目失败' });
  }
});

/**
 * 删除科目
 * @route DELETE /:id
 * @param {Request<{ id: string }>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {Promise<void>}
 */
subjectsRouter.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // 不允许删除默认科目（数学、英语、专业课）
    const subject = /** @type {Subject | undefined} */ (
      db.prepare('SELECT * FROM subjects WHERE id = ?').get(id)
    );
    if (!subject) {
      return res.status(404).json({ error: '科目不存在' });
    }
    if (['数学', '英语', '专业课'].includes(subject.name)) {
      return res.status(403).json({ error: '不能删除默认科目' });
    }

    db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('删除科目失败:', err);
    res.status(500).json({ error: '删除科目失败' });
  }
});
