import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { subjectsApi, recordsApi, exportApi, importApi, tagsApi, remindersApi } from './utils/api';
import useFreezeOnLeave from './hooks/useFreezeOnLeave';
import { saveTimerSnapshot } from './utils/timerStorage';

vi.mock('./utils/api');
vi.mock('./hooks/useFreezeOnLeave');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear(); // 计时快照隔离：避免上个用例的学习态污染下个用例
  subjectsApi.list.mockResolvedValue([
    { id: 1, name: '数学', sort_order: 0 },
    { id: 2, name: '英语', sort_order: 1 },
  ]);
  recordsApi.todayOverview.mockResolvedValue({
    total_study_ms: 0, total_rest_ms: 0, total_records: 0, by_subject: [],
  });
  recordsApi.list.mockResolvedValue({ records: [] });
  // 学习中渲染 TagPicker / ReminderBar 会拉取标签库与提醒
  tagsApi.list.mockResolvedValue([]);
  remindersApi.list.mockResolvedValue([]);
  exportApi.download.mockResolvedValue({
    blob: new Blob(['{}'], { type: 'application/json' }),
    filename: 'focus-export-20260706-123456.json',
  });
  importApi.submit.mockResolvedValue({ success: true, counts: {} });
  // jsdom 不实现 URL.createObjectURL / revokeObjectURL，测试中 stub
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

