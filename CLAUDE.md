# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projects

This repo contains two projects:

1. **FOCUS** (`code/`) — 极简学习计时器，个人考研备考工具
2. **第三方项目** (`111日常学习计时器-第三方项目/`) — 保留的原有学习计时项目，不动

## Branches

| 分支 | 说明 |
|------|------|
| `master` | 日常开发基线，含迁移系统、健康检查、本地部署脚本；每次发布后 merge 回 master 保持最新 |
| `0.3` | 0.3.x 补丁版本发布线（v0.3.1 起，v0.3.4 完结）：0.3.x 的开发与 tag 打于此，已 merge 回 master |
| `0.4` | 0.4.x 版本发布线（v0.4.0 起，管理模式主线）：管理模式从历史页局部功能逐步清晰为全局设计；0.4.x 的开发与 tag 打于此，每次发布后 merge 回 master |
| `feat/deploy` | Fly.io 部署方案档案（Dockerfile + fly.toml + DEPLOY_FLYIO.md），因注册需外币卡暂搁置 |
| `feat/local-deploy` | 已合入 master，本地 + Tailscale 部署方案 |

## Commands

### FOCUS (主项目)

```bash
# Start backend (Express + SQLite, port 3001)
cd code/server && npm run dev

# Start frontend (Vite + React, port 5173, proxies /api to backend)
cd code/client && npm run dev

# Production-like local start (build + serve on :3001)
双击 code/start-local.bat
或：
cd code/client && npm run build
cd code/server && npm start

# 改完前端代码后手动重新构建
cd code && pwsh -File build-client.ps1
# 或 Windows 资源管理器双击 code/build-client.ps1

# Run server tests (Jest 30 + supertest, 内存 SQLite)
cd code/server && npm test

# Watch mode
cd code/server && npm run test:watch

# Run client tests (Vitest + React Testing Library)
cd code/client && npm test

# Watch mode
cd code/client && npm run test:watch
```

> 全部文档索引见 **[docs/INDEX.md](docs/INDEX.md)**
> 测试详情：**[服务端测试](code/server/TESTING.md)** · **[客户端测试](code/client/TESTING.md)**
> 路线图：**[FOCUS ROADMAP](code/ROADMAP.md)**

### 第三方项目

```bash
cd 111日常学习计时器-第三方项目/server && npm run dev
cd 111日常学习计时器-第三方项目/client && npm run dev
# Or: .\111日常学习计时器-第三方项目\启动.bat
```

## FOCUS 项目架构

### 技术栈
- **客户端**: React 18 + Vite 6 + Tailwind CSS 3
- **服务端**: Express 5 (ESM) + better-sqlite3 (WAL 模式)
- **数据库**: SQLite 单文件，开发用 `server/data/focus.db`，手机访问用 `/data/focus.db`（Tailscale）

### 客户端结构 (`code/client/src/`)

