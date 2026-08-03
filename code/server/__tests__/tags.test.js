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
    expect(res.body.map(t => t.name)).toEqual(expect.arrayContaining(['高数', '线代']));
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
    const count = db.prepare('SELECT COUNT(*) as c FROM tags').get();
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
    const count = db.prepare('SELECT COUNT(*) as c FROM tags').get();
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
