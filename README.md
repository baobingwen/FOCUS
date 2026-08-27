# 🎯 FOCUS — 极简学习计时器

一个考研备考用的极简学习计时工具。

## 功能

- **学习计时** — 选科目、开始、结束，专注当前任务
- **暂停/继续** — 学习途中可暂停，暂停时间计入今日休息，历史记录千层饼可视化
- **备注** — 学习过程中随时记录当前学的内容（暂停时也可编辑），历史记录中可修改/补充/清空/点击复制已保存的备注
- **学习标签** — 科目之下的知识点二级细分（高数、线代、真题…），学习中随时点选/新增，一条记录可挂多个；今日概览按标签分组，历史页点标签即可筛选；标签库顺序可拖拽自定义（管理模式内，常用标签排前面）
- **复习页数** — 学习中随时累计本次复习的页数（数字框 +「+1/+5/+10」快捷累加，选填），随记录保存；历史页展示/可改，今日概览汇总「今日总页数」与各科目页数
- **复习方法和提醒** — 自维护的提醒语句库，学习中「结束学习」大按钮下方小字提醒条展示一条，每 15 分钟自动轮换；学习中随时点 ＋ 弹框新增，管理模式内弹窗列表编辑/删除全部条目（数据存后端，跨设备可见）
- **休息计时** — 学习结束后弹出提醒，确认后开始休息计时；也可从空闲状态直接开始休息
- **科目管理** — 默认科目（数学、英语、专业课）+ 自定义新增（删除在管理模式内）
- **考研倒计时** — 右上角常驻显示「距离考研 X 天」，写死 2026-12-19；连点 5 下即进入管理模式（任何页面任何状态可见）
- **今日概览** — 今天总学习时长 + 各科目用时分布（暂停时间自动计入休息）+ 今日总页数与各科目页数汇总
- **历史记录** — 按天翻看过去的记录，带暂停的时段以千层饼堆叠条展示
- **管理模式** — 删除类功能统一收进隐藏模式：连点 5 下右上角考研倒计时进入，管理模式下可删除历史记录（单条，不可恢复）、自定义科目、标签，以及拖拽排序标签库；日常界面只留展示与可逆的修改，防误触
- **数据导出（管理模式）** — 管理模式横幅一键导出全部数据为 JSON 文件下载（含 app/版本/导出时间元数据，records 的 segments 解析为数组）

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
│   │   ├── App.jsx                  # 主布局 + 底部导航 + 考研倒计时 + 全局管理模式
│   │   ├── hooks/useTimer.js        # 计时器状态机
│   │   ├── hooks/useMultiTap.js     # 连点检测（管理模式入口）
│   │   ├── components/
│   │   │   ├── TimerPage.jsx        # 计时器主页面（5 状态：idle/studying/paused/rest_prompt/resting）
│   │   │   ├── ExamCountdown.jsx    # 考研倒计时
│   │   │   ├── SubjectSelector.jsx  # 科目选择器
│   │   │   ├── TagPicker.jsx        # 标签选择器
│   │   │   ├── ReminderBar.jsx      # 复习方法和提醒条
│   │   │   ├── HistoryPage.jsx      # 历史记录
│   │   │   ├── RecordCard.jsx       # 历史记录卡片
│   │   │   ├── SegmentStack.jsx     # 千层饼堆叠条
│   │   │   └── TodayOverview.jsx    # 今日概览
│   │   └── utils/
│   │       ├── api.js               # API 封装
│   │       ├── clipboard.js         # 剪贴板复制工具
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
│   │   ├── subjects.js              # 科目管理 API
│   │   ├── tags.js                  # 标签管理 API
│   │   ├── reminders.js             # 复习提醒 API
│   │   └── export.js                # 数据导出 API
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
空闲 → 选科目 → 开始学习 → 计时中（可写备注、点选标签、累计页数、记录复习提醒）
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
> 离开页面（切标签/锁屏）时计时继续，回来后时长与真实时间一致。
> 学习中「结束学习」大按钮下方有复习方法和提醒条：💡 显示一条自维护的提醒语句，每 15 分钟自动轮换；点 ＋ 随时记录新的复习方法；管理模式内可编辑/删除全部条目。

