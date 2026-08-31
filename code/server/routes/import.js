// code/server/routes/import.js
import { Router } from 'express';
import { getDb } from '../database.js';
import { validatePayload, validateImportRows, intOr, strOr } from '../../shared/importValidation.js';

/**
 * @import { Request, Response } from 'express'
 */

/** @type {Router} */
export const importRouter = Router();

/**
 * 行对象取值：缺失/未定义 → null（undefined 绑定会抛错）
 * @param {Record<string, unknown> | null | undefined} row - 数据行
 * @param {string} col - 列名
 * @returns {unknown}
 */
function val(row, col) {
  const v = row ? row[col] : undefined;
  return v === undefined ? null : v;
}

/**
 * 全量导入数据（管理模式入口）
 * 语义 = 恢复到导出时状态：事务内清空五张业务表，再按导入数据原样插入（保留原 id）
 * 行级校验（code/shared/importValidation.js，与纯静态版同一套规则）事务前先行：
 * 任何一行不合法 → 400，事务未开始、旧数据不受影响；SQLite 现有约束仅作理论兜底
 * @route POST /
 * @param {Request} req - Express 请求对象（body 为完整导出 JSON）
 * @param {Response} res - Express 响应对象
 * @returns {void}
 */
importRouter.post('/', (req, res) => {
  try {
    const error = validatePayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }
    try {
      // 行级校验（事务外先行，与纯静态版同一套规则）：任何一行不合法 → 400，事务未开始、旧数据不受影响
      validateImportRows(/** @type {object} */ (req.body.data));
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }

    const db = getDb();
    /** @type {{ records: unknown[], subjects: unknown[], tags: unknown[], record_tags: unknown[], reminder_items: unknown[] }} */
    const data = req.body.data;

    const insertSubject = db.prepare('INSERT INTO subjects (id, name, sort_order) VALUES (?, ?, ?)');
    const insertTag = db.prepare('INSERT INTO tags (id, name, sort_order) VALUES (?, ?, ?)');
    const insertRecord = db.prepare(`
      INSERT INTO records (id, mode, subject, duration_ms, notes, created_at, segments, paused_ms, pages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertRecordTag = db.prepare('INSERT INTO record_tags (record_id, tag_id) VALUES (?, ?)');
    const insertReminder = db.prepare('INSERT INTO reminder_items (id, content, sort_order, created_at) VALUES (?, ?, ?, ?)');

    const counts = db.transaction(() => {
      // 清空五张业务表（显式先清 record_tags，避免外键级联歧义）
      db.prepare('DELETE FROM record_tags').run();
      db.prepare('DELETE FROM records').run();
      db.prepare('DELETE FROM tags').run();
      db.prepare('DELETE FROM subjects').run();
      db.prepare('DELETE FROM reminder_items').run();

      /** @type {{ records: number, subjects: number, tags: number, record_tags: number, reminder_items: number }} */
      const c = { records: 0, subjects: 0, tags: 0, record_tags: 0, reminder_items: 0 };

      // 先父后子插入，保证引用关系
      for (const s of data.subjects) {
        insertSubject.run(val(/** @type {Record<string, unknown>} */ (s), 'id'), val(/** @type {Record<string, unknown>} */ (s), 'name'), intOr(val(/** @type {Record<string, unknown>} */ (s), 'sort_order'), 0));
        c.subjects++;
      }
      for (const t of data.tags) {
        insertTag.run(val(/** @type {Record<string, unknown>} */ (t), 'id'), val(/** @type {Record<string, unknown>} */ (t), 'name'), intOr(val(/** @type {Record<string, unknown>} */ (t), 'sort_order'), 0));
        c.tags++;
      }
      for (const r of data.records) {
        const row = /** @type {Record<string, unknown>} */ (r);
        // segments 导出时为数组，导入需序列化回 TEXT（与导出解析对称）；非数组原样保留
        const segments = Array.isArray(row.segments)
          ? JSON.stringify(row.segments)
          : val(row, 'segments');
        insertRecord.run(
          val(row, 'id'), val(row, 'mode'), val(row, 'subject'), val(row, 'duration_ms'),
          strOr(val(row, 'notes'), ''), strOr(val(row, 'created_at'), null), segments,
          intOr(val(row, 'paused_ms'), 0), intOr(val(row, 'pages'), null),
        );
        c.records++;
      }
      for (const rt of data.record_tags) {
        insertRecordTag.run(val(/** @type {Record<string, unknown>} */ (rt), 'record_id'), val(/** @type {Record<string, unknown>} */ (rt), 'tag_id'));
        c.record_tags++;
      }
      for (const item of data.reminder_items) {
        insertReminder.run(
          val(/** @type {Record<string, unknown>} */ (item), 'id'),
          val(/** @type {Record<string, unknown>} */ (item), 'content'),
          intOr(val(/** @type {Record<string, unknown>} */ (item), 'sort_order'), 0),
          strOr(val(/** @type {Record<string, unknown>} */ (item), 'created_at'), null),
        );
        c.reminder_items++;
      }
      return c;
    })();

    res.json({ success: true, counts });
  } catch (err) {
    // 行级校验已等价拦截非法行，事务内一般不会触发约束；异常归 500
    const message = err instanceof Error ? err.message : String(err);
    console.error('导入数据失败:', err);
    res.status(500).json({ error: `导入数据失败: ${message}` });
  }
});
