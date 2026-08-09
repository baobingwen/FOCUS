// code/client/src/components/SubjectSelector.jsx
import React, { useState, useEffect } from 'react';
import { subjectsApi } from '../utils/api';

/**
 * 科目选择器组件
 * 用于选择学习科目，支持查看已有科目、新增自定义科目和删除自定义科目
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.selected - 当前选中的科目对象
 * @param {Function} props.onSelect - 选中科目时的回调函数，接收科目对象作为参数
 * @param {boolean} [props.admin] - 管理模式开关：开启时自定义科目显示删除按钮 ×（恒显），日常隐藏
 */
export default function SubjectSelector({ selected, onSelect, admin = false }) {
  // 休息标记对象，用于表示选择了「休息」而非科目
  const REST = { id: '__rest__', name: '☕ 休息' };
  // 科目列表
  const [subjects, setSubjects] = useState([]);
  // 是否显示新增科目输入框
  const [showAdd, setShowAdd] = useState(false);
  // 新增科目的名称
  const [newName, setNewName] = useState('');
  // 加载状态
  const [loading, setLoading] = useState(true);

  /**
   * 加载科目列表
   * 从API获取所有科目并更新状态
   */
  const loadSubjects = async () => {
    try {
      const data = await subjectsApi.list();
      setSubjects(data);
    } catch (err) {
      console.error('加载科目失败:', err);
    }
    setLoading(false);
  };

  // 组件挂载时加载科目列表
  useEffect(() => { loadSubjects(); }, []);

  /**
   * 处理新增科目
   * 调用API创建新科目，成功后更新列表并重置输入状态
   */
  const handleAdd = async () => {
    if (!newName.trim()) return;
    if (newName.trim() === '休息') {
      alert('「休息」为内置选项，无需添加');
      return;
    }
    try {
      const subject = await subjectsApi.create(newName.trim());
      setSubjects(prev => [...prev, subject]);
      setNewName('');
      setShowAdd(false);
    } catch (err) {
      alert(err.message);
    }
  };

  /**
   * 处理删除科目
   * 调用API删除指定科目，成功后更新列表
   * 如果删除的是当前选中的科目，则清空选中状态
   * 
   * @param {Event} e - 点击事件，用于阻止冒泡
   * @param {Object} subject - 要删除的科目对象
   */
  const handleDelete = async (e, subject) => {
    e.stopPropagation();
    if (!confirm(`删除科目「${subject.name}」？`)) return;
    try {
      await subjectsApi.delete(subject.id);
      setSubjects(prev => prev.filter(s => s.id !== subject.id));
      if (selected?.id === subject.id) {
        onSelect(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // 加载中状态
  if (loading) {
    return (
      <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>
    );
  }

  return (
    <div className="mb-6">
      <label className="text-sm font-medium text-gray-600 mb-2 block">选择科目</label>
      <div className="flex flex-wrap gap-2">
        {subjects.map(subject => {
          const isCustom = !['数学', '英语', '专业课'].includes(subject.name);
          return (
            <button
              key={subject.id}
              onClick={() => onSelect(subject)}
              className={`group relative py-2 rounded-xl text-sm font-medium transition-all ${
                isCustom ? 'px-7' : 'px-4'
              } ${
                selected?.id === subject.id
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              <span>{subject.name}</span>
              {/* 删除按钮 — 仅管理模式显示（自定义科目），恒显不随 hover */}
              {isCustom && admin && (
                <span
                  onClick={(e) => handleDelete(e, subject)}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full text-xs
                    inline-flex items-center justify-center
                    ${selected?.id === subject.id
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

        {/* 新增科目按钮 */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all"
          >
            + 新增
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="输入科目名"
              className="w-28 px-2 py-1.5 text-sm border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              onClick={handleAdd}
              className="px-2 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              确认
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(''); }}
              className="px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600"
            >
              取消
            </button>
          </div>
        )}

        {/* 休息按钮 */}
        <button
          onClick={() => onSelect(REST)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            selected?.id === REST.id
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          {REST.name}
        </button>
      </div>
    </div>
  );
}
