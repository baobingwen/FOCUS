# 0009: 复习方法和提醒区 — 学习中提醒条 + 15 分钟轮换 + 管理模式管理

日常点子「添加『复习方法和提醒』区，比如这句：复习的关键在于反复多次和全面，计时页随时可以记录」——用户想在计时页常驻自己积累的复习方法/提醒，学习过程中随时能看见、随时能补充。

## Status

**accepted**

## Design

### 定位：用户自维护的便签库，不是内置语录

内容完全由用户维护（像便签一样可编辑），默认空库。库里可存多条，学习中「结束学习」大按钮下方以小字提醒条展示**一条**，每 15 分钟按插入顺序自动轮换到下一条（1→2→3→1…）。数据存后端 SQLite `reminder_items` 表，跨设备可见（手机/电脑同库）。

### 展示位置：仅学习中

只在学习中（studying/paused）显示，空闲/休息不显示——提醒服务于「正在学习」的场景，不打扰其他状态。「结束学习」大按钮正下方小字（💡 浅灰不抢眼），无条目时只留 ＋ 入口。

### 交互入口

| 能力 | 入口 | 说明 |
|------|------|------|
| 记录（随时） | 提醒条旁 ＋ | 弹框输入保存，新条目排末尾并立即展示——「计时页随时可以记录」 |
| 编辑/删除 | 管理模式「管理」按钮 → 弹窗列表 | 管理模式开启时提醒条旁出现「管理」按钮，弹窗列出全部条目，每条可 ✏️ 编辑 / 🗑 confirm 删除 |

管理入口沿用 0008 的「管理模式」设计：删除类/整理类操作收进隐藏模式，日常界面只留可逆的展示与新增。学习中新增保持常态（可逆、高频、与「随时记录」诉求一致）。

### 数据模型与 API

迁移 `005_add_reminder_items.sql`：

```sql
CREATE TABLE IF NOT EXISTS reminder_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);
```

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reminders` | 全部条目（按 sort_order, id） |
| POST | `/api/reminders` | 新增（trim 判空，≤200 字，排末尾） |
| PATCH | `/api/reminders/:id` | 改内容（同校验） |
| DELETE | `/api/reminders/:id` | 删除（硬删） |

### 轮换实现

前端 `ReminderBar.jsx`：加载全部条目，`setInterval` 每 15 分钟 `index = (index + 1) % items.length` 顺序循环；不足 2 条不轮换。新增后重置下标到新条目（排末尾即展示它），删除后取模修正下标防越界。

## Consequences

- 服务端：新表 + 新路由 + 迁移 005，server 版本 `0.3.3`→`0.3.4`。
- 客户端：新组件 `ReminderBar.jsx`（含 AddModal/ManageModal 子组件）+ `remindersApi` 封装，TimerPage 学习中态接入；client 版本 `0.4.1`→`0.4.2`。
- 测试：服务端 reminders 路由 19 条（128 全绿）；客户端 ReminderBar 12 条 + remindersApi 4 条（234 全绿）。
- 不做：内置固定语录、手动切换提醒、按科目/标签关联提醒、提醒与学习记录绑定（保持极简）。
