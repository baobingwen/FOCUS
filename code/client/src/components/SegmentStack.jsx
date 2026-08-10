// code/client/src/components/SegmentStack.jsx
import React from 'react';
import { fmtShortClock } from '../utils/fmtTime';

/**
 * 千层饼堆叠条组件
 * 按时间比例显示学习段（蓝色）和暂停段（灰色）
 *
 * @param {Object} props - 组件属性
 * @param {Array<{ type: string, duration_ms: number }>} props.segments - 学习/暂停段列表（时间正序）
 */
export default function SegmentStack({ segments }) {
  if (!segments || segments.length === 0) return null;

  const maxMs = Math.max(...segments.map(s => s.duration_ms), 1);
  const totalMs = segments.reduce((sum, s) => sum + s.duration_ms, 0);
  const pauseMs = segments.filter(s => s.type === 'pause').reduce((sum, s) => sum + s.duration_ms, 0);

  return (
    <div className="mt-2 space-y-0.5">
      {/* 反转渲染：自下而上 = 最早段在最下、最晚段在最上（数组仍保持时间正序） */}
      {[...segments].reverse().map((seg, i) => {
        const pct = seg.duration_ms / maxMs;
        const height = Math.max(20, Math.round(pct * 48));
        const isStudy = seg.type === 'study';
        return (
          <div
            key={i}
            data-testid="segment-row"
            className="flex items-center gap-2 rounded-md px-2 transition-colors"
            style={{
              height: `${height}px`,
              backgroundColor: isStudy ? '#dbeafe' : '#f3f4f6',
            }}
          >
            <span className={`text-xs font-medium ${isStudy ? 'text-blue-700' : 'text-gray-500'}`}>
              {isStudy ? '学习' : '暂停'}
            </span>
            <span className={`ml-auto text-xs font-mono ${isStudy ? 'text-blue-600' : 'text-gray-400'}`}>
              {fmtShortClock(seg.duration_ms)}
            </span>
          </div>
        );
      })}
      {/* 汇总信息 */}
      <p className="text-xs text-gray-400 mt-1.5 pt-1 border-t border-gray-100">
        总计 {fmtShortClock(totalMs)}
        {pauseMs > 0 && <span className="text-gray-300">（含暂停 {fmtShortClock(pauseMs)}）</span>}
      </p>
    </div>
  );
}
