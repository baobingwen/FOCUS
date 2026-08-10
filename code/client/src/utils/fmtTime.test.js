import { describe, it, expect } from 'vitest';
import { fmtClock, fmtShortClock } from './fmtTime';

describe('fmtClock（HH:MM:SS或MM:SS格式）', () => {
  it('0 显示 00:00', () => {
    expect(fmtClock(0)).toBe('00:00');
  });

  it('不足 1 小时显示 MM:SS（补零）', () => {
    expect(fmtClock(330000)).toBe('05:30');
  });

  it('超过 1 小时显示 HH:MM:SS', () => {
    expect(fmtClock(3600000)).toBe('01:00:00');
    expect(fmtClock(5400000)).toBe('01:30:00');
  });

  it('非法输入（负数/NaN/非数字）显示 00:00', () => {
    expect(fmtClock(-1000)).toBe('00:00');
    expect(fmtClock(NaN)).toBe('00:00');
    expect(fmtClock('abc')).toBe('00:00');
  });
});

describe('fmtShortClock（MM:SS格式）', () => {
  it('0 显示 00:00', () => {
    expect(fmtShortClock(0)).toBe('00:00');
  });

  it('显示 MM:SS（补零）', () => {
    expect(fmtShortClock(330000)).toBe('05:30');
    expect(fmtShortClock(1000)).toBe('00:01');
  });

  it('超过 1 小时分钟数不折叠（如 75:00）', () => {
    expect(fmtShortClock(4500000)).toBe('75:00');
  });

  it('非法输入（负数/NaN/非数字）显示 00:00', () => {
    expect(fmtShortClock(-1000)).toBe('00:00');
    expect(fmtShortClock(NaN)).toBe('00:00');
    expect(fmtShortClock(null)).toBe('00:00');
  });
});
