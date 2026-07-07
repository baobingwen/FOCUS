import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryPage, { getTodayStr } from './HistoryPage';
import { recordsApi } from '../utils/api';

vi.mock('../utils/api');

const today = '2026-07-07';
const mockRecords = {
  records: [
    { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '高数练习', created_at: '2026-07-07 10:00:00' },
    { id: 2, mode: 'rest', subject: null, duration_ms: 300000, notes: '', created_at: '2026-07-07 11:00:00' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-07T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HistoryPage', () => {
  it('loading 态显示加载中', () => {
    recordsApi.list.mockReturnValueOnce(new Promise(() => {}));
    recordsApi.todayOverview.mockReturnValueOnce(new Promise(() => {}));

    render(<HistoryPage refreshKey={0} />);
    // HistoryPage 自身和内部的 TodayOverview 都可能显示加载中
    expect(screen.getAllByText('加载中...').length).toBeGreaterThanOrEqual(1);
  });

  it('空记录显示这天没有记录', async () => {
    recordsApi.list.mockResolvedValueOnce({ records: [] });
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 0, total_rest_ms: 0, total_records: 0, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('这天没有记录')).toBeInTheDocument();
    });
  });

  it('有记录时显示记录列表', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });
    expect(screen.getByText('数学')).toBeInTheDocument();
    expect(screen.getByText('学习')).toBeInTheDocument();
    expect(screen.getByText('休息')).toBeInTheDocument();
  });

  it('显示当前日期和（今天）标签', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText(today)).toBeInTheDocument();
    });
    expect(screen.getByText('（今天）')).toBeInTheDocument();
  });

  it('点击 ← 前一天 切换到前一天', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText(today)).toBeInTheDocument();
    });

    recordsApi.list.mockResolvedValueOnce({ records: [] });
    await userEvent.click(screen.getByText('← 前一天'));

    await waitFor(() => {
      expect(screen.getByText('2026-07-06')).toBeInTheDocument();
    });
  });

  it('不是今天时显示「后一天」按钮', async () => {
    recordsApi.list.mockResolvedValueOnce({ records: [] });
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 0, total_rest_ms: 0, total_records: 0, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText(today)).toBeInTheDocument();
    });

    // 切换到前一天
    recordsApi.list.mockResolvedValueOnce({ records: [] });
    await userEvent.click(screen.getByText('← 前一天'));

    await waitFor(() => {
      expect(screen.getByText('后一天 →')).toBeInTheDocument();
    });
  });

  it('点击「后一天」返回今天', async () => {
    recordsApi.list.mockResolvedValueOnce({ records: [] });
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 0, total_rest_ms: 0, total_records: 0, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText(today)).toBeInTheDocument();
    });

    // 前一天
    recordsApi.list.mockResolvedValueOnce({ records: [] });
    await userEvent.click(screen.getByText('← 前一天'));

    await waitFor(() => {
      expect(screen.getByText('2026-07-06')).toBeInTheDocument();
    });

    // 后一天回到今天
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });
    await userEvent.click(screen.getByText('后一天 →'));

    await waitFor(() => {
      expect(screen.getByText(today)).toBeInTheDocument();
    });
    // 回到今天后显示（今天）标签
    expect(screen.getByText('（今天）')).toBeInTheDocument();
  });

  it('refreshKey 变化后重新加载', async () => {
    recordsApi.list.mockResolvedValue(mockRecords);
    recordsApi.todayOverview.mockResolvedValue({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    const { rerender } = render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    expect(recordsApi.list).toHaveBeenCalledTimes(1);

    rerender(<HistoryPage refreshKey={1} />);

    await waitFor(() => {
      expect(recordsApi.list.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
