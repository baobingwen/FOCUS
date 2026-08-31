import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordsApi,
  subjectsApi,
  tagsApi,
  remindersApi,
  exportApi,
  importApi,
  __closeLocalDb,
} from './apiLocal';

// 每个测试前重置数据库（关闭连接 + 删除库；重新建库时会再次写入默认科目种子）
beforeEach(async () => {
  __closeLocalDb();
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('focus-db');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

/**
 * 构造合法的导入 payload（五表）
 * @param {object} overrides - 覆盖 data 各表
 * @returns {object}
 */
function makePayload(overrides = {}) {
  return {
    app: 'FOCUS',
    version: '0.0.0',
    exported_at: '2026-01-01 00:00:00',
    data: {
      records: [],
      subjects: [],
      tags: [],
      record_tags: [],
      reminder_items: [],
      ...overrides,
    },
  };
}

describe('subjectsApi', () => {
  it('首次建库写入默认科目（数学/英语/专业课）', async () => {
    const list = await subjectsApi.list();
    expect(list.map((s) => s.name)).toEqual(['数学', '英语', '专业课']);
    expect(list.map((s) => s.sort_order)).toEqual([0, 1, 2]);
  });

  it('create: 新科目排末尾', async () => {
    const created = await subjectsApi.create('政治');
    expect(created).toEqual({ id: 4, name: '政治', sort_order: 3 });
    const list = await subjectsApi.list();
    expect(list.map((s) => s.name)).toEqual(['数学', '英语', '专业课', '政治']);
  });

  it('create: 重名抛「科目已存在」', async () => {
    await expect(subjectsApi.create('数学')).rejects.toThrow('科目已存在');
  });

  it('create: 空名抛「科目名不能为空」', async () => {
    await expect(subjectsApi.create('  ')).rejects.toThrow('科目名不能为空');
  });

  it('delete: 默认科目不可删', async () => {
    const [math] = await subjectsApi.list();
    await expect(subjectsApi.delete(math.id)).rejects.toThrow('不能删除默认科目');
  });

  it('delete: 自定义科目可删，删除后列表不含', async () => {
    const created = await subjectsApi.create('政治');
    await expect(subjectsApi.delete(created.id)).resolves.toEqual({ success: true });
    const names = (await subjectsApi.list()).map((s) => s.name);
    expect(names).not.toContain('政治');
  });

  it('delete: 不存在的科目抛「科目不存在」', async () => {
    await expect(subjectsApi.delete(999)).rejects.toThrow('科目不存在');
  });
});

describe('tagsApi', () => {
  it('list: 初始为空', async () => {
    expect(await tagsApi.list()).toEqual([]);
  });

  it('create: 新标签排末尾', async () => {
    const t1 = await tagsApi.create('高数');
    const t2 = await tagsApi.create('线代');
    expect(t1).toEqual({ id: 1, name: '高数', sort_order: 0 });
    expect(t2).toEqual({ id: 2, name: '线代', sort_order: 1 });
    expect((await tagsApi.list()).map((t) => t.name)).toEqual(['高数', '线代']);
  });

  it('create: 重名幂等复用，返回已有标签', async () => {
    const first = await tagsApi.create('高数');
    const second = await tagsApi.create(' 高数 '); // trim 后同名
    expect(second).toEqual(first);
    expect((await tagsApi.list()).length).toBe(1);
  });

  it('create: 空名抛「标签名不能为空」', async () => {
    await expect(tagsApi.create('')).rejects.toThrow('标签名不能为空');
  });

  it('create: 超过 12 字抛「标签名不能超过 12 字」', async () => {
    await expect(tagsApi.create('一二三四五六七八九十甲乙丙')).rejects.toThrow('标签名不能超过 12 字');
  });

  it('reorder: 全量重排后 list 按新顺序', async () => {
    await tagsApi.create('高数');
    await tagsApi.create('线代');
    await tagsApi.create('真题');
    const all = await tagsApi.list();
    await tagsApi.reorder([all[2].id, all[0].id, all[1].id]);
    const after = await tagsApi.list();
    expect(after.map((t) => t.name)).toEqual(['真题', '高数', '线代']);
    expect(after.map((t) => t.sort_order)).toEqual([0, 1, 2]);
  });

  it('reorder: 非全量抛「ids 必须包含全部标签（全量重排）」', async () => {
    await tagsApi.create('高数');
    await tagsApi.create('线代');
    const [first] = await tagsApi.list();
    await expect(tagsApi.reorder([first.id])).rejects.toThrow('ids 必须包含全部标签（全量重排）');
  });

  it('delete: 级联清空记录的关联（记录 tags 变空）', async () => {
    const tag = await tagsApi.create('高数');
    await recordsApi.create({
      mode: 'study', subject: '数学', duration_ms: 1000, tags: ['高数'],
    });
    await tagsApi.delete(tag.id);
    expect((await tagsApi.list()).length).toBe(0);
    const { records } = await recordsApi.list();
    expect(records[0].tags).toEqual([]);
  });
});

describe('recordsApi.create', () => {
  it('学习记录：保存并返回完整记录（segments 数组 / created_at 格式 / tags 空数组）', async () => {
    const result = await recordsApi.create({
      mode: 'study',
      subject: '数学',
      duration_ms: 60000,
      paused_ms: 10000,
      segments: [{ type: 'study', start: 1, end: 2 }],
      notes: '高数第三章',
      tags: [],
      pages: 30,
    });
    expect(result.id).toBe(1);
    expect(result.mode).toBe('study');
    expect(result.subject).toBe('数学');
    expect(result.duration_ms).toBe(60000);
    expect(result.paused_ms).toBe(10000);
    expect(result.pages).toBe(30);
    expect(result.notes).toBe('高数第三章');
    expect(result.segments).toEqual([{ type: 'study', start: 1, end: 2 }]);
    expect(result.tags).toEqual([]);
    expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('学习记录：tags 幂等创建并关联', async () => {
    const r1 = await recordsApi.create({
      mode: 'study', subject: '数学', duration_ms: 1000, tags: ['高数', '线代'],
    });
    const r2 = await recordsApi.create({
      mode: 'study', subject: '数学', duration_ms: 1000, tags: ['高数'],
    });
    expect(r1.tags).toEqual(['高数', '线代']);
    expect(r2.tags).toEqual(['高数']);
    // 标签库只创建一次
    expect((await tagsApi.list()).map((t) => t.name)).toEqual(['高数', '线代']);
  });

  it('休息记录：subject 为 null、tags 为空、pages 为 null', async () => {
    const result = await recordsApi.create({ mode: 'rest', duration_ms: 5000 });
    expect(result.mode).toBe('rest');
    expect(result.subject).toBeNull();
    expect(result.paused_ms).toBe(0);
    expect(result.pages).toBeNull();
    expect(result.segments).toBeNull();
    expect(result.tags).toEqual([]);
  });

  it('校验：mode 无效抛错', async () => {
    await expect(recordsApi.create({ mode: 'jog', duration_ms: 1000 }))
      .rejects.toThrow('无效的 mode，必须为 study 或 rest');
  });

  it('校验：duration_ms 无效抛错', async () => {
    await expect(recordsApi.create({ mode: 'study', subject: '数学', duration_ms: 0 }))
      .rejects.toThrow('无效的 duration_ms');
  });

  it('校验：学习模式缺 subject 抛错', async () => {
    await expect(recordsApi.create({ mode: 'study', duration_ms: 1000 }))
      .rejects.toThrow('学习模式需要指定 subject');
  });

  it('校验：pages 无效抛错', async () => {
    await expect(recordsApi.create({ mode: 'study', subject: '数学', duration_ms: 1000, pages: 0 }))
      .rejects.toThrow('无效的 pages，必须为 1~9999 的整数');
  });
});

describe('recordsApi.list', () => {
  it('按日期过滤（仅返回该日记录）', async () => {
    const today = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
    const yesterday = new Date(Date.now() - 86400000);
    const yStr = `${yesterday.getFullYear()}-${p(yesterday.getMonth() + 1)}-${p(yesterday.getDate())}`;

    // 先导入（会清空仓库）再创建今天的记录
    await importApi.submit(makePayload({
      records: [{
        id: 99, mode: 'study', subject: '英语', duration_ms: 2000,
        notes: '', segments: null, paused_ms: 0, pages: null, created_at: `${yStr} 10:00:00`,
      }],
    }));
    await recordsApi.create({ mode: 'study', subject: '数学', duration_ms: 1000 });

    const todayRes = await recordsApi.list(todayStr);
    expect(todayRes.records.length).toBe(1);
    expect(todayRes.records[0].subject).toBe('数学');
    const yRes = await recordsApi.list(yStr);
    expect(yRes.records.length).toBe(1);
    expect(yRes.records[0].subject).toBe('英语');
  });

  it('按 created_at 倒序返回', async () => {
    const today = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
    // 先导入（会清空仓库）再创建较晚的记录，验证倒序
    await importApi.submit(makePayload({
      records: [{
        id: 1, mode: 'study', subject: '英语', duration_ms: 2000,
        notes: '', segments: null, paused_ms: 0, pages: null, created_at: `${todayStr} 09:00:00`,
      }],
    }));
    await recordsApi.create({ mode: 'study', subject: '数学', duration_ms: 1000 });
    const { records } = await recordsApi.list(todayStr);
    expect(records.map((r) => r.subject)).toEqual(['数学', '英语']); // 数学(较晚)在前
  });

  it('不带 date 时限制最近 200 条', async () => {
    for (let i = 0; i < 205; i++) {
      await recordsApi.create({ mode: 'study', subject: '数学', duration_ms: 1000 });
    }
    const { records } = await recordsApi.list();
    expect(records.length).toBe(200);
  });
});

describe('recordsApi.update', () => {
  it('修改备注（trim）/标签（整组替换）/页数', async () => {
    const created = await recordsApi.create({
      mode: 'study', subject: '数学', duration_ms: 1000, notes: '旧备注', tags: ['高数'], pages: 10,
    });
    const updated = await recordsApi.update(created.id, {
      notes: '  新备注  ',
      tags: ['线代'],
      pages: 25,
    });
    expect(updated.notes).toBe('新备注');
    expect(updated.tags).toEqual(['线代']);
    expect(updated.pages).toBe(25);
  });

  it('pages 传 null 清空页数', async () => {
    const created = await recordsApi.create({
      mode: 'study', subject: '数学', duration_ms: 1000, pages: 10,
    });
    const updated = await recordsApi.update(created.id, { pages: null });
    expect(updated.pages).toBeNull();
  });

  it('休息记录不可修改', async () => {
    const created = await recordsApi.create({ mode: 'rest', duration_ms: 5000 });
    await expect(recordsApi.update(created.id, { notes: 'x' }))
      .rejects.toThrow('仅学习记录可修改备注或标签');
  });

  it('不存在的记录抛「记录不存在」', async () => {
    await expect(recordsApi.update(999, { notes: 'x' })).rejects.toThrow('记录不存在');
  });
});

describe('recordsApi.remove', () => {
  it('删除记录并级联清 record_tags', async () => {
    const created = await recordsApi.create({
      mode: 'study', subject: '数学', duration_ms: 1000, tags: ['高数'],
    });
    await recordsApi.remove(created.id);
    const { records } = await recordsApi.list();
    expect(records).toEqual([]);
    // 标签库保留
    expect((await tagsApi.list()).map((t) => t.name)).toEqual(['高数']);
  });

  it('不存在的记录抛「记录不存在」', async () => {
    await expect(recordsApi.remove(999)).rejects.toThrow('记录不存在');
  });
});

describe('recordsApi.todayOverview', () => {
  it('统计学习/休息/暂停/页数/按科目分组', async () => {
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;

    await recordsApi.create({ mode: 'study', subject: '数学', duration_ms: 3600000, paused_ms: 300000, pages: 30 });
    await recordsApi.create({ mode: 'study', subject: '英语', duration_ms: 1800000, pages: 10 });
    await recordsApi.create({ mode: 'rest', duration_ms: 600000 });

    const overview = await recordsApi.todayOverview();
    expect(overview.date).toBe(today);
    expect(overview.total_study_ms).toBe(5400000); // 1h + 30min
    expect(overview.total_rest_ms).toBe(900000); // rest 10min + paused 5min
    expect(overview.total_records).toBe(3);
    expect(overview.total_pages).toBe(40);
    expect(overview.by_subject).toEqual([
      { subject: '数学', total_ms: 3600000, count: 1, total_pages: 30 },
      { subject: '英语', total_ms: 1800000, count: 1, total_pages: 10 },
    ]);
  });
});

describe('remindersApi', () => {
  it('create/list/update/delete 与排序', async () => {
    const a = await remindersApi.create('复习的关键在于反复多次和全面');
    const b = await remindersApi.create('及时回顾错题');
    expect(a.sort_order).toBe(0);
    expect(b.sort_order).toBe(1);
    expect((await remindersApi.list()).map((i) => i.content)).toEqual([
      '复习的关键在于反复多次和全面', '及时回顾错题',
    ]);

    const updated = await remindersApi.update(a.id, '改后的提醒');
    expect(updated.content).toBe('改后的提醒');

    await remindersApi.delete(b.id);
    expect((await remindersApi.list()).map((i) => i.content)).toEqual(['改后的提醒']);
  });

  it('create: 空内容抛「提醒内容不能为空」', async () => {
    await expect(remindersApi.create(' ')).rejects.toThrow('提醒内容不能为空');
  });

  it('create: 超过 200 字抛「提醒内容不能超过 200 字」', async () => {
    await expect(remindersApi.create('长'.repeat(201))).rejects.toThrow('提醒内容不能超过 200 字');
  });
});

describe('exportApi.download', () => {
  it('生成与后端一致的导出结构（app/version/exported_at/data 五表，segments 数组，record_tags 无内部 id）', async () => {
    const record = await recordsApi.create({
      mode: 'study', subject: '数学', duration_ms: 60000,
      segments: [{ type: 'study', start: 1, end: 2 }],
      tags: ['高数'], pages: 5,
    });
    await remindersApi.create('提醒');

    const { blob, filename } = await exportApi.download();
    expect(filename).toMatch(/^focus-export-\d{8}-\d{6}\.json$/);

    const payload = JSON.parse(await blob.text());
    expect(payload.app).toBe('FOCUS');
    expect(payload.version).toBeTruthy();
    expect(payload.exported_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(Object.keys(payload.data).sort()).toEqual(
      ['record_tags', 'records', 'reminder_items', 'subjects', 'tags'],
    );
    // records：segments 为数组
    expect(payload.data.records[0].id).toBe(record.id);
    expect(Array.isArray(payload.data.records[0].segments)).toBe(true);
    // record_tags：只含 record_id/tag_id（剥离内部自增 id）
    expect(payload.data.record_tags[0]).toEqual({
      record_id: record.id,
      tag_id: (await tagsApi.list())[0].id,
    });
    // subjects：含默认三科
    expect(payload.data.subjects.map((s) => s.name)).toEqual(['数学', '英语', '专业课']);
  });
});

describe('importApi.submit', () => {
  it('成功导入：全量替换保留原 id，旧数据消失', async () => {
    await recordsApi.create({ mode: 'study', subject: '数学', duration_ms: 1000 });
    const payload = makePayload({
      subjects: [{ id: 5, name: '政治', sort_order: 0 }],
      tags: [{ id: 7, name: '马原', sort_order: 0 }],
      records: [{
        id: 9, mode: 'study', subject: '政治', duration_ms: 2000,
        notes: '导入的', segments: [{ type: 'study', start: 1, end: 2 }],
        paused_ms: 0, pages: 3, created_at: '2026-01-01 09:00:00',
      }],
      record_tags: [{ record_id: 9, tag_id: 7 }],
    });

    const result = await importApi.submit(payload);
    expect(result).toEqual({
      success: true,
      counts: { records: 1, subjects: 1, tags: 1, record_tags: 1, reminder_items: 0 },
    });

    // 旧数据消失，新数据保留原 id
    expect((await subjectsApi.list()).map((s) => s.name)).toEqual(['政治']);
    const { records } = await recordsApi.list('2026-01-01');
    expect(records.length).toBe(1);
    expect(records[0].id).toBe(9);
    expect(records[0].subject).toBe('政治');
    expect(records[0].tags).toEqual(['马原']);
    expect(records[0].segments).toEqual([{ type: 'study', start: 1, end: 2 }]);
  });

  it('app 非 FOCUS 抛「不是 FOCUS 导出的数据文件」', async () => {
    await expect(importApi.submit({ app: 'OTHER', data: { records: [], subjects: [], tags: [], record_tags: [], reminder_items: [] } }))
      .rejects.toThrow('不是 FOCUS 导出的数据文件');
  });

  it('缺表抛「导入数据缺少表」', async () => {
    await expect(importApi.submit(makePayload({ records: undefined })))
      .rejects.toThrow('导入数据缺少表: records');
  });

  it('行不合法（缺 id）拒绝且旧数据保留', async () => {
    await recordsApi.create({ mode: 'study', subject: '数学', duration_ms: 1000 });
    const payload = makePayload({
      records: [{ mode: 'study', subject: '英语', duration_ms: 1000 }],
    });
    await expect(importApi.submit(payload)).rejects.toThrow('导入数据不合法: records 行缺少有效 id');
    // 旧数据未受影响
    const { records } = await recordsApi.list();
    expect(records.length).toBe(1);
    expect(records[0].subject).toBe('数学');
  });

  it('record_tags 引用不存在的记录拒绝', async () => {
    const payload = makePayload({
      records: [{ id: 1, mode: 'study', subject: '数学', duration_ms: 1000, notes: '', segments: null, paused_ms: 0, pages: null, created_at: '2026-01-01 00:00:00' }],
      tags: [{ id: 2, name: '高数', sort_order: 0 }],
      record_tags: [{ record_id: 999, tag_id: 2 }],
    });
    await expect(importApi.submit(payload)).rejects.toThrow('导入数据不合法: record_tags 引用的记录或标签不存在');
  });

  it('重复 subjects.name 拒绝（双版本规则一致）', async () => {
    const payload = makePayload({
      subjects: [
        { id: 1, name: '数学', sort_order: 0 },
        { id: 2, name: '数学', sort_order: 1 },
      ],
    });
    await expect(importApi.submit(payload)).rejects.toThrow('导入数据不合法: subjects 行 name 重复');
  });

  it('重复 record_tags 拒绝（双版本规则一致）', async () => {
    const payload = makePayload({
      subjects: [{ id: 1, name: '数学', sort_order: 0 }],
      records: [{ id: 2, mode: 'study', subject: '数学', duration_ms: 1000, notes: '', segments: null, paused_ms: 0, pages: null, created_at: '2026-01-01 00:00:00' }],
      tags: [{ id: 3, name: '高数', sort_order: 0 }],
      record_tags: [
        { record_id: 2, tag_id: 3 },
        { record_id: 2, tag_id: 3 },
      ],
    });
    await expect(importApi.submit(payload)).rejects.toThrow('导入数据不合法: record_tags 行重复');
  });

  it('duration_ms ≤ 0 拒绝', async () => {
    const payload = makePayload({
      subjects: [{ id: 1, name: '数学', sort_order: 0 }],
      records: [{ id: 2, mode: 'study', subject: '数学', duration_ms: 0 }],
    });
    await expect(importApi.submit(payload)).rejects.toThrow('导入数据不合法: records 行 duration_ms 无效');
  });

  it('空串 tags.name 拒绝', async () => {
    const payload = makePayload({ tags: [{ id: 1, name: '  ', sort_order: 0 }] });
    await expect(importApi.submit(payload)).rejects.toThrow('导入数据不合法: tags 行 name 缺失');
  });

  it('sort_order 缺失时接受并归一为 0（默认值归一化双端一致）', async () => {
    const payload = makePayload({
      subjects: [{ id: 1, name: '政治' }], // 无 sort_order
      records: [{ id: 2, mode: 'study', subject: '政治', duration_ms: 1000, notes: '', segments: null, paused_ms: 0, pages: null, created_at: '2026-01-01 00:00:00' }],
    });
    const result = await importApi.submit(payload);
    expect(result.counts.subjects).toBe(1);
    const subjects = await subjectsApi.list();
    expect(subjects[0]).toMatchObject({ id: 1, name: '政治', sort_order: 0 });
  });
});
