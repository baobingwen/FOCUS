// code/client/src/components/TimerRestoreBar.jsx
import React from 'react';
import { fmtClock, fmtTime } from '../utils/fmtTime';

/**
 * 计时快照恢复提示条（App 层，计时/历史 tab 都可见）
 *
 * 页面刷新/误关标签/崩溃后由计时快照自动恢复计时时展示：
 * 「已恢复上次学习：科目 · 已学时长 · 离开时长」
 *   - 默认计入离开时间（绝对时间戳继续累计，与锁屏休眠恢复一致）
 *   - 「忽略离开时间」：当前段起点前移离开时长，缺口不计入（再点切回计入）
 *   - 「放弃本次学习」：清快照回空闲
 *
 * @param {Object} props
 * @param {Object} props.timer - useTimer() 返回的 timer 对象（需含 restoreInfo/awayIgnored/ignoreAwayTime/countAwayTime/discardRestore）
 */
export default function TimerRestoreBar({ timer }) {
  const { restoreInfo, awayIgnored, ignoreAwayTime, countAwayTime, discardRestore, dismissRestore } = timer;
  if (!restoreInfo) return null;

  const isRest = restoreInfo.phase === 'resting';
  const subjectText = isRest
    ? '上次休息'
    : `上次学习${restoreInfo.subjectName ? `：${restoreInfo.subjectName}` : ''}`;
  const elapsedLabel = isRest ? '已休息' : '已学';

  return (
    <div className="mx-4 mt-12 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 z-10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-blue-700">
          🔄 已恢复{subjectText} · {elapsedLabel} {fmtClock(restoreInfo.elapsedAtClose)} · 离开 {fmtTime(restoreInfo.awayMs)}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={awayIgnored ? countAwayTime : ignoreAwayTime}
            className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded-lg hover:bg-blue-200 transition-colors"
          >
            {awayIgnored ? '计入离开时间' : '忽略离开时间'}
          </button>
          <button
            onClick={discardRestore}
            className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors"
          >
            放弃本次学习
          </button>
          <button
            onClick={dismissRestore}
            aria-label="关闭恢复提示条"
            className="text-sm text-gray-400 hover:text-gray-600 px-1 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
