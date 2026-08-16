// code/client/src/components/ReminderBar.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReminderBar, { ROTATE_INTERVAL_MS } from './ReminderBar';
import { remindersApi } from '../utils/api';

vi.mock('../utils/api');

beforeEach(() => {
  vi.clearAllMocks();
  remindersApi.list.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ReminderBar', () => {
  it('空库：不显示提醒文字，只留 ＋ 入口', async () => {
    render(<ReminderBar />);
    await waitFor(() => expect(remindersApi.list).toHaveBeenCalled());
    expect(screen.queryByText(/💡/)).not.toBeInTheDocument();
    expect(screen.getByTestId('reminder-add')).toBeInTheDocument();
  });

  it('有条目：显示第一条内容', async () => {
    remindersApi.list.mockResolvedValue([
      { id: 1, content: '复习的关键在于反复多次和全面' },
      { id: 2, content: '及时回顾错题' },
    ]);
    render(<ReminderBar />);

    await waitFor(() => {
      expect(screen.getByText(/复习的关键在于反复多次和全面/)).toBeInTheDocument();
    });
  });

  it('每 15 分钟轮换到下一条（顺序循环）', async () => {
    vi.useFakeTimers();
    remindersApi.list.mockResolvedValue([
      { id: 1, content: '第一条' },
      { id: 2, content: '第二条' },
    ]);
    render(<ReminderBar />);

    // 初始显示第一条（flush 微任务等 list 加载完成）
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText(/第一条/)).toBeInTheDocument();

    // 15 分钟后轮到第二条
    act(() => { vi.advanceTimersByTime(ROTATE_INTERVAL_MS); });
    expect(screen.getByText(/第二条/)).toBeInTheDocument();

    // 再过 15 分钟回到第一条（循环）
    act(() => { vi.advanceTimersByTime(ROTATE_INTERVAL_MS); });
    expect(screen.getByText(/第一条/)).toBeInTheDocument();
  });

  it('不足 2 条不轮换（一直显示同一条）', async () => {
    vi.useFakeTimers();
    remindersApi.list.mockResolvedValue([{ id: 1, content: '唯一一条' }]);
    render(<ReminderBar />);

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    act(() => { vi.advanceTimersByTime(ROTATE_INTERVAL_MS * 3); });
    expect(screen.getByText(/唯一一条/)).toBeInTheDocument();
  });

  it('点 ＋ 弹框新增，保存后新条目展示在提醒条', async () => {
    remindersApi.list.mockResolvedValue([{ id: 1, content: '已有提醒' }]);
    remindersApi.create.mockResolvedValue({ id: 2, content: '新记的方法' });
    render(<ReminderBar />);

    await waitFor(() => expect(screen.getByText(/已有提醒/)).toBeInTheDocument());

    await userEvent.click(screen.getByTestId('reminder-add'));
    expect(screen.getByText('记录复习方法')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('例如：复习的关键在于反复多次和全面'), '新记的方法');
    await userEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(remindersApi.create).toHaveBeenCalledWith('新记的方法');
      expect(screen.getByText(/新记的方法/)).toBeInTheDocument();
    });
  });

  it('新增弹框内容为空时保存按钮 disabled', async () => {
    remindersApi.list.mockResolvedValue([]);
    render(<ReminderBar />);

    await waitFor(() => expect(screen.getByTestId('reminder-add')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('reminder-add'));

    const saveBtn = screen.getByText('保存').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  // ──── 管理模式 ────

  it('日常（admin=false）：不显示「管理」按钮', async () => {
    remindersApi.list.mockResolvedValue([{ id: 1, content: '提醒' }]);
    render(<ReminderBar />);
    await waitFor(() => expect(screen.getByText(/提醒/)).toBeInTheDocument());
    expect(screen.queryByTestId('reminder-manage')).not.toBeInTheDocument();
  });

  it('管理模式（admin=true）：显示「管理」按钮，点开弹窗列出全部条目', async () => {
    remindersApi.list.mockResolvedValue([
      { id: 1, content: '方法一' },
      { id: 2, content: '方法二' },
    ]);
    render(<ReminderBar admin />);

    await waitFor(() => expect(screen.getByText(/方法一/)).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('reminder-manage'));

    expect(screen.getByText('管理复习提醒')).toBeInTheDocument();
    expect(screen.getAllByText(/方法/).length).toBeGreaterThanOrEqual(2);
  });

  it('管理模式弹窗：编辑条目保存后更新', async () => {
    remindersApi.list.mockResolvedValue([{ id: 1, content: '旧内容' }]);
    remindersApi.update.mockResolvedValue({ id: 1, content: '新内容' });
    render(<ReminderBar admin />);

    await waitFor(() => expect(screen.getByText(/旧内容/)).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('reminder-manage'));
    await userEvent.click(screen.getByTitle('编辑'));

    const textarea = screen.getByDisplayValue('旧内容');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, '新内容');
    await userEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(remindersApi.update).toHaveBeenCalledWith(1, '新内容');
      expect(screen.getAllByText(/新内容/).length).toBeGreaterThan(0);
    });
  });

  it('管理模式弹窗：删除条目后从列表移除', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    remindersApi.list.mockResolvedValue([
      { id: 1, content: '要删的' },
      { id: 2, content: '保留的' },
    ]);
    remindersApi.delete.mockResolvedValue({ success: true });
    render(<ReminderBar admin />);

    await waitFor(() => expect(screen.getByText(/要删的/)).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('reminder-manage'));

    // 弹窗内找到「要删的」条目所在行的删除按钮
    const deleteBtn = screen.getAllByTitle('删除').find((btn) => btn.closest('li')?.textContent?.includes('要删的'));
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(remindersApi.delete).toHaveBeenCalledWith(1);
      expect(screen.queryByText(/要删的/)).not.toBeInTheDocument();
      expect(screen.getAllByText(/保留的/).length).toBeGreaterThan(0);
    });
  });

  it('管理模式弹窗：confirm 拒绝时不删除', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    remindersApi.list.mockResolvedValue([{ id: 1, content: '不删的' }]);
    render(<ReminderBar admin />);

    await waitFor(() => expect(screen.getByText(/不删的/)).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('reminder-manage'));
    await userEvent.click(screen.getAllByTitle('删除')[0]);

    expect(remindersApi.delete).not.toHaveBeenCalled();
    expect(screen.getAllByText(/不删的/).length).toBeGreaterThan(0);
  });

  it('管理模式弹窗：关闭按钮关闭弹窗', async () => {
    remindersApi.list.mockResolvedValue([{ id: 1, content: '提醒' }]);
    render(<ReminderBar admin />);

    await waitFor(() => expect(screen.getByText(/提醒/)).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('reminder-manage'));
    expect(screen.getByText('管理复习提醒')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('reminder-manage-close'));
    expect(screen.queryByText('管理复习提醒')).not.toBeInTheDocument();
  });
});
