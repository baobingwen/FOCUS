// code/client/src/components/ExamCountdown.test.jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExamCountdown from './ExamCountdown';

afterEach(() => {
  vi.useRealTimers();
});

describe('ExamCountdown', () => {
  it('距考研还有 159 天（2026-07-13 → 2026-12-19）', () => {
    vi.useFakeTimers({ now: new Date(2026, 6, 13) });
    render(<ExamCountdown />);
    expect(screen.getByText('距离考研 159 天')).toBeInTheDocument();
  });

  it('考研日期（2026-12-19）当天显示「考研日」', () => {
    vi.useFakeTimers({ now: new Date(2026, 11, 19) });
    render(<ExamCountdown />);
    expect(screen.getByText('📅 考研日')).toBeInTheDocument();
  });

  it('考研日期过后（2027-01-01）不渲染', () => {
    vi.useFakeTimers({ now: new Date(2027, 0, 1) });
    const { container } = render(<ExamCountdown />);
    expect(container.innerHTML).toBe('');
  });

  // ──── 管理模式隐藏入口（连点 5 下）────

  it('连点 5 下调用 onMultiTap（管理模式入口）', async () => {
    // 只 fake Date
    vi.useFakeTimers({ now: new Date(2026, 6, 13), toFake: ['Date'] });
    const onMultiTap = vi.fn();
    render(<ExamCountdown onMultiTap={onMultiTap} />);

    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByTestId('exam-countdown'));
    }

    expect(onMultiTap).toHaveBeenCalledTimes(1);
  });

  it('连点不足 5 下不触发 onMultiTap', async () => {
    vi.useFakeTimers({ now: new Date(2026, 6, 13), toFake: ['Date'] });
    const onMultiTap = vi.fn();
    render(<ExamCountdown onMultiTap={onMultiTap} />);

    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByTestId('exam-countdown'));
    }

    expect(onMultiTap).not.toHaveBeenCalled();
  });
});
