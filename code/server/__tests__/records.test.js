import request from 'supertest';
import { jest } from '@jest/globals';
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
// POST /api/records
// ──────────────────────────────────────────────
describe('POST /api/records', () => {
  const validStudy = { mode: 'study', subject: '数学', duration_ms: 3600000 };
  const validRest = { mode: 'rest', duration_ms: 600000 };

  it('创建一条学习记录', async () => {
    const res = await request(app).post('/api/records').send(validStudy);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      mode: 'study',
      subject: '数学',
      duration_ms: 3600000,
      notes: '',
    });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('created_at');
  });

  it('创建一条休息记录（不含 subject）', async () => {
    const res = await request(app).post('/api/records').send(validRest);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      mode: 'rest',
      subject: null,
      duration_ms: 600000,
    });
  });

  it('创建带 notes 的记录', async () => {
    const res = await request(app).post('/api/records').send({
      ...validStudy,
      notes: '真题模拟',
    });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('真题模拟');
  });

  it('notes 为空字符串时保存为空字符串', async () => {
    const res = await request(app).post('/api/records').send({
      ...validStudy,
      notes: '',
    });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('');
  });

  it('不传 notes 字段时默认空字符串', async () => {
    const { notes, ...withoutNotes } = validStudy;
    const res = await request(app).post('/api/records').send(withoutNotes);
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('');
  });

  it('缺失 mode 返回 400', async () => {
    const { mode, ...noMode } = validStudy;
    const res = await request(app).post('/api/records').send(noMode);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('mode 值非法返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      ...validStudy,
      mode: 'walk',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('mode');
  });

  it('duration_ms 为 0 返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      ...validStudy,
      duration_ms: 0,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('duration_ms');
  });

  it('duration_ms 为负数返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      ...validStudy,
      duration_ms: -1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('duration_ms');
  });

  it('duration_ms 为字符串返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      ...validStudy,
      duration_ms: '3600000',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('duration_ms');
  });

  it('学习模式不传 subject 返回 400', async () => {
    const { subject, ...noSubject } = validStudy;
    const res = await request(app).post('/api/records').send(noSubject);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('subject');
  });

  it('休息模式可以没有 subject', async () => {
    const res = await request(app).post('/api/records').send(validRest);
    expect(res.status).toBe(200);
    expect(res.body.subject).toBeNull();
  });

  it('duration_ms 为 Infinity 应返回 400 或 500（无效数值）', async () => {
    const res = await request(app).post('/api/records').send({
      ...validStudy,
      duration_ms: Infinity,
    });
    // Infinity > 0 为 true，typeof 也是 'number'，但 SQLite 无法存储
    // 期望服务端给出错误（400 或 500 都可接受）
    expect([400, 500]).toContain(res.status);
  });
});

// ──────────────────────────────────────────────
// GET /api/records
// ──────────────────────────────────────────────
describe('GET /api/records', () => {
  it('无记录时返回空数组', async () => {
    const res = await request(app).get('/api/records');
    expect(res.status).toBe(200);
    expect(res.body.records).toEqual([]);
  });

  it('返回最近 200 条记录', async () => {
    const db = getDb();
    // 插入 3 条
    const insert = db.prepare(
      'INSERT INTO records (mode, subject, duration_ms) VALUES (?, ?, ?)'
    );
    for (let i = 0; i < 3; i++) {
      insert.run('study', '数学', 1000 * (i + 1));
    }

    const res = await request(app).get('/api/records');
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(3);
    // 默认倒序
    expect(res.body.records[0].duration_ms).toBe(3000);
  });

  it('按日期过滤记录', async () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    ).run('study', '数学', 1000, '2026-07-06 10:00:00');
    db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    ).run('study', '英语', 2000, '2026-07-05 10:00:00');

    const res = await request(app).get('/api/records?date=2026-07-06');
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0].subject).toBe('数学');
  });

  it('无效日期格式返回空数组', async () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    ).run('study', '数学', 1000, '2026-07-06 10:00:00');

    const res = await request(app).get('/api/records?date=not-a-date');
    expect(res.status).toBe(200);
    // SQLite DATE('not-a-date') → null, 不匹配任何行
    expect(res.body.records).toEqual([]);
  });

  it('不传 date 参数时返回所有记录（上限 200）', async () => {
    const db = getDb();
    const insert = db.prepare(
      'INSERT INTO records (mode, subject, duration_ms) VALUES (?, ?, ?)'
    );
    for (let i = 0; i < 5; i++) {
      insert.run('study', '数学', 1000);
    }

    const resNoDate = await request(app).get('/api/records');
    expect(resNoDate.status).toBe(200);
    expect(resNoDate.body.records).toHaveLength(5);
  });
});

