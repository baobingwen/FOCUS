// code/client/src/components/HistoryPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { recordsApi } from '../utils/api';
import TodayOverview from './TodayOverview';
import RecordCard from './RecordCard';
import { copyText } from '../utils/clipboard';

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
 * @param {boolean} [props.adminMode] - 全局管理模式开关（App 层托管，跨 tab 生效）
 */
export default function HistoryPage({ refreshKey, adminMode = false }) {
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
  // 复制反馈（{ id, status: 'ok' | 'fail' }），用于备注点击复制后的内联提示
  const [copyFeedback, setCopyFeedback] = useState(null);
  // 当前按标签筛选（null = 全部）
  const [filterTag, setFilterTag] = useState(null);
  // 编辑态标签草稿（进入编辑时从记录复制，保存时 PATCH 提交）
  const [draftTags, setDraftTags] = useState([]);
  // 编辑态页数草稿（null = 未填写，保存时 PATCH 提交，可清空）
  const [draftPages, setDraftPages] = useState(null);
  // 删除失败的错误提示（内联显示，成功后清除）
  const [deleteError, setDeleteError] = useState('');

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
   * 日期或刷新键变化时重置备注/标签编辑状态与筛选（草稿随列表切换自然丢弃）
   */
  useEffect(() => {
    setEditingId(null);
    setDraft('');
    setDraftTags([]);
    setDraftPages(null);
    setEditError('');
    setCopyFeedback(null);
    setFilterTag(null);
    setDeleteError('');
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
   * 进入某条学习记录的备注/标签编辑
   * 单条互斥：editingId 指向新记录时自动收起上一条
   * @param {{ id: number, notes?: string, tags?: string[] }} record
   */
  const startEdit = (record) => {
    setEditingId(record.id);
    setDraft(record.notes || '');
    setDraftTags(record.tags || []);
    setDraftPages(record.pages ?? null);
    setEditError('');
  };

  /**
   * 取消编辑，丢弃草稿
   */
  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
    setDraftTags([]);
    setDraftPages(null);
    setEditError('');
  };

  /**
   * 保存备注与标签
   * 成功后静默原地更新列表；失败保持编辑态并显示错误提示
   * @param {{ id: number }} record
   */
  const saveEdit = async (record) => {
    setSavingId(record.id);
    setEditError('');
    try {
      const updated = await recordsApi.update(record.id, { notes: draft.trim(), tags: draftTags, pages: draftPages });
      setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
      setEditingId(null);
      setDraft('');
      setDraftTags([]);
      setDraftPages(null);
    } catch (err) {
      setEditError(`保存失败: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  /**
   * 编辑态切换标签选中（点选/取消）
   * @param {string} name - 标签名
   */
  const toggleDraftTag = useCallback((name) => {
    setDraftTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);
  }, []);

  /**
   * 编辑态标签被从库中删除后：从草稿移除 + 重拉列表同步级联效果 + 清理筛选
   * @param {string} name - 被删除的标签名
   */
  const removeDraftTag = useCallback((name) => {
    setDraftTags(prev => prev.filter(t => t !== name));
    loadRecords();
    setFilterTag(prev => (prev === name ? null : prev));
  }, [loadRecords]);

  /**
   * 删除单条记录（管理模式内）：confirm 确认后调 DELETE，成功本地移除
   * 失败保留记录并内联报错；删除前清除旧错误
   * @param {{ id: number, mode: string }} record
   */
  const handleDelete = async (record) => {
    const label = record.mode === 'study' ? '学习记录' : '休息记录';
    if (!window.confirm(`删除这条${label}？此操作不可恢复`)) return;
    setDeleteError('');
    try {
      await recordsApi.remove(record.id);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
    } catch (err) {
      setDeleteError(`删除失败: ${err.message}`);
    }
  };

  /**
   * 复制备注到剪贴板并显示内联反馈（已复制✓ / 复制失败）
   * 反馈 1.5s 后自动消失；多次点击只保留最近一次状态
   * @param {{ id: number, notes?: string }} record
   */
  const handleCopyNote = async (record) => {
    const ok = await copyText(record.notes || '');
    setCopyFeedback({ id: record.id, status: ok ? 'ok' : 'fail' });
    setTimeout(() => {
      setCopyFeedback((prev) => (prev && prev.id === record.id ? null : prev));
    }, 1500);
  };

  // 当天记录中出现过的标签（用于列表上方筛选行）
  const filterTags = useMemo(() => {
    const set = new Set();
    for (const r of records) {
      if (r.mode === 'study' && Array.isArray(r.tags)) {
        for (const t of r.tags) set.add(t);
      }
    }
    return [...set];
  }, [records]);

  // 按标签筛选后的记录列表（筛选仅命中学习记录）
  const visibleRecords = filterTag
    ? records.filter(r => r.mode === 'study' && Array.isArray(r.tags) && r.tags.includes(filterTag))
    : records;

  // 判断是否显示"后一天"按钮（当前不是今天时才显示）
  const showPrev = currentDate !== getTodayStr() || !isToday(currentDate);

  return (
    <div>
      {/* 标题 */}
      <h2 className="text-lg font-bold text-gray-800 mb-4">📋 历史记录</h2>

      {/* 删除失败提示（管理模式下删除出错时显示） */}
      {deleteError && (
        <p className="text-xs text-red-500 mb-3">{deleteError}</p>
      )}

      {/* 今日概览（仅在当天显示）— 传入 records 供客户端按标签分组 */}
      {isToday(currentDate) && (
        <TodayOverview refreshKey={refreshKey + '-' + overviewRefreshKey} records={records} />
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

      {/* 标签筛选行（当天记录中出现过标签时显示） */}
      {filterTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <button
            onClick={() => setFilterTag(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              filterTag === null
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'
            }`}
          >
            全部
          </button>
          {filterTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                filterTag === tag
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 记录列表 */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">加载中...</div>
      ) : visibleRecords.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-400 text-sm">
            {filterTag ? `没有含「${filterTag}」标签的记录` : '这天没有记录'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRecords.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              adminMode={adminMode}
              isEditing={editingId === record.id}
              saving={savingId === record.id}
              draft={draft}
              draftTags={draftTags}
              draftPages={draftPages}
              editError={editError}
              copyFeedback={copyFeedback}
              filterTag={filterTag}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onDelete={handleDelete}
              onCopyNote={handleCopyNote}
              onDraftChange={setDraft}
              onDraftPagesChange={setDraftPages}
              onTagClick={setFilterTag}
              onToggleDraftTag={toggleDraftTag}
              onRemoveDraftTag={removeDraftTag}
            />
          ))}
        </div>
      )}
    </div>
  );
}
