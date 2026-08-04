import request from 'supertest';
import { getDb, closeDb } from '../database.js';
import { app } from '../index.js';

/**
 * 提取标签名数组（供顺序断言）
 * @param {Array<{ name: string }>} list - 标签数组
 * @returns {string[]}
 */
const tagNames = (list) => list.map(t => t.name);

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
// GET /api/tags
// ──────────────────────────────────────────────
describe('GET /api/tags', () => {
  it('无标签时返回空数组', async () => {
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('返回所有标签', async () => {
    const db = getDb();
    db.prepare('INSERT INTO tags (name) VALUES (?)').run('高数');
    db.prepare('INSERT INTO tags (name) VALUES (?)').run('线代');

    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(tagNames(res.body)).toEqual(expect.arrayContaining(['高数', '线代']));
  });

  it('新标签排在末尾（创建顺序）', async () => {
    await request(app).post('/api/tags').send({ name: '高数' });
    await request(app).post('/api/tags').send({ name: '线代' });
    await request(app).post('/api/tags').send({ name: '真题' });

    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(200);
    expect(tagNames(res.body)).toEqual(['高数', '线代', '真题']);
  });

  it('通过记录保存创建的标签也排在末尾', async () => {
    await request(app).post('/api/tags').send({ name: '高数' });
    await request(app).post('/api/tags').send({ name: '线代' });
    await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['错题'],
    });

    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(200);
    expect(tagNames(res.body)).toEqual(['高数', '线代', '错题']);
  });
});

// ──────────────────────────────────────────────
// PUT /api/tags/order
// ──────────────────────────────────────────────
describe('PUT /api/tags/order', () => {
  /** 创建三个标签，返回按创建顺序的 id 数组 */
  async function createThree() {
    const a = (await request(app).post('/api/tags').send({ name: '高数' })).body;
    const b = (await request(app).post('/api/tags').send({ name: '线代' })).body;
    const c = (await request(app).post('/api/tags').send({ name: '真题' })).body;
    return [a, b, c];
  }

  it('重排后 GET 返回新顺序', async () => {
    const [a, b, c] = await createThree();

    const res = await request(app).put('/api/tags/order').send({ ids: [c.id, a.id, b.id] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await request(app).get('/api/tags');
    expect(tagNames(list.body)).toEqual(['真题', '高数', '线代']);
  });

  it('缺 id（非全量）返回 400 且顺序不变', async () => {
    const [a, , c] = await createThree();

    const res = await request(app).put('/api/tags/order').send({ ids: [c.id, a.id] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('全部');

    const list = await request(app).get('/api/tags');
    expect(tagNames(list.body)).toEqual(['高数', '线代', '真题']);
  });

  it('包含不存在的 id 返回 400', async () => {
    const [a, , c] = await createThree();

    const res = await request(app).put('/api/tags/order').send({ ids: [c.id, a.id, 999999] });
    expect(res.status).toBe(400);
  });

  it('ids 含重复返回 400', async () => {
    const [a, b, c] = await createThree();

    const res = await request(app).put('/api/tags/order').send({ ids: [a.id, a.id, b.id, c.id] });
    expect(res.status).toBe(400);
  });

  it('ids 非数组返回 400', async () => {
    const res = await request(app).put('/api/tags/order').send({ ids: '高数' });
    expect(res.status).toBe(400);
  });

  it('ids 含非正整数返回 400', async () => {
    const [a, b] = await createThree();

    const res = await request(app).put('/api/tags/order').send({ ids: [a.id, b.id, 0] });
    expect(res.status).toBe(400);
  });

  it('空标签库提交空数组合法（幂等无操作）', async () => {
    const res = await request(app).put('/api/tags/order').send({ ids: [] });
    expect(res.status).toBe(200);
  });
});

// ──────────────────────────────────────────────
// POST /api/tags
// ──────────────────────────────────────────────
describe('POST /api/tags', () => {
  it('创建新标签返回 201', async () => {
    const res = await request(app).post('/api/tags').send({ name: '高数' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: '高数' });
    expect(res.body).toHaveProperty('id');
  });

  it('重名幂等复用：返回已有标签且不重复创建', async () => {
    const first = await request(app).post('/api/tags').send({ name: '高数' });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/tags').send({ name: '高数' });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const db = getDb();
    const count = /** @type {{ c: number }} */ (db.prepare('SELECT COUNT(*) as c FROM tags').get());
    expect(count.c).toBe(1);
  });

  it('名称前后空格被 trim', async () => {
    const res = await request(app).post('/api/tags').send({ name: '  高数  ' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('高数');
  });

  it('空名返回 400', async () => {
    const res = await request(app).post('/api/tags').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能为空');
  });

  it('缺失 name 返回 400', async () => {
    const res = await request(app).post('/api/tags').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能为空');
  });

  it('超过 12 字返回 400', async () => {
    const res = await request(app).post('/api/tags').send({ name: '一二三四五六七八九十一二三四' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('12');
  });
});

// ──────────────────────────────────────────────
// DELETE /api/tags/:id
// ──────────────────────────────────────────────
describe('DELETE /api/tags/:id', () => {
  it('删除标签成功', async () => {
    const created = await request(app).post('/api/tags').send({ name: '高数' });
    const res = await request(app).delete(`/api/tags/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const db = getDb();
    const count = /** @type {{ c: number }} */ (db.prepare('SELECT COUNT(*) as c FROM tags').get());
    expect(count.c).toBe(0);
  });

  it('删除标签级联清除记录的关联', async () => {
    const tag = (await request(app).post('/api/tags').send({ name: '高数' })).body;
    const rec = (await request(app).post('/api/records').send({
      mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数'],
    })).body;
    expect(rec.tags).toEqual(['高数']);

    await request(app).delete(`/api/tags/${tag.id}`);

    const list = await request(app).get('/api/records');
    expect(list.body.records[0].tags).toEqual([]);
  });

  it('标签不存在返回 404', async () => {
    const res = await request(app).delete('/api/tags/999999');
    expect(res.status).toBe(404);
  });

  it('id 非数字返回 404', async () => {
    const res = await request(app).delete('/api/tags/abc');
    expect(res.status).toBe(404);
  });
});
