import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerPage from './TimerPage';
import { recordsApi, subjectsApi, tagsApi, remindersApi } from '../utils/api';
import { loadPendingRecord, savePendingRecord } from '../utils/pendingRecord';

vi.mock('../utils/api');

function createMockTimer(overrides = {}) {
  return {
    phase: 'idle',
    elapsed: 0,
    selectedSubject: null,
    notes: '',
    tags: [],
    pages: null,
    selectSubject: vi.fn(),
    updateNotes: vi.fn(),
    updatePages: vi.fn(),
    addPages: vi.fn(),
    toggleTag: vi.fn(),
    removeTag: vi.fn(),
    startStudy: vi.fn(),
    endStudy: vi.fn(),
    pauseStudy: vi.fn(),
    resumeStudy: vi.fn(),
    startRest: vi.fn(),
    endRest: vi.fn(),
    skipRest: vi.fn(),
    pausedElapsed: 0,
    frozen: false,
    freeze: vi.fn(),
    thaw: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear(); // 待重试记录隔离：避免上个用例的待重试态污染下个用例
  subjectsApi.list.mockResolvedValue([]);
  tagsApi.list.mockResolvedValue([]);
  remindersApi.list.mockResolvedValue([]);
});

describe('TimerPage', () => {
  it('idle 且未选科目时，开始按钮 disabled 并显示提示', () => {
    subjectsApi.list.mockImplementation(() => new Promise(() => {}));
    const timer = createMockTimer();
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    const btn = screen.getByText('开始学习').closest('button');
    expect(btn).toBeDisabled();
    expect(screen.getByText('请先选择一个科目或休息')).toBeInTheDocument();
  });

  // ──── 管理模式 ────

  it('studying 态日常（admin=false）：标签区无删除 × 和排序 ⚙', async () => {
    tagsApi.list.mockResolvedValue([{ id: 1, name: '高数' }, { id: 2, name: '线代' }]);
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '数学' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('高数')).toBeInTheDocument();
    });
    expect(screen.queryByText('×')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sort-toggle')).not.toBeInTheDocument();
  });

  it('studying 态管理模式（admin=true）：标签区出现删除 × 和排序 ⚙', async () => {
    tagsApi.list.mockResolvedValue([{ id: 1, name: '高数' }, { id: 2, name: '线代' }]);
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '数学' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} adminMode />);

    await waitFor(() => {
      expect(screen.getAllByText('×')).toHaveLength(2);
    });
    expect(screen.getByTestId('sort-toggle')).toBeInTheDocument();
  });

  it('idle 且已选科目时，开始按钮 enabled', () => {
    subjectsApi.list.mockImplementation(() => new Promise(() => {}));
    const timer = createMockTimer({ selectedSubject: { id: 1, name: '数学' } });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    const btn = screen.getByText('开始学习').closest('button');
    expect(btn).not.toBeDisabled();
  });

  it('studying 状态：显示计时器、科目标签、备注框和结束按钮', () => {
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '英语' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByText('📚 英语')).toBeInTheDocument();
    expect(screen.getByText(/00:05/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('记录一下当前的学习内容...')).toBeInTheDocument();
    expect(screen.getByText('结束学习')).toBeInTheDocument();
  });

  it('rest_prompt 状态：显示休息弹窗', () => {
    const timer = createMockTimer({ phase: 'rest_prompt' });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByText('学得不错！')).toBeInTheDocument();
    expect(screen.getByText('休息一下')).toBeInTheDocument();
    expect(screen.getByText('不休息')).toBeInTheDocument();
  });

  it('resting 状态：显示休息计时和结束按钮', () => {
    const timer = createMockTimer({ phase: 'resting', elapsed: 10000 });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByText('☕ 休息中')).toBeInTheDocument();
    expect(screen.getByText('结束休息')).toBeInTheDocument();
    // 显示 00:10
    expect(screen.getByText(/00:10/)).toBeInTheDocument();
  });

  it('结束学习 → 确认弹窗 → API 成功 → 调用 onRecordSaved', async () => {
    const endStudy = vi.fn(() => ({ duration_ms: 5000, paused_ms: 0, segments: [{ type: 'study', duration_ms: 5000 }] }));
    const onRecordSaved = vi.fn();
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '数学' },
      notes: '做练习',
      endStudy,
    });
    recordsApi.create.mockResolvedValueOnce({ id: 1 });

    render(<TimerPage timer={timer} onRecordSaved={onRecordSaved} />);

    // 先弹确认框（此时尚未结束）
    await userEvent.click(screen.getAllByText('结束学习')[0]);
    expect(endStudy).not.toHaveBeenCalled();

    // 确认结束
    await userEvent.click(screen.getAllByText('结束学习')[1]);

    expect(endStudy).toHaveBeenCalled();
    expect(recordsApi.create).toHaveBeenCalledWith({
      mode: 'study',
      subject: '数学',
      duration_ms: 5000,
      paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 5000 }],
      notes: '做练习',
      tags: [],
      pages: null,
    });
    await waitFor(() => {
      expect(onRecordSaved).toHaveBeenCalled();
    });
  });

  it('结束学习 → 确认弹窗 → API 失败 → toast + 待重试记录写入 localStorage', async () => {
    const endStudy = vi.fn(() => ({ duration_ms: 5000, paused_ms: 0, segments: [{ type: 'study', duration_ms: 5000 }] }));
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '数学' },
      notes: '',
      endStudy,
    });
    recordsApi.create.mockRejectedValueOnce(new Error('网络错误'));

    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getAllByText('结束学习')[0]);
    await userEvent.click(screen.getAllByText('结束学习')[1]);

    await waitFor(() => {
      expect(screen.getByText('保存失败: 网络错误')).toBeInTheDocument();
    });
    // 待重试记录已暂存（localStorage 持久化，刷新不丢）
    const pending = loadPendingRecord();
    expect(pending).not.toBeNull();
    expect(pending.subject).toBe('数学');
    expect(pending.duration_ms).toBe(5000);
  });

  it('结束学习 → duration=0 时什么都不做', async () => {
    const endStudy = vi.fn(() => null);
    const timer = createMockTimer({
      phase: 'studying',
      endStudy,
    });

    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getAllByText('结束学习')[0]);
    await userEvent.click(screen.getAllByText('结束学习')[1]);
    expect(recordsApi.create).not.toHaveBeenCalled();
  });

  it('结束休息 → API 成功 → 显示休息时长 toast', async () => {
    const endRest = vi.fn(() => 120000);
    const timer = createMockTimer({
      phase: 'resting',
      elapsed: 120000,
      endRest,
    });
    recordsApi.create.mockResolvedValueOnce({ id: 2 });

    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('结束休息'));

    expect(endRest).toHaveBeenCalled();
    expect(recordsApi.create).toHaveBeenCalledWith({
      mode: 'rest',
      duration_ms: 120000,
      notes: '',
    });
    await waitFor(() => {
      expect(screen.getByText('休息了 02:00，继续加油！')).toBeInTheDocument();
    });
  });

  it('结束休息 → API 失败 → 显示错误 toast', async () => {
    const endRest = vi.fn(() => 60000);
    const timer = createMockTimer({
      phase: 'resting',
      elapsed: 60000,
      endRest,
    });
    recordsApi.create.mockRejectedValueOnce(new Error('保存休息失败'));

    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('结束休息'));

    await waitFor(() => {
      expect(screen.getByText('保存休息失败: 保存休息失败')).toBeInTheDocument();
    });
  });

  it('休息弹窗中点击「休息一下」调用 startRest', async () => {
    const startRest = vi.fn();
    const timer = createMockTimer({ phase: 'rest_prompt', startRest });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('休息一下'));
    expect(startRest).toHaveBeenCalled();
  });

  it('休息弹窗中点击「不休息」调用 skipRest', async () => {
    const skipRest = vi.fn();
    const timer = createMockTimer({ phase: 'rest_prompt', skipRest });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('不休息'));
    expect(skipRest).toHaveBeenCalled();
  });

  it('未知 phase 返回 null', () => {
    const timer = createMockTimer({ phase: 'unknown' });
    const { container } = render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('idle 且选中休息时，按钮显示 ☕ 和「开始休息」', () => {
    subjectsApi.list.mockImplementation(() => new Promise(() => {}));
    const timer = createMockTimer({
      selectedSubject: { id: '__rest__', name: '☕ 休息' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByText('☕')).toBeInTheDocument();
    expect(screen.getByText('开始休息')).toBeInTheDocument();

    const btn = screen.getByText('开始休息').closest('button');
    expect(btn).not.toBeDisabled();
  });

  it('idle 且选中休息时，点击按钮调用 startRest', async () => {
    subjectsApi.list.mockImplementation(() => new Promise(() => {}));
    const startRest = vi.fn();
    const timer = createMockTimer({
      selectedSubject: { id: '__rest__', name: '☕ 休息' },
      startRest,
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('开始休息'));
    expect(startRest).toHaveBeenCalled();
  });

  // ──── 暂停交互测试 ────

  it('学习中显示暂停按钮', () => {
    const timer = createMockTimer({ phase: 'studying', elapsed: 5000 });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByLabelText('暂停')).toBeInTheDocument();
    expect(screen.getByText('结束学习')).toBeInTheDocument();
  });

  it('暂停态显示继续按钮和暂停计时', () => {
    const timer = createMockTimer({
      phase: 'paused',
      elapsed: 5000,
      pausedElapsed: 2000,
      notes: '暂停中记录',
      selectedSubject: { id: 1, name: '数学' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByLabelText('继续')).toBeInTheDocument();
    expect(screen.getByText(/暂停中 00:02/)).toBeInTheDocument();
    expect(screen.getByText('结束学习')).toBeInTheDocument();
  });

  it('暂停态点击继续 → 调用 resumeStudy', async () => {
    const resumeStudy = vi.fn();
    const timer = createMockTimer({ phase: 'paused', resumeStudy });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('继续'));
    expect(resumeStudy).toHaveBeenCalled();
  });

  it('暂停态点击结束 → 弹出确认窗', async () => {
    const timer = createMockTimer({ phase: 'paused' });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('结束学习'));
    expect(screen.getByText('当前处于暂停中，确定结束吗？')).toBeInTheDocument();
  });

  it('暂停态结束确认 → 保存记录并调用 onRecordSaved', async () => {
    const endStudy = vi.fn(() => ({ duration_ms: 8000, paused_ms: 2000, segments: [
      { type: 'study', duration_ms: 8000 },
      { type: 'pause', duration_ms: 2000 },
    ] }));
    const onRecordSaved = vi.fn();
    const timer = createMockTimer({
      phase: 'paused',
      endStudy,
      selectedSubject: { id: 1, name: '数学' },
    });
    recordsApi.create.mockResolvedValueOnce({ id: 1 });

    render(<TimerPage timer={timer} onRecordSaved={onRecordSaved} />);

    await userEvent.click(screen.getByText('结束学习'));
    expect(screen.getByText('当前处于暂停中，确定结束吗？')).toBeInTheDocument();

    await userEvent.click(screen.getAllByText('结束学习')[1]);

    expect(endStudy).toHaveBeenCalled();
    expect(recordsApi.create).toHaveBeenCalledWith({
      mode: 'study',
      subject: '数学',
      duration_ms: 8000,
      paused_ms: 2000,
      segments: [
        { type: 'study', duration_ms: 8000 },
        { type: 'pause', duration_ms: 2000 },
      ],
      notes: '',
      tags: [],
      pages: null,
    });
    await waitFor(() => {
      expect(onRecordSaved).toHaveBeenCalled();
    });
  });

  it('暂停态结束确认弹窗 → 返回学习关闭弹窗', async () => {
    const endStudy = vi.fn();
    const timer = createMockTimer({ phase: 'paused', endStudy });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('结束学习'));
    expect(screen.getByText('当前处于暂停中，确定结束吗？')).toBeInTheDocument();

    await userEvent.click(screen.getByText('返回学习'));
    expect(endStudy).not.toHaveBeenCalled();
    expect(screen.queryByText('当前处于暂停中，确定结束吗？')).not.toBeInTheDocument();
  });

  it('学习中点击暂停按钮 → 调用 pauseStudy', async () => {
    const pauseStudy = vi.fn();
    const timer = createMockTimer({ phase: 'studying', pauseStudy });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('暂停'));
    expect(pauseStudy).toHaveBeenCalled();
  });

  // ──── 冻结 UI 测试 ────

  it('冻结态计时器数字变灰', () => {
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      frozen: true,
      selectedSubject: { id: 1, name: '数学' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    const timeEl = screen.getByText(/00:05/);
    expect(timeEl.className).toContain('text-gray-300');
  });

  it('冻结态不显示暂停计时标签', () => {
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      frozen: true,
      selectedSubject: { id: 1, name: '数学' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.queryByText(/暂停中/)).not.toBeInTheDocument();
  });

  it('冻结态科目标签变灰', () => {
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      frozen: true,
      selectedSubject: { id: 1, name: '数学' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    const badge = screen.getByText('📚 数学');
    expect(badge.className).toContain('text-gray-500');
  });

  it('学习非冻结态计时器正常显色', () => {
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      frozen: false,
      selectedSubject: { id: 1, name: '数学' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    const timeEl = screen.getByText(/00:05/);
    expect(timeEl.className).toContain('text-gray-900');
  });

  // ──── 标签交互测试 ────

  it('studying 状态显示标签选择区，选中项高亮', async () => {
    tagsApi.list.mockResolvedValue([{ id: 1, name: '高数' }, { id: 2, name: '线代' }]);
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '数学' },
      tags: ['高数'],
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('标签（选填）')).toBeInTheDocument();
    });
    // 选中「高数」chip 高亮，未选「线代」不高亮
    expect(screen.getByText('高数').closest('button').className).toContain('bg-blue-500');
    expect(screen.getByText('线代').closest('button').className).not.toContain('bg-blue-500');
  });

  it('studying 状态点击标签 chip → 调用 toggleTag', async () => {
    tagsApi.list.mockResolvedValue([{ id: 1, name: '高数' }]);
    const toggleTag = vi.fn();
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '数学' },
      toggleTag,
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('高数')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('高数'));
    expect(toggleTag).toHaveBeenCalledWith('高数');
  });

  it('结束学习提交选中的标签', async () => {
    const endStudy = vi.fn(() => ({ duration_ms: 5000, paused_ms: 0, segments: [{ type: 'study', duration_ms: 5000 }] }));
    const onRecordSaved = vi.fn();
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '数学' },
      tags: ['高数', '极限'],
      endStudy,
    });
    recordsApi.create.mockResolvedValueOnce({ id: 1 });

    render(<TimerPage timer={timer} onRecordSaved={onRecordSaved} />);
    await userEvent.click(screen.getAllByText('结束学习')[0]);
    await userEvent.click(screen.getAllByText('结束学习')[1]);

    expect(recordsApi.create).toHaveBeenCalledWith({
      mode: 'study',
      subject: '数学',
      duration_ms: 5000,
      paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 5000 }],
      notes: '',
      tags: ['高数', '极限'],
      pages: null,
    });
    await waitFor(() => {
      expect(onRecordSaved).toHaveBeenCalled();
    });
  });

  // ──── 复习页数测试 ────

  it('studying 状态显示页数输入框和 +1/+5/+10 快捷芯片', () => {
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '数学' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByLabelText('复习页数')).toBeInTheDocument();
    expect(screen.getByText('页数（选填）')).toBeInTheDocument();
    expect(screen.getByLabelText('页数 +1')).toBeInTheDocument();
    expect(screen.getByLabelText('页数 +5')).toBeInTheDocument();
    expect(screen.getByLabelText('页数 +10')).toBeInTheDocument();
  });

  it('点击 +5 芯片调用 addPages(5)', async () => {
    const addPages = vi.fn();
    const timer = createMockTimer({
      phase: 'studying',
      addPages,
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('页数 +5'));
    expect(addPages).toHaveBeenCalledWith(5);
  });

  it('页数输入框输入合法数字调用 updatePages', async () => {
    const timer = createMockTimer({ phase: 'studying' });
    // 有状态 stub：模拟受控组件回写（多位数输入依赖 value 回读）
    timer.updatePages = (v) => { timer.pages = v; };
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    const input = screen.getByLabelText('复习页数');
    // jsdom 对 type="number" 的 userEvent 键入支持不可靠，改用 fireEvent.change 直接设值
    fireEvent.change(input, { target: { value: '30' } });
    expect(timer.pages).toBe(30);
  });

  it('页数输入框清空调用 updatePages(null)', async () => {
    const updatePages = vi.fn();
    const timer = createMockTimer({
      phase: 'studying',
      pages: 12,
      updatePages,
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.clear(screen.getByLabelText('复习页数'));
    expect(updatePages).toHaveBeenCalledWith(null);
  });

  it('结束学习提交已填写的页数', async () => {
    const endStudy = vi.fn(() => ({ duration_ms: 5000, paused_ms: 0, segments: [{ type: 'study', duration_ms: 5000 }] }));
    const onRecordSaved = vi.fn();
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      selectedSubject: { id: 1, name: '数学' },
      pages: 30,
      endStudy,
    });
    recordsApi.create.mockResolvedValueOnce({ id: 1 });

    render(<TimerPage timer={timer} onRecordSaved={onRecordSaved} />);
    await userEvent.click(screen.getAllByText('结束学习')[0]);
    await userEvent.click(screen.getAllByText('结束学习')[1]);

    expect(recordsApi.create).toHaveBeenCalledWith(expect.objectContaining({ pages: 30 }));
  });

  it('冻结态页数区块与备注同规则（仍显示输入与芯片）', () => {
    const timer = createMockTimer({
      phase: 'studying',
      elapsed: 5000,
      frozen: true,
      selectedSubject: { id: 1, name: '数学' },
    });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByLabelText('复习页数')).toBeInTheDocument();
    expect(screen.getByLabelText('页数 +1')).toBeInTheDocument();
  });

  // ──── 结束确认弹窗（学习中）────

  it('学习中点结束学习 → 弹确认框（结束学习/返回学习），尚未结束', async () => {
    const endStudy = vi.fn();
    const timer = createMockTimer({ phase: 'studying', endStudy });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getAllByText('结束学习')[0]);

    expect(screen.getByText('结束学习？')).toBeInTheDocument();
    expect(screen.getAllByText('结束学习')).toHaveLength(2); // 大按钮 + 弹窗确认按钮
    expect(screen.getByText('返回学习')).toBeInTheDocument();
    expect(endStudy).not.toHaveBeenCalled();
  });

  it('学习中确认框点返回学习 → 关闭弹窗，不结束', async () => {
    const endStudy = vi.fn();
    const timer = createMockTimer({ phase: 'studying', endStudy });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getAllByText('结束学习')[0]);
    await userEvent.click(screen.getByText('返回学习'));

    expect(endStudy).not.toHaveBeenCalled();
    expect(screen.queryByText('结束学习？')).not.toBeInTheDocument();
    expect(recordsApi.create).not.toHaveBeenCalled();
  });

  // ──── 保存失败重试（待重试记录）────

  it('保存失败（rest_prompt + 待重试）→ 弹窗变「重试保存/放弃记录」，隐藏休息/不休息', () => {
    savePendingRecord({
      mode: 'study', subject: '数学', duration_ms: 3600000, paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 3600000 }], notes: '', tags: [], pages: null,
    });
    const timer = createMockTimer({ phase: 'rest_prompt' });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByText('学习记录保存失败')).toBeInTheDocument();
    expect(screen.getByText('数学 · 1小时0分 未保存')).toBeInTheDocument();
    expect(screen.getByText('重试保存')).toBeInTheDocument();
    expect(screen.getByText('放弃记录')).toBeInTheDocument();
    expect(screen.queryByText('休息一下')).not.toBeInTheDocument();
    expect(screen.queryByText('不休息')).not.toBeInTheDocument();
  });

  it('重试保存成功 → 清空待重试并恢复正常休息弹窗', async () => {
    savePendingRecord({
      mode: 'study', subject: '数学', duration_ms: 3600000, paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 3600000 }], notes: '', tags: [], pages: null,
    });
    const onRecordSaved = vi.fn();
    const timer = createMockTimer({ phase: 'rest_prompt' });
    recordsApi.create.mockResolvedValueOnce({ id: 9 });

    render(<TimerPage timer={timer} onRecordSaved={onRecordSaved} />);

    await userEvent.click(screen.getByText('重试保存'));

    expect(recordsApi.create).toHaveBeenCalledWith(expect.objectContaining({ subject: '数学', duration_ms: 3600000 }));
    await waitFor(() => {
      expect(onRecordSaved).toHaveBeenCalled();
    });
    // 清空待重试 + 恢复正常「要休息吗？」弹窗
    expect(loadPendingRecord()).toBeNull();
    await waitFor(() => {
      expect(screen.getByText('休息一下')).toBeInTheDocument();
    });
  });

  it('重试保存再次失败 → 保持失败态并提示', async () => {
    savePendingRecord({
      mode: 'study', subject: '数学', duration_ms: 3600000, paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 3600000 }], notes: '', tags: [], pages: null,
    });
    const timer = createMockTimer({ phase: 'rest_prompt' });
    recordsApi.create.mockRejectedValueOnce(new Error('还是不行'));

    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('重试保存'));

    await waitFor(() => {
      expect(recordsApi.create).toHaveBeenCalledTimes(1);
    });
    // 仍为失败态（重试/放弃在，休息/不休息不出现），待重试保留
    expect(screen.getByText('学习记录保存失败')).toBeInTheDocument();
    expect(screen.getByText('重试保存')).toBeInTheDocument();
    expect(screen.queryByText('休息一下')).not.toBeInTheDocument();
    expect(loadPendingRecord()).not.toBeNull();
  });

  it('放弃记录（rest_prompt）→ 调用 skipRest 并清空待重试', async () => {
    savePendingRecord({
      mode: 'study', subject: '数学', duration_ms: 3600000, paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 3600000 }], notes: '', tags: [], pages: null,
    });
    const skipRest = vi.fn();
    const timer = createMockTimer({ phase: 'rest_prompt', skipRest });

    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('放弃记录'));

    expect(skipRest).toHaveBeenCalled();
    expect(loadPendingRecord()).toBeNull();
  });

  // ──── 刷新恢复（idle + 待重试记录）────

  it('idle 且存在待重试记录（刷新恢复）→ 显示恢复弹窗', () => {
    savePendingRecord({
      mode: 'study', subject: '英语', duration_ms: 1800000, paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 1800000 }], notes: '', tags: [], pages: null,
    });
    const timer = createMockTimer(); // idle
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    expect(screen.getByText('学习记录保存失败')).toBeInTheDocument();
    expect(screen.getByText('英语 · 30分 未保存')).toBeInTheDocument();
    expect(screen.getByText('重试保存')).toBeInTheDocument();
    expect(screen.getByText('放弃记录')).toBeInTheDocument();
  });

  it('idle 恢复弹窗重试保存成功 → 清空待重试并调用 onRecordSaved', async () => {
    savePendingRecord({
      mode: 'study', subject: '英语', duration_ms: 1800000, paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 1800000 }], notes: '', tags: [], pages: null,
    });
    const onRecordSaved = vi.fn();
    const timer = createMockTimer(); // idle
    recordsApi.create.mockResolvedValueOnce({ id: 9 });

    render(<TimerPage timer={timer} onRecordSaved={onRecordSaved} />);

    await userEvent.click(screen.getByText('重试保存'));

    expect(recordsApi.create).toHaveBeenCalledWith(expect.objectContaining({ subject: '英语' }));
    await waitFor(() => {
      expect(onRecordSaved).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText('学习记录保存失败')).not.toBeInTheDocument();
    });
    expect(loadPendingRecord()).toBeNull();
  });

  it('idle 恢复弹窗点放弃记录 → 弹窗关闭且 localStorage 清空', async () => {
    savePendingRecord({
      mode: 'study', subject: '英语', duration_ms: 1800000, paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 1800000 }], notes: '', tags: [], pages: null,
    });
    const timer = createMockTimer(); // idle
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('放弃记录'));

    expect(screen.queryByText('学习记录保存失败')).not.toBeInTheDocument();
    expect(loadPendingRecord()).toBeNull();
  });
});
