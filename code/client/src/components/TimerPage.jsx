// code/client/src/components/TimerPage.jsx
import React, { useState, useCallback } from 'react';
import SubjectSelector from './SubjectSelector';
import { recordsApi } from '../utils/api';

/**
 * 将 ms 格式化为时间显示（HH:MM:SS或MM:SS格式）
 * @param {number} ms
 * @returns {string} 格式化后的时间字符串
 */
function fmtTime(ms) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 计时器页面组件
 * 管理学习/休息的计时、记录保存和UI状态切换
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.timer - 计时器状态对象（来自useTimer钩子）
 * @param {Function} props.onRecordSaved - 记录保存后的回调函数
 */
export default function TimerPage({ timer, onRecordSaved }) {
  // 保存中状态（防止重复提交）
  const [saving, setSaving] = useState(false);
  // Toast通知状态
  const [toast, setToast] = useState(null);

  /**
   * 显示Toast通知
   * @param {string} msg - 通知消息
   * @param {string} type - 通知类型（'success' 或 'error'）
   */
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  /**
   * 处理结束学习
   * 停止计时器并保存学习记录到后端
   */
  const handleEndStudy = async () => {
    const duration = timer.endStudy(); // 停止计时并获取时长
    if (!duration) return; // 如果没有有效时长则退出

    setSaving(true);
    try {
      // 调用API保存学习记录
      await recordsApi.create({
        mode: 'study',
        subject: timer.selectedSubject.name,
        duration_ms: duration,
        notes: timer.notes.trim(),
      });
      onRecordSaved?.(); // 通知父组件刷新数据
    } catch (err) {
      showToast(`保存失败: ${err.message}`, 'error');
    }
    setSaving(false);
  };

  /**
   * 处理结束休息
   * 停止休息计时并保存休息记录
   */
  const handleEndRest = async () => {
    const duration = timer.endRest(); // 停止休息计时并获取时长
    if (!duration) return;

    try {
      // 调用API保存休息记录
      await recordsApi.create({
        mode: 'rest',
        duration_ms: duration,
        notes: '',
      });
      showToast(`休息了 ${fmtTime(duration)}，继续加油！`);
      onRecordSaved?.();
    } catch (err) {
      showToast(`保存休息失败: ${err.message}`, 'error');
    }
  };

  // ===== 渲染各状态 =====

  // 状态 1：空闲 — 选科目 + 开始按钮
  if (timer.phase === 'idle') {
    return (
      <div className="flex flex-col items-center pt-12 px-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">🎯 FOCUS</h1>
        <p className="text-sm text-gray-400 mb-10">选择科目，开始专注</p>

        <SubjectSelector
          selected={timer.selectedSubject}
          onSelect={timer.selectSubject}
        />

        <button
          onClick={timer.startStudy}
          disabled={!timer.selectedSubject}
          className={`mt-6 w-48 h-48 rounded-full flex items-center justify-center
            shadow-lg transition-all duration-200 text-white font-bold text-xl
            ${timer.selectedSubject
              ? 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 cursor-pointer'
              : 'bg-gray-300 cursor-not-allowed'
            }`}
        >
          <div className="text-center">
            <div className="text-4xl mb-1">▶</div>
            <div>开始学习</div>
          </div>
        </button>

        {!timer.selectedSubject && (
          <p className="text-xs text-gray-300 mt-4">请先选择一个科目</p>
        )}

        {/* Toast */}
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  // 状态 2：学习中 — 计时器 + 备注 + 结束按钮
  if (timer.phase === 'studying') {
    return (
      <div className="flex flex-col items-center pt-8 px-4">
        {/* 科目标签 */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-6">
          📚 {timer.selectedSubject?.name}
        </div>

        {/* 计时器 */}
        <div className="timer-font text-7xl font-light tracking-tight text-gray-900 mb-8 select-none">
          {fmtTime(timer.elapsed)}
        </div>

        {/* 备注输入框 */}
        <div className="w-full max-w-sm mb-8">
          <label className="text-xs text-gray-400 mb-1 block">备注（选填）</label>
          <textarea
            value={timer.notes}
            onChange={(e) => timer.updateNotes(e.target.value)}
            placeholder="记录一下当前的学习内容..."
            className="w-full h-24 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl
              resize-none outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* 结束学习按钮 */}
        <button
          onClick={handleEndStudy}
          disabled={saving}
          className="w-36 h-36 rounded-full bg-orange-400 hover:bg-orange-500 active:bg-orange-600
            shadow-lg transition-all duration-200 text-white font-bold flex items-center justify-center"
        >
          <div className="text-center">
            <div className="text-3xl mb-1">⬛</div>
            <div>{saving ? '保存中...' : '结束学习'}</div>
          </div>
        </button>

        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  // 状态 3：休息弹窗
  if (timer.phase === 'rest_prompt') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl p-8 mx-4 max-w-sm w-full shadow-2xl text-center">
          <div className="text-5xl mb-4">☕</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">学得不错！</h2>
          <p className="text-sm text-gray-400 mb-8">休息一下还是继续？</p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={timer.startRest}
              className="px-8 py-3 bg-blue-500 text-white rounded-xl font-medium
                hover:bg-blue-600 active:bg-blue-700 transition-all shadow-md"
            >
              休息一下
            </button>
            <button
              onClick={timer.skipRest}
              className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium
                hover:bg-gray-200 active:bg-gray-300 transition-all"
            >
              不休息
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 状态 4：休息中
  if (timer.phase === 'resting') {
    return (
      <div className="flex flex-col items-center pt-16 px-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium mb-6">
          ☕ 休息中
        </div>

        <div className="timer-font text-6xl font-light tracking-tight text-gray-700 mb-12 select-none">
          {fmtTime(timer.elapsed)}
        </div>

        <button
          onClick={handleEndRest}
          className="w-36 h-36 rounded-full bg-blue-400 hover:bg-blue-500 active:bg-blue-600
            shadow-lg transition-all duration-200 text-white font-bold flex items-center justify-center"
        >
          <div className="text-center">
            <div className="text-3xl mb-1">▶</div>
            <div>结束休息</div>
          </div>
        </button>

        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  return null;
}

/**
 * Toast通知组件
 * 显示短暂的消息提示（成功或错误）
 */
function Toast({ message, type }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all
      ${type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
      {message}
    </div>
  );
}
