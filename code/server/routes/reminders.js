// code/server/routes/reminders.js
import { Router } from 'express';
import { getDb } from '../database.js';

/**
 * @import { Request, Response } from 'express'
 */

/** 提醒内容长度上限（中文按字计） */
export const REMINDER_MAX_LENGTH = 200;

/** @type {Router} */
export const remindersRouter = Router();

/**
 * 计算下一个排序值（新条目排末尾）
 * @param {import('better-sqlite3').Database} db - 数据库实例
 * @returns {number}
 */
function nextSortOrder(db) {
  /** @type {{ max_order: number | null }} */
  const maxOrder = /** @type {{ max_order: number | null }} */ (
    db.prepare('SELECT MAX(sort_order) as max_order FROM reminder_items').get()
  );
  return (maxOrder?.max_order ?? -1) + 1;
}

/**
 * 获取全部复习提醒（按 sort_order, id 排序）
 * @route GET /
 * @param {Request} _req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {void}
 */
remindersRouter.get('/', (_req, res) => {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM reminder_items ORDER BY sort_order, id').all();
    res.json(items);
  } catch (err) {
    console.error('获取复习提醒失败:', err);
    res.status(500).json({ error: '获取复习提醒失败' });
  }
});

/**
 * 新增一条复习提醒（排末尾）
 * @route POST /
 * @param {Request<{}, {}, { content?: string }>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {void}
 */
remindersRouter.post('/', (req, res) => {
  try {
    const db = getDb();
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

    if (!content) {
      return res.status(400).json({ error: '提醒内容不能为空' });
    }
    if (content.length > REMINDER_MAX_LENGTH) {
      return res.status(400).json({ error: `提醒内容不能超过 ${REMINDER_MAX_LENGTH} 字` });
    }

    const result = db
      .prepare('INSERT INTO reminder_items (content, sort_order) VALUES (?, ?)')
      .run(content, nextSortOrder(db));
    const item = db.prepare('SELECT * FROM reminder_items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(item);
  } catch (err) {
    console.error('新增复习提醒失败:', err);
    res.status(500).json({ error: '新增复习提醒失败' });
  }
});

/**
 * 修改一条复习提醒的内容
 * @route PATCH /:id
 * @param {Request<{ id: string }, {}, { content?: string }>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {void}
 */
remindersRouter.patch('/:id', (req, res) => {
  try {
    const db = getDb();

    const idStr = req.params.id;
    if (!/^\d+$/.test(idStr)) {
      return res.status(404).json({ error: '复习提醒不存在' });
    }
    const id = Number(idStr);

    const existing = /** @type {{ id: number } | undefined} */ (
      db.prepare('SELECT id FROM reminder_items WHERE id = ?').get(id)
    );
    if (!existing) {
      return res.status(404).json({ error: '复习提醒不存在' });
    }

    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) {
      return res.status(400).json({ error: '提醒内容不能为空' });
    }
    if (content.length > REMINDER_MAX_LENGTH) {
      return res.status(400).json({ error: `提醒内容不能超过 ${REMINDER_MAX_LENGTH} 字` });
    }

    db.prepare('UPDATE reminder_items SET content = ? WHERE id = ?').run(content, id);
    const item = db.prepare('SELECT * FROM reminder_items WHERE id = ?').get(id);
    res.json(item);
  } catch (err) {
    console.error('修改复习提醒失败:', err);
    res.status(500).json({ error: '修改复习提醒失败' });
  }
});

/**
 * 删除一条复习提醒
 * @route DELETE /:id
 * @param {Request<{ id: string }>} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {void}
 */
remindersRouter.delete('/:id', (req, res) => {
  try {
    const db = getDb();

    const idStr = req.params.id;
    if (!/^\d+$/.test(idStr)) {
      return res.status(404).json({ error: '复习提醒不存在' });
    }
    const id = Number(idStr);

    const existing = /** @type {{ id: number } | undefined} */ (
      db.prepare('SELECT id FROM reminder_items WHERE id = ?').get(id)
    );
    if (!existing) {
      return res.status(404).json({ error: '复习提醒不存在' });
    }

    db.prepare('DELETE FROM reminder_items WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('删除复习提醒失败:', err);
    res.status(500).json({ error: '删除复习提醒失败' });
  }
});