### 直接休息流程
```
空闲 → 选中「休息」→ 开始休息 → 休息计时中 → 结束 → 回到空闲
```

## 数据库

五张表：

**`records`** — 计时记录

| 字段        | 说明                  |
| ----------- | --------------------- |
| mode        | `study` 或 `rest`         |
| subject     | 科目（休息时为 null）     |
| duration_ms | 学习时长（毫秒，不含暂停）|
| paused_ms   | 暂停总时长（毫秒）        |
| segments    | 段列表 JSON（学习/暂停分段）|
| notes       | 备注                      |
| pages       | 复习页数（正整数，选填，休息为 null）|
| created_at  | 创建时间                  |

**`subjects`** — 科目

| 字段       | 说明           |
| ---------- | -------------- |
| name       | 科目名（唯一） |
| sort_order | 排序序号       |

**`tags`** — 标签（科目之下的知识点二级细分）

| 字段       | 说明                   |
| ---------- | ---------------------- |
| name       | 标签名（唯一）         |
| sort_order | 排序序号（自定义顺序） |

**`record_tags`** — 记录与标签的多对多关联

| 字段      | 说明                        |
| --------- | --------------------------- |
| record_id | 记录 id（级联删除）         |
| tag_id    | 标签 id（级联删除）         |

**`reminder_items`** — 复习方法和提醒语句

| 字段      | 说明                  |
| --------- | --------------------- |
| content   | 提醒语句内容（非空）  |
| sort_order| 排序序号（插入顺序，轮换按此循环） |
| created_at| 创建时间              |

## API

| 方法   | 路径                           | 说明                       |
| ------ | ------------------------------ | -------------------------- |
| GET    | `/health`                      | 健康检查（含版本号）       |
| GET    | `/api/version`                 | 获取当前版本号             |
| POST   | `/api/records`                 | 保存一条记录（可带 `tags`、`pages`） |
| GET    | `/api/records?date=YYYY-MM-DD` | 获取指定日期的记录（含 `tags`）|
| PATCH  | `/api/records/:id`             | 修改学习记录的备注、标签和页数     |
| DELETE | `/api/records/:id`             | 删除单条记录（学习/休息均可）       |
| GET    | `/api/records/today`           | 获取今日概览                 |
| GET    | `/api/subjects`                | 获取所有科目                 |
| POST   | `/api/subjects`                | 创建新科目                   |
| DELETE | `/api/subjects/:id`            | 删除科目（默认科目不可删）   |
| GET    | `/api/tags`                    | 获取所有标签                 |
| POST   | `/api/tags`                    | 创建标签（重名幂等复用）     |
| PUT    | `/api/tags/order`              | 批量重排标签顺序（全量提交） |
| DELETE | `/api/tags/:id`                | 删除标签（级联清关联）       |
| GET    | `/api/reminders`              | 获取全部复习提醒（按 sort_order）|
| POST   | `/api/reminders`              | 新增一条复习提醒            |
| PATCH  | `/api/reminders/:id`          | 修改一条复习提醒内容        |
| DELETE | `/api/reminders/:id`          | 删除一条复习提醒            |
| GET    | `/api/export`                 | 导出全部数据为 JSON 文件（下载附件） |

## 版本

版本分为三部分，各自独立管理：

```text
client/package.json → 0.3.0   (客户端版本，独立递增)
server/package.json → 0.3.0   (服务端版本，独立递增)
git tag              → v0.3.0 (项目里程碑标记)
```

- 客户端/服务端版本在各自 `package.json#version` 中维护
- git tag 仅标记项目整体里程碑，不参与运行时版本读取
- 服务端：`GET /api/version` 返回 server 版本
- 前端：`__APP_VERSION__` 全局常量（Vite build 时注入）

## 文档

完整文档索引见 [`docs/INDEX.md`](docs/INDEX.md)。

## 许可

[MIT](LICENSE) © 2026 Bingwen Bao (baobingwen)
