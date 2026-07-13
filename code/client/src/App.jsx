import React, { useState, useCallback } from 'react';
import TimerPage from './components/TimerPage';
import HistoryPage from './components/HistoryPage';
import ExamCountdown from './components/ExamCountdown';
import useTimer from './hooks/useTimer';

const TABS = [
  { key: 'timer', label: '计时', icon: '⏱️' },
  { key: 'history', label: '历史', icon: '📋' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('timer');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const timer = useTimer();

  const handleRecordSaved = useCallback(() => {
    setHistoryRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col mx-auto relative overflow-hidden"
         style={{ maxWidth: '430px' }}>

        {/* 考研倒计时（右上角） */}
        <ExamCountdown />

        {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
        <div className="px-4 pt-6">
          {activeTab === 'timer' && (
            <TimerPage timer={timer} onRecordSaved={handleRecordSaved} />
          )}
          {activeTab === 'history' && (
            <HistoryPage refreshKey={historyRefreshKey} />
          )}
        </div>
      </div>

      {/* 底部导航 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-40"
           style={{ maxWidth: '430px', margin: '0 auto' }}>
        <div className="flex justify-around items-center px-4 py-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center gap-0.5 px-6 py-1 rounded-lg transition-all ${
                activeTab === tab.key ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className={`text-xs font-medium ${activeTab === tab.key ? 'text-blue-600' : ''}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
