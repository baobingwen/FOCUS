// code/client/src/components/ExamCountdown.test.jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
});