/** 构造一份最小完整导出 payload */
function makePayload() {
  return {
    app: 'FOCUS',
    version: '0.3.5',
    exported_at: '2026-08-27 12:00:00',
    data: {
      records: [{ id: 1, mode: 'study', subject: '数学', duration_ms: 3600000 }],
      subjects: [{ id: 1, name: '数学', sort_order: 0 }],
      tags: [{ id: 2, name: '高数', sort_order: 0 }],
      record_tags: [{ record_id: 1, tag_id: 2 }],
      reminder_items: [{ id: 3, content: '反复多次', sort_order: 0 }],
    },
  };
}

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

  // ──── 数据导出（管理模式横幅按钮）────

  it('「导出数据」按钮仅在管理模式开启时显示', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });

    // 日常：无导出按钮
    expect(screen.queryByText('导出数据')).not.toBeInTheDocument();

    // 管理模式：横幅出现导出按钮
    await multiTapCountdown();
    expect(screen.getByText('导出数据')).toBeInTheDocument();
  });

  it('点击「导出数据」调用 exportApi.download 并触发浏览器下载', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    await userEvent.click(screen.getByText('导出数据'));

    await waitFor(() => {
      expect(exportApi.download).toHaveBeenCalledTimes(1);
      // 触发 <a download> 点击下载
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('导出中：按钮禁用并显示「导出中…」', async () => {
    // Loading 态：保持 pending 不 resolve，避免 act 告警
    exportApi.download.mockReturnValueOnce(new Promise(() => {}));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    await userEvent.click(screen.getByText('导出数据'));

    await waitFor(() => {
      expect(screen.getByText('导出中…')).toBeInTheDocument();
    });
    expect(screen.getByText('导出中…').closest('button')).toBeDisabled();
  });

  it('导出失败：alert 提示错误信息', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    exportApi.download.mockRejectedValueOnce(new Error('导出数据失败'));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    await userEvent.click(screen.getByText('导出数据'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('导出失败：导出数据失败');
    });
  });

  // ──── 数据导入（管理模式横幅按钮）────

  it('「导入数据」按钮仅在管理模式开启时显示', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });

    // 日常：无导入按钮
    expect(screen.queryByText('导入数据')).not.toBeInTheDocument();

    // 管理模式：横幅出现导入按钮
    await multiTapCountdown();
    expect(screen.getByText('导入数据')).toBeInTheDocument();
  });

  it('学习中点击「导入数据」：alert 提示先结束学习，不打开文件选择框', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('数学')).toBeInTheDocument();
    });

    // 进入学习态：选科目 → 开始学习（大按钮可访问名含 ▶ 图标）
    await userEvent.click(screen.getByRole('button', { name: '数学' }));
    await userEvent.click(screen.getByRole('button', { name: /开始学习/ }));
    expect(screen.getByText('结束学习')).toBeInTheDocument();

    await multiTapCountdown();

    await userEvent.click(screen.getByText('导入数据'));

    expect(alertSpy).toHaveBeenCalledWith('学习中不能导入数据，请先结束当前学习');
  });

  it('选择有效导出文件：确认弹窗展示文件名/统计/风险提示', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    const file = new File([JSON.stringify(makePayload())], 'focus-export-20260827-120000.json', {
      type: 'application/json',
    });
    const input = document.querySelector('input[type="file"]');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('确认导入数据')).toBeInTheDocument();
    });
    expect(screen.getByText(/focus-export-20260827-120000\.json/)).toBeInTheDocument();
    expect(screen.getByText(/1 条记录 · 1 个科目 · 1 个标签 · 1 条提醒/)).toBeInTheDocument();
    expect(screen.getByText(/导入将替换当前全部数据/)).toBeInTheDocument();
    expect(screen.getByText('先下载当前备份')).toBeInTheDocument();
  });

  it('确认弹窗「取消」：关闭弹窗不导入', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    const file = new File([JSON.stringify(makePayload())], 'focus-export.json', { type: 'application/json' });
    await userEvent.upload(document.querySelector('input[type="file"]'), file);

    await waitFor(() => {
      expect(screen.getByText('确认导入数据')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('取消'));

    expect(screen.queryByText('确认导入数据')).not.toBeInTheDocument();
    expect(importApi.submit).not.toHaveBeenCalled();
  });

  it('确认弹窗「先下载当前备份」：复用导出 API 下载当前数据', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    const file = new File([JSON.stringify(makePayload())], 'focus-export.json', { type: 'application/json' });
    await userEvent.upload(document.querySelector('input[type="file"]'), file);

    await waitFor(() => {
      expect(screen.getByText('先下载当前备份')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('先下载当前备份'));

    await waitFor(() => {
      expect(exportApi.download).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('确认导入：调用 importApi.submit → alert 导入完成 → 整页刷新', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    // jsdom 的 location.reload 不可直接 spy，整体替换 location 对象
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    const payload = makePayload();
    const file = new File([JSON.stringify(payload)], 'focus-export.json', { type: 'application/json' });
    await userEvent.upload(document.querySelector('input[type="file"]'), file);

    await waitFor(() => {
      expect(screen.getByText('确认导入')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('确认导入'));

    await waitFor(() => {
      expect(importApi.submit).toHaveBeenCalledWith(payload);
    });
    expect(alertSpy).toHaveBeenCalledWith('导入完成，页面即将刷新');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('导入中：横幅按钮与确认按钮都禁用并显示「导入中…」', async () => {
    // Loading 态：保持 pending 不 resolve，避免 act 告警
    importApi.submit.mockReturnValueOnce(new Promise(() => {}));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    const file = new File([JSON.stringify(makePayload())], 'focus-export.json', { type: 'application/json' });
    await userEvent.upload(document.querySelector('input[type="file"]'), file);

    await waitFor(() => {
      expect(screen.getByText('确认导入')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('确认导入'));

    // 「导入中…」同时出现在横幅按钮与弹窗确认按钮（两处都应禁用）
    await waitFor(() => {
      expect(screen.getAllByText('导入中…').length).toBeGreaterThan(0);
    });
    for (const el of screen.getAllByText('导入中…')) {
      expect(el.closest('button')).toBeDisabled();
    }
  });

  it('导入失败：alert 提示错误信息，弹窗保持可重试', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    importApi.submit.mockRejectedValueOnce(new Error('导入数据失败'));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    const file = new File([JSON.stringify(makePayload())], 'focus-export.json', { type: 'application/json' });
    await userEvent.upload(document.querySelector('input[type="file"]'), file);

    await waitFor(() => {
      expect(screen.getByText('确认导入')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('确认导入'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('导入失败：导入数据失败');
    });
    // 弹窗未关闭，可重试
    expect(screen.getByText('确认导入')).toBeInTheDocument();
  });

  it('非 JSON 文件：alert 提示解析失败', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    const file = new File(['not-json'], 'bad.json', { type: 'application/json' });
    await userEvent.upload(document.querySelector('input[type="file"]'), file);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('导入文件解析失败：不是有效的 JSON 文件');
    });
    expect(screen.queryByText('确认导入数据')).not.toBeInTheDocument();
  });

  it('app 不是 FOCUS 的文件：alert 提示不是有效导出文件', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    await multiTapCountdown();

    const file = new File([JSON.stringify({ app: 'OTHER', data: {} })], 'other.json', { type: 'application/json' });
    await userEvent.upload(document.querySelector('input[type="file"]'), file);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('不是有效的 FOCUS 导出文件');
    });
  });

  // ──── 计时快照恢复（刷新/崩溃后自动恢复）────

  /** 播种一份合法 studying 快照：已学 12:34 · 离开 5 分钟前最后写入 */
  function seedTimerSnapshot() {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    saveTimerSnapshot({
      version: 1,
      phase: 'studying',
      segmentStart: fiveMinAgo,
      accumulatedStudy: 754000, // 12:34
      accumulatedPause: 0,
      segments: [{ type: 'study', duration_ms: 754000 }],
      subject: { id: 1, name: '数学' },
      notes: '',
      tags: [],
      pages: null,
      updatedAt: fiveMinAgo,
    });
  }

  it('存在合法快照：打开页面自动恢复计时并显示提示条', async () => {
    seedTimerSnapshot();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/已恢复上次学习：数学/)).toBeInTheDocument();
    });
    expect(screen.getByText(/已学 12:34/)).toBeInTheDocument();
    expect(screen.getByText(/离开 5分/)).toBeInTheDocument();
    // 计时器已恢复为学习中状态
    expect(screen.getByText('结束学习')).toBeInTheDocument();
  });

  it('点「放弃本次学习」：清快照回空闲，提示条消失', async () => {
    seedTimerSnapshot();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/已恢复上次学习/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('放弃本次学习'));

    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    expect(screen.queryByText(/已恢复上次学习/)).not.toBeInTheDocument();
    expect(localStorage.getItem('focus:timer:snapshot')).toBeNull();
  });

  it('点「忽略离开时间」：按钮切换为「计入离开时间」', async () => {
    seedTimerSnapshot();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/已恢复上次学习/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('忽略离开时间'));

    expect(screen.getByText('计入离开时间')).toBeInTheDocument();
    expect(screen.queryByText('忽略离开时间')).not.toBeInTheDocument();
  });

  it('点 ✕ 关闭提示条：计时继续、快照保留', async () => {
    seedTimerSnapshot();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/已恢复上次学习/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: '关闭恢复提示条' }));

    expect(screen.queryByText(/已恢复上次学习/)).not.toBeInTheDocument();
    // 计时继续（学习中状态仍在）
    expect(screen.getByText('结束学习')).toBeInTheDocument();
    // 快照保留（下次刷新仍可恢复）
    expect(localStorage.getItem('focus:timer:snapshot')).not.toBeNull();
  });

  it('无快照时不显示恢复提示条', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('🎯 FOCUS')).toBeInTheDocument();
    });
    expect(screen.queryByText(/已恢复上次学习/)).not.toBeInTheDocument();
  });
});