| 文件 | 说明 |
|------|------|
| `App.jsx` | 主布局 + 底部导航 + useTimer 调用（计时状态托管于此，跨标签切换不丢失）+ 全局管理模式 state/横幅（连点右上角考研倒计时进入，跨 tab 常驻） |
| `components/TimerPage.jsx` | 计时器页面，5 状态机 (idle→studying→paused→rest_prompt→resting)，从 props 接收 timer；idle 态支持直接休息；暂停态支持继续和确认结束；学习中可点选/新增标签、累计复习页数（数字框 + +1/+5/+10 快捷芯片）；学习/暂停态大按钮始终居中，暂停/继续按钮悬浮右缘不占布局 |
| `components/ReminderBar.jsx` | 复习方法和提醒条：学习中「结束学习」大按钮下方小字提醒（💡 浅灰不抢眼），每 15 分钟按插入顺序轮换下一条；提醒条旁 ＋ 弹框新增（随时记录）；管理模式开启时出现「管理」按钮 → 弹窗列表编辑/删除全部条目（AddModal/ManageModal 子组件） |
| `components/ExamCountdown.jsx` | 考研倒计时（右上角常驻，写死 2026-12-19，过期自动隐藏）+ 全局管理模式隐藏入口（连点 5 下调用 onMultiTap，任何状态可见） |
| `components/SubjectSelector.jsx` | 科目选择（固定列表 + 自定义新增 + 休息；删除 × 仅管理模式 admin 显示，恒显） |
| `components/TagPicker.jsx` | 标签选择器（扁平全局标签库点选/新增，删除 × 与 ⚙ 排序仅管理模式 admin 显示，学习中与历史编辑态共用） |
| `components/HistoryPage.jsx` | 历史记录（按日查看 + 日期导航 + 学习记录备注内联编辑 + 备注点击复制 + 标签展示/点选筛选/✏️ 编辑态增删 + 页数「📖 N 页」徽标/编辑 + 管理模式删除：adminMode prop 开启时卡片右上角删除按钮、confirm 单条删除；入口在右上角考研倒计时，App 层统一；记录卡片渲染与编辑态状态拆分至 RecordCard） |
| `components/RecordCard.jsx` | 单条记录卡片纯展示壳（查看态 + ✏️ 编辑态表单渲染），所有编辑状态由 HistoryPage 持有通过 props 传入，不持有状态（v0.4.1 从 HistoryPage 拆分） |
| `components/SegmentStack.jsx` | 千层饼堆叠条（学习/暂停段按时间比例显示 + 总计/含暂停汇总），独立组件（v0.4.1 从 HistoryPage 拆分） |
| `components/TodayOverview.jsx` | 今日概览（总时长 + 按科目分组条形图 + 按标签分组时长 + 今日总页数与科目页数） |
| `hooks/useTimer.js` | 极简计时器，使用 Date.now() 绝对时间戳，含 freeze/thaw 冻结机制 |
| `hooks/useFreezeOnLeave.js` | 离开页面自动冻结 — 监听 visibilitychange/blur/focus，调用 freeze/thaw |
| `hooks/useMultiTap.js` | 连点检测 — count 次点击（间隔 ≤windowMs，超时重置）触发 onComplete，管理模式隐藏入口共用 |
| `utils/api.js` | fetch 封装 |
| `utils/clipboard.js` | 剪贴板复制工具（navigator.clipboard + execCommand 降级） |
| `utils/fmtTime.js` | 时长格式化工具：`fmtTime`（中文时长"1小时30分"）+ `fmtClock`（HH:MM:SS/MM:SS，计时页用）+ `fmtShortClock`（MM:SS，历史页/千层饼用） |

### 服务端结构 (`code/server/`)

| 文件 | 说明 |
|------|------|
| `index.js` | 入口，express + cors + 静态文件托管 + `/health` 健康检查，导出 `app` 供 supertest 调用 |
| `database.js` | SQLite 初始化 + 幂等迁移引擎 + `closeDb()`，支持 `DB_PATH` 环境变量覆写 |
| `routes/records.js` | POST 保存记录（可带 tags、pages），GET 按日期查询（返回每条 tags），GET /today 今日概览（含 total_pages 与按科目页数），PATCH /:id 修改备注、标签与页数（整组替换，仅学习记录），DELETE /:id 删除单条记录（学习/休息均可，硬删除，record_tags 级联清理） |
| `routes/subjects.js` | 科目 CRUD（默认科目不可删） |
| `routes/tags.js` | 标签 CRUD：GET 全量（按 sort_order）、POST 幂等复用（≤12 字，排末尾）、PUT /order 批量重排（全量校验）、DELETE 级联清关联 |
| `routes/reminders.js` | 复习提醒 CRUD：GET 全量（按 sort_order）、POST 新增（≤200 字，排末尾）、PATCH /:id 改内容、DELETE /:id 删除 |
| `migrations/` | 增量 SQL 迁移脚本目录，按文件名排序执行，仅增不删改 |

### 数据库迁移系统

位于 `database.js` 的 `runMigrations()` 函数，启动时自动运行：

1. 建 `_migrations` 追踪表（记录已执行的迁移名）
2. 扫描 `migrations/*.sql` 文件，按文件名排序
3. 对未执行的迁移：`BEGIN → exec(sql) → INSERT _migrations → COMMIT`
4. 已执行的直接跳过，不重跑

```sql
-- 示例 migrations/001_add_notes_index.sql
CREATE INDEX IF NOT EXISTS idx_records_notes ON records(notes);
```

### 测试架构

#### 服务端 (`code/server/`)

| 文件/配置 | 说明 |
|-----------|------|
| `__tests__/records.test.js` | records 路由测试 |
| `__tests__/subjects.test.js` | subjects 路由测试 |
| `jest.setup.cjs` | 测试前设 `DB_PATH=:memory:`、`NODE_ENV=test` |
| `package.json#jest` | Jest 30 配置，原生 ESM + `--experimental-vm-modules` |

用例数见 [`code/server/TESTING.md`](code/server/TESTING.md)。

