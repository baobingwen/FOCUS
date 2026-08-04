import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagPicker from './TagPicker';
import { tagsApi } from '../utils/api';

vi.mock('../utils/api');

// sortablejs 用假类替换：记录实例，测试里可手动触发 onUpdate 模拟拖拽
vi.mock('sortablejs', () => {
  class MockSortable {
    constructor(el, options) {
      this.el = el;
      this.options = options;
      MockSortable.instances.push(this);
    }
    destroy() {
      MockSortable.instances = MockSortable.instances.filter(i => i !== this);
    }
  }
  MockSortable.instances = [];
  MockSortable.simulateUpdate = (oldIndex, newIndex) => {
    const latest = MockSortable.instances[MockSortable.instances.length - 1];
    latest?.options.onUpdate?.({ oldIndex, newIndex });
  };
  return { default: MockSortable };
});

import Sortable from 'sortablejs';

const TAGS = [
  { id: 1, name: '高数' },
  { id: 2, name: '线代' },
  { id: 3, name: '真题' },
];

/** 提取芯片显示名（去掉 ≡ 手柄和 × 删除符） */
const chipNames = () =>
  screen.getAllByTestId('tag-chip').map(el => el.textContent.replace(/[≡×]/g, '').trim());

function setup(overrides = {}) {
  const user = userEvent.setup();
  render(<TagPicker selected={[]} onToggle={vi.fn()} {...overrides} />);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  tagsApi.list.mockResolvedValue(TAGS);
});

// ──────────────────────────────────────────────
// 排序入口
// ──────────────────────────────────────────────
describe('排序入口', () => {
  it('少于 2 个标签时排序按钮禁用', async () => {
    tagsApi.list.mockResolvedValue([{ id: 1, name: '高数' }]);
    setup();

    const toggle = await screen.findByTestId('sort-toggle');
    expect(toggle).toBeDisabled();
  });

  it('≥2 个标签时排序按钮可点', async () => {
    setup();

    const toggle = await screen.findByTestId('sort-toggle');
    expect(toggle).toBeEnabled();
  });
});

// ──────────────────────────────────────────────
// 排序模式
// ──────────────────────────────────────────────
describe('排序模式', () => {
  it('点击 ⚙ 进入：显示手柄，隐藏删除 ×、新增和 ⚙', async () => {
    const user = setup();
    await user.click(await screen.findByTestId('sort-toggle'));

    expect(screen.getAllByTestId('tag-drag-handle')).toHaveLength(3);
    expect(screen.getByTestId('sort-done')).toBeInTheDocument();
    expect(screen.getByTestId('sort-cancel')).toBeInTheDocument();
    expect(screen.queryByTestId('sort-toggle')).not.toBeInTheDocument();
    expect(screen.queryByText('+ 标签')).not.toBeInTheDocument();
    expect(screen.queryByText('×')).not.toBeInTheDocument();
  });

  it('排序模式下点芯片不触发点选', async () => {
    const onToggle = vi.fn();
    const user = setup({ onToggle });
    await user.click(await screen.findByTestId('sort-toggle'));

    await user.click(screen.getAllByTestId('tag-chip')[0]);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('拖拽换位后点完成：提交新顺序并退出排序模式', async () => {
    tagsApi.reorder.mockResolvedValue({ success: true });
    const user = setup();
    await user.click(await screen.findByTestId('sort-toggle'));

    act(() => Sortable.simulateUpdate(0, 2));
    expect(chipNames()).toEqual(['线代', '真题', '高数']);

    await user.click(screen.getByTestId('sort-done'));

    expect(tagsApi.reorder).toHaveBeenCalledWith([2, 3, 1]);
    await waitFor(() => expect(screen.queryByTestId('sort-done')).not.toBeInTheDocument());
    expect(screen.queryByTestId('tag-drag-handle')).not.toBeInTheDocument();
  });

  it('取消排序：恢复原顺序且不提交', async () => {
    const user = setup();
    await user.click(await screen.findByTestId('sort-toggle'));

    act(() => Sortable.simulateUpdate(0, 2));
    expect(chipNames()).toEqual(['线代', '真题', '高数']);

    await user.click(screen.getByTestId('sort-cancel'));

    expect(chipNames()).toEqual(['高数', '线代', '真题']);
    expect(tagsApi.reorder).not.toHaveBeenCalled();
    expect(screen.queryByTestId('tag-drag-handle')).not.toBeInTheDocument();
  });

  it('提交失败：alert 提示并留在排序模式', async () => {
    tagsApi.reorder.mockRejectedValue(new Error('排序失败'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = setup();
    await user.click(await screen.findByTestId('sort-toggle'));

    await user.click(screen.getByTestId('sort-done'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('排序失败'));
    expect(screen.getByTestId('sort-done')).toBeInTheDocument();
    alertSpy.mockRestore();
  });
});
