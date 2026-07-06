# 🎯 FOCUS — 极简学习计时器

一个考研备考用的极简学习计时工具。

## 功能

- **学习计时** — 选科目、开始、结束，专注当前任务
- **备注** — 学习过程中随时记录当前学的内容
- **休息计时** — 学习结束后弹出提醒，确认后自动开始休息计时
- **科目管理** — 默认科目（数学、英语、专业课）+ 自定义新增/删除
- **今日概览** — 今天总学习时长 + 各科目用时分布
- **历史记录** — 按天翻看过去的记录

## 快速开始

需要 Node.js 18+。

```bash
# 安装依赖
cd code/server && npm install
cd code/client && npm install

# 启动后端（端口 3001）
cd code/server && npm run dev

# 新开一个终端，启动前端（端口 5173）
cd code/client && npm run dev
```

前端 Vite 开发服务器会自动代理 `/api` 请求到后端，打开浏览器访问 `http://localhost:5173` 即可使用。

## 技术栈

| 层     | 技术                                         |
| ------ | -------------------------------------------- |
| 前端   | React 18 + Vite 6 + Tailwind CSS 3           |
| 后端   | Express 4（ESM）+ better-sqlite3（WAL 模式） |
| 数据库 | SQLite 单文件 `server/data/focus.db`         |

## 项目结构

```txt
code/
├── client/                         # React 前端
│   ├── src/
│   │   ├── App.jsx                 # 主布局 + 底部导航（计时/历史）
│   │   ├── hooks/useTimer.js       # 计时器状态机
│   │   ├── components/
│   │   │   ├── TimerPage.jsx       # 计时器主页面（4 状态）
│   │   │   ├── SubjectSelector.jsx # 科目选择器
│   │   │   ├── HistoryPage.jsx     # 历史记录
│   │   │   └── TodayOverview.jsx   # 今日概览
│   │   └── utils/api.js            # API 封装
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── server/                         # Express 后端
    ├── src/
    │   ├── index.js                # 入口
    │   ├── database.js             # SQLite 初始化
    │   └── routes/
    │       ├── records.js          # 计时记录 API
    │       └── subjects.js         # 科目管理 API
    └── package.json
```

## 使用流程

```txt
空闲 → 选科目 → 开始学习 → 计时中（可写备注）→ 结束
                                                    ↓
                                        弹出「要休息吗？」
                                       ↙              ↘
                                    休息计时         回到起始
                                       ↓
                                    结束休息
                                       ↓
                                    回到起始
```

## 数据库

两张表：

**`records`** — 计时记录

| 字段        | 说明                  |
| ----------- | --------------------- |
| mode        | `study` 或 `rest`     |
| subject     | 科目（休息时为 null） |
| duration_ms | 时长（毫秒）          |
| notes       | 备注                  |
| created_at  | 创建时间              |

**`subjects`** — 科目

| 字段       | 说明           |
| ---------- | -------------- |
| name       | 科目名（唯一） |
| sort_order | 排序序号       |

## API

| 方法   | 路径                           | 说明                       |
| ------ | ------------------------------ | -------------------------- |
| POST   | `/api/records`                 | 保存一条记录               |
| GET    | `/api/records?date=YYYY-MM-DD` | 获取指定日期的记录         |
| GET    | `/api/records/today`           | 获取今日概览               |
| GET    | `/api/subjects`                | 获取所有科目               |
| POST   | `/api/subjects`                | 创建新科目                 |
| DELETE | `/api/subjects/:id`            | 删除科目（默认科目不可删） |

## 进度

初步开发
