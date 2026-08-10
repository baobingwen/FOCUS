import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecordCard from './RecordCard';
import { tagsApi } from '../utils/api';

vi.mock('../utils/api');

// 学习记录样例
const studyRecord = {
  id: 1, mode: 'study', subject: '数学', duration_ms: 3600000,
  notes: '高数练习', pages: 30, tags: ['高数', '极限'],
  created_at: '2026-07-07 10:00:00',
};

const restRecord = {
  id: 2, mode: 'rest', subject: null, duration_ms: 300000,
  notes: '', pages: null, tags: [],
  created_at: '2026-07-07 11:00:00',
};

const segmentsRecord = {
  id: 10, mode: 'study', subject: '数学', duration_ms: 600000,
  paused_ms: 300000,
  segments: [
    { type: 'study', duration_ms: 600000 },
    { type: 'pause', duration_ms: 100000 },
    { type: 'study', duration_ms: 900000 },
  ],
  notes: '暂停实验', created_at: '2026-07-07 10:00:00',
};

const defaultProps = (overrides = {}) => ({
  record: studyRecord,
  adminMode: false,
  isEditing: false,
  saving: false,
  draft: '',
  draftTags: [],
  draftPages: null,
  editError: '',
  copyFeedback: null,
  filterTag: null,
  onStartEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onSaveEdit: vi.fn(),
  onDelete: vi.fn(),
  onCopyNote: vi.fn(),
  onDraftChange: vi.fn(),
  onDraftPagesChange: vi.fn(),
  onTagClick: vi.fn(),
  onToggleDraftTag: vi.fn(),
  onRemoveDraftTag: vi.fn(),
  ...overrides,
});

const renderCard = (props) => render(<RecordCard {...defaultProps(props)} />);

// 受控 wrapper：草稿跟随回调更新（模拟页面里 setDraft 的真实行为）
// 这样展示壳的 value 跟随，userEvent.type 逐字符输入可累积
const renderControlledEdit = () => {
  const onDraftChange = vi.fn();
  const onDraftPagesChange = vi.fn();
  function Wrapper() {
    const [draft, setDraft] = useState('');
    const [draftPages, setDraftPages] = useState(null);
    return (
      <RecordCard
        {...defaultProps({
          isEditing: true,
          draft,
          draftPages,
          onDraftChange: (v) => { setDraft(v); onDraftChange(v); },
          onDraftPagesChange: (v) => { setDraftPages(v); onDraftPagesChange(v); },
        })}
      />
    );
  }
  render(<Wrapper />);
  return { onDraftChange, onDraftPagesChange };
};

