import React, { useState, useEffect } from 'react';
import { subjectsApi } from '../utils/api';

export default function SubjectSelector({ selected, onSelect }) {
  const [subjects, setSubjects] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSubjects = async () => {
    try {
      const data = await subjectsApi.list();
      setSubjects(data);
    } catch (err) {
      console.error('加载科目失败:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadSubjects(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const subject = await subjectsApi.create(newName.trim());
      setSubjects(prev => [...prev, subject]);
      setNewName('');
      setShowAdd(false);
    } catch (err) {
      alert(err.message);
    }
  };

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

  if (loading) {
    return (
      <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>
    );
  }

  return (
    <div className="mb-6">
      <label className="text-sm font-medium text-gray-600 mb-2 block">选择科目</label>
      <div className="flex flex-wrap gap-2">
        {subjects.map(subject => (
          <button
            key={subject.id}
            onClick={() => onSelect(subject)}
            className={`group relative px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selected?.id === subject.id
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            <span>{subject.name}</span>
            {/* 只有自定义科目显示删除按钮 */}
            {!['数学', '英语', '专业课'].includes(subject.name) && (
              <span
                onClick={(e) => handleDelete(e, subject)}
                className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-xs
                  ${selected?.id === subject.id
                    ? 'text-white/70 hover:text-white'
                    : 'text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100'
                  } transition-all`}
              >
                ×
              </span>
            )}
          </button>
        ))}

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
      </div>
    </div>
  );
}
