// code/client/src/components/ReminderBar.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { remindersApi } from '../utils/api';

/** 轮换间隔：15 分钟换一条（与设计决策一致） */
export const ROTATE_INTERVAL_MS = 15 * 60 * 1000;

/**
 * 复习方法和提醒条组件
 * 学习中「结束学习」大按钮下方展示一条小字提醒（💡 浅灰不抢眼），每 15 分钟按插入顺序轮换下一条；
 * 提醒条旁点 ＋ 弹框新增（随时记录）；管理模式开启时出现「管理」按钮 → 弹窗列表编辑/删除全部条目
 *
 * @param {Object} props - 组件属性
 * @param {boolean} [props.admin] - 管理模式开关：开启时显示「管理」入口
 */
export default function ReminderBar({ admin = false }) {
  // 全部提醒条目（按服务端 sort_order 顺序返回）
  const [items, setItems] = useState([]);
  // 当前展示的条目下标（顺序循环轮换）
  const [index, setIndex] = useState(0);
  // 新增弹框开关
  const [showAdd, setShowAdd] = useState(false);
  // 管理弹窗开关
  const [showManage, setShowManage] = useState(false);

  /**
   * 加载全部提醒
   */
  const loadItems = useCallback(async () => {
    try {
      const data = await remindersApi.list();
      setItems(data);
    } catch (err) {
      console.error('加载复习提醒失败:', err);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  /**
   * 每 15 分钟轮换到下一条（顺序循环；不足 2 条无需轮换）
   */
  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % items.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  // 当前要展示的条目
  const current = items.length > 0 ? items[index % items.length] : null;

  /**
   * 新增成功后追加到列表末尾（服务端排末尾），重置下标到新条目
   * @param {string} content - 新增的提醒内容
   */
  const handleAdd = async (content) => {
    try {
      const item = await remindersApi.create(content);
      setItems(prev => [...prev, item]);
      setIndex(items.length); // 新条目排末尾，展示它
      setShowAdd(false);
    } catch (err) {
      alert(err.message);
    }
  };

  /**
   * 管理弹窗内更新条目后同步列表
   * @param {{ id: number, content: string }} updated - 更新后的条目
   */
  const handleUpdated = (updated) => {
    setItems(prev => prev.map(t => (t.id === updated.id ? updated : t)));
  };

  /**
   * 管理弹窗内删除条目后同步列表
   * @param {number} id - 被删除的条目 id
   */
  const handleDeleted = (id) => {
    setItems(prev => {
      const next = prev.filter(t => t.id !== id);
      setIndex(i => (next.length > 0 ? i % next.length : 0));
      return next;
    });
  };

  return (
    <div className="w-full max-w-sm mb-2">
      {/* 提醒条：无条目时不显示提醒文字，只留 ＋ 入口 */}
      <div className="flex items-center gap-1.5 text-gray-400">
        {current && (
          <p className="text-xs leading-relaxed select-none flex-1">
            💡 {current.content}
          </p>
        )}

        {/* 新增（学习中随时记录） */}
        <button
          onClick={() => setShowAdd(true)}
          data-testid="reminder-add"
          aria-label="新增复习提醒"
          className={`shrink-0 w-5 h-5 rounded-full border transition-all text-xs font-medium
            ${current
              ? 'border-gray-300 text-gray-400 hover:border-blue-300 hover:text-blue-500'
              : 'border-dashed border-gray-300 text-gray-400 hover:border-blue-300 hover:text-blue-500'}`}
        >
          ＋
        </button>

        {/* 管理入口（管理模式能力，仅 admin 显示） */}
        {admin && (
          <button
            onClick={() => setShowManage(true)}
            data-testid="reminder-manage"
            title="管理复习提醒"
            className="shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all"
          >
            管理
          </button>
        )}
      </div>

      {/* 新增弹框 */}
      {showAdd && (
        <AddModal onConfirm={handleAdd} onCancel={() => setShowAdd(false)} />
      )}

      {/* 管理弹窗（管理模式） */}
      {showManage && (
        <ManageModal
          items={items}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onClose={() => setShowManage(false)}
        />
      )}
    </div>
  );
}

/**
 * 新增弹框：输入提醒内容，确认提交
 * @param {Object} props - 组件属性
 * @param {Function} props.onConfirm - 确认回调（接收内容字符串）
 * @param {Function} props.onCancel - 取消回调
 */
function AddModal({ onConfirm, onCancel }) {
  const [content, setContent] = useState('');

  const confirm = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl p-8 mx-4 max-w-sm w-full shadow-2xl text-center">
        <h2 className="text-lg font-bold text-gray-800 mb-2">记录复习方法</h2>
        <p className="text-sm text-gray-400 mb-6">想到就记下，学习中随时提醒自己</p>

        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="例如：复习的关键在于反复多次和全面"
          maxLength={200}
          className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-xl
            resize-none outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
        />

        <div className="flex gap-4 justify-center mt-6">
          <button
            onClick={confirm}
            disabled={!content.trim()}
            className={`px-8 py-3 rounded-xl font-medium transition-all shadow-md ${
              content.trim()
                ? 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            保存
          </button>
          <button
            onClick={onCancel}
            className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 active:bg-gray-300 transition-all"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 管理弹窗：列出全部提醒条目，每条可编辑（✏️ 切换输入框）/ 删除（confirm 后硬删）
 * @param {Object} props - 组件属性
 * @param {Array<{ id: number, content: string }>} props.items - 全部提醒条目
 * @param {Function} props.onUpdated - 条目更新回调
 * @param {Function} props.onDeleted - 条目删除回调
 * @param {Function} props.onClose - 关闭弹窗回调
 */
function ManageModal({ items, onUpdated, onDeleted, onClose }) {
  // 正在编辑的条目 id（null = 无编辑中）
  const [editingId, setEditingId] = useState(null);
  // 编辑中的内容
  const [editContent, setEditContent] = useState('');

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const saveEdit = async (id) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    try {
      const updated = await remindersApi.update(id, trimmed);
      onUpdated(updated);
      setEditingId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const remove = async (item) => {
    if (!confirm(`删除提醒「${item.content}」？`)) return;
    try {
      await remindersApi.delete(item.id);
      onDeleted(item.id);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl p-6 mx-4 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">管理复习提醒</h2>
          <button
            onClick={onClose}
            data-testid="reminder-manage-close"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">还没有复习提醒，学习中点 ＋ 记一条吧</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {items.map(item => (
              <li key={item.id} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2">
                {editingId === item.id ? (
                  <>
                    <textarea
                      autoFocus
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      maxLength={200}
                      className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 resize-none outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      onClick={() => saveEdit(item.id)}
                      disabled={!editContent.trim()}
                      className={`shrink-0 px-2.5 py-1 text-xs rounded-lg transition-all ${
                        editContent.trim()
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <>
                    <p className="flex-1 text-sm text-gray-700 leading-relaxed">{item.content}</p>
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        onClick={() => startEdit(item)}
                        title="编辑"
                        className="text-xs text-gray-400 hover:text-blue-500 transition-all"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => remove(item)}
                        title="删除"
                        className="text-xs text-gray-400 hover:text-red-500 transition-all"
                      >
                        🗑
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-center mt-6">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 active:bg-gray-300 transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
