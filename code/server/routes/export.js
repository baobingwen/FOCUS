// code/server/routes/export.js
import { Router } from 'express';
import { getDb } from '../database.js';
import { getVersion } from '../version.js';

/**
 * @import { Request, Response } from 'express'
 */

/** @type {Router} */
export const exportRouter = Router();

/**
 * 格式化本地时间为 'YYYY-MM-DD HH:MM:SS'（与 SQLite DATETIME 存储格式一致）
 * @param {Date} date - 时间
 * @returns {string}
 */
function formatLocalDateTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/**
 * 解析 records 行的 segments 字段（JSON 文本 → 数组，解析失败保持原样）
 * @param {Array<Record<string, unknown>>} rows - 记录行数组
 * @returns {Array<Record<string, unknown>>}
 */
function parseSegments(rows) {
  return rows.map((row) => {
    if (row.segments && typeof row.segments === 'string') {
      try { row.segments = JSON.parse(row.segments); } catch { /* 保持原样 */ }
    }
    return row;
  });
}

/**
 * 全量导出数据为 JSON 文件下载（管理模式入口）
 * 覆盖五张业务表：records / subjects / tags / record_tags / reminder_items
 * 顶层带 app / version / exported_at 元数据；不含 _migrations 内部表
 * @route GET /
 * @param {Request} _req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @returns {void}
 */
exportRouter.get('/', (_req, res) => {
  try {
    const db = getDb();
    const now = new Date();

    const data = {
      records: parseSegments(
        /** @type {Array<Record<string, unknown>>} */ (
          db.prepare('SELECT * FROM records ORDER BY id').all()
        ),
      ),
      subjects: db.prepare('SELECT * FROM subjects ORDER BY sort_order, id').all(),
      tags: db.prepare('SELECT * FROM tags ORDER BY sort_order, id').all(),
      record_tags: db.prepare('SELECT * FROM record_tags ORDER BY record_id, tag_id').all(),
      reminder_items: db.prepare('SELECT * FROM reminder_items ORDER BY sort_order, id').all(),
    };

    const payload = {
      app: 'FOCUS',
      version: getVersion(),
      exported_at: formatLocalDateTime(now),
      data,
    };

    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
    const filename = `focus-export-${stamp}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('导出数据失败:', err);
    res.status(500).json({ error: '导出数据失败' });
  }
});
