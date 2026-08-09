// code/client/src/components/ExamCountdown.jsx
import { useState, useEffect } from 'react';
import useMultiTap from '../hooks/useMultiTap';

/** 考研日期：2026 年 12 月 19 日 */
const EXAM_DATE = new Date(2026, 11, 19);

function calcDays() {
  const diff = EXAM_DATE.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * 考研倒计时组件
 * 在页面右上角显示距考研还有多少天，不显眼
 * 考研日期过后自动隐藏
 *
 * 同时是全局管理模式的隐藏入口：连点 5 下进入（任何页面任何状态都可见）
 *
 * @param {Object} props - 组件属性
 * @param {Function} [props.onMultiTap] - 连点 5 下（间隔 ≤2s）达标后的回调（进入管理模式）
 */
export default function ExamCountdown({ onMultiTap = () => {} }) {
  const [days, setDays] = useState(calcDays);
  const handleClick = useMultiTap(onMultiTap);

  useEffect(() => {
    const id = setInterval(() => setDays(calcDays()), 60000);
    return () => clearInterval(id);
  }, []);

  if (days < 0) return null;

  const text = days === 0 ? '📅 考研日' : `距离考研 ${days} 天`;

  return (
    <div
      onClick={handleClick}
      data-testid="exam-countdown"
      title=""
      className={`absolute top-3 right-3 text-sm font-medium select-none z-10 ${
        days === 0 ? 'text-amber-500' : 'text-gray-600'
      }`}
    >
      {text}
    </div>
  );
}
