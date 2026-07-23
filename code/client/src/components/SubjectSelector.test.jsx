import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubjectSelector from './SubjectSelector';
import { subjectsApi } from '../utils/api';

vi.mock('../utils/api');

const defaultSubjects = [
  { id: 1, name: '数学', sort_order: 0 },
  { id: 2, name: '英语', sort_order: 1 },
  { id: 3, name: '专业课', sort_order: 2 },
];

const mockSubjects = [...defaultSubjects, { id: 4, name: '政治', sort_order: 3 }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SubjectSelector', () => {
  it('loading 态显示加载中', () => {
    subjectsApi.list.mockReturnValueOnce(new Promise(() => {}));
    render(<SubjectSelector selected={null} onSelect={vi.fn()} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('加载成功后显示科目列表', async () => {
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    render(<SubjectSelector selected={null} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('数学')).toBeInTheDocument();
    });
    expect(screen.getByText('英语')).toBeInTheDocument();
    expect(screen.getByText('专业课')).toBeInTheDocument();
  });

  it('点击科目调用 onSelect', async () => {
    const onSelect = vi.fn();
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    render(<SubjectSelector selected={null} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('数学')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('数学'));
    expect(onSelect).toHaveBeenCalledWith(defaultSubjects[0]);
  });

  it('选中科目的按钮包含蓝色样式', async () => {
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    render(<SubjectSelector selected={defaultSubjects[0]} onSelect={vi.fn()} />);

    await waitFor(() => {
      const btn = screen.getByText('数学').closest('button');
      expect(btn.className).toContain('bg-blue-500');
    });
  });

  it('点击 + 新增 显示输入框', async () => {
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    render(<SubjectSelector selected={null} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('数学')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('+ 新增'));
    expect(screen.getByPlaceholderText('输入科目名')).toBeInTheDocument();
  });

  it('输入科目名后确认调用 subjectsApi.create', async () => {
    const newSubject = { id: 5, name: '物理', sort_order: 3 };
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    subjectsApi.create.mockResolvedValueOnce(newSubject);
    render(<SubjectSelector selected={null} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('数学')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('+ 新增'));
    await userEvent.type(screen.getByPlaceholderText('输入科目名'), '物理');
    await userEvent.click(screen.getByText('确认'));

    expect(subjectsApi.create).toHaveBeenCalledWith('物理');
    await waitFor(() => {
      expect(screen.getByText('物理')).toBeInTheDocument();
    });
  });

  it('输入框按 Enter 触发生成', async () => {
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    subjectsApi.create.mockResolvedValueOnce({ id: 5, name: '历史', sort_order: 3 });
    render(<SubjectSelector selected={null} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('数学')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('+ 新增'));
    const input = screen.getByPlaceholderText('输入科目名');
    await userEvent.type(input, '历史{Enter}');

    expect(subjectsApi.create).toHaveBeenCalledWith('历史');
  });

  it('删除自定义科目（confirm=true）', async () => {
    window.confirm = vi.fn(() => true);
    subjectsApi.list.mockResolvedValueOnce(mockSubjects);
    subjectsApi.delete.mockResolvedValueOnce({});
    const onSelect = vi.fn();
    render(<SubjectSelector selected={null} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('政治')).toBeInTheDocument();
    });

    // 找到政治按钮上的 ×
    const delBtn = screen.getByText('政治').closest('button').querySelector('span:last-child');
    await userEvent.click(delBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(subjectsApi.delete).toHaveBeenCalledWith(4);
  });

  it('默认科目（数学/英语/专业课）没有删除按钮', async () => {
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    render(<SubjectSelector selected={null} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('数学')).toBeInTheDocument();
    });

    // 默认科目按钮内不应该有 × 字符
    const mathBtn = screen.getByText('数学').closest('button');
    expect(mathBtn.textContent).not.toContain('×');
  });

  it('删除当前选中科目时调用 onSelect(null)', async () => {
    window.confirm = vi.fn(() => true);
    subjectsApi.list.mockResolvedValueOnce(mockSubjects);
    subjectsApi.delete.mockResolvedValueOnce({});
    const onSelect = vi.fn();
    render(<SubjectSelector selected={mockSubjects[3]} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('政治')).toBeInTheDocument();
    });

    const delBtn = screen.getByText('政治').closest('button').querySelector('span:last-child');
    await userEvent.click(delBtn);

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });

  it('删除时 confirm=false 不执行删除', async () => {
    window.confirm = vi.fn(() => false);
    subjectsApi.list.mockResolvedValueOnce(mockSubjects);
    const onSelect = vi.fn();
    render(<SubjectSelector selected={null} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('政治')).toBeInTheDocument();
    });

    const delBtn = screen.getByText('政治').closest('button').querySelector('span:last-child');
    await userEvent.click(delBtn);

    expect(subjectsApi.delete).not.toHaveBeenCalled();
  });

  it('渲染「☕ 休息」按钮', async () => {
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    render(<SubjectSelector selected={null} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('☕ 休息')).toBeInTheDocument();
    });
  });

  it('点击「☕ 休息」调用 onSelect(REST)', async () => {
    const onSelect = vi.fn();
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    render(<SubjectSelector selected={null} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('☕ 休息')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('☕ 休息'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: '__rest__', name: '☕ 休息' })
    );
  });

  it('选中休息时按钮包含蓝色样式', async () => {
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    const restMarker = { id: '__rest__', name: '☕ 休息' };
    render(<SubjectSelector selected={restMarker} onSelect={vi.fn()} />);

    await waitFor(() => {
      const btn = screen.getByText('☕ 休息').closest('button');
      expect(btn.className).toContain('bg-blue-500');
    });
  });

  it('不能创建名为「休息」的科目', async () => {
    window.alert = vi.fn();
    subjectsApi.list.mockResolvedValueOnce(defaultSubjects);
    render(<SubjectSelector selected={null} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('数学')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('+ 新增'));
    await userEvent.type(screen.getByPlaceholderText('输入科目名'), '休息');
    await userEvent.click(screen.getByText('确认'));

    expect(window.alert).toHaveBeenCalledWith('「休息」为内置选项，无需添加');
    expect(subjectsApi.create).not.toHaveBeenCalled();
  });
});
