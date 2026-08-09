// code/client/src/components/TagPicker.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sortable from 'sortablejs';
import { tagsApi } from '../utils/api';

/**
 * 标签选择器组件
 * 展示扁平全局标签库，支持点选/取消（选中高亮）、新增标签、删除标签
 * 学习中与历史页编辑态共用；删除标签会级联清除所有历史记录上的该标签
 *
 * 排序模式：点 ⚙ 进入，芯片出现 ≡ 手柄可拖拽换位（sortablejs），
 * 「完成」批量提交 PUT /tags/order，「取消」恢复进入前顺序
 * 删除 × 与排序 ⚙ 属管理模式能力，仅 admin=true 时显示（日常只点选/新增）
 *
 * @param {Object} props - 组件属性
 * @param {string[]} props.selected - 当前选中的标签名数组
 * @param {Function} props.onToggle - 点选/取消标签的回调，接收标签名
 * @param {Function} [props.onDelete] - 标签被删除后的回调，接收标签名（父组件用来清理选中态）
 * @param {boolean} [props.admin] - 管理模式开关：开启时显示删除 × 与排序 ⚙ 入口
 */
export default function TagPicker({ selected = [], onToggle, onDelete, admin = false }) {
  // 标签库（全部标签）
  const [allTags, setAllTags] = useState([]);
  // 是否显示新增输入框
  const [showAdd, setShowAdd] = useState(false);
  // 新增标签名
  const [newName, setNewName] = useState('');
  // 排序模式：进入时快照顺序，取消时恢复
  const [sortMode, setSortMode] = useState(false);
  const orderSnapshotRef = useRef(null);
  // 芯片容器（sortablejs 挂载点）
  const listRef = useRef(null);

  /**
   * 加载标签库
   */
  const loadTags = useCallback(async () => {
    try {
      const tags = await tagsApi.list();
      setAllTags(tags);
    } catch (err) {
      console.error('加载标签失败:', err);
    }
  }, []);

  useEffect(() => { loadTags(); }, [loadTags]);

  /**
   * 排序模式下创建 sortablejs 实例（handle 限定手柄区可拖，防点选误触）
   * onUpdate 时把 React state 重排成 DOM 的新顺序 —— 排序后 state 与 DOM 一致，
   * React 调和无操作，不会闪动
   */
  useEffect(() => {
    if (!sortMode || !listRef.current) return undefined;
    const sortable = new Sortable(listRef.current, {
      handle: '.tag-drag-handle',
      animation: 150,
      ghostClass: 'opacity-50',
      onUpdate: (evt) => {
        setAllTags(prev => {
          const next = [...prev];
          const [moved] = next.splice(evt.oldIndex, 1);
          next.splice(evt.newIndex, 0, moved);
          return next;
        });
      },
    });
    return () => sortable.destroy();
  }, [sortMode]);

  /**
   * 进入排序模式：快照当前顺序，取消时恢复
   */
  const enterSortMode = () => {
    orderSnapshotRef.current = allTags.map(t => t.id);
    setSortMode(true);
  };

  /**
   * 取消排序：恢复进入前的顺序快照并退出
   */
  const cancelSortMode = () => {
    if (orderSnapshotRef.current) {
      const snapshot = orderSnapshotRef.current;
      setAllTags(prev => [...prev].sort((a, b) => snapshot.indexOf(a.id) - snapshot.indexOf(b.id)));
    }
    orderSnapshotRef.current = null;
    setSortMode(false);
  };

  /**
   * 完成排序：批量提交新顺序（全量 id），失败 alert 并留在排序模式
   */
  const commitSort = async () => {
    try {
      await tagsApi.reorder(allTags.map(t => t.id));
      orderSnapshotRef.current = null;
      setSortMode(false);
    } catch (err) {
      alert(err.message);
    }
  };

  /**
   * 新增标签（幂等：重名自动复用已有），创建成功后自动选中
   */
  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const tag = await tagsApi.create(newName.trim());
      setAllTags(prev => prev.some(t => t.id === tag.id) ? prev : [...prev, tag]);
      onToggle(tag.name);
      setNewName('');
      setShowAdd(false);
    } catch (err) {
      alert(err.message);
    }
  };

  /**
   * 删除标签（级联清关联），成功后从选中态移除
   * @param {Event} e - 点击事件，用于阻止冒泡
   * @param {{ id: number, name: string }} tag - 要删除的标签
   */
  const handleDelete = async (e, tag) => {
    e.stopPropagation();
    if (!confirm(`删除标签「${tag.name}」？将从所有历史记录中移除`)) return;
    try {
      await tagsApi.delete(tag.id);
      setAllTags(prev => prev.filter(t => t.id !== tag.id));
      onDelete?.(tag.name);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* 芯片区（排序模式下是 sortablejs 容器，操作按钮在容器外，不会被拖拽） */}
      <div ref={listRef} className="inline-flex flex-wrap items-center gap-1.5">
        {allTags.map(tag => {
          const isSelected = selected.includes(tag.name);
          return (
            <button
              key={tag.id}
              data-testid="tag-chip"
              onClick={() => !sortMode && onToggle(tag.name)}
              title={sortMode ? '拖动手柄调整顺序' : '点选/取消标签'}
              className={`group relative px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                sortMode
                  ? 'bg-white text-gray-600 border border-dashed border-gray-300 cursor-default'
                  : isSelected
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {/* 排序模式：≡ 拖拽手柄 */}
              {sortMode && (
                <span
                  data-testid="tag-drag-handle"
                  className="tag-drag-handle mr-1.5 cursor-grab active:cursor-grabbing select-none"
                >
                  ≡
                </span>
              )}
              <span>{tag.name}</span>
              {/* × = 从标签库删除（级联清所有记录关联）— 仅管理模式显示，恒显不随 hover；排序模式下隐藏防误删 */}
              {!sortMode && admin && (
                <span
                  onClick={(e) => handleDelete(e, tag)}
                  title="删除标签"
                  className={`ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-xs
                    ${isSelected
                      ? 'text-white/70 hover:text-white'
                      : 'text-gray-300 hover:text-red-500'
                    } transition-all`}
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 排序模式操作区 */}
      {sortMode ? (
        <div className="inline-flex items-center gap-1.5">
          <button
            onClick={commitSort}
            data-testid="sort-done"
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all"
          >
            完成
          </button>
          <button
            onClick={cancelSortMode}
            data-testid="sort-cancel"
            className="px-2 py-1 rounded-full text-xs text-gray-400 hover:text-gray-600 transition-all"
          >
            取消
          </button>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5">
          {/* 新增标签（排序模式下隐藏） */}
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all"
            >
              + 标签
            </button>
          ) : (
            <span className="inline-flex items-center gap-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="输入标签名"
                maxLength={12}
                className="w-28 px-2 py-1 text-xs border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                onClick={handleAdd}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                确认
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewName(''); }}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
              >
                取消
              </button>
            </span>
          )}

          {/* ⚙ 排序入口（管理模式能力，仅 admin 显示）：少于 2 个标签无需排序 */}
          {admin && (
            <button
              onClick={enterSortMode}
              disabled={allTags.length < 2}
              title={allTags.length < 2 ? '至少 2 个标签才能排序' : '调整标签顺序'}
              data-testid="sort-toggle"
              className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                allTags.length < 2
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-400 border border-gray-200 hover:border-blue-300 hover:text-blue-500'
              }`}
            >
              ⚙
            </button>
          )}
        </div>
      )}
    </div>
  );
}
