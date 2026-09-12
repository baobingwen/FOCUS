// code/client/src/components/ProgressPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { recordsApi, subjectsApi } from '../utils/api';
import { fmtTime } from '../utils/fmtTime';

/** 展示窗口：滚动近 7 天（含今天），科目覆盖与各科配速共用（见 docs/adr/0016） */
const WINDOW_DAYS = 7;
/**
 * 取数回溯上限：为计算「上次学习距今 N 天」而向前多取的日历天数
 * 超出该回溯窗口（含从未学过）的科目，距今天数显示「—」
 */
const LOOKBACK_DAYS = 90;

/**
 * 本地日期字符串（YYYY-MM-DD）
 * @param {Date} d - 日期对象
 * @returns {string} YYYY-MM-DD
 */
function toDateStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 在给定日期上加减天数（按本地时间，返回新对象，不修改入参）
 * @param {Date} d - 基准日期
 * @param {number} n - 天数（可负）
 * @returns {Date} 偏移后的日期
 */
function addDays(d, n) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/**
 * 进度页组件（第三个 tab）
 * 跨天回顾视图，回答「这段时间分配得怎么样」：
 * - 页面标题（与计时页 / 历史页同款；剩余天数不在此页重复——右上角常驻倒计时是唯一来源）
 * - 科目覆盖：近 7 天 × 全部科目点阵，某天该科有学习记录即点亮（二元判定、无时长阈值）
 * - 各科配速：近 7 天各科目累计学习时长占比条
 * 纯只读视图，不含修改/删除操作；休息记录不参与统计；不随管理模式变化
 *
 * @param {Object} props - 组件属性
 * @param {string|number} [props.refreshKey] - 刷新键，变化时重新加载（结束学习保存后自增）
 */
export default function ProgressPage({ refreshKey = 0 }) {
  // 科目列表（全部科目，按 sort_order，用于覆盖格与配速的行集合）
  const [subjects, setSubjects] = useState([]);
  // 回溯窗口内的全部记录（含 tags，但本页只需 mode/subject/duration_ms/created_at）
  const [records, setRecords] = useState([]);
  // 加载状态
  const [loading, setLoading] = useState(true);

  /**
   * 加载进度数据：科目列表 + 回溯窗口内的记录（一次区间取数，覆盖与配速共用）
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const from = toDateStr(addDays(today, -(LOOKBACK_DAYS - 1)));
      const to = toDateStr(today);
      const [subjectList, result] = await Promise.all([
        subjectsApi.list(),
        recordsApi.range(from, to),
      ]);
      setSubjects(Array.isArray(subjectList) ? subjectList : []);
      setRecords(result?.records || []);
    } catch (err) {
      console.error('加载进度数据失败:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  // 覆盖格与配速的聚合（纯前端，一套逻辑双版本共用）
  const { dates, rows, maxMs, litCellCount } = useMemo(() => {
    const today = new Date();
    const todayStr = toDateStr(today);

    // 展示窗口的 7 个日期：最旧在左、今天在右
    const windowDates = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
      windowDates.push(toDateStr(addDays(today, -i)));
    }
    const inWindow = new Set(windowDates);

    /** @type {Map<string, number>} `日期|科目` → 该日该科学习时长（仅用于判定是否点亮） */
    const byDateSubject = new Map();
    /** @type {Map<string, number>} 科目 → 展示窗口内累计学习时长 */
    const totalInWindow = new Map();
    /** @type {Map<string, string>} 科目 → 回溯窗口内最近一次学习日期 */
    const lastStudied = new Map();

    for (const r of records) {
      if (r.mode !== 'study' || !r.subject) continue;
      const d = String(r.created_at).slice(0, 10);
      const prev = lastStudied.get(r.subject);
      if (!prev || d > prev) lastStudied.set(r.subject, d);
      if (!inWindow.has(d)) continue;
      const key = `${d}|${r.subject}`;
      byDateSubject.set(key, (byDateSubject.get(key) || 0) + (r.duration_ms || 0));
      totalInWindow.set(r.subject, (totalInWindow.get(r.subject) || 0) + (r.duration_ms || 0));
    }

    const built = subjects.map((s) => {
      const name = s.name;
      const last = lastStudied.get(name) || null;
      const gapDays = last
        ? Math.round(
            (new Date(`${todayStr}T00:00:00`) - new Date(`${last}T00:00:00`)) / 86400000,
          )
        : null;
      return {
        name,
        cells: windowDates.map((d) => byDateSubject.has(`${d}|${name}`)),
        totalMs: totalInWindow.get(name) || 0,
        gapDays,
      };
    });

    return {
      dates: windowDates,
      rows: built,
      maxMs: Math.max(1, ...built.map((r) => r.totalMs)),
      litCellCount: built.reduce((acc, r) => acc + r.cells.filter(Boolean).length, 0),
    };
  }, [subjects, records]);

  if (loading) {
    return <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>;
  }

  const todayIndex = WINDOW_DAYS - 1;

  return (
    <div data-testid="progress-page">
      {/* 页面标题：与计时页「🎯 FOCUS」/ 历史页「📋 历史记录」同款。
          剩余天数不在此页重复——右上角全局倒计时是唯一来源（App 层常驻，三个 tab 都可见） */}
      <h2 className="text-lg font-bold text-gray-800 mb-4">📈 学习进度</h2>

      {/* 科目覆盖（断层）：近 7 天 × 全部科目 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">科目覆盖 · 近 7 天</h3>

        {litCellCount === 0 && (
          <p className="text-center text-gray-300 text-sm py-2 mb-1">近 7 天还没有学习记录</p>
        )}

        {/* 表头：日期（日）+ 右侧列表头「上次」（列内为「N 天前 / 今天」，见下方行渲染）*/}
        <div className="flex items-center mb-1.5">
          <div className="w-20 shrink-0" />
          <div className="flex-1 grid grid-cols-7 gap-1">
            {dates.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[10px] ${
                  i === todayIndex ? 'text-blue-600 font-medium' : 'text-gray-300'
                }`}
              >
                {Number(d.slice(8, 10))}
              </div>
            ))}
          </div>
          <div className="w-11 shrink-0 text-right text-[10px] text-gray-300">上次</div>
        </div>

        {/* 科目行：点亮格 + 上次列（表头「上次」；今天学过显示「今天」，其余「N 天前」，回溯窗口内无记录「—」）*/}
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center">
              <div className="w-20 shrink-0 pr-1 text-xs text-gray-600 truncate" title={row.name}>
                {row.name}
              </div>
              <div className="flex-1 grid grid-cols-7 gap-1">
                {row.cells.map((lit, i) => (
                  <div key={i} className="flex justify-center">
                    <div
                      data-lit={lit ? 'true' : 'false'}
                      className={`w-2.5 h-2.5 rounded-sm ${lit ? 'bg-blue-500' : 'bg-gray-100'}`}
                    />
                  </div>
                ))}
              </div>
              <div className="w-11 shrink-0 text-right text-[11px] text-gray-400">
                {row.gapDays === null ? '—' : (row.gapDays === 0 ? '今天' : `${row.gapDays} 天前`)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 各科配速：近 7 天累计学习时长占比条（视觉与今日概览的科目条形图同款）*/}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-medium text-gray-500 mb-3">各科配速 · 近 7 天</h3>

        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                <span className="truncate pr-2">{row.name}</span>
                <span className="font-mono shrink-0">{fmtTime(row.totalMs)}</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${(row.totalMs / maxMs) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
