import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryPage, { getTodayStr } from './HistoryPage';
import { recordsApi, tagsApi } from '../utils/api';

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
  tagsApi.list.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  delete navigator.clipboard;
  delete document.execCommand;
  vi.restoreAllMocks();
});

// 获取某条记录备注行内的 ✏️ 编辑按钮（备注文字现在是复制入口）
const editButtonOf = (noteText) =>
  within(screen.getByText(noteText).closest('div')).getByTitle('编辑备注');

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

  it('点击 ✏️ 进入编辑态（预填原备注）', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(editButtonOf('高数练习'));
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

    await userEvent.click(editButtonOf('高数练习'));
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
    expect(recordsApi.update).toHaveBeenCalledWith(1, { notes: '高数第三章 反常积分', tags: [], pages: null });
  });

  it('取消编辑丢弃草稿且不调用更新接口', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(editButtonOf('高数练习'));
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

    await userEvent.click(editButtonOf('高数练习'));
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

    await userEvent.click(editButtonOf('高数练习'));
    expect(screen.getByPlaceholderText('记录一下当前的学习内容...').value).toBe('高数练习');

    await userEvent.click(editButtonOf('背单词'));
    // 只有一条编辑框，且预填新记录内容
    expect(screen.getAllByPlaceholderText('记录一下当前的学习内容...')).toHaveLength(1);
    expect(screen.getByPlaceholderText('记录一下当前的学习内容...').value).toBe('背单词');
  });

  // ──── 备注复制 ────

  it('点击备注文字复制到剪贴板并显示「已复制」', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('高数练习'));

    expect(writeText).toHaveBeenCalledWith('高数练习');
    await waitFor(() => {
      expect(screen.getByText('已复制✓')).toBeInTheDocument();
    });
  });

  it('无 navigator.clipboard 时降级 execCommand 复制', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(true);

    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('高数练习'));

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    await waitFor(() => {
      expect(screen.getByText('已复制✓')).toBeInTheDocument();
    });
  });

  it('复制失败显示「复制失败」提示', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(false);

    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('高数练习'));

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    await waitFor(() => {
      expect(screen.getByText('复制失败')).toBeInTheDocument();
    });
  });

  // ──── 标签展示与筛选 ────

  it('查看态显示学习记录的标签 chips，并出现筛选行', async () => {
    const withTags = {
      records: [
        { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '高数练习', tags: ['高数', '极限'], created_at: '2026-07-07 10:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(withTags);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 0, total_records: 1, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('record-tag')).toHaveLength(2);
    // 筛选行出现「全部」
    expect(screen.getByText('全部')).toBeInTheDocument();
  });

  it('点记录上的标签 chip 即按标签筛选，点「全部」恢复', async () => {
    const records = {
      records: [
        { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: 'A', tags: ['高数'], created_at: '2026-07-07 10:00:00' },
        { id: 2, mode: 'study', subject: '数学', duration_ms: 1800000, notes: 'B', tags: ['线代'], created_at: '2026-07-07 11:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(records);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 5400000, total_rest_ms: 0, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument();
    });
    expect(screen.getByText('B')).toBeInTheDocument();

    // 点 A 记录上的「高数」chip → 只看含高数的记录
    const gaoShuChip = screen.getAllByTestId('record-tag').find(el => el.textContent === '高数');
    await userEvent.click(gaoShuChip);

    await waitFor(() => {
      expect(screen.queryByText('B')).not.toBeInTheDocument();
    });
    expect(screen.getByText('A')).toBeInTheDocument();

    // 点「全部」恢复
    await userEvent.click(screen.getByText('全部'));
    await waitFor(() => {
      expect(screen.getByText('B')).toBeInTheDocument();
    });
  });

  it('休息记录不显示标签 chips', async () => {
    const mixed = {
      records: [
        { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: 'A', tags: ['高数'], created_at: '2026-07-07 10:00:00' },
        { id: 2, mode: 'rest', subject: null, duration_ms: 300000, notes: '', tags: [], created_at: '2026-07-07 11:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(mixed);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('休息')).toBeInTheDocument();
    });
    // 只有学习记录有标签 chip（高数），休息记录无
    expect(screen.getAllByTestId('record-tag')).toHaveLength(1);
  });

  // ──── 标签编辑态 ────

  it('编辑态显示标签选择器，保存时备注与标签一起提交', async () => {
    tagsApi.list.mockResolvedValue([{ id: 1, name: '高数' }]);
    const withTags = {
      records: [
        { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '高数练习', tags: ['高数'], created_at: '2026-07-07 10:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(withTags);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 0, total_records: 1, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(editButtonOf('高数练习'));
    // 编辑态出现标签选择器
    await waitFor(() => {
      expect(screen.getByText('+ 标签')).toBeInTheDocument();
    });

    recordsApi.update.mockResolvedValueOnce({
      id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, tags: ['高数'], created_at: '2026-07-07 10:00:00',
    });
    await userEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(recordsApi.update).toHaveBeenCalledWith(1, { notes: '高数练习', tags: ['高数'], pages: null });
    });
  });

  it('编辑态取消标签后保存提交空标签', async () => {
    tagsApi.list.mockResolvedValue([{ id: 1, name: '高数' }]);
    const withTags = {
      records: [
        { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '高数练习', tags: ['高数'], created_at: '2026-07-07 10:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(withTags);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 0, total_records: 1, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(editButtonOf('高数练习'));
    await waitFor(() => {
      expect(screen.getAllByTestId('tag-chip').length).toBeGreaterThanOrEqual(1);
    });

    // 点掉选中的「高数」chip（取消选中）
    const chip = screen.getAllByTestId('tag-chip').find(el => el.textContent.includes('高数'));
    await userEvent.click(chip);

    recordsApi.update.mockResolvedValueOnce({
      id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, tags: [], created_at: '2026-07-07 10:00:00',
    });
    await userEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(recordsApi.update).toHaveBeenCalledWith(1, { notes: '高数练习', tags: [], pages: null });
    });
  });

  // ──── 复习页数测试 ────

  it('学习记录有 pages 时显示「📖 N 页」徽标', async () => {
    const withPages = {
      records: [
        { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '高数练习', pages: 30, created_at: '2026-07-07 10:00:00' },
        { id: 2, mode: 'study', subject: '英语', duration_ms: 1800000, notes: '背单词', pages: null, created_at: '2026-07-07 11:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(withPages);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 5400000, total_rest_ms: 0, total_records: 2, by_subject: [], total_pages: 30 });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('📖 30 页')).toBeInTheDocument();
    });
    // 无 pages 的记录不显示徽标
    expect(screen.queryByText('📖 0 页')).not.toBeInTheDocument();
  });

  it('休息记录不显示页数徽标', async () => {
    const mixed = {
      records: [
        { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '', pages: 30, created_at: '2026-07-07 10:00:00' },
        { id: 2, mode: 'rest', subject: null, duration_ms: 300000, notes: '', pages: null, created_at: '2026-07-07 11:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(mixed);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [], total_pages: 30 });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('📖 30 页')).toBeInTheDocument();
    });
    expect(screen.getAllByText('📖 30 页')).toHaveLength(1);
  });

  it('编辑态可修改页数，保存时随备注标签一起提交', async () => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(editButtonOf('高数练习'));
    const pagesInput = screen.getByLabelText('编辑页数');
    await userEvent.clear(pagesInput);
    await userEvent.type(pagesInput, '45');

    recordsApi.update.mockResolvedValueOnce({
      id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '高数练习', pages: 45, created_at: '2026-07-07 10:00:00',
    });
    await userEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(recordsApi.update).toHaveBeenCalledWith(1, { notes: '高数练习', tags: [], pages: 45 });
    });
  });

  it('编辑态清空页数：保存提交 null', async () => {
    const withPages = {
      records: [
        { id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '高数练习', pages: 30, created_at: '2026-07-07 10:00:00' },
      ],
    };
    recordsApi.list.mockResolvedValueOnce(withPages);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 0, total_records: 1, by_subject: [], total_pages: 30 });

    render(<HistoryPage refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });

    await userEvent.click(editButtonOf('高数练习'));
    await userEvent.clear(screen.getByLabelText('编辑页数'));

    recordsApi.update.mockResolvedValueOnce({
      id: 1, mode: 'study', subject: '数学', duration_ms: 3600000, notes: '高数练习', pages: null, created_at: '2026-07-07 10:00:00',
    });
    await userEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(recordsApi.update).toHaveBeenCalledWith(1, { notes: '高数练习', tags: [], pages: null });
    });
  });
});

