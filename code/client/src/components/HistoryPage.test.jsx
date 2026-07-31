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

  // ──── 千层饼测试 ────

  it('有 segments 的记录显示千层饼堆叠条', async () => {
    const recordWithSegments = {
      records: [
        {
          id: 10,
          mode: 'study',
          subject: '数学',
          duration_ms: 600000,
          paused_ms: 300000,
          segments: [
            { type: 'study', duration_ms: 600000 },
            { type: 'pause', duration_ms: 100000 },
            { type: 'study', duration_ms: 900000 },
          ],
          notes: '暂停实验',
          created_at: '2026-07-07 10:00:00',
        },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(recordWithSegments);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 600000, total_rest_ms: 300000, total_records: 1, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('暂停实验')).toBeInTheDocument();
    });

    // 显示千层饼段标签
    await waitFor(() => {
      expect(screen.getByText(/含暂停/)).toBeInTheDocument();
    });
  });

  it('千层饼段自下而上显示（最早段在最下、最晚段在最上）', async () => {
    const recordWithSegments = {
      records: [
        {
          id: 13,
          mode: 'study',
          subject: '数学',
          duration_ms: 1600000,
          paused_ms: 100000,
          segments: [
            { type: 'study', duration_ms: 600000 },
            { type: 'pause', duration_ms: 100000 },
            { type: 'study', duration_ms: 900000 },
          ],
          notes: '顺序测试',
          created_at: '2026-07-07 10:00:00',
        },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(recordWithSegments);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 1600000, total_rest_ms: 0, total_records: 1, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('顺序测试')).toBeInTheDocument();
    });

    const rows = screen.getAllByTestId('segment-row');
    expect(rows).toHaveLength(3);
    // 最上 = 最晚段（study 900000 → 15:00）
    expect(rows[0].textContent).toContain('学习');
    expect(rows[0].textContent).toContain('15:00');
    // 中间 = 暂停段
    expect(rows[1].textContent).toContain('暂停');
    expect(rows[1].textContent).toContain('01:40');
    // 最下 = 最早段（study 600000 → 10:00）
    expect(rows[2].textContent).toContain('学习');
    expect(rows[2].textContent).toContain('10:00');
  });

  it('无 segments 的记录正常显示（不出现千层饼）', async () => {
    const recordNoSegments = {
      records: [
        { id: 11, mode: 'study', subject: '英语', duration_ms: 1200000, notes: '背单词', created_at: '2026-07-07 11:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(recordNoSegments);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 1200000, total_rest_ms: 0, total_records: 1, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('背单词')).toBeInTheDocument();
    });

    expect(screen.queryByText(/含暂停/)).not.toBeInTheDocument();
  });

  it('单段 segments 不显示千层饼（同老数据）', async () => {
    const recordSingleSegment = {
      records: [
        {
          id: 12,
          mode: 'study',
          subject: '数学',
          duration_ms: 600000,
          paused_ms: 0,
          segments: [{ type: 'study', duration_ms: 600000 }],
          notes: '只有一段',
          created_at: '2026-07-07 09:00:00',
        },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(recordSingleSegment);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 600000, total_rest_ms: 0, total_records: 1, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('只有一段')).toBeInTheDocument();
    });

    expect(screen.queryByText(/含暂停/)).not.toBeInTheDocument();
  });

  // ──── 备注内联编辑 ────

  it('点击学习记录的备注进入编辑态（预填原备注）', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('高数练习'));
    const textarea = screen.getByPlaceholderText('记录一下当前的学习内容...');
    expect(textarea.value).toBe('高数练习');
  });

  it('无备注的学习记录显示「＋ 添加备注」，点击进入编辑', async () => {
    const withEmptyNotes = {
      records: [
        { id: 5, mode: 'study', subject: '英语', duration_ms: 600000, notes: '', created_at: '2026-07-07 10:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(withEmptyNotes);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 600000, total_rest_ms: 0, total_records: 1, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('＋ 添加备注')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('＋ 添加备注'));
    const textarea = screen.getByPlaceholderText('记录一下当前的学习内容...');
    expect(textarea.value).toBe('');
  });

  it('保存成功后原地更新备注并收起编辑态', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('高数练习'));
    const textarea = screen.getByPlaceholderText('记录一下当前的学习内容...');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, '高数第三章 反常积分');

    recordsApi.update.mockResolvedValueOnce({
      id: 1, mode: 'study', subject: '数学', duration_ms: 3600000,
      notes: '高数第三章 反常积分', created_at: '2026-07-07 10:00:00',
    });
    await userEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(screen.getByText('高数第三章 反常积分')).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText('记录一下当前的学习内容...')).not.toBeInTheDocument();
    expect(recordsApi.update).toHaveBeenCalledWith(1, { notes: '高数第三章 反常积分' });
  });

  it('取消编辑丢弃草稿且不调用更新接口', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('高数练习'));
    const textarea = screen.getByPlaceholderText('记录一下当前的学习内容...');
    await userEvent.type(textarea, ' 补充');

    await userEvent.click(screen.getByText('取消'));

    expect(screen.queryByPlaceholderText('记录一下当前的学习内容...')).not.toBeInTheDocument();
    expect(screen.getByText('高数练习')).toBeInTheDocument();
    expect(recordsApi.update).not.toHaveBeenCalled();
  });

  it('保存失败显示错误提示并保持编辑态不丢内容', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('高数练习'));
    await userEvent.type(screen.getByPlaceholderText('记录一下当前的学习内容...'), ' 补充');

    recordsApi.update.mockRejectedValueOnce(new Error('网络错误'));
    await userEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(screen.getByText('保存失败: 网络错误')).toBeInTheDocument();
    });
    // 编辑态保持，草稿不丢
    expect(screen.getByPlaceholderText('记录一下当前的学习内容...').value).toBe('高数练习 补充');
    expect(recordsApi.update).toHaveBeenCalledTimes(1);
  });

  it('休息记录不显示备注编辑入口', async () => {
    const mixed = {
      records: [
        { id: 1, mode: 'study', subject: '英语', duration_ms: 600000, notes: '', created_at: '2026-07-07 10:00:00' },
        { id: 2, mode: 'rest', subject: null, duration_ms: 300000, notes: '', created_at: '2026-07-07 11:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(mixed);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('休息')).toBeInTheDocument();
    });

    // 只有学习记录有「＋ 添加备注」，休息记录没有
    expect(screen.getAllByText('＋ 添加备注')).toHaveLength(1);
  });

  it('同时只能编辑一条记录（新编辑自动收起旧编辑）', async () => {
    const twoStudy = {
      records: [
        { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '高数练习', created_at: '2026-07-07 10:00:00' },
        { id: 2, mode: 'study', subject: '英语', duration_ms: 1200000, notes: '背单词', created_at: '2026-07-07 11:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(twoStudy);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 4800000, total_rest_ms: 0, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('高数练习'));
    expect(screen.getByPlaceholderText('记录一下当前的学习内容...').value).toBe('高数练习');

    await userEvent.click(screen.getByText('背单词'));
    // 只有一条编辑框，且预填新记录内容
    expect(screen.getAllByPlaceholderText('记录一下当前的学习内容...')).toHaveLength(1);
    expect(screen.getByPlaceholderText('记录一下当前的学习内容...').value).toBe('背单词');
  });
});
