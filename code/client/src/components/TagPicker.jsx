// code/client/src/components/TagPicker.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { tagsApi } from '../utils/api';

/**
 * 标签选择器组件
 * 展示扁平全局标签库，支持点选/取消（选中高亮）、新增标签、删除标签
 * 学习中与历史页编辑态共用；删除标签会级联清除所有历史记录上的该标签
 *
 * @param {Object} props - 组件属性
 * @param {string[]} props.selected - 当前选中的标签名数组
 * @param {Function} props.onToggle - 点选/取消标签的回调，接收标签名
 * @param {Function} [props.onDelete] - 标签被删除后的回调，接收标签名（父组件用来清理选中态）
 */
export default function TagPicker({ selected = [], onToggle, onDelete }) {
  // 标签库（全部标签）
  const [allTags, setAllTags] = useState([]);
  // 是否显示新增输入框
  const [showAdd, setShowAdd] = useState(false);
  // 新增标签名
  const [newName, setNewName] = useState('');

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
      {allTags.map(tag => {
        const isSelected = selected.includes(tag.name);
        return (
          <button
            key={tag.id}
            data-testid="tag-chip"
            onClick={() => onToggle(tag.name)}
            title="点选/取消标签"
            className={`group relative px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              isSelected
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            <span>{tag.name}</span>
            {/* × = 从标签库删除（级联清所有记录关联） */}
            <span
              onClick={(e) => handleDelete(e, tag)}
              title="删除标签"
              className={`ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-xs
                ${isSelected
                  ? 'text-white/70 hover:text-white'
                  : 'text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100'
                } transition-all`}
            >
              ×
            </span>
          </button>
        );
      })}

      {/* 新增标签 */}
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
    </div>
  );
}
