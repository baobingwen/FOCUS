# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projects

This repo contains two projects:

1. **FOCUS** (`code/`) — 极简学习计时器，个人考研备考工具
2. **第三方项目** (`111日常学习计时器-第三方项目/`) — 保留的原有学习计时项目，不动

## Commands

### FOCUS (主项目)

```bash
# Start backend (Express + SQLite, port 3001)
cd code/server && npm run dev

# Start frontend (Vite + React, port 5173, proxies /api to backend)
cd code/client && npm run dev
```

### 第三方项目

```bash
cd 111日常学习计时器-第三方项目/server && npm run dev
cd 111日常学习计时器-第三方项目/client && npm run dev
# Or: .\111日常学习计时器-第三方项目\启动.bat
```

## FOCUS 项目架构

### 技术栈
- **客户端**: React 18 + Vite 6 + Tailwind CSS 3
- **服务端**: Express 4 (ESM) + better-sqlite3 (WAL 模式)
- **数据库**: SQLite 单文件 `server/data/focus.db`

### 客户端结构 (`code/client/src/`)

| 文件 | 说明 |
|------|------|
| `App.jsx` | 主布局 + 底部导航（计时/历史两标签） |
| `components/TimerPage.jsx` | 计时器主页面，4 状态机 (idle→studying→rest_prompt→resting) |
| `components/SubjectSelector.jsx` | 科目选择（固定列表 + 自定义新增/删除） |
| `components/HistoryPage.jsx` | 历史记录（按日查看 + 日期导航） |
| `components/TodayOverview.jsx` | 今日概览（总时长 + 按科目分组条形图） |
| `hooks/useTimer.js` | 极简计时器，使用 Date.now() 绝对时间戳 |
| `utils/api.js` | fetch 封装 |

### 服务端结构 (`code/server/`)

| 文件 | 说明 |
|------|------|
| `index.js` | 入口，express + cors + 静态文件托管 |
| `database.js` | SQLite 初始化 + 自动建表 |
| `routes/records.js` | POST 保存记录，GET 按日期查询，GET /today 今日概览 |
| `routes/subjects.js` | 科目 CRUD（默认科目不可删） |

### 数据库

**records** — `mode` (study/rest), `subject`, `duration_ms`, `notes`, `created_at`
**subjects** — `name`, `sort_order`（默认：数学、英语、专业课）

### 核心概念
- **状态机**: idle → studying → rest_prompt → resting → idle
- **极简**: 没有计次、没有分段、没有自动分类、没有二级标签
- **双轨时间**: Date.now() 绝对时间戳，锁屏休眠恢复后精准咬合
- **科目**: 一级分类，固定列表 + 用户自定义
