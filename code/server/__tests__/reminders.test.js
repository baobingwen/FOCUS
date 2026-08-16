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
// GET /api/reminders
// ──────────────────────────────────────────────
describe('GET /api/reminders', () => {
  it('空库返回空数组', async () => {
    const res = await request(app).get('/api/reminders');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('按 sort_order, id 排序返回全部条目', async () => {
    const db = getDb();
    db.prepare('INSERT INTO reminder_items (content, sort_order) VALUES (?, ?)').run('第一条', 0);
    db.prepare('INSERT INTO reminder_items (content, sort_order) VALUES (?, ?)').run('第三条', 2);
    db.prepare('INSERT INTO reminder_items (content, sort_order) VALUES (?, ?)').run('第二条', 1);

    const res = await request(app).get('/api/reminders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map(r => r.content)).toEqual(['第一条', '第二条', '第三条']);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('sort_order');
    expect(res.body[0]).toHaveProperty('created_at');
  });
});

// ──────────────────────────────────────────────
// POST /api/reminders
// ──────────────────────────────────────────────
describe('POST /api/reminders', () => {
  it('新增一条复习提醒成功', async () => {
    const res = await request(app).post('/api/reminders').send({ content: '复习的关键在于反复多次和全面' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('复习的关键在于反复多次和全面');
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('sort_order');
  });

  it('内容自动 trim', async () => {
    const res = await request(app).post('/api/reminders').send({ content: '  专注当下  ' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('专注当下');
  });

  it('新条目 sort_order 递增（排末尾）', async () => {
    const first = await request(app).post('/api/reminders').send({ content: '第一条' });
    const second = await request(app).post('/api/reminders').send({ content: '第二条' });
    expect(second.body.sort_order).toBe(first.body.sort_order + 1);
  });

  it('内容为空返回 400', async () => {
    const res = await request(app).post('/api/reminders').send({ content: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能为空');
  });

  it('内容仅为空白字符返回 400', async () => {
    const res = await request(app).post('/api/reminders').send({ content: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能为空');
  });

  it('不传 content 字段返回 400', async () => {
    const res = await request(app).post('/api/reminders').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能为空');
  });

  it('内容超长返回 400', async () => {
    const res = await request(app).post('/api/reminders').send({ content: '长'.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能超过 200 字');
  });

  it('内容恰好 200 字返回 201（边界合法）', async () => {
    const res = await request(app).post('/api/reminders').send({ content: '长'.repeat(200) });
    expect(res.status).toBe(201);
  });
});

// ──────────────────────────────────────────────
// PATCH /api/reminders/:id
// ──────────────────────────────────────────────
describe('PATCH /api/reminders/:id', () => {
  it('修改一条复习提醒成功', async () => {
    const created = await request(app).post('/api/reminders').send({ content: '旧内容' });

    const res = await request(app).patch(`/api/reminders/${created.body.id}`).send({ content: '新内容' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('新内容');
    expect(res.body.id).toBe(created.body.id);

    // 确认列表已更新
    const list = await request(app).get('/api/reminders');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].content).toBe('新内容');
  });

  it('修改不存在的条目返回 404', async () => {
    const res = await request(app).patch('/api/reminders/99999').send({ content: '内容' });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('不存在');
  });

  it('非数字 id 返回 404', async () => {
    const res = await request(app).patch('/api/reminders/abc').send({ content: '内容' });
    expect(res.status).toBe(404);
  });

  it('内容为空返回 400', async () => {
    const created = await request(app).post('/api/reminders').send({ content: '内容' });
    const res = await request(app).patch(`/api/reminders/${created.body.id}`).send({ content: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('不能为空');
  });

  it('修改后 sort_order 保持不变', async () => {
    const created = await request(app).post('/api/reminders').send({ content: '第一条' });
    const res = await request(app).patch(`/api/reminders/${created.body.id}`).send({ content: '改后' });
    expect(res.body.sort_order).toBe(created.body.sort_order);
  });
});

// ──────────────────────────────────────────────
// DELETE /api/reminders/:id
// ──────────────────────────────────────────────
describe('DELETE /api/reminders/:id', () => {
  it('删除一条复习提醒成功', async () => {
    const created = await request(app).post('/api/reminders').send({ content: '待删除' });

    const res = await request(app).delete(`/api/reminders/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 确认已从列表移除
    const list = await request(app).get('/api/reminders');
    expect(list.body).toHaveLength(0);
  });

  it('删除不存在的条目返回 404', async () => {
    const res = await request(app).delete('/api/reminders/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('不存在');
  });

  it('非数字 id 返回 404', async () => {
    const res = await request(app).delete('/api/reminders/abc');
    expect(res.status).toBe(404);
  });

  it('多条删除互不影响', async () => {
    const a = await request(app).post('/api/reminders').send({ content: '甲' });
    await request(app).post('/api/reminders').send({ content: '乙' });

    await request(app).delete(`/api/reminders/${a.body.id}`);
    const list = await request(app).get('/api/reminders');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].content).toBe('乙');
  });
});
