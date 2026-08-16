-- 复习方法和提醒：用户自维护的提醒语句库
-- 学习中计时器下方展示一条，每 15 分钟按 sort_order 顺序轮换
CREATE TABLE IF NOT EXISTS reminder_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);
