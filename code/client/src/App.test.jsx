import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { subjectsApi, recordsApi } from './utils/api';

vi.mock('./utils/api');

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
});
