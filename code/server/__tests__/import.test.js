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

/**
 * 构造一份最小完整导出 payload（与 GET /api/export 输出结构一致）
 * @param {object} [overrides] - 覆盖 data 下的某张表
 * @returns {object}
 */
function makePayload(overrides = {}) {
  return {
    app: 'FOCUS',
    version: '0.3.5',
    exported_at: '2026-08-27 12:00:00',
    data: {
      records: [],
      subjects: [
        { id: 1, name: '数学', sort_order: 0 },
        { id: 2, name: '英语', sort_order: 1 },
        { id: 3, name: '专业课', sort_order: 2 },
      ],
      tags: [],
      record_tags: [],
      reminder_items: [],
      ...overrides,
    },
  };
}

// ──────────────────────────────────────────────
// POST /api/import
// ──────────────────────────────────────────────
describe('POST /api/import', () => {
  it('空五表导入：清空默认科目，counts 全 0（完全信任文件内容）', async () => {
    const res = await request(app).post('/api/import').send(makePayload({ subjects: [] }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      counts: { records: 0, subjects: 0, tags: 0, record_tags: 0, reminder_items: 0 },
    });
    const db = getDb();
    expect(db.prepare('SELECT COUNT(*) AS n FROM subjects').get().n).toBe(0);
  });

  it('全量替换：导入前数据被清空，替换为导入内容（保留原 id，record_tags 引用一致）', async () => {
    const db = getDb();
    // 造一份「旧」数据
    db.prepare('INSERT INTO subjects (name, sort_order) VALUES (?, ?)').run('政治', 3);
    db.prepare("INSERT INTO records (mode, subject, duration_ms) VALUES ('study', '政治', 1000)").run();
    db.prepare('INSERT INTO tags (name, sort_order) VALUES (?, ?)').run('旧标签', 0);
    db.prepare('INSERT INTO reminder_items (content, sort_order) VALUES (?, ?)').run('旧提醒', 0);

    const payload = makePayload({
      subjects: [{ id: 10, name: '新科目', sort_order: 0 }],
      records: [
        {
          id: 20, mode: 'study', subject: '新科目', duration_ms: 3600000,
          notes: '导入的记录', created_at: '2026-08-27 10:00:00',
          segments: null, paused_ms: 0, pages: 5,
        },
      ],
      tags: [{ id: 30, name: '新标签', sort_order: 0 }],
      record_tags: [{ record_id: 20, tag_id: 30 }],
      reminder_items: [{ id: 40, content: '新提醒', sort_order: 0, created_at: '2026-08-27 09:00:00' }],
    });

    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ records: 1, subjects: 1, tags: 1, record_tags: 1, reminder_items: 1 });

    // 旧数据全部消失
    expect(db.prepare('SELECT COUNT(*) AS n FROM subjects').get().n).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM records').get().n).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM tags').get().n).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM reminder_items').get().n).toBe(1);

    // 新数据原样（保留 id 与引用）
    expect(db.prepare('SELECT * FROM subjects WHERE id = 10').get())
      .toEqual({ id: 10, name: '新科目', sort_order: 0 });
    expect(db.prepare('SELECT * FROM records WHERE id = 20').get())
      .toMatchObject({ id: 20, subject: '新科目', notes: '导入的记录', pages: 5, paused_ms: 0 });
    expect(db.prepare('SELECT * FROM tags WHERE id = 30').get())
      .toEqual({ id: 30, name: '新标签', sort_order: 0 });
    expect(db.prepare('SELECT * FROM record_tags').get())
      .toEqual({ record_id: 20, tag_id: 30 });
    expect(db.prepare('SELECT * FROM reminder_items WHERE id = 40').get())
      .toEqual({ id: 40, content: '新提醒', sort_order: 0, created_at: '2026-08-27 09:00:00' });
  });

  it('records.segments 数组序列化为 JSON 文本入库，再导出可解析回数组（与导出对称）', async () => {
    const payload = makePayload({
      subjects: [{ id: 1, name: '数学', sort_order: 0 }],
      records: [
        {
          id: 5, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '',
          created_at: '2026-08-27 10:00:00',
          segments: [
            { type: 'study', duration_ms: 3600000 },
            { type: 'pause', duration_ms: 600000 },
          ],
          paused_ms: 600000, pages: null,
        },
      ],
    });
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(200);

    const db = getDb();
    const row = db.prepare('SELECT segments, paused_ms FROM records WHERE id = 5').get();
    expect(typeof row.segments).toBe('string');
    expect(JSON.parse(row.segments)).toEqual([
      { type: 'study', duration_ms: 3600000 },
      { type: 'pause', duration_ms: 600000 },
    ]);

    // 与导出对称：导出时 segments 解析回数组
    const exportRes = await request(app).get('/api/export');
    expect(exportRes.body.data.records[0].segments).toEqual([
      { type: 'study', duration_ms: 3600000 },
      { type: 'pause', duration_ms: 600000 },
    ]);
  });

  it('app 不是 FOCUS 时拒绝导入（400）', async () => {
    const res = await request(app).post('/api/import').send({ ...makePayload(), app: 'OTHER' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不是 FOCUS');
  });

  it('data 缺少某张表时拒绝导入（400）', async () => {
    const payload = makePayload();
    delete payload.data.tags;
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tags');
  });

  it('行数据不合法（行级校验）时整体拒绝，原数据保留', async () => {
    const db = getDb();
    db.prepare('INSERT INTO subjects (name, sort_order) VALUES (?, ?)').run('政治', 3);

    // subjects 中有一行 name 为 null（行级校验拦截）；records 数据合法但不应落库
    const payload = makePayload({
      subjects: [{ id: 1, name: null, sort_order: 0 }],
      records: [{ id: 2, mode: 'study', subject: '数学', duration_ms: 1000, paused_ms: 0 }],
    });
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('导入数据不合法');

    // 校验在事务前执行：旧数据保留、无半截数据
    expect(db.prepare('SELECT COUNT(*) AS n FROM subjects').get().n).toBe(4); // 默认 3 + 政治
    expect(db.prepare('SELECT COUNT(*) AS n FROM records').get().n).toBe(0);
  });

  it('duration_ms ≤ 0 拒绝（行级校验，之前 SQLite 仅 NOT NULL 放行）', async () => {
    const payload = makePayload({
      subjects: [{ id: 1, name: '数学', sort_order: 0 }],
      records: [{ id: 2, mode: 'study', subject: '数学', duration_ms: 0, paused_ms: 0 }],
    });
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('导入数据不合法: records 行 duration_ms 无效');
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM records').get().n).toBe(0);
  });

  it('空串 subjects.name 拒绝（行级校验，之前 NOT NULL 放行空串）', async () => {
    const payload = makePayload({ subjects: [{ id: 1, name: '  ', sort_order: 0 }] });
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('导入数据不合法: subjects 行 name 缺失');
  });

  it('重复 subjects.name 拒绝（400 中文消息，替代原 SQLite UNIQUE 英文原文）', async () => {
    const payload = makePayload({
      subjects: [
        { id: 1, name: '数学', sort_order: 0 },
        { id: 2, name: '数学', sort_order: 1 },
      ],
    });
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('导入数据不合法: subjects 行 name 重复');
  });

  it('重复 tags.name 拒绝（行级校验，错误消息统一中文）', async () => {
    const payload = makePayload({
      tags: [
        { id: 1, name: '高数', sort_order: 0 },
        { id: 2, name: '高数', sort_order: 1 },
      ],
    });
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('导入数据不合法: tags 行 name 重复');
  });

  it('重复 record_tags 拒绝（行级校验，替代原复合主键兜底）', async () => {
    const payload = makePayload({
      subjects: [{ id: 1, name: '数学', sort_order: 0 }],
      records: [{ id: 2, mode: 'study', subject: '数学', duration_ms: 1000, paused_ms: 0 }],
      tags: [{ id: 3, name: '高数', sort_order: 0 }],
      record_tags: [
        { record_id: 2, tag_id: 3 },
        { record_id: 2, tag_id: 3 },
      ],
    });
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('导入数据不合法: record_tags 行重复');
  });

  it('sort_order 缺失时接受并归一为 0（行为放宽，对齐纯静态版）', async () => {
    const payload = makePayload({
      subjects: [{ id: 1, name: '数学' }], // 无 sort_order
      records: [{ id: 2, mode: 'study', subject: '数学', duration_ms: 1000, paused_ms: 0, pages: 3 }],
    });
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(200);
    expect(getDb().prepare('SELECT sort_order FROM subjects WHERE id = 1').get())
      .toEqual({ sort_order: 0 });
    expect(getDb().prepare('SELECT pages FROM records WHERE id = 2').get()).toEqual({ pages: 3 });
  });

  it('导入后 sqlite_sequence 更新：新插入记录 id 从导入最大 id 之后继续', async () => {
    const payload = makePayload({
      subjects: [{ id: 1, name: '数学', sort_order: 0 }],
      records: [{ id: 100, mode: 'study', subject: '数学', duration_ms: 1000, paused_ms: 0 }],
    });
    const res = await request(app).post('/api/import').send(payload);
    expect(res.status).toBe(200);

    const db = getDb();
    const result = db
      .prepare("INSERT INTO records (mode, subject, duration_ms) VALUES ('study', '数学', 500)")
      .run();
    expect(Number(result.lastInsertRowid)).toBeGreaterThan(100);
  });
});
