import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerPage from './TimerPage';
import { recordsApi, subjectsApi } from '../utils/api';

vi.mock('../utils/api');

function createMockTimer(overrides = {}) {
  return {
    phase: 'idle',
    elapsed: 0,
    selectedSubject: null,
    notes: '',
    selectSubject: vi.fn(),
    updateNotes: vi.fn(),
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
  subjectsApi.list.mockResolvedValue([]);
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

  it('结束学习 → API 成功 → 调用 onRecordSaved', async () => {
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

    await userEvent.click(screen.getByText('结束学习'));

    expect(endStudy).toHaveBeenCalled();
    expect(recordsApi.create).toHaveBeenCalledWith({
      mode: 'study',
      subject: '数学',
      duration_ms: 5000,
      paused_ms: 0,
      segments: [{ type: 'study', duration_ms: 5000 }],
      notes: '做练习',
    });
    await waitFor(() => {
      expect(onRecordSaved).toHaveBeenCalled();
    });
  });

  it('结束学习 → API 失败 → 显示错误 toast', async () => {
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

    await userEvent.click(screen.getByText('结束学习'));

    await waitFor(() => {
      expect(screen.getByText('保存失败: 网络错误')).toBeInTheDocument();
    });
  });

  it('结束学习 → duration=0 时什么都不做', async () => {
    const endStudy = vi.fn(() => null);
    const timer = createMockTimer({
      phase: 'studying',
      endStudy,
    });

    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('结束学习'));
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

    await userEvent.click(screen.getByText('确定'));

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
    });
    await waitFor(() => {
      expect(onRecordSaved).toHaveBeenCalled();
    });
  });

  it('暂停态结束确认弹窗 → 取消关闭弹窗', async () => {
    const endStudy = vi.fn();
    const timer = createMockTimer({ phase: 'paused', endStudy });
    render(<TimerPage timer={timer} onRecordSaved={vi.fn()} />);

    await userEvent.click(screen.getByText('结束学习'));
    expect(screen.getByText('当前处于暂停中，确定结束吗？')).toBeInTheDocument();

    await userEvent.click(screen.getByText('取消'));
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
});
