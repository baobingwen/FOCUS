// code/client/src/components/TodayOverview.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { recordsApi } from '../utils/api';
import { fmtTime } from '../utils/fmtTime';

/**
 * 今日概览组件
 * 显示当天的学习统计数据，包括总学习时长、休息时长以及各科目的学习时长分布
 * 
 * @param {Object} props - 组件属性
 * @param {string|number} props.refreshKey - 刷新键，变化时重新加载数据
 */
export default function TodayOverview({ refreshKey }) {
  // 今日概览数据
  const [data, setData] = useState(null);
  // 加载状态
  const [loading, setLoading] = useState(true);

  /**
   * 加载今日概览数据
   * 从API获取当天的学习统计数据
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await recordsApi.todayOverview();
      setData(result);
    } catch (err) {
      console.error('加载今日概览失败:', err);
    }
    setLoading(false);
  }, []);

  /**
   * 当组件挂载或刷新键变化时重新加载数据
   */
  useEffect(() => { load(); }, [load, refreshKey]);

  // 加载中状态
  if (loading) {
    return <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>;
  }

  // 无数据时返回空
  if (!data) return null;

  // 计算各科目中最大时长，用于进度条比例计算
  const maxSubjectMs = data.by_subject?.length > 0
    ? Math.max(...data.by_subject.map(s => s.total_ms))
    : 1;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
      <h3 className="text-sm font-medium text-gray-500 mb-3">今日概览</h3>

      {/* 总学习时长 */}
      <div className="text-center mb-4">
        <div className="text-3xl font-bold text-gray-800 timer-font">
          {fmtTime(data.total_study_ms)}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          学习 {fmtTime(data.total_study_ms)} · 休息 {fmtTime(data.total_rest_ms)}
        </div>
      </div>

      {/* 按科目分组 */}
      {data.by_subject?.length > 0 && (
        <div className="space-y-2">
          {data.by_subject.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                <span>{item.subject}</span>
                <span className="font-mono">{fmtTime(item.total_ms)}</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${(item.total_ms / maxSubjectMs) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {data.total_records === 0 && (
        <p className="text-center text-gray-300 text-sm py-2">今天还没有记录</p>
      )}
    </div>
  );
}
