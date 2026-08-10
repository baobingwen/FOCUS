// code/client/src/components/RecordCard.jsx
import React from 'react';
import TagPicker from './TagPicker';
import SegmentStack from './SegmentStack';
import { fmtShortClock } from '../utils/fmtTime';

/**
 * 单条记录卡片（纯展示壳）
 * 查看态（类型/科目/页数/时长/标签/备注/千层饼/时间戳）与 ✏️ 编辑态（备注/页数/标签表单）的渲染。
 * 所有状态与逻辑由 HistoryPage 持有，通过 props 传入。
 *
 * @param {Object} props - 组件属性
 * @param {Object} props.record - 学习/休息记录
 * @param {boolean} [props.adminMode] - 全局管理模式开关（显示删除按钮）
 * @param {boolean} props.isEditing - 该记录是否处于编辑态（editingId === record.id）
 * @param {boolean} props.saving - 该记录是否保存中（savingId === record.id）
 * @param {string} props.draft - 编辑态备注草稿
 * @param {string[]} props.draftTags - 编辑态标签草稿
 * @param {number|null} props.draftPages - 编辑态页数草稿（null = 未填写）
 * @param {string} props.editError - 编辑态保存错误提示
 * @param {Object|null} props.copyFeedback - 复制反馈（{ id, status: 'ok' | 'fail' }）
 * @param {string|null} props.filterTag - 当前按标签筛选（用于高亮查看态标签 chips）
 * @param {Function} props.onStartEdit - 进入编辑态
 * @param {Function} props.onCancelEdit - 取消编辑，丢弃草稿
 * @param {Function} props.onSaveEdit - 保存编辑（备注/标签/页数随草稿提交）
 * @param {Function} props.onDelete - 删除单条记录（管理模式，confirm 确认）
 * @param {Function} props.onCopyNote - 复制备注到剪贴板并显示反馈
 * @param {Function} props.onDraftChange - 修改备注草稿
 * @param {Function} props.onDraftPagesChange - 修改页数草稿（null = 清空）
 * @param {Function} props.onTagClick - 查看态点击标签 chip 即按标签筛选
 * @param {Function} props.onToggleDraftTag - 编辑态点选/取消标签
 * @param {Function} props.onRemoveDraftTag - 编辑态标签从库中删除后同步清理草稿
 */
export default function RecordCard({
  record,
  adminMode = false,
  isEditing,
  saving,
  draft,
  draftTags,
  draftPages,
  editError,
  copyFeedback,
  filterTag,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onCopyNote,
  onDraftChange,
  onDraftPagesChange,
  onTagClick,
  onToggleDraftTag,
  onRemoveDraftTag,
}) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
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

        {/* 复习页数 — 有值才显示，仅学习记录 */}
        {record.mode === 'study' && record.pages > 0 && (
          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            📖 {record.pages} 页
          </span>
        )}

        {/* 时长 */}
        <span className={`text-sm font-mono text-gray-700 ${adminMode && !isEditing ? '' : 'ml-auto'}`}>
          {fmtShortClock(record.duration_ms)}
        </span>

        {/* 删除按钮 — 仅管理模式显示，时长左侧；编辑中的记录不显示（互斥） */}
        {adminMode && !isEditing && (
          <button
            onClick={() => onDelete(record)}
            title="删除此记录"
            aria-label="删除记录"
            className="text-xs text-red-400 hover:text-red-600 ml-auto transition-colors"
          >
            删
          </button>
        )}
      </div>

      {/* 标签展示 — 查看态点标签即筛选；仅学习记录 */}
      {record.mode === 'study' && !isEditing && record.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1 ml-1">
          {record.tags.map(tag => (
            <button
              key={tag}
              data-testid="record-tag"
              onClick={() => onTagClick(filterTag === tag ? null : tag)}
              title="点击按标签筛选"
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                filterTag === tag
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 备注/标签编辑 — 仅学习记录可内联编辑；休息记录无备注/标签概念 */}
      {record.mode === 'study' && (
        isEditing ? (
          <div className="mt-1 ml-1">
            <textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="记录一下当前的学习内容..."
              rows={2}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg
                resize-none outline-none focus:border-blue-300 focus:ring-2
                focus:ring-blue-100 text-gray-700"
            />
            {/* 页数编辑（null = 清空） */}
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-gray-400">页数</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={draftPages ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    onDraftPagesChange(null);
                  } else {
                    const n = Number(v);
                    if (Number.isInteger(n) && n >= 1 && n <= 9999) onDraftPagesChange(n);
                  }
                }}
                placeholder="未填写"
                aria-label="编辑页数"
                className="w-20 px-2 py-1 text-xs text-center border border-gray-200 rounded-lg
                  outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-gray-700"
              />
            </div>
            <div className="mt-2">
              <TagPicker
                selected={draftTags}
                onToggle={onToggleDraftTag}
                onDelete={onRemoveDraftTag}
                admin={adminMode}
              />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={() => onSaveEdit(record)}
                disabled={saving}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg
                  hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={onCancelEdit}
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
            {/* 备注文字 = 复制入口（hover 样式与编辑入口保持一致） */}
            <button
              onClick={() => onCopyNote(record)}
              title="点击复制备注"
              className="text-xs text-left text-gray-400 hover:text-blue-500 transition-colors"
            >
              {record.notes}
            </button>
            {copyFeedback?.id === record.id && (
              <span
                aria-live="polite"
                className={`text-xs ${copyFeedback.status === 'ok' ? 'text-green-500' : 'text-red-500'}`}
              >
                {copyFeedback.status === 'ok' ? '已复制✓' : '复制失败'}
              </span>
            )}
            {/* ✏️ = 编辑入口 */}
            <button
              onClick={() => onStartEdit(record)}
              title="编辑备注"
              aria-label="编辑备注"
              className="text-xs text-gray-300 hover:text-blue-500 transition-colors"
            >
              ✏️
            </button>
          </div>
        ) : (
          <button
            onClick={() => onStartEdit(record)}
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
  );
}