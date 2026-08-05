import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TodayOverview from './TodayOverview';
import { recordsApi } from '../utils/api';

vi.mock('../utils/api');

beforeEach(() => {
  vi.clearAllMocks();
});

const mockOverview = {
  total_study_ms: 7200000,
  total_rest_ms: 600000,
  total_records: 5,
  by_subject: [
    { subject: '数学', total_ms: 3600000 },
    { subject: '英语', total_ms: 2400000 },
    { subject: '专业课', total_ms: 1200000 },
  ],
};

describe('TodayOverview', () => {
  it('loading 态显示加载中', () => {
    recordsApi.todayOverview.mockReturnValueOnce(new Promise(() => {}));
    render(<TodayOverview refreshKey={0} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('total_records=0 时显示今天还没有记录', async () => {
    recordsApi.todayOverview.mockResolvedValueOnce({
      total_study_ms: 0,
      total_rest_ms: 0,
      total_records: 0,
      by_subject: [],
    });
    render(<TodayOverview refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('今天还没有记录')).toBeInTheDocument();
    });
  });

  it('正常数据：显示总时长和按科目分组', async () => {
    recordsApi.todayOverview.mockResolvedValueOnce(mockOverview);
    render(<TodayOverview refreshKey={0} />);

    await waitFor(() => {
      // 总时长 7200000ms = 2小时
      expect(screen.getByText('2小时0分')).toBeInTheDocument();
    });

    // 各科目时长
    expect(screen.getByText('数学')).toBeInTheDocument();
    expect(screen.getByText('英语')).toBeInTheDocument();
    expect(screen.getByText('专业课')).toBeInTheDocument();
  });

  it('条形图比例：最长科目占 100%', async () => {
    recordsApi.todayOverview.mockResolvedValueOnce(mockOverview);
    render(<TodayOverview refreshKey={0} />);

    await waitFor(() => {
      const mathRow = screen.getByText('数学').closest('.flex').parentElement;
      const bars = mathRow.querySelectorAll('[style*="width"]');
      expect(bars[0].style.width).toBe('100%');
    });
  });

  it('by_subject 为空数组时不会除以 0', async () => {
    recordsApi.todayOverview.mockResolvedValueOnce({
      total_study_ms: 0,
      total_rest_ms: 0,
      total_records: 0,
      by_subject: [],
    });
    const { container } = render(<TodayOverview refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('今天还没有记录')).toBeInTheDocument();
    });

    // 不报错即可
    expect(container.querySelector('[style*="width"]')).toBeNull();
  });

  it('refreshKey 变化会重新加载', async () => {
    recordsApi.todayOverview.mockResolvedValue(mockOverview);
    const { rerender } = render(<TodayOverview refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('2小时0分')).toBeInTheDocument();
    });

    expect(recordsApi.todayOverview).toHaveBeenCalledTimes(1);

    rerender(<TodayOverview refreshKey={1} />);

    await waitFor(() => {
      expect(recordsApi.todayOverview).toHaveBeenCalledTimes(2);
    });
  });

  it('传入 records 时按标签分组显示（仅学习记录，休息不计入）', async () => {
    recordsApi.todayOverview.mockResolvedValueOnce(mockOverview);
    const records = [
      { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数', '极限'] },
      { id: 2, mode: 'study', subject: '数学', duration_ms: 1800000, tags: ['高数'] },
      { id: 3, mode: 'rest', subject: null, duration_ms: 600000, tags: [] },
    ];
    render(<TodayOverview refreshKey={0} records={records} />);

    await waitFor(() => {
      expect(screen.getByText('2小时0分')).toBeInTheDocument();
    });

    // 高数 = 1h + 30m = 1小时30分；极限 = 1h
    expect(screen.getByText('按标签')).toBeInTheDocument();
    expect(screen.getByText('高数')).toBeInTheDocument();
    expect(screen.getByText('1小时30分')).toBeInTheDocument();
    expect(screen.getByText('极限')).toBeInTheDocument();
  });

  // ──── 复习页数测试 ────

  it('total_pages > 0 时显示「📖 今日 N 页」', async () => {
    recordsApi.todayOverview.mockResolvedValueOnce({
      total_study_ms: 7200000,
      total_rest_ms: 600000,
      total_records: 5,
      total_pages: 50,
      by_subject: [
        { subject: '数学', total_ms: 3600000, total_pages: 30 },
        { subject: '英语', total_ms: 2400000, total_pages: 20 },
      ],
    });
    render(<TodayOverview refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText(/📖 今日 50 页/)).toBeInTheDocument();
    });
  });

  it('total_pages 为 0 时不显示今日页数', async () => {
    recordsApi.todayOverview.mockResolvedValueOnce(mockOverview);
    render(<TodayOverview refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('2小时0分')).toBeInTheDocument();
    });
    expect(screen.queryByText(/今日 \d+ 页/)).not.toBeInTheDocument();
  });

  it('科目分组行附页数文字（total_pages > 0 时）', async () => {
    recordsApi.todayOverview.mockResolvedValueOnce({
      total_study_ms: 7200000,
      total_rest_ms: 600000,
      total_records: 5,
      total_pages: 30,
      by_subject: [
        { subject: '数学', total_ms: 3600000, total_pages: 30 },
        { subject: '英语', total_ms: 2400000, total_pages: 0 },
      ],
    });
    render(<TodayOverview refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('2小时0分')).toBeInTheDocument();
    });

    // 数学行有「· 30 页」，英语行无页数文字
    expect(screen.getByText('· 30 页')).toBeInTheDocument();
    expect(screen.queryByText('· 0 页')).not.toBeInTheDocument();
  });
});
