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
    startRest: vi.fn(),
    endRest: vi.fn(),
    skipRest: vi.fn(),
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
    expect(screen.getByText('请先选择一个科目')).toBeInTheDocument();
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
    const endStudy = vi.fn(() => 5000);
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
      notes: '做练习',
    });
    await waitFor(() => {
      expect(onRecordSaved).toHaveBeenCalled();
    });
  });

  it('结束学习 → API 失败 → 显示错误 toast', async () => {
    const endStudy = vi.fn(() => 5000);
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
});
