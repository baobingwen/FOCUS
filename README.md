# 🎯 FOCUS — 极简学习计时器

一个考研备考用的极简学习计时工具。

## 功能

- **学习计时** — 选科目、开始、结束，专注当前任务
- **暂停/继续** — 学习途中可暂停，暂停时间计入今日休息，历史记录千层饼可视化
- **备注** — 学习过程中随时记录当前学的内容（暂停时也可编辑），历史记录中可修改/补充/清空/点击复制已保存的备注
- **学习标签** — 科目之下的知识点二级细分（高数、线代、真题…），学习中随时点选/新增，一条记录可挂多个；今日概览按标签分组，历史页点标签即可筛选；标签库顺序可拖拽自定义（管理模式内，常用标签排前面）
- **复习页数** — 学习中随时累计本次复习的页数（数字框 +「+1/+5/+10」快捷累加，选填），随记录保存；历史页展示/可改，今日概览汇总「今日总页数」与各科目页数
- **复习方法和提醒** — 自维护的提醒语句库，学习中「结束学习」大按钮下方小字提醒条展示一条，每 15 分钟自动轮换；学习中随时点 ＋ 弹框新增，管理模式内弹窗列表编辑/删除全部条目（数据随版本存储：服务端版存后端跨设备可见，纯静态版存浏览器）
- **休息计时** — 学习结束后弹出提醒，确认后开始休息计时；也可从空闲状态直接开始休息
- **科目管理** — 默认科目（数学、英语、专业课）+ 自定义新增（删除在管理模式内）
- **考研倒计时** — 右上角常驻显示「距离考研 X 天」，写死 2026-12-19；连点 5 下即进入管理模式（任何页面任何状态可见）
- **今日概览** — 今天总学习时长 + 各科目用时分布（暂停时间自动计入休息）+ 今日总页数与各科目页数汇总
- **历史记录** — 按天翻看过去的记录，带暂停的时段以千层饼堆叠条展示
- **管理模式** — 删除类功能统一收进隐藏模式：连点 5 下右上角考研倒计时进入，管理模式下可删除历史记录（单条，不可恢复）、自定义科目、标签，以及拖拽排序标签库；日常界面只留展示与可逆的修改，防误触
- **数据导出（管理模式）** — 管理模式横幅一键导出全部数据为 JSON 文件下载（含 app/版本/导出时间元数据，records 的 segments 解析为数组）
- **数据导入（管理模式）** — 管理模式横幅「导入数据」按钮，把导出的 JSON 文件恢复到本地（全量替换，语义 = 恢复到导出时状态）；确认弹窗展示文件信息与导入统计、可先下载当前备份，导入成功后整页刷新；学习中不可导入
- **计时状态持久化** — 学习中/暂停中/休息中的计时状态自动存入浏览器 localStorage：刷新页面、误关标签页、浏览器崩溃后重新打开自动恢复计时（科目/备注/标签/页数/已学时长原样还原），顶部提示条显示离开时长，默认计入离开时间，可「忽略离开时间」（离开缺口不计入）或「放弃本次学习」；会话正常结束自动清空
- **结束确认 + 保存失败重试** — 学习中/暂停中点「结束学习」先弹确认框（「结束学习 / 返回学习」，返回学习继续计时，不会误触结束）；学习记录保存失败时弹窗变为「重试保存 / 放弃记录」——待重试记录写入浏览器 localStorage，刷新/误关页面后仍可重试，学习数据不再因保存失败丢失
- **双版本构建** — 同一套代码按构建开关 `VITE_DATA_LAYER` 产出两种形态。**服务端版**，默认构建，数据存后端 SQLite，沿用现有 Node + Tailscale 部署；**纯静态版**，`npm run build:static`，数据存浏览器 IndexedDB，可一键部署到 GitHub Pages（`https://baobingwen.github.io/FOCUS/`，见 `code/DEPLOY_STATIC.md`）；两版功能、界面、交互一致，导出文件互通

## 快速开始

需要 Node.js 18+。

### 服务端版（默认形态）

数据存后端 SQLite，沿用现有部署。

**开发模式（前后端热更新）**：

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

**生产模式（本地 + Tailscale 手机访问）**：

```bash
# 改完前端代码后手动构建
cd code && pwsh -File build-client.ps1
# 或双击 code/build-client.ps1

# 启动服务
双击 code/start-local.bat
```

手机浏览器访问 `http://<Tailscale-IP>:3001` 即可使用。

### 纯静态版（无后端形态）

数据存浏览器 IndexedDB，无需后端，可部署到任意静态托管。

**开发模式**：

```bash
cd code/client && npm run dev:static
```

浏览器访问 `http://localhost:5173`，数据层为浏览器 IndexedDB（无需启动后端）。

**构建与预览**：

```bash
cd code/client && npm run build:static   # 产物在 dist-static/
npx vite preview --outDir dist-static --base /FOCUS/   # 预览子路径（访问 http://localhost:4173/FOCUS/）
```

或使用手动构建脚本（改完代码后，与 `build-client.ps1` 对应）：

```bash
cd code && pwsh -File build-client-static.ps1   # 产物在 client/dist-static/
```

数据存于浏览器 IndexedDB，清除站点数据会清空记录，注意先导出备份。

**部署到 GitHub Pages**：

```bash
cd code && pwsh -File deploy-static.ps1   # 构建 + 推送到 gh-pages 分支
```