// ──── 管理模式（入口 = 右上角考研倒计时连点 5 下，开关由 App 层托管）与删除 ────

describe('HistoryPage 管理模式删除', () => {
  const renderWithRecords = async (props = {}) => {
    recordsApi.list.mockResolvedValueOnce(mockRecords);
    recordsApi.todayOverview.mockResolvedValueOnce({ total_study_ms: 3600000, total_rest_ms: 300000, total_records: 2, by_subject: [] });
    const utils = render(<HistoryPage refreshKey={0} {...props} />);
    await waitFor(() => {
      expect(screen.getByText('高数练习')).toBeInTheDocument();
    });
    return utils;
  };

  it('正常状态（adminMode=false）无删除按钮（无感知）', async () => {
    await renderWithRecords();

    expect(screen.queryByLabelText('删除记录')).not.toBeInTheDocument();
  });

  it('adminMode=true 时卡片出现删除按钮（学习 + 休息）', async () => {
    await renderWithRecords({ adminMode: true });

    expect(screen.getAllByLabelText('删除记录')).toHaveLength(2);
  });

  it('adminMode 变 false 时删除按钮消失（切回日常）', async () => {
    const { rerender } = await renderWithRecords({ adminMode: true });
    expect(screen.getAllByLabelText('删除记录')).toHaveLength(2);

    rerender(<HistoryPage refreshKey={0} adminMode={false} />);

    expect(screen.queryByLabelText('删除记录')).not.toBeInTheDocument();
  });

  it('confirm 取消：不删除、不调用接口', async () => {
    window.confirm = vi.fn(() => false);
    await renderWithRecords({ adminMode: true });

    await userEvent.click(screen.getAllByLabelText('删除记录')[0]);

    expect(window.confirm).toHaveBeenCalledWith('删除这条学习记录？此操作不可恢复');
    expect(recordsApi.remove).not.toHaveBeenCalled();
    expect(screen.getByText('高数练习')).toBeInTheDocument();
  });

  it('confirm 确认：删除成功，记录本地移除', async () => {
    window.confirm = vi.fn(() => true);
    await renderWithRecords({ adminMode: true });

    recordsApi.remove.mockResolvedValueOnce({ success: true });
    await userEvent.click(screen.getAllByLabelText('删除记录')[0]);

    await waitFor(() => {
      expect(recordsApi.remove).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.queryByText('高数练习')).not.toBeInTheDocument();
    });
    // 休息记录保留
    expect(screen.getByText('休息')).toBeInTheDocument();
  });

  it('删除失败：保留记录并显示内联错误', async () => {
    window.confirm = vi.fn(() => true);
    await renderWithRecords({ adminMode: true });

    recordsApi.remove.mockRejectedValueOnce(new Error('网络错误'));
    await userEvent.click(screen.getAllByLabelText('删除记录')[0]);

    await waitFor(() => {
      expect(screen.getByText('删除失败: 网络错误')).toBeInTheDocument();
    });
    expect(screen.getByText('高数练习')).toBeInTheDocument();
  });

  it('正在编辑的记录不显示删除按钮（互斥）', async () => {
    await renderWithRecords({ adminMode: true });
    expect(screen.getAllByLabelText('删除记录')).toHaveLength(2);

    // 进入编辑态：编辑中的学习记录删除按钮消失，休息记录保留
    await userEvent.click(editButtonOf('高数练习'));
    expect(screen.getByPlaceholderText('记录一下当前的学习内容...')).toBeInTheDocument();
    expect(screen.getAllByLabelText('删除记录')).toHaveLength(1);
  });

  it('休息记录也可删除', async () => {
    window.confirm = vi.fn(() => true);
    await renderWithRecords({ adminMode: true });

    recordsApi.remove.mockResolvedValueOnce({ success: true });
    // 第二条 = 休息记录
    await userEvent.click(screen.getAllByLabelText('删除记录')[1]);

    await waitFor(() => {
      expect(recordsApi.remove).toHaveBeenCalledWith(2);
      expect(window.confirm).toHaveBeenCalledWith('删除这条休息记录？此操作不可恢复');
    });
    await waitFor(() => {
      expect(screen.queryByText('休息')).not.toBeInTheDocument();
    });
    expect(screen.getByText('高数练习')).toBeInTheDocument();
  });
});
