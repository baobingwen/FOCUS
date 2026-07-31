// code/client/src/components/HistoryPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { recordsApi } from '../utils/api';
import TodayOverview from './TodayOverview';
import { fmtTime } from '../utils/fmtTime';

/**
 * 将 ms 格式化为短时间显示（MM:SS格式）
 * @param {number} ms
 * @returns {string} 格式化后的时间（如 "05:30"）
 */
function fmtShortTime(ms) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * 获取今天的日期字符串（YYYY-MM-DD格式）
 * @returns {string} 今天的日期字符串
 */
export function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 判断给定的日期字符串是否为今天
 * @param {string} dateStr - 日期字符串（YYYY-MM-DD格式）
 * @returns {boolean} 是否为今天
 */
function isToday(dateStr) {
  return dateStr === getTodayStr();
}

/**
 * 历史记录页面组件
 * 显示指定日期的学习/休息记录，支持日期导航
 * 
 * @param {Object} props - 组件属性
 * @param {string|number} props.refreshKey - 刷新键，变化时重新加载数据
 */
export default function HistoryPage({ refreshKey }) {
  // 当前查看的日期（YYYY-MM-DD格式）
  const [currentDate, setCurrentDate] = useState(getTodayStr);
  // 当前日期的记录列表
  const [records, setRecords] = useState([]);
  // 加载状态
  const [loading, setLoading] = useState(true);
  // 今日概览组件的刷新键
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);
  // 正在编辑备注的记录 id（单条互斥：同一时间只编辑一条）
  const [editingId, setEditingId] = useState(null);
  // 编辑草稿
  const [draft, setDraft] = useState('');
  // 正在保存的记录 id（用于按钮禁用 + 文案）
  const [savingId, setSavingId] = useState(null);
  // 保存失败的错误提示（保持编辑态不丢内容）
  const [editError, setEditError] = useState('');

  /**
   * 加载指定日期的记录
   * 从API获取当前日期的所有记录并更新状态
   */
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await recordsApi.list(currentDate);
      setRecords(result.records || []);
    } catch (err) {
      console.error('加载历史记录失败:', err);
    }
    setLoading(false);
  }, [currentDate]);

  /**
   * 当日期变化、刷新键变化或概览刷新键变化时重新加载记录
   */
  useEffect(() => { loadRecords(); }, [loadRecords, refreshKey, overviewRefreshKey]);

  /**
   * 日期或刷新键变化时重置备注编辑状态（草稿随列表切换自然丢弃）
   */
  useEffect(() => {
    setEditingId(null);
    setDraft('');
    setEditError('');
  }, [currentDate, refreshKey]);

  /**
   * 切换到前一天
   */
  const goToPrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  /**
   * 切换到后一天
   */
  const goToNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  /**
   * 切换到今天
   */
  const goToToday = () => {
    setCurrentDate(getTodayStr());
  };

  /**
   * 进入某条学习记录的备注编辑
   * 单条互斥：editingId 指向新记录时自动收起上一条
   * @param {{ id: number, notes?: string }} record
   */
  const startEdit = (record) => {
    setEditingId(record.id);
    setDraft(record.notes || '');
    setEditError('');
  };

  /**
   * 取消编辑，丢弃草稿
   */
  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
    setEditError('');
  };

  /**
   * 保存备注
   * 成功后静默原地更新列表；失败保持编辑态并显示错误提示
   * @param {{ id: number }} record
   */
  const saveEdit = async (record) => {
    setSavingId(record.id);
    setEditError('');
    try {
      const updated = await recordsApi.update(record.id, { notes: draft.trim() });
      setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
      setEditingId(null);
      setDraft('');
    } catch (err) {
      setEditError(`保存失败: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  // 判断是否显示"后一天"按钮（当前不是今天时才显示）
  const showPrev = currentDate !== getTodayStr() || !isToday(currentDate);

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4">📋 历史记录</h2>

      {/* 今日概览（仅在当天显示） */}
      {isToday(currentDate) && (
        <TodayOverview refreshKey={refreshKey + '-' + overviewRefreshKey} />
      )}

      {/* 日期导航 */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-xl p-2 shadow-sm border border-gray-100">
        <button
          onClick={goToPrevDay}
          className="px-3 py-1 text-sm text-gray-500 hover:text-blue-500 transition-colors"
        >
          ← 前一天
        </button>

        <span className="text-sm font-medium text-gray-700">
          {currentDate}
          {isToday(currentDate) && <span className="text-blue-500 ml-1">（今天）</span>}
        </span>

        {showPrev ? (
          <button
            onClick={goToNextDay}
            className="px-3 py-1 text-sm text-gray-500 hover:text-blue-500 transition-colors"
          >
            后一天 →
          </button>
        ) : (
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm text-blue-500 hover:text-blue-600 transition-colors"
          >
            回到今天
          </button>
        )}
      </div>

      {/* 记录列表 */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">加载中...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-400 text-sm">这天没有记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-2 mb-1">
                {/* 类型标签 */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  record.mode === 'study'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {record.mode === 'study' ? '学习' : '休息'}
                </span>

                {/* 科目 */}
                {record.subject && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {record.subject}
                  </span>
                )}

                {/* 时长 */}
                <span className="text-sm font-mono text-gray-700 ml-auto">
                  {fmtShortTime(record.duration_ms)}
                </span>
              </div>

              {/* 备注 — 仅学习记录可内联编辑；休息记录无备注概念 */}
              {record.mode === 'study' && (
                editingId === record.id ? (
                  <div className="mt-1 ml-1">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="记录一下当前的学习内容..."
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg
                        resize-none outline-none focus:border-blue-300 focus:ring-2
                        focus:ring-blue-100 text-gray-700"
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => saveEdit(record)}
                        disabled={savingId === record.id}
                        className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg
                          hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        {savingId === record.id ? '保存中...' : '保存'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg
                          hover:bg-gray-200 transition-colors"
                      >
                        取消
                      </button>
                      {editError && (
                        <span className="text-xs text-red-500">{editError}</span>
                      )}
                    </div>
                  </div>
                ) : record.notes ? (
                  <div className="flex items-center gap-1 mt-1 ml-1">
                    <button
                      onClick={() => startEdit(record)}
                      title="点击修改备注"
                      className="text-xs text-left text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      {record.notes}
                    </button>
                    <span className="text-xs text-gray-300 select-none cursor-default" aria-hidden="true">✏️</span>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(record)}
                    className="text-xs text-left text-gray-300 mt-1 ml-1 hover:text-blue-500 transition-colors"
                  >
                    ＋ 添加备注
                  </button>
                )
              )}

              {/* 千层饼 — 仅学习记录有 segments 时显示 */}
              {record.mode === 'study' && record.segments && record.segments.length > 1 && (
                <SegmentStack segments={record.segments} />
              )}

              {/* 时间戳 */}
              <p className="text-xs text-gray-300 mt-1">
                {record.created_at?.slice(0, 16) || ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 千层饼堆叠条组件
 * 按时间比例显示学习段（蓝色）和暂停段（灰色）
 */
function SegmentStack({ segments }) {
  if (!segments || segments.length === 0) return null;

  const maxMs = Math.max(...segments.map(s => s.duration_ms), 1);
  const totalMs = segments.reduce((sum, s) => sum + s.duration_ms, 0);
  const pauseMs = segments.filter(s => s.type === 'pause').reduce((sum, s) => sum + s.duration_ms, 0);

  return (
    <div className="mt-2 space-y-0.5">
      {segments.map((seg, i) => {
        const pct = seg.duration_ms / maxMs;
        const height = Math.max(20, Math.round(pct * 48));
        const isStudy = seg.type === 'study';
        return (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md px-2 transition-colors"
            style={{
              height: `${height}px`,
              backgroundColor: isStudy ? '#dbeafe' : '#f3f4f6',
            }}
          >
            <span className={`text-xs font-medium ${isStudy ? 'text-blue-700' : 'text-gray-500'}`}>
              {isStudy ? '学习' : '暂停'}
            </span>
            <span className={`ml-auto text-xs font-mono ${isStudy ? 'text-blue-600' : 'text-gray-400'}`}>
              {fmtShortTime(seg.duration_ms)}
            </span>
          </div>
        );
      })}
      {/* 汇总信息 */}
      <p className="text-xs text-gray-400 mt-1.5 pt-1 border-t border-gray-100">
        总计 {fmtShortTime(totalMs)}
        {pauseMs > 0 && <span className="text-gray-300">（含暂停 {fmtShortTime(pauseMs)}）</span>}
      </p>
    </div>
  );
}
