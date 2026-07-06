import React, { useState, useEffect, useCallback } from 'react';
import { recordsApi } from '../utils/api';

function fmtTime(ms) {
  if (!ms || ms <= 0) return '0分';
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分`;
}

export default function TodayOverview({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) {
    return <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>;
  }

  if (!data) return null;

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
