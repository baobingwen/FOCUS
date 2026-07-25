# 🎯 FOCUS — 极简学习计时器

一个考研备考用的极简学习计时工具。

## 功能

- **学习计时** — 选科目、开始、结束，专注当前任务
- **暂停/继续** — 学习途中可暂停，暂停时间计入今日休息，历史记录千层饼可视化
- **备注** — 学习过程中随时记录当前学的内容（暂停时也可编辑）
- **休息计时** — 学习结束后弹出提醒，确认后开始休息计时；也可从空闲状态直接开始休息
- **科目管理** — 默认科目（数学、英语、专业课）+ 自定义新增/删除
- **考研倒计时** — 右上角常驻显示「距离考研 X 天」，写死 2026-12-19
- **今日概览** — 今天总学习时长 + 各科目用时分布（暂停时间自动计入休息）
- **历史记录** — 按天翻看过去的记录，带暂停的时段以千层饼堆叠条展示

## 快速开始

需要 Node.js 18+。

### 开发模式（前后端热更新）

```bash
# 安装依赖（首次）
cd code/server && npm install
cd code/client && npm install

# 启动后端（端口 3001）
cd code/server && npm run dev

# 新开终端，启动前端（端口 5173）
cd code/client && npm run dev
```

前端 Vite 开发服务器自动代理 `/api` 到后端，浏览器访问 `http://localhost:5173`。

### 生产模式（本地 + Tailscale 手机访问）

```bash
# 改完前端代码后手动构建
cd code && pwsh -File build-client.ps1
# 或双击 code/build-client.ps1

# 启动服务
双击 code/start-local.bat
```

手机浏览器访问 `http://<Tailscale-IP>:3001` 即可使用。

## 技术栈

| 层     | 技术                                              |
| ------ | ------------------------------------------------- |
| 前端   | React 18 + Vite 6 + Tailwind CSS 3                |
| 后端   | Express 5（ESM）+ better-sqlite3（WAL 模式）      |
| 数据库 | SQLite 单文件 `server/data/focus.db`              |
| 测试   | 服务端 Jest 30 + supertest · 客户端 Vitest + RTL  |

## 项目结构

```
code/
├── client/                          # React 前端
│   ├── src/
│   │   ├── App.jsx                  # 主布局 + 底部导航 + 考研倒计时
│   │   ├── hooks/useTimer.js        # 计时器状态机
│   │   ├── components/
│   │   │   ├── TimerPage.jsx        # 计时器主页面（5 状态：idle/studying/paused/rest_prompt/resting）
│   │   │   ├── ExamCountdown.jsx    # 考研倒计时
│   │   │   ├── SubjectSelector.jsx  # 科目选择器
│   │   │   ├── HistoryPage.jsx      # 历史记录
│   │   │   └── TodayOverview.jsx    # 今日概览
│   │   └── utils/
│   │       ├── api.js               # API 封装
│   │       └── fmtTime.js           # 时长格式化
│   ├── vite.config.js               # Vite 配置（注入 __APP_VERSION__）
│   └── package.json
│
├── server/                          # Express 后端
│   ├── index.js                     # 入口 + /health + /api/version
│   ├── database.js                  # SQLite 初始化 + 幂等迁移
│   ├── version.js                   # git tag 版本读取
│   ├── routes/
│   │   ├── records.js               # 计时记录 API
│   │   └── subjects.js              # 科目管理 API
│   └── package.json
│
├── build-client.ps1                 # 手动构建脚本
├── start-local.bat                  # 本地一键启动
├── ROADMAP.md                       # 功能路线图
└── LOCAL_DEPLOY.md                  # 本地 + Tailscale 部署指南

docs/
├── INDEX.md                         # 全部文档索引
└── adr/                             # 架构决策记录
```

## 使用流程

### 学习流程
```
空闲 → 选科目 → 开始学习 → 计时中（可写备注）
                            ↙          ↘
                         暂停           结束
                          ↓              ↓
                       继续 ← 暂停中    弹出「要休息吗？」
                                       ↙              ↘
                                    休息计时         回到空闲
                                       ↓
                                    结束休息
                                       ↓
                                    回到空闲
```

> 暂停时计时器灰化显示暂停时长，可随时继续或经确认后结束。
> 暂停时间自动计入今日休息统计，历史记录中以千层饼堆叠条展示。

### 直接休息流程
```
空闲 → 选中「休息」→ 开始休息 → 休息计时中 → 结束 → 回到空闲
```

## 数据库

两张表：

**`records`** — 计时记录

| 字段        | 说明                  |
| ----------- | --------------------- |
| mode        | `study` 或 `rest`         |
| subject     | 科目（休息时为 null）     |
| duration_ms | 学习时长（毫秒，不含暂停）|
| paused_ms   | 暂停总时长（毫秒）        |
| segments    | 段列表 JSON（学习/暂停分段）|
| notes       | 备注                      |
| created_at  | 创建时间                  |

**`subjects`** — 科目

| 字段       | 说明           |
| ---------- | -------------- |
| name       | 科目名（唯一） |
| sort_order | 排序序号       |

## API

| 方法   | 路径                           | 说明                       |
| ------ | ------------------------------ | -------------------------- |
| GET    | `/health`                      | 健康检查（含版本号）       |
| GET    | `/api/version`                 | 获取当前版本号             |
| POST   | `/api/records`                 | 保存一条记录               |
| GET    | `/api/records?date=YYYY-MM-DD` | 获取指定日期的记录         |
| GET    | `/api/records/today`           | 获取今日概览               |
| GET    | `/api/subjects`                | 获取所有科目               |
| POST   | `/api/subjects`                | 创建新科目                 |
| DELETE | `/api/subjects/:id`            | 删除科目（默认科目不可删） |

## 版本

版本分为三部分，各自独立管理：

```text
client/package.json → 0.2.2   (客户端版本，独立递增)
server/package.json → 0.2.3   (服务端版本，独立递增)
git tag              → v0.2.4 (项目里程碑标记)
```

- 客户端/服务端版本在各自 `package.json#version` 中维护
- git tag 仅标记项目整体里程碑，不参与运行时版本读取
- 服务端：`GET /api/version` 返回 server 版本
- 前端：`__APP_VERSION__` 全局常量（Vite build 时注入）

## 文档

完整文档索引见 [`docs/INDEX.md`](docs/INDEX.md)。

## 许可

[MIT](LICENSE) © 2026 Bingwen Bao (baobingwen)
