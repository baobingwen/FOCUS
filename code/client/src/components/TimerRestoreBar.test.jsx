// code/client/src/components/TimerRestoreBar.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerRestoreBar from './TimerRestoreBar';

/** 构造一份 mock timer（默认学习中恢复态） */
function makeTimer(overrides = {}) {
  return {
    restoreInfo: {
      phase: 'studying',
      subjectName: '数学',
      elapsedAtClose: 12 * 60 * 1000 + 34 * 1000, // 12:34
      awayMs: 5 * 60 * 1000, // 5分
    },
    awayIgnored: false,
    ignoreAwayTime: vi.fn(),
    countAwayTime: vi.fn(),
    discardRestore: vi.fn(),
    dismissRestore: vi.fn(),
    ...overrides,
  };
}

describe('TimerRestoreBar', () => {
  it('restoreInfo 为 null 时不渲染', () => {
    const { container } = render(<TimerRestoreBar timer={makeTimer({ restoreInfo: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('学习中恢复：展示科目/已学时长/离开时长与两个动作按钮', () => {
    render(<TimerRestoreBar timer={makeTimer()} />);

    expect(screen.getByText(/已恢复上次学习：数学/)).toBeInTheDocument();
    expect(screen.getByText(/已学 12:34/)).toBeInTheDocument();
    expect(screen.getByText(/离开 5分/)).toBeInTheDocument();
    expect(screen.getByText('忽略离开时间')).toBeInTheDocument();
    expect(screen.getByText('放弃本次学习')).toBeInTheDocument();
  });

  it('休息中恢复：展示「已恢复上次休息 · 已休息 …」', () => {
    render(<TimerRestoreBar timer={makeTimer({
      restoreInfo: { phase: 'resting', subjectName: null, elapsedAtClose: 5 * 60 * 1000, awayMs: 60000 },
    })} />);

    expect(screen.getByText(/已恢复上次休息/)).toBeInTheDocument();
    expect(screen.getByText(/已休息 05:00/)).toBeInTheDocument();
    expect(screen.getByText(/离开 1分/)).toBeInTheDocument();
    expect(screen.queryByText(/上次学习/)).not.toBeInTheDocument();
  });

  it('点「忽略离开时间」调用 ignoreAwayTime', async () => {
    const timer = makeTimer();
    render(<TimerRestoreBar timer={timer} />);

    await userEvent.click(screen.getByText('忽略离开时间'));

    expect(timer.ignoreAwayTime).toHaveBeenCalledTimes(1);
    expect(timer.countAwayTime).not.toHaveBeenCalled();
  });

  it('awayIgnored 时按钮显示「计入离开时间」，点击调用 countAwayTime', async () => {
    const timer = makeTimer({ awayIgnored: true });
    render(<TimerRestoreBar timer={timer} />);

    expect(screen.getByText('计入离开时间')).toBeInTheDocument();
    expect(screen.queryByText('忽略离开时间')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('计入离开时间'));

    expect(timer.countAwayTime).toHaveBeenCalledTimes(1);
  });

  it('点「放弃本次学习」调用 discardRestore', async () => {
    const timer = makeTimer();
    render(<TimerRestoreBar timer={timer} />);

    await userEvent.click(screen.getByText('放弃本次学习'));

    expect(timer.discardRestore).toHaveBeenCalledTimes(1);
  });

  it('点 ✕ 调用 dismissRestore（仅关闭提示条，不影响计时与快照）', async () => {
    const timer = makeTimer();
    render(<TimerRestoreBar timer={timer} />);

    await userEvent.click(screen.getByRole('button', { name: '关闭恢复提示条' }));

    expect(timer.dismissRestore).toHaveBeenCalledTimes(1);
  });
});
