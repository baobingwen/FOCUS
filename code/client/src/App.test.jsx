import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { subjectsApi, recordsApi } from './utils/api';
import useFreezeOnLeave from './hooks/useFreezeOnLeave';

vi.mock('./utils/api');
vi.mock('./hooks/useFreezeOnLeave');

beforeEach(() => {
  vi.clearAllMocks();
  subjectsApi.list.mockResolvedValue([
    { id: 1, name: '数学', sort_order: 0 },
    { id: 2, name: '英语', sort_order: 1 },
  ]);
  recordsApi.todayOverview.mockResolvedValue({
    total_study_ms: 0, total_rest_ms: 0, total_records: 0, by_subject: [],
  });
  recordsApi.list.mockResolvedValue({ records: [] });
});

describe('App', () => {
  it('默认显示计时页面', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
  });

  it('点击「历史」tab 切换到历史页面', async () => {
    render(<App />);

    await userEvent.click(screen.getByText('📋'));

    await waitFor(() => {
      expect(screen.getByText('📋 历史记录')).toBeInTheDocument();
    });
  });

  it('点击「计时」tab 切换回计时页面', async () => {
    render(<App />);

    await userEvent.click(screen.getByText('📋'));
    await waitFor(() => {
      expect(screen.getByText('📋 历史记录')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('⏱️'));
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
  });

  it('渲染 App 不接入 useFreezeOnLeave（离开页面冻结已停用，v0.4.3）', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });

    // 回归守卫：调用点已注释停用
    expect(useFreezeOnLeave).not.toHaveBeenCalled();
  });

  // ──── 全局管理模式测试（入口 = 右上角考研倒计时连点 5 下）────

  const multiTapCountdown = async () => {
    const el = screen.getByTestId('exam-countdown');
    for (let i = 0; i < 5; i++) {
      await userEvent.click(el);
    }
  };

  it('连点 5 下考研倒计时进入全局管理模式：横幅出现', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });

    await multiTapCountdown();

    expect(screen.getByText(/管理模式已开启/)).toBeInTheDocument();
    expect(screen.getByText('退出管理模式')).toBeInTheDocument();
  });

  it('管理模式横幅跨 tab 常驻：计时页进入后切历史页横幅仍在', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });

    await multiTapCountdown();
    expect(screen.getByText(/管理模式已开启/)).toBeInTheDocument();

    await userEvent.click(screen.getByText('📋'));
    await waitFor(() => {
      expect(screen.getByText('📋 历史记录')).toBeInTheDocument();
    });
    expect(screen.getByText(/管理模式已开启/)).toBeInTheDocument();
  });

  it('历史页也可连点考研倒计时进入管理模式（学习中状态同样有效）', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('📋'));
    await waitFor(() => {
      expect(screen.getByText('📋 历史记录')).toBeInTheDocument();
    });

    await multiTapCountdown();

    expect(screen.getByText(/管理模式已开启/)).toBeInTheDocument();
  });

  it('管理模式开启时自定义科目显示删除按钮，日常隐藏', async () => {
    subjectsApi.list.mockResolvedValue([
      { id: 1, name: '数学', sort_order: 0 },
      { id: 2, name: '英语', sort_order: 1 },
      { id: 3, name: '政治', sort_order: 2 },
    ]);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('政治')).toBeInTheDocument();
    });

    // 日常：自定义科目无 ×
    expect(screen.getByText('政治').closest('button').textContent).not.toContain('×');

    // 进入管理模式：× 出现
    await multiTapCountdown();
    expect(screen.getByText(/管理模式已开启/)).toBeInTheDocument();
    expect(screen.getByText('政治').closest('button').textContent).toContain('×');
  });

  it('点「退出管理模式」关闭横幅与删除入口', async () => {
    subjectsApi.list.mockResolvedValue([
      { id: 1, name: '数学', sort_order: 0 },
      { id: 2, name: '政治', sort_order: 1 },
    ]);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('政治')).toBeInTheDocument();
    });

    await multiTapCountdown();
    expect(screen.getByText('政治').closest('button').textContent).toContain('×');

    await userEvent.click(screen.getByText('退出管理模式'));

    expect(screen.queryByText(/管理模式已开启/)).not.toBeInTheDocument();
    expect(screen.getByText('政治').closest('button').textContent).not.toContain('×');
  });
});