**关键决策（服务端）：**
- **Jest 30** + **supertest**：supertest 直接驱动 Express app，无需监听端口
- **`:memory:` SQLite**：每个测试文件启动全新空数据库，`beforeEach` 中 `closeDb(); getDb();` 重置
- **时间隔离**：`/today` 边界测试通过 `jest.useFakeTimers({ now: ... })` 模拟系统时间，配合显式 `created_at` 插入
- **Express 5 注意**：catch-all 路由不能用 `'*'`（path-to-regexp v8 不认），要用 `'/{*path}'`
- **ESM 注意**：`jest` 对象需从 `@jest/globals` 显式导入，`setupFiles` 用 `.cjs` 扩展名

#### 客户端 (`code/client/src/`)

| 测试文件 | 说明 |
|----------|------|
| `utils/api.test.js` | fetch 封装测试 |
| `utils/clipboard.test.js` | 剪贴板复制工具测试 |
| `hooks/useTimer.test.js` | 状态机全路径覆盖 |
| `hooks/useFreezeOnLeave.test.js` | 页面离开冻结事件测试 |
| `components/TimerPage.test.jsx` | 5 态渲染 + 保存 + 休息 + 暂停 + 弹窗确认 + 冻结 UI |
| `components/ReminderBar.test.jsx` | 提醒条展示/轮换/新增/管理模式门控 + 编辑/删除 |
| `components/SubjectSelector.test.jsx` | CRUD + confirm 弹窗 + 休息 |
| `components/HistoryPage.test.jsx` | 日期导航 + 列表 + 千层饼 + 备注编辑/复制 |
| `components/TodayOverview.test.jsx` | 概览 + 条形图 |
| `components/ExamCountdown.test.jsx` | 考研倒计时 |
| `App.test.jsx` | Tab 切换 |

用例数及合计见 [`code/client/TESTING.md`](code/client/TESTING.md)。

**关键决策（客户端）：**
- **Vitest** + **React Testing Library** + **jsdom**：Vitest 原生 Vite 集成，零额外配置
- **模块级 mock**：`vi.mock('../utils/api')` 拦截所有 API 调用，组件测试隔离
- **日期固定**：`vi.useFakeTimers({ toFake: ['Date'] })` 只 fake Date，保留异步定时器避免超时
- **Loading 态**：`mockReturnValueOnce(new Promise(() => {}))` 保持 pending，避免 act 告警

### 部署方案

#### 本地 + Tailscale（当前在用，0 元）

通过 Tailscale 组网，手机远程访问本机服务：

```bash
# 安装依赖（首次）
cd code/server && npm install
cd ../client && npm install

# 构建前端 + 启动服务（以后双击即可）
code/start-local.bat
```

手机浏览器打开 `http://<Tailscale-IP>:3001` 即可使用。  
详细指南见 `code/LOCAL_DEPLOY.md`。

#### Fly.io 云部署（备选，需外币信用卡）

方案文档在 `feat/deploy` 分支，含 Dockerfile、`fly.toml` 等配置。  
详细方案见 `code/DEPLOY_FLYIO.md`（仅限 `feat/deploy` 分支）。

### 数据库

**records** — `mode` (study/rest), `subject`, `duration_ms`, `paused_ms` (暂停总时长), `segments` (JSON 段列表), `notes`, `pages` (复习页数，正整数选填，仅学习记录), `created_at`
**subjects** — `name`, `sort_order`（默认：数学、英语、专业课）
**tags** — `name`（唯一，≤12 字）, `sort_order`（自定义排列顺序，新标签自动排末尾）
**record_tags** — `record_id`, `tag_id` 多对多关联（外键级联删除）
**reminder_items** — `content`（复习提醒内容，≤200 字）, `sort_order`（插入顺序，学习中轮换按此循环）, `created_at`
**_migrations** — 迁移追踪表，记录已执行的迁移脚本名

### 核心概念
- **状态机**: idle → studying → paused → studying → paused → ... → rest_prompt → resting → idle
- **极简**: 没有计次、没有分段、没有自动分类
- **双轨时间**: Date.now() 绝对时间戳，锁屏休眠恢复后精准咬合
- **科目**: 一级分类，固定列表 + 用户自定义
- **标签**: 科目之下的知识点二级细分，扁平全局库，一条记录可挂多个；统计按「科目 × 标签」交叉，重名幂等复用
- **复习提醒**: 用户自维护的提醒语句库，学习中「结束学习」大按钮下方小字提醒条展示一条、每 15 分钟顺序轮换，点 ＋ 随时新增，管理模式内编辑/删除；存后端 `reminder_items` 表
- **部署**: 本地 + Tailscale 优先，Fly.io 方案备选