beforeEach(() => {
  vi.clearAllMocks();
  tagsApi.list.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RecordCard 查看态', () => {
  it('学习记录显示类型/科目/时长', () => {
    renderCard();

    expect(screen.getByText('学习')).toBeInTheDocument();
    expect(screen.getByText('数学')).toBeInTheDocument();
    // fmtShortClock(3600000) = 60:00
    expect(screen.getByText('60:00')).toBeInTheDocument();
  });

  it('休息记录显示类型与时长，无科目', () => {
    renderCard({ record: restRecord });

    expect(screen.getByText('休息')).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();
    expect(screen.queryByText('数学')).not.toBeInTheDocument();
  });

  it('显示时间戳（取 created_at 前 16 位）', () => {
    renderCard();

    expect(screen.getByText('2026-07-07 10:00')).toBeInTheDocument();
  });

  it('有 pages 的学习记录显示「📖 N 页」徽标', () => {
    renderCard();

    expect(screen.getByText('📖 30 页')).toBeInTheDocument();
  });

  it('无 pages 的记录不显示页数徽标', () => {
    renderCard({ record: { ...studyRecord, pages: null } });

    expect(screen.queryByText(/📖/)).not.toBeInTheDocument();
  });

  it('休息记录不显示页数徽标', () => {
    renderCard({ record: restRecord });

    expect(screen.queryByText(/📖/)).not.toBeInTheDocument();
  });

  it('有备注的学习记录显示备注与 ✏️ 编辑入口', () => {
    renderCard();

    expect(screen.getByText('高数练习')).toBeInTheDocument();
    expect(screen.getByLabelText('编辑备注')).toBeInTheDocument();
  });

  it('无备注的学习记录显示「＋ 添加备注」，点击调用 onStartEdit', async () => {
    const onStartEdit = vi.fn();
    renderCard({ record: { ...studyRecord, notes: '' }, onStartEdit });

    expect(screen.queryByLabelText('编辑备注')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('＋ 添加备注'));
    expect(onStartEdit).toHaveBeenCalledWith({ ...studyRecord, notes: '' });
  });

  it('点击 ✏️ 调用 onStartEdit', async () => {
    const onStartEdit = vi.fn();
    renderCard({ onStartEdit });

    await userEvent.click(screen.getByLabelText('编辑备注'));
    expect(onStartEdit).toHaveBeenCalledWith(studyRecord);
  });

  it('点击备注文字调用 onCopyNote', async () => {
    const onCopyNote = vi.fn();
    renderCard({ onCopyNote });

    await userEvent.click(screen.getByText('高数练习'));
    expect(onCopyNote).toHaveBeenCalledWith(studyRecord);
  });

  it('休息记录不显示备注编辑入口（＋ 添加备注 / ✏️）', () => {
    renderCard({ record: restRecord });

    expect(screen.queryByText('＋ 添加备注')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('编辑备注')).not.toBeInTheDocument();
    expect(screen.queryByText('高数练习')).not.toBeInTheDocument();
  });

  it('copyFeedback 命中该记录时显示「已复制✓」', () => {
    renderCard({ copyFeedback: { id: 1, status: 'ok' } });

    expect(screen.getByText('已复制✓')).toBeInTheDocument();
  });

  it('copyFeedback 复制失败时显示「复制失败」', () => {
    renderCard({ copyFeedback: { id: 1, status: 'fail' } });

    expect(screen.getByText('复制失败')).toBeInTheDocument();
  });

  it('copyFeedback 属于其他记录时不显示', () => {
    renderCard({ copyFeedback: { id: 999, status: 'ok' } });

    expect(screen.queryByText('已复制✓')).not.toBeInTheDocument();
  });

  it('查看态显示学习记录的标签 chips', () => {
    renderCard();

    expect(screen.getAllByTestId('record-tag')).toHaveLength(2);
  });

  it('休息记录不显示标签 chips', () => {
    renderCard({ record: restRecord });

    expect(screen.queryByTestId('record-tag')).not.toBeInTheDocument();
  });

  it('点击标签 chip 调用 onTagClick（无筛选时传标签名）', async () => {
    const onTagClick = vi.fn();
    renderCard({ onTagClick });

    await userEvent.click(screen.getByText('高数'));
    expect(onTagClick).toHaveBeenCalledWith('高数');
  });

  it('当前筛选标签高亮，再点击时传 null（取消筛选）', async () => {
    const onTagClick = vi.fn();
    renderCard({ filterTag: '高数', onTagClick });

    await userEvent.click(screen.getByText('高数'));
    expect(onTagClick).toHaveBeenCalledWith(null);
  });
});

