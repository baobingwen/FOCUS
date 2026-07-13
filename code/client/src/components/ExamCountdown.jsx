// code/client/src/components/ExamCountdown.jsx
import { useState, useEffect } from 'react';

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
 */
export default function ExamCountdown() {
  const [days, setDays] = useState(calcDays);

  useEffect(() => {
    const id = setInterval(() => setDays(calcDays()), 60000);
    return () => clearInterval(id);
  }, []);

  if (days < 0) return null;
  if (days === 0) return (
    <div className="absolute top-3 right-3 text-sm font-medium text-amber-500 select-none z-10">
      📅 考研日
    </div>
  );

  return (
    <div className="absolute top-3 right-3 text-sm font-medium text-gray-600 select-none z-10">
      距离考研 {days} 天
    </div>
  );
}
