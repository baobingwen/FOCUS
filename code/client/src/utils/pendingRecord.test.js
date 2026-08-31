import { describe, it, expect, beforeEach } from 'vitest';
import { savePendingRecord, loadPendingRecord, clearPendingRecord } from './pendingRecord';

const VALID_RECORD = {
  mode: 'study',
  subject: '数学',
  duration_ms: 3600000,
  paused_ms: 120000,
  segments: [{ type: 'study', duration_ms: 3600000 }, { type: 'pause', duration_ms: 120000 }],
  notes: '做练习',
  tags: ['高数'],
  pages: 30,
};

beforeEach(() => {
  localStorage.clear();
});

describe('pendingRecord', () => {
  it('save → load 完整往返（含 version 与各业务字段）', () => {
    savePendingRecord(VALID_RECORD);

    const loaded = loadPendingRecord();
    expect(loaded).not.toBeNull();
    expect(loaded.version).toBe(1);
    expect(loaded.mode).toBe('study');
    expect(loaded.subject).toBe('数学');
    expect(loaded.duration_ms).toBe(3600000);
    expect(loaded.paused_ms).toBe(120000);
    expect(loaded.segments).toHaveLength(2);
    expect(loaded.notes).toBe('做练习');
    expect(loaded.tags).toEqual(['高数']);
    expect(loaded.pages).toBe(30);
  });

  it('无记录时 load 返回 null', () => {
    expect(loadPendingRecord()).toBeNull();
  });

  it('clear 后 load 返回 null', () => {
    savePendingRecord(VALID_RECORD);
    clearPendingRecord();
    expect(loadPendingRecord()).toBeNull();
  });

  it('覆盖写入：后保存的覆盖先保存的', () => {
    savePendingRecord(VALID_RECORD);
    savePendingRecord({ ...VALID_RECORD, subject: '英语' });

    expect(loadPendingRecord().subject).toBe('英语');
  });

  it('JSON 损坏返回 null', () => {
    localStorage.setItem('focus:pending-record', '{not-json');
    expect(loadPendingRecord()).toBeNull();
  });

  it('version 不匹配返回 null', () => {
    localStorage.setItem('focus:pending-record', JSON.stringify({ ...VALID_RECORD, version: 999 }));
    expect(loadPendingRecord()).toBeNull();
  });

  it('mode 非 study（休息记录）返回 null', () => {
    localStorage.setItem('focus:pending-record', JSON.stringify({ ...VALID_RECORD, mode: 'rest' }));
    expect(loadPendingRecord()).toBeNull();
  });

  it('duration_ms ≤ 0 返回 null', () => {
    localStorage.setItem('focus:pending-record', JSON.stringify({ ...VALID_RECORD, duration_ms: 0 }));
    expect(loadPendingRecord()).toBeNull();
  });

  it('subject 为空串返回 null', () => {
    localStorage.setItem('focus:pending-record', JSON.stringify({ ...VALID_RECORD, subject: '  ' }));
    expect(loadPendingRecord()).toBeNull();
  });

  it('segments 非法返回 null', () => {
    localStorage.setItem('focus:pending-record', JSON.stringify({ ...VALID_RECORD, segments: [{ type: 'xx' }] }));
    expect(loadPendingRecord()).toBeNull();
  });

  it('tags 含非字符串返回 null', () => {
    localStorage.setItem('focus:pending-record', JSON.stringify({ ...VALID_RECORD, tags: [1] }));
    expect(loadPendingRecord()).toBeNull();
  });

  it('pages 越界返回 null', () => {
    localStorage.setItem('focus:pending-record', JSON.stringify({ ...VALID_RECORD, pages: 10000 }));
    expect(loadPendingRecord()).toBeNull();
  });

  it('pages 为 null 合法（未填写页数）', () => {
    savePendingRecord({ ...VALID_RECORD, pages: null });
    expect(loadPendingRecord().pages).toBeNull();
  });
});
