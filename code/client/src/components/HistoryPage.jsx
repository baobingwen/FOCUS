import React, { useState, useEffect, useCallback } from 'react';
import { recordsApi } from '../utils/api';
import TodayOverview from './TodayOverview';

function fmtTime(ms) {
  if (!ms || ms <= 0) return '0分';
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分`;
}

function fmtShortTime(ms) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(dateStr) {
  return dateStr === getTodayStr();
}

export default function HistoryPage({ refreshKey }) {
  const [currentDate, setCurrentDate] = useState(getTodayStr);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);

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

  useEffect(() => { loadRecords(); }, [loadRecords, refreshKey, overviewRefreshKey]);

  const goToPrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const goToNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const goToToday = () => {
    setCurrentDate(getTodayStr());
  };

  const showPrev = currentDate !== getTodayStr() || !isToday(currentDate);

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4">📋 历史记录</h2>

      {/* 今日概览（仅在当天显示） */}
      {isToday(currentDate) && (
        <TodayOverview refreshKey={refreshKey + '-' + overviewRefreshKey} />
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

      {/* 记录列表 */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">加载中...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-400 text-sm">这天没有记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
            >
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

                {/* 时长 */}
                <span className="text-sm font-mono text-gray-700 ml-auto">
                  {fmtShortTime(record.duration_ms)}
                </span>
              </div>

              {/* 备注 */}
              {record.notes && (
                <p className="text-xs text-gray-400 mt-1 ml-1">{record.notes}</p>
              )}

              {/* 时间戳 */}
              <p className="text-xs text-gray-300 mt-1">
                {record.created_at?.slice(0, 16) || ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
