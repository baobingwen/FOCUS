import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProgressPage from './ProgressPage';
import { recordsApi, subjectsApi } from '../utils/api';

vi.mock('../utils/api');

/** 科目列表（按 sort_order，覆盖格与配速的行集合） */
const SUBJECTS = [
  { id: 1, name: '数学', sort_order: 0 },
  { id: 2, name: '英语', sort_order: 1 },
  { id: 3, name: '专业课', sort_order: 2 },
];

/**
 * 构造一条记录（进度页只用 mode/subject/duration_ms/created_at）
 * @param {string|null} subject - 科目（休息记录为 null）
 * @param {string} createdAt - created_at（本地时间字符串）
 * @param {number} [durationMs] - 时长
 * @param {string} [mode] - study / rest
 * @returns {object}
 */
function rec(subject, createdAt, durationMs = 3600000, mode = 'study') {
  return { mode, subject, duration_ms: durationMs, created_at: createdAt };
}

beforeEach(() => {
  vi.clearAllMocks();
  // 固定「今天」= 2026-09-12 12:00（距考研 2026-12-19 为 98 天），只 fake Date 保留异步定时器
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 12, 12, 0, 0));
  subjectsApi.list.mockResolvedValue(SUBJECTS);
  recordsApi.range.mockResolvedValue({ records: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProgressPage', () => {
  it('loading 态显示加载中', () => {
    recordsApi.range.mockReturnValueOnce(new Promise(() => {}));
    render(<ProgressPage refreshKey={0} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('取数区间：to = 今天，from = 今天往前 89 天（90 天回溯窗口）', async () => {
    render(<ProgressPage refreshKey={0} />);
    await waitFor(() => {
      expect(recordsApi.range).toHaveBeenCalledWith('2026-06-15', '2026-09-12');
    });
  });

  it('页面标题渲染（与另两个 tab 同款），今天列高亮', async () => {
    render(<ProgressPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('📈 学习进度')).toBeInTheDocument();
    });
    // 剩余天数不在此页重复（唯一来源是右上角全局倒计时）
    expect(screen.queryByTestId('progress-countdown')).not.toBeInTheDocument();
    // 表头最后一列（今天 = 12 号）高亮
    expect(screen.getByText('12').className).toContain('text-blue-600');
  });

  it('覆盖格：有学习记录即点亮（1 秒记录同样点亮，验证无时长阈值）', async () => {
    recordsApi.range.mockResolvedValue({
      records: [
        rec('数学', '2026-09-12 10:00:00', 1000),    // 今天，仅 1 秒
        rec('英语', '2026-09-10 10:00:00', 3600000), // 2 天前
      ],
    });
    const { container } = render(<ProgressPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByTestId('progress-page')).toBeInTheDocument();
    });
    // 7 天 × 3 科目 = 21 格，点亮 2 格
    expect(container.querySelectorAll('[data-lit="true"]').length).toBe(2);
    expect(container.querySelectorAll('[data-lit="false"]').length).toBe(19);
  });

  it('窗口外的记录不点亮覆盖格（仅展示窗口内 7 天）', async () => {
    recordsApi.range.mockResolvedValue({
      records: [
        rec('数学', '2026-09-12 10:00:00'), // 窗口内（今天）
        rec('数学', '2026-09-05 10:00:00'), // 窗口外（8 天前）
      ],
    });
    const { container } = render(<ProgressPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByTestId('progress-page')).toBeInTheDocument();
    });
    expect(container.querySelectorAll('[data-lit="true"]').length).toBe(1);
  });

  it('「上次」列：表头渲染，今天学过 =「今天」、N 天前、无记录 = —', async () => {
    recordsApi.range.mockResolvedValue({
      records: [
        rec('数学', '2026-09-12 10:00:00'),
        rec('英语', '2026-09-09 10:00:00'),
      ],
    });
    render(<ProgressPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('今天')).toBeInTheDocument();
    });
    expect(screen.getByText('上次')).toBeInTheDocument(); // 右侧列表头
    expect(screen.getByText('3 天前')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // 专业课：回溯窗口内无记录
  });

  it('「上次」列取回溯窗口内最近一条（窗口内更早的记录不覆盖它）', async () => {
    recordsApi.range.mockResolvedValue({
      records: [
        rec('数学', '2026-08-01 10:00:00'),
        rec('数学', '2026-09-11 10:00:00'),
        rec('数学', '2026-09-05 10:00:00'),
      ],
    });
    render(<ProgressPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('1 天前')).toBeInTheDocument();
    });
  });

  it('休息记录不参与：不点亮格、不计入配速', async () => {
    recordsApi.range.mockResolvedValue({
      records: [rec(null, '2026-09-12 10:00:00', 7200000, 'rest')],
    });
    const { container } = render(<ProgressPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByTestId('progress-page')).toBeInTheDocument();
    });
    expect(container.querySelectorAll('[data-lit="true"]').length).toBe(0);
    // 三个科目配速均为 0分
    expect(screen.getAllByText('0分').length).toBe(3);
  });

  it('配速条：最长科目占 100%，其余按比例（含 0%）', async () => {
    recordsApi.range.mockResolvedValue({
      records: [
        rec('数学', '2026-09-12 10:00:00', 7200000),
        rec('英语', '2026-09-12 09:00:00', 3600000),
      ],
    });
    const { container } = render(<ProgressPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('2小时0分')).toBeInTheDocument();
    });
    const bars = [...container.querySelectorAll('div[style*="width"]')];
    expect(bars.length).toBe(3);
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('50%');
    expect(bars[2].style.width).toBe('0%');
  });

  it('近 7 天无学习记录时显示空状态提示', async () => {
    recordsApi.range.mockResolvedValue({ records: [] });
    render(<ProgressPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('近 7 天还没有学习记录')).toBeInTheDocument();
    });
  });

  it('refreshKey 变化时重新加载', async () => {
    const { rerender } = render(<ProgressPage refreshKey={0} />);
    await waitFor(() => {
      expect(recordsApi.range).toHaveBeenCalledTimes(1);
    });

    rerender(<ProgressPage refreshKey={1} />);
    await waitFor(() => {
      expect(recordsApi.range).toHaveBeenCalledTimes(2);
    });
  });
});
