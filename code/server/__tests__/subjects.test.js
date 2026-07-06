import request from 'supertest';
import { getDb, closeDb } from '../database.js';
import { app } from '../index.js';

beforeEach(() => {
  closeDb();
  getDb();
});

afterAll(() => {
  closeDb();
});

// ──────────────────────────────────────────────
// GET /api/subjects
// ──────────────────────────────────────────────
describe('GET /api/subjects', () => {
  it('返回默认的三个科目（数学、英语、专业课）', async () => {
    const res = await request(app).get('/api/subjects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].name).toBe('数学');
    expect(res.body[1].name).toBe('英语');
    expect(res.body[2].name).toBe('专业课');
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('sort_order');
  });
});

// ──────────────────────────────────────────────
// POST /api/subjects
// ──────────────────────────────────────────────
describe('POST /api/subjects', () => {
  it('创建新科目成功', async () => {
    const res = await request(app).post('/api/subjects').send({ name: '政治' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('政治');
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('sort_order');

    // 确认已加入列表
    const list = await request(app).get('/api/subjects');
    expect(list.body).toHaveLength(4);
  });

  it('创建重复科目返回 409', async () => {
    await request(app).post('/api/subjects').send({ name: '政治' });
    const res = await request(app).post('/api/subjects').send({ name: '政治' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('已存在');
  });

  it('科目名为空字符串返回 400', async () => {
    const res = await request(app).post('/api/subjects').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能为空');
  });

  it('科目名仅为空白字符返回 400', async () => {
    const res = await request(app).post('/api/subjects').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能为空');
  });

  it('不传 name 字段返回 400', async () => {
    const res = await request(app).post('/api/subjects').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能为空');
  });

  it('新建科目 sort_order 递增', async () => {
    const first = await request(app).post('/api/subjects').send({ name: '政治' });
    const second = await request(app).post('/api/subjects').send({ name: '物理' });
    expect(second.body.sort_order).toBe(first.body.sort_order + 1);
  });
});

// ──────────────────────────────────────────────
// DELETE /api/subjects/:id
// ──────────────────────────────────────────────
describe('DELETE /api/subjects/:id', () => {
  it('删除默认科目（数学）返回 403', async () => {
    const list = await request(app).get('/api/subjects');
    const math = list.body.find((s) => s.name === '数学');

    const res = await request(app).delete(`/api/subjects/${math.id}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('不能删除默认科目');

    // 确认未被删除
    const after = await request(app).get('/api/subjects');
    expect(after.body).toHaveLength(3);
  });

  it('删除英语也返回 403', async () => {
    const list = await request(app).get('/api/subjects');
    const eng = list.body.find((s) => s.name === '英语');

    const res = await request(app).delete(`/api/subjects/${eng.id}`);
    expect(res.status).toBe(403);
  });

  it('删除专业课也返回 403', async () => {
    const list = await request(app).get('/api/subjects');
    const major = list.body.find((s) => s.name === '专业课');

    const res = await request(app).delete(`/api/subjects/${major.id}`);
    expect(res.status).toBe(403);
  });

  it('删除不存在的科目返回 404', async () => {
    const res = await request(app).delete('/api/subjects/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('不存在');
  });

  it('删除自定义科目成功', async () => {
    const created = await request(app).post('/api/subjects').send({ name: '政治' });

    const res = await request(app).delete(`/api/subjects/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 确认已从列表移除
    const list = await request(app).get('/api/subjects');
    expect(list.body).toHaveLength(3);
  });

  it('非数字 id 返回 404（数据库查询无结果）', async () => {
    // Express 5 params 如果是字符串且不是数字, better-sqlite3 的 .get(id) 会找 id = 0 或不匹配
    const res = await request(app).delete('/api/subjects/abc');
    expect(res.status).toBe(404);
  });
});
