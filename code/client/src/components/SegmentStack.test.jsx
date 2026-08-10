import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SegmentStack from './SegmentStack';

const segments = [
  { type: 'study', duration_ms: 600000 },
  { type: 'pause', duration_ms: 100000 },
  { type: 'study', duration_ms: 900000 },
];

describe('SegmentStack 千层饼', () => {
  it('空 segments 不渲染', () => {
    const { container } = render(<SegmentStack segments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('渲染每个段为一行（学习/暂停标签 + 时长）', () => {
    render(<SegmentStack segments={segments} />);

    const rows = screen.getAllByTestId('segment-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('学习');
    expect(rows[1].textContent).toContain('暂停');
    expect(rows[2].textContent).toContain('学习');
  });

  it('段自下而上显示（最早段在最下、最晚段在最上）', () => {
    render(<SegmentStack segments={segments} />);

    const rows = screen.getAllByTestId('segment-row');
    // 最上 = 最晚段（study 900000 → 15:00）
    expect(rows[0].textContent).toContain('15:00');
    // 中间 = 暂停段（100000 → 01:40）
    expect(rows[1].textContent).toContain('01:40');
    // 最下 = 最早段（study 600000 → 10:00）
    expect(rows[2].textContent).toContain('10:00');
  });

  it('汇总显示总计，含暂停时显示暂停时长', () => {
    render(<SegmentStack segments={segments} />);

    // 总计 1600000 → 26:40；含暂停 100000 → 01:40
    expect(screen.getByText(/总计 26:40/)).toBeInTheDocument();
    expect(screen.getByText(/含暂停 01:40/)).toBeInTheDocument();
  });

  it('无暂停段时不显示「含暂停」', () => {
    render(<SegmentStack segments={[{ type: 'study', duration_ms: 600000 }]} />);

    expect(screen.getByText(/总计 10:00/)).toBeInTheDocument();
    expect(screen.queryByText(/含暂停/)).not.toBeInTheDocument();
  });
});