部署地址 `https://baobingwen.github.io/FOCUS/`（FOCUS 仓库 gh-pages 分支，项目页子路径，GitHub Pages 大小写不敏感、小写 /focus/ 亦可访问）。一次性设置（仓库 Settings → Pages 选 gh-pages 分支）与数据迁移说明见 [`code/DEPLOY_STATIC.md`](code/DEPLOY_STATIC.md)。

## 构建形态（双版本）

| 命令 | 形态 | 产物 | 数据层 |
| ---- | ---- | ---- | ------ |
| `npm run build`（默认） | 服务端版 | `dist/` | REST API（需后端） |
| `npm run build:static` | 纯静态版 | `dist-static/` | 浏览器 IndexedDB |
| `npm run dev` | 服务端版开发 | - | REST API（需后端） |
| `npm run dev:static` | 纯静态版开发 | - | 浏览器 IndexedDB |

导出文件的 `version` 字段：服务端版填 server 版本，纯静态版填 client 版本（仅元数据，不影响互通）。

## 从服务端版迁移到纯静态版

1. 在服务端版管理模式「导出数据」，下载 JSON 备份文件
2. 构建并打开纯静态版
3. 在纯静态版管理模式「导入数据」，选择备份文件并确认导入
4. 数据以快照方式一次性迁移；之后两版数据各自独立，如需继续同步，重复「导出 → 导入」

## 技术栈

| 层            | 技术                                              | 说明        |
| ------------- | ------------------------------------------------- | ----------- |
| 前端          | React 19 + Vite 8 + Tailwind CSS 4                | -           |
| 后端          | Express 5（ESM）+ better-sqlite3（WAL 模式）      | 仅服务端版  |
| 数据库（服务端版） | SQLite 单文件 `server/data/focus.db`           | -           |
| 数据库（纯静态版） | IndexedDB（`focus-db` 库，五个对象仓库）       | -           |
| 测试          | 服务端 Jest 30 + supertest · 客户端 Vitest + RTL  | -           |

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
│   │       ├── api.js               # 数据访问统一入口（按构建开关分发数据层）
│   │       ├── apiRest.js           # REST 数据层实现（服务端版）
│   │       ├── apiLocal.js          # IndexedDB 数据层实现（纯静态版）
│   │       ├── clipboard.js         # 剪贴板复制工具
│   │       ├── fmtTime.js           # 时长格式化
│   │       ├── timerStorage.js      # 计时快照存取（localStorage，刷新/崩溃恢复）
│   │       └── pendingRecord.js     # 待重试记录存取（localStorage，保存失败重试）
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
│   │   ├── export.js                # 数据导出 API
│   │   └── import.js                # 数据导入 API
│   └── package.json
│
├── shared/                          # 双版本共用模块
│   └── importValidation.js          # 导入校验（顶层结构 + 行级规则；client 经 Vite alias 引用、server 相对路径引用）
│
├── build-client.ps1                 # 手动构建脚本
├── build-client-static.ps1          # 手动构建纯静态版脚本
├── deploy-static.ps1                # 纯静态版部署到 GitHub Pages 脚本
├── start-local.bat                  # 本地一键启动
├── ROADMAP.md                       # 功能路线图
├── LOCAL_DEPLOY.md                  # 本地 + Tailscale 部署指南
└── DEPLOY_STATIC.md                 # GitHub Pages 部署指南（纯静态版）

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
                       继续 ← 暂停中    确认框「结束学习 / 返回学习」
                                        ↙          ↘
                                返回学习继续计时    保存记录（成功）
                                                      ↓
                                                  弹出「要休息吗？」
                                                   ↙              ↘
                                                休息计时         回到空闲
                                                   ↓
                                                结束休息
                                                   ↓
                                                回到空闲
```

> 保存失败时确认框变为「重试保存 / 放弃记录」：重试保存直到成功（或放弃，直接回到空闲）；待重试记录存于浏览器 localStorage，刷新/误关后仍可处理。
> 暂停时计时器灰化显示暂停时长，可随时继续或经确认后结束。
> 暂停时间自动计入今日休息统计，历史记录中以千层饼堆叠条展示。
> 离开页面（切标签/锁屏）时计时继续，回来后时长与真实时间一致。
> 学习中「结束学习」大按钮下方有复习方法和提醒条：💡 显示一条自维护的提醒语句，每 15 分钟自动轮换；点 ＋ 随时记录新的复习方法；管理模式内可编辑/删除全部条目。

### 直接休息流程
```
空闲 → 选中「休息」→ 开始休息 → 休息计时中 → 结束 → 回到空闲
```

### 计时恢复（刷新 / 崩溃后）

学习中/暂停中/休息中刷新页面、误关标签页或浏览器崩溃，重新打开后自动恢复上次计时（科目/备注/标签/页数/已学时长原样还原），顶部提示条显示「已恢复上次学习」与离开时长：默认计入离开时间，可「忽略离开时间」（离开缺口不计入）或「放弃本次学习」。会话正常结束自动清空恢复记录。

上次学习记录保存失败且未处理时，重新打开会弹出「重试保存 / 放弃记录」（待重试记录存于 localStorage，不随刷新丢失）。

## 数据存储

服务端版存于 SQLite 五张表，纯静态版存于浏览器 IndexedDB 五个对象仓库，两版共享同一数据模型（`record_tags` 独立保存多对多关联，导出文件互通）：

五张表/仓库：

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
| POST   | `/api/import`                 | 导入全部数据（全量替换，body 为导出 JSON） |

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