describe('RecordCard 编辑态', () => {
  it('isEditing=true 显示编辑表单（备注预填草稿 + 页数 + 标签选择器 + 保存/取消）', () => {
    renderCard({
      isEditing: true,
      draft: '高数练习',
      draftTags: ['高数'],
      draftPages: 45,
    });

    const textarea = screen.getByPlaceholderText('记录一下当前的学习内容...');
    expect(textarea.value).toBe('高数练习');
    expect(screen.getByLabelText('编辑页数').value).toBe('45');
    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(screen.getByText('+ 标签')).toBeInTheDocument();
  });

  it('编辑态备注输入调用 onDraftChange', async () => {
    const { onDraftChange } = renderControlledEdit();

    await userEvent.type(screen.getByPlaceholderText('记录一下当前的学习内容...'), 'abc');
    expect(onDraftChange).toHaveBeenLastCalledWith('abc');
  });

  it('编辑态页数输入数字调用 onDraftPagesChange', async () => {
    const { onDraftPagesChange } = renderControlledEdit();

    const input = screen.getByLabelText('编辑页数');
    await userEvent.clear(input);
    await userEvent.type(input, '45');
    expect(onDraftPagesChange).toHaveBeenLastCalledWith(45);
  });

  it('编辑态清空页数调用 onDraftPagesChange(null)', async () => {
    const onDraftPagesChange = vi.fn();
    renderCard({ isEditing: true, draftPages: 30, onDraftPagesChange });

    await userEvent.clear(screen.getByLabelText('编辑页数'));
    expect(onDraftPagesChange).toHaveBeenCalledWith(null);
  });

  it('点击保存调用 onSaveEdit，点击取消调用 onCancelEdit', async () => {
    const onSaveEdit = vi.fn();
    const onCancelEdit = vi.fn();
    renderCard({ isEditing: true, onSaveEdit, onCancelEdit });

    await userEvent.click(screen.getByText('保存'));
    expect(onSaveEdit).toHaveBeenCalledWith(studyRecord);

    await userEvent.click(screen.getByText('取消'));
    expect(onCancelEdit).toHaveBeenCalled();
  });

  it('saving=true 时保存按钮禁用并显示保存中', () => {
    renderCard({ isEditing: true, saving: true });

    const saveBtn = screen.getByText('保存中...');
    expect(saveBtn).toBeDisabled();
  });

  it('编辑态标签选择器点选调用 onToggleDraftTag', async () => {
    tagsApi.list.mockResolvedValue([{ id: 1, name: '高数' }]);
    const onToggleDraftTag = vi.fn();
    renderCard({ isEditing: true, draftTags: ['高数'], onToggleDraftTag });

    // TagPicker 异步加载标签库，等待 chips 渲染后再点选
    const chip = await screen.findByTestId('tag-chip');
    await userEvent.click(chip);
    expect(onToggleDraftTag).toHaveBeenCalledWith('高数');
  });

  it('editError 时显示错误提示', () => {
    renderCard({ isEditing: true, editError: '保存失败: 网络错误' });

    expect(screen.getByText('保存失败: 网络错误')).toBeInTheDocument();
  });

  it('编辑态不显示备注复制入口与删除按钮', () => {
    renderCard({ isEditing: true, adminMode: true });

    expect(screen.queryByLabelText('编辑备注')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('删除记录')).not.toBeInTheDocument();
  });
});

describe('RecordCard 管理模式删除', () => {
  it('adminMode=false 无删除按钮（正常使用无感知）', () => {
    renderCard();

    expect(screen.queryByLabelText('删除记录')).not.toBeInTheDocument();
  });

  it('adminMode=true 显示删除按钮，点击调用 onDelete', async () => {
    const onDelete = vi.fn();
    renderCard({ adminMode: true, onDelete });

    await userEvent.click(screen.getByLabelText('删除记录'));
    expect(onDelete).toHaveBeenCalledWith(studyRecord);
  });

  it('休息记录管理模式同样显示删除按钮', () => {
    renderCard({ adminMode: true, record: restRecord });

    expect(screen.getAllByLabelText('删除记录')).toHaveLength(1);
  });
});

describe('RecordCard 千层饼条件', () => {
  it('多段 segments 的学习记录显示千层饼（含暂停汇总）', () => {
    renderCard({ record: segmentsRecord });

    expect(screen.getAllByTestId('segment-row')).toHaveLength(3);
    expect(screen.getByText(/含暂停/)).toBeInTheDocument();
  });

  it('无 segments 的记录不出现千层饼', () => {
    renderCard();

    expect(screen.queryByText(/含暂停/)).not.toBeInTheDocument();
  });

  it('单段 segments 不显示千层饼（同老数据）', () => {
    renderCard({
      record: {
        ...studyRecord,
        segments: [{ type: 'study', duration_ms: 600000 }],
      },
    });

    expect(screen.queryByText(/含暂停/)).not.toBeInTheDocument();
  });
});
