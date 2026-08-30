import React, { useState, useCallback, useRef } from 'react';
import TimerPage from './components/TimerPage';
import HistoryPage from './components/HistoryPage';
import ExamCountdown from './components/ExamCountdown';
import useTimer from './hooks/useTimer';
import TimerRestoreBar from './components/TimerRestoreBar';
import { exportApi, importApi } from './utils/api';
import { loadTimerSnapshot } from './utils/timerStorage';
// 停用（v0.4.3）：逻辑移除「学习中离开页面暂停」功能
// import useFreezeOnLeave from './hooks/useFreezeOnLeave';

const TABS = [
  { key: 'timer', label: '计时', icon: '⏱️' },
  { key: 'history', label: '历史', icon: '📋' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('timer');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  // 全局管理模式
  const [adminMode, setAdminMode] = useState(false);
  // 数据导出中状态（管理模式横幅按钮）
  const [exporting, setExporting] = useState(false);
  // 数据导入状态：导入中 + 确认弹窗预览（选择文件解析后待确认）
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  // 隐藏的文件选择框（导入入口）
  const fileInputRef = useRef(null);
  // 计时快照：挂载时从 localStorage 读取（无快照/非法 → null），水合 useTimer 恢复计时
  const [initialTimerSnapshot] = useState(() => loadTimerSnapshot());
  const timer = useTimer(initialTimerSnapshot);

  // 停用（v0.4.3）：逻辑移除「学习中离开页面暂停」功能
  // useFreezeOnLeave(timer);

  const handleRecordSaved = useCallback(() => {
    setHistoryRefreshKey(k => k + 1);
  }, []);

  const enterAdminMode = useCallback(() => setAdminMode(true), []);
  const exitAdminMode = useCallback(() => setAdminMode(false), []);

  /**
   * 触发浏览器下载（创建对象 URL + 隐藏 a 标签点击）
   * @param {Blob} blob - 下载内容
   * @param {string} filename - 下载文件名
   * @returns {void}
   */
  const downloadBlob = useCallback((blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  /**
   * 导出全部数据为 JSON 文件下载（管理模式横幅按钮）
   * @returns {Promise<void>}
   */
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { blob, filename } = await exportApi.download();
      downloadBlob(blob, filename);
    } catch (err) {
      alert(`导出失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }, [downloadBlob]);

  /**
   * 点击「导入数据」：学习中禁止（替换科目表后当前学习记录会以旧科目名保存），否则打开文件选择框
   * @returns {void}
   */
  const handleImportClick = useCallback(() => {
    if (timer.phase !== 'idle') {
      alert('学习中不能导入数据，请先结束当前学习');
      return;
    }
    fileInputRef.current?.click();
  }, [timer.phase]);

  /**
   * 选择导入文件：读取 → 解析 → 校验顶层结构 → 生成确认弹窗预览
   * @param {React.ChangeEvent<HTMLInputElement>} e - 文件选择事件
   * @returns {Promise<void>}
   */
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    // 清空 value 允许重新选择同一文件
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || payload.app !== 'FOCUS' || !payload.data) {
        alert('不是有效的 FOCUS 导出文件');
        return;
      }
      const d = payload.data;
      const counts = {
        records: Array.isArray(d.records) ? d.records.length : 0,
        subjects: Array.isArray(d.subjects) ? d.subjects.length : 0,
        tags: Array.isArray(d.tags) ? d.tags.length : 0,
        reminders: Array.isArray(d.reminder_items) ? d.reminder_items.length : 0,
      };
      setImportPreview({
        filename: file.name,
        exported_at: payload.exported_at || '未知',
        version: payload.version || '未知',
        counts,
        payload,
      });
    } catch {
      alert('导入文件解析失败：不是有效的 JSON 文件');
    }
  }, []);

  /**
   * 确认弹窗内「先下载当前备份」：复用导出 API 下载当前数据
   * @returns {Promise<void>}
   */
  const handleBackupDownload = useCallback(async () => {
    try {
      const { blob, filename } = await exportApi.download();
      downloadBlob(blob, filename);
    } catch (err) {
      alert(`备份下载失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }, [downloadBlob]);

  /**
   * 确认导入：提交完整导出 JSON → 成功提示后整页刷新（数据重拉、计时器回 idle）
   * @returns {Promise<void>}
   */
  const handleConfirmImport = useCallback(async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      await importApi.submit(importPreview.payload);
      alert('导入完成，页面即将刷新');
      window.location.reload();
    } catch (err) {
      alert(`导入失败：${err instanceof Error ? err.message : String(err)}`);
      setImporting(false);
    }
  }, [importPreview]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col mx-auto relative overflow-hidden"
         style={{ maxWidth: '430px' }}>

        {/* 考研倒计时（右上角）= 管理模式隐藏入口 */}
        <ExamCountdown onMultiTap={enterAdminMode} />

        {/* 计时快照恢复提示条（自动恢复计时时显示，跨 tab 常驻） */}
        {timer.restored && <TimerRestoreBar timer={timer} />}

        {/* 管理模式横幅 */}
        {adminMode && (
          <div className="flex items-center justify-between gap-2 mt-12 mx-4 px-3 py-2 rounded-xl bg-yellow-50 border border-yellow-200 z-10">
            <span className="text-xs text-yellow-700">管理模式已开启</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50"
              >
                {exporting ? '导出中…' : '导出数据'}
              </button>
              <button
                onClick={handleImportClick}
                disabled={importing}
                className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50"
              >
                {importing ? '导入中…' : '导入数据'}
              </button>
              <button
                onClick={exitAdminMode}
                className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                退出管理模式
              </button>
            </div>
          </div>
        )}

        {/* 隐藏文件选择框（导入入口） */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 导入确认弹窗：文件信息 + 导入统计 + 风险提示 + 备份入口 */}
        {importPreview && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-xl">
              <h3 className="font-medium text-sm mb-2">确认导入数据</h3>
              <div className="text-xs text-gray-600 space-y-1 mb-3">
                <p>文件：{importPreview.filename}</p>
                <p>导出时间：{importPreview.exported_at} · 来源版本：{importPreview.version}</p>
                <p>
                  将导入：{importPreview.counts.records} 条记录 · {importPreview.counts.subjects} 个科目 ·{' '}
                  {importPreview.counts.tags} 个标签 · {importPreview.counts.reminders} 条提醒
                </p>
              </div>
              <p className="text-xs text-red-600 mb-4">
                ⚠️ 导入将替换当前全部数据（无法撤销），建议先下载当前数据备份。
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setImportPreview(null)}
                  className="text-xs bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBackupDownload}
                  className="text-xs bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  先下载当前备份
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {importing ? '导入中…' : '确认导入'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
        <div className="px-4 pt-6">
          {activeTab === 'timer' && (
            <TimerPage timer={timer} onRecordSaved={handleRecordSaved} adminMode={adminMode} onEnterAdminMode={enterAdminMode} />
          )}
          {activeTab === 'history' && (
            <HistoryPage refreshKey={historyRefreshKey} adminMode={adminMode} onEnterAdminMode={enterAdminMode} />
          )}
        </div>
      </div>

      {/* 底部导航 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-40"
           style={{ maxWidth: '430px', margin: '0 auto' }}>
        <div className="flex justify-around items-center px-4 py-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center gap-0.5 px-6 py-1 rounded-lg transition-all ${
                activeTab === tab.key ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className={`text-xs font-medium ${activeTab === tab.key ? 'text-blue-600' : ''}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
