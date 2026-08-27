import request from 'supertest';
import { getDb, closeDb } from '../database.js';
import { app } from '../index.js';

/**
 * 每个测试前重置为全新的空内存数据库
 */
beforeEach(() => {
  closeDb();
  getDb();
});

afterAll(() => {
  closeDb();
});

// ──────────────────────────────────────────────
// GET /api/export
// ──────────────────────────────────────────────
describe('GET /api/export', () => {
  it('空库导出：元数据正确、默认科目在内、其余业务表为空', async () => {
    const res = await request(app).get('/api/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');

    expect(res.body.app).toBe('FOCUS');
    expect(res.body.version).toBeDefined();
    // 与 SQLite DATETIME 存储格式一致：YYYY-MM-DD HH:MM:SS
    expect(res.body.exported_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    expect(res.body.data).toEqual({
      records: [],
      // 建表时自动写入的默认科目（数学、英语、专业课）
      subjects: [
        { id: 1, name: '数学', sort_order: 0 },
        { id: 2, name: '英语', sort_order: 1 },
        { id: 3, name: '专业课', sort_order: 2 },
      ],
      tags: [],
      record_tags: [],
      reminder_items: [],
    });
  });

  it('响应带 Content-Disposition 附件文件名（focus-export-YYYYMMDD-HHMMSS.json）', async () => {
    const res = await request(app).get('/api/export');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="focus-export-\d{8}-\d{6}\.json"$/
    );
  });

  it('全量导出各表数据，records 的 segments 解析为数组', async () => {
    const db = getDb();
    // 科目：默认 数学/英语/专业课 + 自定义 政治
    db.prepare('INSERT INTO subjects (name, sort_order) VALUES (?, ?)').run('政治', 3);
    // 标签
    db.prepare('INSERT INTO tags (name, sort_order) VALUES (?, ?)').run('高数', 0);
    db.prepare('INSERT INTO tags (name, sort_order) VALUES (?, ?)').run('线代', 1);
    // 学习记录：segments 以 JSON 文本入库
    db.prepare(`
      INSERT INTO records (mode, subject, duration_ms, notes, segments, paused_ms, pages, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'study', '数学', 3600000, '真题模拟',
      JSON.stringify([
        { type: 'study', duration_ms: 3600000 },
        { type: 'pause', duration_ms: 600000 },
      ]),
      600000, 30, '2026-07-06 10:00:00',
    );
    const recId = db.prepare('SELECT id FROM records LIMIT 1').get().id;
    const tagIds = db.prepare('SELECT id FROM tags ORDER BY id').all().map(r => r.id);
    db.prepare('INSERT INTO record_tags (record_id, tag_id) VALUES (?, ?)').run(recId, tagIds[0]);
    db.prepare('INSERT INTO reminder_items (content, sort_order) VALUES (?, ?)').run('反复多次', 0);

    const res = await request(app).get('/api/export');
    expect(res.status).toBe(200);

    expect(res.body.data.subjects.map(s => s.name)).toEqual(['数学', '英语', '专业课', '政治']);
    expect(res.body.data.tags.map(t => t.name)).toEqual(['高数', '线代']);
    expect(res.body.data.record_tags).toEqual([{ record_id: recId, tag_id: tagIds[0] }]);
    expect(res.body.data.reminder_items.map(r => r.content)).toEqual(['反复多次']);

    expect(res.body.data.records).toHaveLength(1);
    const record = res.body.data.records[0];
    expect(record.subject).toBe('数学');
    expect(record.notes).toBe('真题模拟');
    expect(record.pages).toBe(30);
    expect(record.paused_ms).toBe(600000);
    expect(record.segments).toEqual([
      { type: 'study', duration_ms: 3600000 },
      { type: 'pause', duration_ms: 600000 },
    ]);
  });

  it('休息记录无 segments 时导出为 null 保持原值', async () => {
    const db = getDb();
    db.prepare('INSERT INTO records (mode, subject, duration_ms) VALUES (?, ?, ?)')
      .run('rest', null, 600000);

    const res = await request(app).get('/api/export');
    expect(res.status).toBe(200);
    expect(res.body.data.records).toHaveLength(1);
    expect(res.body.data.records[0].mode).toBe('rest');
    expect(res.body.data.records[0].segments).toBeNull();
  });

  it('不含 _migrations 内部表', async () => {
    const res = await request(app).get('/api/export');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('_migrations');
  });
});
