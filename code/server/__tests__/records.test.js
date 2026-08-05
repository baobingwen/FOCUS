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

  it('创建带 segments 和 paused_ms 的学习记录', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study',
      subject: '数学',
      duration_ms: 600000,
      paused_ms: 300000,
      segments: [
        { type: 'study', duration_ms: 600000 },
        { type: 'pause', duration_ms: 300000 },
        { type: 'study', duration_ms: 900000 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'study' }),
    ]));
    expect(res.body.paused_ms).toBe(300000);
  });

  it('不传 segments/paused_ms 时兼容老数据', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000,
    });
    expect(res.status).toBe(200);
    expect(res.body.segments).toBeNull();
    expect(res.body.paused_ms).toBe(0);
  });

  it('休息模式传 paused_ms 被忽略', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'rest', duration_ms: 600000, paused_ms: 99999,
    });
    expect(res.status).toBe(200);
    expect(res.body.paused_ms).toBe(0);
  });
});

// ──────────────────────────────────────────────
// PATCH /api/records/:id
// ──────────────────────────────────────────────
describe('PATCH /api/records/:id', () => {
  /** 创建一条学习记录，返回完整记录对象 */
  async function createStudy(overrides = {}) {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000,
      ...overrides,
    });
    return res.body;
  }

  /** 创建一条休息记录，返回完整记录对象 */
  async function createRest() {
    const res = await request(app).post('/api/records').send({
      mode: 'rest', duration_ms: 600000,
    });
    return res.body;
  }

  it('修改学习记录的备注', async () => {
    const rec = await createStudy({ notes: '旧备注' });
    const res = await request(app).patch(`/api/records/${rec.id}`).send({ notes: '新备注' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: rec.id, mode: 'study', notes: '新备注' });
  });

  it('notes 前后空格被 trim', async () => {
    const rec = await createStudy({ notes: '旧备注' });
    const res = await request(app).patch(`/api/records/${rec.id}`).send({ notes: '  高数第三章  ' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('高数第三章');
  });

  it('空字符串保存等于清空备注', async () => {
    const rec = await createStudy({ notes: '旧备注' });
    const res = await request(app).patch(`/api/records/${rec.id}`).send({ notes: '' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('');
  });

  it('记录不存在返回 404', async () => {
    const res = await request(app).patch('/api/records/999999').send({ notes: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('id 非数字返回 404', async () => {
    const res = await request(app).patch('/api/records/abc').send({ notes: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('休息记录不可修改备注，返回 400', async () => {
    const rec = await createRest();
    const res = await request(app).patch(`/api/records/${rec.id}`).send({ notes: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('学习记录');
  });

  it('notes 非字符串返回 400', async () => {
    const rec = await createStudy();
    const res = await request(app).patch(`/api/records/${rec.id}`).send({ notes: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('空 body 返回 200（notes/tags 均可选，什么都不传为无操作）', async () => {
    const rec = await createStudy({ notes: '原备注' });
    const res = await request(app).patch(`/api/records/${rec.id}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('原备注');
  });

  it('修改后返回的记录保留 segments 解析', async () => {
    const createRes = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 600000,
      paused_ms: 300000,
      segments: [
        { type: 'study', duration_ms: 600000 },
        { type: 'pause', duration_ms: 300000 },
      ],
    });
    const rec = createRes.body;
    const res = await request(app).patch(`/api/records/${rec.id}`).send({ notes: '分段测试' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('分段测试');
    expect(res.body.segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'pause' }),
    ]));
    expect(res.body.paused_ms).toBe(300000);
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
      total_pages: 0,
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

  it('暂停时间 (paused_ms) 计入今日总休息', async () => {
    const db = getDb();
    const today = '2026-07-06';
    const insert = db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, paused_ms, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    // 一条手动休息 10min
    insert.run('rest', null, 600000, 0, `${today} 10:00:00`);
    // 一条学习记录含暂停 5min
    insert.run('study', '数学', 1800000, 300000, `${today} 11:00:00`);

    jest.useFakeTimers({ now: new Date(`${today}T23:00:00`) });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    // 总休息 = 手动 10min + 暂停 5min = 15min
    expect(res.body.total_rest_ms).toBe(900000);
    expect(res.body.total_study_ms).toBe(1800000);
    expect(res.body.total_records).toBe(2);
  });

  it('有 paused_ms 但无手动 rest 时，休息统计只来自暂停', async () => {
    const db = getDb();
    const today = '2026-07-06';
    db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, paused_ms, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run('study', '英语', 1200000, 600000, `${today} 14:00:00`);

    jest.useFakeTimers({ now: new Date(`${today}T23:00:00`) });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    expect(res.body.total_rest_ms).toBe(600000); // 只有暂停
    expect(res.body.total_study_ms).toBe(1200000);
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

// ──────────────────────────────────────────────
// records × 标签
// ──────────────────────────────────────────────
describe('records 与标签联动', () => {
  it('POST 学习记录带 tags：自动建标签并返回 tags', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数', '极限'],
    });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(['高数', '极限']);
  });

  it('POST 带 tags 的记录会自动建立标签库条目', async () => {
    await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数'],
    });
    const tags = await request(app).get('/api/tags');
    expect(tags.body.map(t => t.name)).toContain('高数');
  });

  it('POST tags 重名去重', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数', '高数'],
    });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(['高数']);
  });

  it('POST 休息记录带 tags 被忽略', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'rest', duration_ms: 600000, tags: ['高数'],
    });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]);
  });

  it('POST tags 非数组返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: '高数',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('GET 记录返回每条的 tags 数组', async () => {
    await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数', '线代'],
    });
    await request(app).post('/api/records').send({
      mode: 'rest', duration_ms: 600000,
    });

    const res = await request(app).get('/api/records');
    expect(res.status).toBe(200);
    const study = res.body.records.find(r => r.mode === 'study');
    expect(study.tags).toEqual(['高数', '线代']);
    const rest = res.body.records.find(r => r.mode === 'rest');
    expect(rest.tags).toEqual([]);
  });

  it('PATCH 整组替换标签', async () => {
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数'],
    })).body;

    const res = await request(app).patch(`/api/records/${rec.id}`).send({ tags: ['极限', '导数'] });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(['极限', '导数']);
  });

  it('PATCH tags 为空数组清空标签', async () => {
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数'],
    })).body;

    const res = await request(app).patch(`/api/records/${rec.id}`).send({ tags: [] });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]);
  });

  it('PATCH 只传 tags 不影响 notes', async () => {
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, notes: '原备注', tags: ['高数'],
    })).body;

    const res = await request(app).patch(`/api/records/${rec.id}`).send({ tags: ['线代'] });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(['线代']);
    expect(res.body.notes).toBe('原备注');
  });

  it('PATCH 只传 notes 不影响标签', async () => {
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数'],
    })).body;

    const res = await request(app).patch(`/api/records/${rec.id}`).send({ notes: '新备注' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('新备注');
    expect(res.body.tags).toEqual(['高数']);
  });

  it('PATCH tags 非数组返回 400', async () => {
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000,
    })).body;

    const res = await request(app).patch(`/api/records/${rec.id}`).send({ tags: 123 });
    expect(res.status).toBe(400);
  });

  it('PATCH 休息记录带标签返回 400', async () => {
    const rest = (await request(app).post('/api/records').send({
      mode: 'rest', duration_ms: 600000,
    })).body;

    const res = await request(app).patch(`/api/records/${rest.id}`).send({ tags: ['高数'] });
    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────
// records × 页数 (pages)
// ──────────────────────────────────────────────
describe('records × 页数', () => {
  it('POST 学习记录带 pages：保存并返回 pages', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: 30,
    });
    expect(res.status).toBe(200);
    expect(res.body.pages).toBe(30);
  });

  it('POST 学习记录不传 pages：pages 为 null', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000,
    });
    expect(res.status).toBe(200);
    expect(res.body.pages).toBeNull();
  });

  it('POST pages 为 0 返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: 0,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pages');
  });

  it('POST pages 为负数返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: -5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pages');
  });

  it('POST pages 为小数返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: 3.5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pages');
  });

  it('POST pages 为字符串返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: '30',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pages');
  });

  it('POST pages 超过 9999 返回 400', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: 10000,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pages');
  });

  it('POST pages 为 9999 合法', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: 9999,
    });
    expect(res.status).toBe(200);
    expect(res.body.pages).toBe(9999);
  });

  it('POST 休息记录带 pages 被忽略（存 null）', async () => {
    const res = await request(app).post('/api/records').send({
      mode: 'rest', duration_ms: 600000, pages: 30,
    });
    expect(res.status).toBe(200);
    expect(res.body.pages).toBeNull();
  });

  it('GET 记录返回每条的 pages', async () => {
    await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: 30,
    });
    await request(app).post('/api/records').send({
      mode: 'study', subject: '英语', duration_ms: 3600000,
    });

    const res = await request(app).get('/api/records');
    expect(res.status).toBe(200);
    const withPages = res.body.records.find(r => r.subject === '数学');
    expect(withPages.pages).toBe(30);
    const withoutPages = res.body.records.find(r => r.subject === '英语');
    expect(withoutPages.pages).toBeNull();
  });

  it('PATCH 修改学习记录的 pages', async () => {
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: 10,
    })).body;

    const res = await request(app).patch(`/api/records/${rec.id}`).send({ pages: 25 });
    expect(res.status).toBe(200);
    expect(res.body.pages).toBe(25);
  });

  it('PATCH pages 为 null 清空页数', async () => {
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, pages: 10,
    })).body;

    const res = await request(app).patch(`/api/records/${rec.id}`).send({ pages: null });
    expect(res.status).toBe(200);
    expect(res.body.pages).toBeNull();
  });

  it('PATCH pages 非法值返回 400', async () => {
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000,
    })).body;

    for (const bad of [0, -1, 1.5, '30', 10000]) {
      const res = await request(app).patch(`/api/records/${rec.id}`).send({ pages: bad });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('pages');
    }
  });

  it('PATCH 休息记录带 pages 返回 400', async () => {
    const rest = (await request(app).post('/api/records').send({
      mode: 'rest', duration_ms: 600000,
    })).body;

    const res = await request(app).patch(`/api/records/${rest.id}`).send({ pages: 30 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('学习记录');
  });

  it('PATCH 只传 pages 不影响 notes 和 tags', async () => {
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, notes: '原备注', tags: ['高数'],
    })).body;

    const res = await request(app).patch(`/api/records/${rec.id}`).send({ pages: 15 });
    expect(res.status).toBe(200);
    expect(res.body.pages).toBe(15);
    expect(res.body.notes).toBe('原备注');
    expect(res.body.tags).toEqual(['高数']);
  });

  it('/today 汇总今日总页数（NULL 自动忽略）', async () => {
    const db = getDb();
    const today = '2026-07-06';
    const insert = db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, pages, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    insert.run('study', '数学', 3600000, 30, `${today} 10:00:00`);
    insert.run('study', '英语', 1800000, 20, `${today} 14:00:00`);
    // 无页数记录 + 休息记录不参与
    insert.run('study', '专业课', 1200000, null, `${today} 16:00:00`);
    insert.run('rest', null, 600000, null, `${today} 12:00:00`);

    jest.useFakeTimers({ now: new Date(`${today}T23:00:00`) });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    expect(res.body.total_pages).toBe(50);
  });

  it('/today 按科目分组带 total_pages', async () => {
    const db = getDb();
    const today = '2026-07-06';
    const insert = db.prepare(
      `INSERT INTO records (mode, subject, duration_ms, pages, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    insert.run('study', '数学', 3600000, 30, `${today} 10:00:00`);
    insert.run('study', '数学', 1200000, 15, `${today} 14:00:00`);
    insert.run('study', '英语', 1800000, 20, `${today} 11:00:00`);
    // 无页数记录计入科目分组但 pages 为 0
    insert.run('study', '英语', 600000, null, `${today} 15:00:00`);

    jest.useFakeTimers({ now: new Date(`${today}T23:00:00`) });
    const res = await request(app).get('/api/records/today');
    jest.useRealTimers();

    expect(res.status).toBe(200);
    const math = res.body.by_subject.find(s => s.subject === '数学');
    expect(math.total_pages).toBe(45);
    const english = res.body.by_subject.find(s => s.subject === '英语');
    expect(english.total_pages).toBe(20);
  });
});