// ──────────────────────────────────────────────
// GET /api/records/today
// ──────────────────────────────────────────────
describe('GET /api/records/today', () => {
  it('无记录时返回零值', async () => {
    const res = await request(app).get('/api/records/today');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total_study_ms: 0,
      total_rest_ms: 0,
      total_records: 0,
      by_subject: [],
    });
    expect(res.body).toHaveProperty('date');
  });

  it('正确汇总今日学习时长', async () => {
    const db = getDb();
    // 使用已知日期插入，然后 mock 系统时间对齐
    const today = '2026-07-06';
    const insert = db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    );
    insert.run('study', '数学', 3600000, `${today} 10:00:00`);
    insert.run('study', '英语', 1800000, `${today} 14:00:00`);
    insert.run('rest', null, 600000, `${today} 12:00:00`);

    // Mock 系统时间使端点使用 2026-07-06
    jest.useFakeTimers({ now: new Date(`${today}T23:00:00`) });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    expect(res.body.total_study_ms).toBe(3600000 + 1800000);
    expect(res.body.total_rest_ms).toBe(600000);
    expect(res.body.total_records).toBe(3);
  });

  it('按科目分组并按总时长降序', async () => {
    const db = getDb();
    const today = '2026-07-06';
    const insert = db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    );
    insert.run('study', '英语', 1800000, `${today} 10:00:00`);
    insert.run('study', '数学', 3600000, `${today} 11:00:00`);
    insert.run('study', '数学', 1200000, `${today} 14:00:00`);

    jest.useFakeTimers({ now: new Date(`${today}T23:00:00`) });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    expect(res.body.by_subject).toHaveLength(2);
    // 数学总时长优先（4800000 > 1800000）
    expect(res.body.by_subject[0].subject).toBe('数学');
    expect(res.body.by_subject[0].total_ms).toBe(4800000);
    expect(res.body.by_subject[0].count).toBe(2);
    expect(res.body.by_subject[1].subject).toBe('英语');
    expect(res.body.by_subject[1].total_ms).toBe(1800000);
    expect(res.body.by_subject[1].count).toBe(1);
  });

  it('时间边界：23:59:59 的记录算今天', async () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    ).run('study', '数学', 3600000, '2026-07-06 23:59:59');

    jest.useFakeTimers({ now: new Date('2026-07-06T23:59:59') });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    expect(res.body.total_study_ms).toBe(3600000);
    expect(res.body.total_records).toBe(1);
  });

  it('时间边界：00:00:00 的记录也算今天', async () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    ).run('study', '数学', 3600000, '2026-07-06 00:00:00');

    jest.useFakeTimers({ now: new Date('2026-07-06T12:00:00') });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    expect(res.body.total_study_ms).toBe(3600000);
  });

  it('昨日记录不统计到今天', async () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    ).run('study', '数学', 3600000, '2026-07-05 23:59:58');

    jest.useFakeTimers({ now: new Date('2026-07-06T12:00:00') });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    expect(res.body.total_study_ms).toBe(0);
    expect(res.body.total_records).toBe(0);
  });

  it('凌晨 0~8 点用本地时间而非 UTC 算今天', async () => {
    const db = getDb();
    // 模拟北京时间凌晨 1~2 点创建的记录（UTC+8）
    const todayLocal = '2026-07-07';
    db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    ).run('study', '数学', 3600000, `${todayLocal} 01:00:00`);
    db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, created_at)
       VALUES (?, ?, ?, ?)`
    ).run('study', '英语', 1800000, `${todayLocal} 02:00:00`);

    // Mock 为北京时间凌晨 3:00 —— 此时 UTC 日期仍是前一天 (2026-07-06)
    jest.useFakeTimers({ now: new Date(`${todayLocal}T03:00:00`) });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    // 旧代码用 UTC 算今天会返回 0，新代码用本地时间应正确统计到
    expect(res.body.total_study_ms).toBe(3600000 + 1800000);
    expect(res.body.total_records).toBe(2);
    expect(res.body.by_subject).toHaveLength(2);
  });
});
