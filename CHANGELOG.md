# Changelog

All notable changes to this project will be documented in this file.

## [0.5.3] — 2026-08-31

### 版本线：0.5.x 维护（无后端 Local-First 主线）

日常点子「导入校验在双版本之间不一致」落地——双版本共用同一套导入校验规则，同一份文件两端要么都接受要么都拒绝。

### Changed

- **导入校验双版本统一**：抽公共模块 `code/shared/importValidation.js`（纯函数，客户端经 Vite alias `@shared` 引用、服务端相对路径引用），双版本共用同一套显式行级校验——顶层结构（app=FOCUS、data 五表均为数组）+ 行级规则（id 正整数 / mode 仅 study·rest / duration_ms > 0 / 科目·标签·提醒名称非空 / record_tags 引用存在 / 重复科目名与重复 record_tags 拒绝）；任何一行不合法整体拒绝、事务回滚，错误消息统一为「导入数据不合法: …」中文描述
- **服务端行为对齐明细**：duration_ms ≤ 0 与空串名称从「接受」变为「拒绝」（此前 SQLite 仅 NOT NULL 放行）；重复科目名/重复 record_tags 的拒绝前置到校验层（400 的 error 字段从 SQLite 英文原文变为中文规则消息）；sort_order 缺失/null 从「拒绝」变为「接受并归一为 0」；notes/paused_ms/pages/created_at 缺失字段默认值归一化与纯静态版一致（intOr/strOr 共享辅助）
- **纯静态版**：删除本地 `validatePayload/validateImportRows` 改用共享模块；补齐缺失的重复科目名/重复 record_tags 检查（此前 IndexedDB 无唯一约束会接受）；归一化改用共享辅助
- 服务端 SQLite 现有约束（UNIQUE/复合主键/外键/NOT NULL）保留作理论兜底，不加新 migration/CHECK 约束；对正常流程与历史导出文件零影响（FOCUS 自身导出的文件字段齐全、值合法，必然通过校验；唯一边界：已含重复数据（脏库）导出的文件会被拒绝，属合理保护）

### Tests

- 服务端 140 → 146 全绿：import.test.js 7 → 13 条（+6：duration_ms≤0 拒绝 / 空串科目名拒绝 / 重复科目名 400 中文消息 / 重复标签名拒绝 / 重复 record_tags 拒绝 / sort_order 缺失归一 0）；原「NOT NULL 约束回滚」用例改为行级校验语义（断言「导入数据不合法」）
- 客户端 320 → 325 全绿：apiLocal.test.js 41 → 46 条（+5：重复科目名 / 重复 record_tags / duration_ms≤0 / 空串标签名 / sort_order 缺失归 0）；双构建（dist / dist-static）验证 alias 解析正常

### Docs

- `docs/adr/0013-import-validation-unified.md` — 新增双版本导入校验统一设计文档（差异清单 / 6 条决策 / 影响分析）
- `CONTEXT.md` — 「数据导入」概念更新：完全信任文件 → 双版本共用同一套行级校验 + 中文错误 + 默认值归一化
- `code/ROADMAP.md` — 日常点子「导入校验双版本不一致」标记设计已确定；v0.4.4 导入条目「完全信任文件」表述修正
- `CLAUDE.md` — routes/import.js 描述更新 + 新增 code/shared/importValidation.js 说明行
- `code/client/docs/CODE_STRUCTURE.md` — 版本头 v0.5.3 + 依赖图 apiLocal → shared/importValidation + 文件职责表新增共享模块行
- `docs/INDEX.md` — 登记 ADR 0013
- `code/server/TESTING.md` / `code/client/TESTING.md` — import.test.js 7→13 条、apiLocal 41→46 条、总数 140→146 / 320→325 同步

## [0.5.2] — 2026-08-30

### 版本线：0.5.x 维护（无后端 Local-First 主线）

日常点子「计时器状态不持久化，刷新即丢失」落地——进行中的学习/休息计时快照写入 localStorage，页面刷新、误关标签页、浏览器崩溃后重新打开自动恢复计时。

### Added

- **计时状态持久化**：学习中/暂停中/休息中三态的关键状态（阶段、当前段绝对时间戳、累计学习/暂停时长、段列表、科目、备注、标签、页数）定时写入浏览器 localStorage（键 `focus:timer:snapshot`，带 `version` 字段），刷新/误关标签/崩溃后重新打开自动恢复——科目/备注/标签/页数/已学时长原样还原，第一帧即恢复态（新增 `utils/timerStorage.js` 存取 + `useTimer` 快照水合/持久化）
- **恢复提示条（TimerRestoreBar）**：App 顶部提示条「已恢复上次学习：科目 · 已学时长 · 离开时长」（计时/历史 tab 都可见）——默认计入离开时间（绝对时间戳继续累计，与锁屏休眠恢复一致）；可「忽略离开时间」（当前段起点前移离开时长，缺口不计入、恢复到关页面前的瞬间状态，可再点切回计入）；可「放弃本次学习」（清快照回空闲）；可 ✕ 关闭提示条（仅隐藏，快照保留、计时继续，下次刷新仍可恢复）；陈旧快照不设上限，提示条醒目展示离开时长、当场决定
- **写时机与边界**：状态切换/输入即写 + pagehide/beforeunload 最后补写 + 活跃态每 10 秒周期兜底（防浏览器崩溃）；elapsed 不落盘（由绝对时间戳推导，tick 不写）；只持久化 studying/paused/resting，rest_prompt 不持久化（endStudy/skipRest/endRest 清空快照）；快照是 UI 运行态而非业务数据——不进五表/五仓库、不参与导出/导入，双版本（服务端版/纯静态版）共用 useTimer 天然生效

### Changed

- 文档一致性修复：CONTEXT/README/CLAUDE 技术栈修正为 React 19 + Vite 8 + Tailwind CSS 4（原写 React 18 + Vite 6 + Tailwind CSS 3，与 client/package.json 实际不符——日常点子「文档/工程一致性问题」随之解决）
- CONTEXT.md「计时器状态持久化」概念移入 Language 概念区（原挂在技术栈之后，位置错误）

### Tests

- 客户端 297 → 320 全绿：useTimer.test.js +11（快照写入/输入同步/会话结束清空/水合恢复/忽略计入离开/放弃/关闭提示条/pagehide/非法快照忽略）、TimerRestoreBar.test.jsx 新增 7 条、App.test.jsx +5（自动恢复显示/放弃/忽略切换/✕ 关闭/无快照不显示）；服务端 140 全绿（零改动）

### Docs

- `docs/adr/0012-timer-persistence.md` — 计时器状态持久化设计文档（快照结构/写时机/恢复交互/阶段边界/组件改造/不做的）
- `CONTEXT.md` / `README.md` / `CLAUDE.md` — 计时快照概念、恢复流程、功能条目、结构表/测试表同步
- `code/ROADMAP.md` — 事项从日常点子移入已实现（v0.5.2）
- `code/client/docs/CODE_STRUCTURE.md` — 版本头 v0.5.2 + 依赖图/文件职责表/测试对应表同步
- `code/client/TESTING.md` — 317 条 / 19 个测试文件
- `docs/INDEX.md` — 登记 ADR 0012

## [0.5.1] — 2026-08-30

### 版本线：0.5.x 维护（无后端 Local-First 主线）

日常点子「设计一套无后端方案」迭代 B 落地——纯静态版部署到 GitHub Pages：浏览器打开固定网址即可使用。v0.5.1 起确定双版本（服务端版 + 纯静态版）长期共存、各自演进，不再移除后端。

### Added

- **GitHub Pages 部署（纯静态版）**：部署地址 `https://baobingwen.github.io/FOCUS/`（FOCUS 源码仓库 `gh-pages` 分支、项目页子路径——`focus` 名字已被源码仓库占用、根地址被其他站占用，故用子路径；GitHub Pages URL 大小写不敏感，小写 `/focus/` 亦可访问）
- **vite base 按 mode 区分**：`vite.config.js` 在 `static` 模式下 `base` 为 `/FOCUS/`（资源引用带子路径前缀），默认模式保持 `'/'`——服务端版构建与部署不受影响
- **部署脚本 `code/deploy-static.ps1`**：构建纯静态版 → 同步到独立部署工作区 `code/.deploy-static/`（保留 `.git` 部署历史，仅首次初始化，已加入 `.gitignore`）→ commit（带版本号）→ **普通快进 push**（非强制覆盖）；无变更时跳过部署；远程 `gh-pages` 被外部改动导致 push 被拒时停下提示，由用户确认后手动 `--force-with-lease` 处理
- **部署指南 `code/DEPLOY_STATIC.md`**：一次性设置（Settings → Pages 选 gh-pages 分支）、每次发布流程、本地预览验证（`vite preview --base /FOCUS/`）、IndexedDB origin 隔离与数据迁移说明、回滚（gh-pages 保留每次部署历史）、常见问题

### Changed

- README/CONTEXT/CLAUDE/INDEX/CODE_STRUCTURE/ADR 0011 — 双版本条目与部署方案同步 GitHub Pages 部署
- 预览命令补 `--base /FOCUS/`（子路径部署下本地预览需匹配 base）

### Docs

- `code/DEPLOY_STATIC.md` — 新增 GitHub Pages 部署指南（一次性设置/发布流程/数据迁移/回滚/常见问题）
- `code/ROADMAP.md` — 迭代 B 移入已实现 + 版本头 0.5.1
- `docs/adr/0011-no-backend-local-first.md` — 迭代拆分 B 标注 v0.5.1 已完成 + 落地内容
- `CONTEXT.md` — 「纯静态版/服务端版」条目补 GitHub Pages 子路径部署
- `README.md` — 纯静态版章节补「部署到 GitHub Pages」命令块 + 项目结构
- `CLAUDE.md` — Commands 加 `deploy-static.ps1` + 部署方案区新增「GitHub Pages」+ 核心概念「部署」更新
- `code/client/docs/CODE_STRUCTURE.md` — 版本头 v0.5.1
- `docs/INDEX.md` — 部署区登记 `deploy-static.ps1` / `DEPLOY_STATIC.md`

### Tests

- 服务端 140 全绿（零改动）；客户端 297 全绿（零改动，迭代 B 为构建配置与部署脚本，无新增用例）

## [0.5.0] — 2026-08-30

### 版本线：0.5.x 起点（无后端 Local-First 主线）

日常点子「设计一套无后端方案，逐步转向无后端」迭代 A 落地——同一代码库 + 构建开关 `VITE_DATA_LAYER` 产出双版本：服务端版（默认，REST + SQLite）与纯静态版（数据存浏览器 IndexedDB）。

### Added

- **数据层双实现**：`utils/api.js` 改为统一入口（按构建开关分发），新增 `apiRest.js`（REST，服务端版）与 `apiLocal.js`（IndexedDB 五仓库 1:1 模拟五表，纯静态版）；接口契约不变，组件零改动
- **构建形态**：`npm run build:static`（纯静态版，产物 `dist-static/`）、`npm run dev:static`（纯静态版开发）；默认构建仍为服务端版，现有部署脚本不变；新增手动构建脚本 `code/build-client-static.ps1`（与 `build-client.ps1` 对应，改完代码后构建纯静态版）
- **导出/导入本地化**：纯静态版在浏览器端直接生成导出 JSON（格式与后端完全一致）与事务式导入（坏行整体回滚），双版本导出文件互通
- **种子数据**：首次建库写入默认科目（数学、英语、专业课）；默认科目按名字禁删、导入不补默认科目——与后端行为一致

### Tests

- 客户端：新增 `apiLocal.test.js`（fake-indexeddb 直测本地数据层：CRUD/排序/幂等/级联/种子/统计/导出/导入事务）+ `apiRest.test.js`（REST 数据层迁移）+ `api.test.js`（分发入口）；组件测试零改动

### Docs

- `docs/adr/0011-no-backend-local-first.md` — 无后端方案设计文档（双版本数据层、迭代拆分 A/B/C）
- `CONTEXT.md` — 新增「数据层」「纯静态版/服务端版」概念，导出/导入/复习提醒条目兼容双版本
- `README.md` — 快速开始按形态重组、构建形态速查表、迁移小节、技术栈/项目结构/数据存储更新
- `CLAUDE.md` — Commands 按形态分组、技术栈/客户端结构/测试表/核心概念补数据层
- `code/client/docs/CODE_STRUCTURE.md` — 依赖图/文件职责表/测试对应表更新
- `code/ROADMAP.md` — 无后端条目标记设计已确定（引用 ADR 0011）
- `docs/INDEX.md` — ADR 0011 索引

## [0.4.5] — 2026-08-28

### 版本线：0.4.x 维护

日常点子「数据库导入功能」落地——v0.4.4 数据导出的配对恢复能力：把导出的 JSON 文件重新恢复到本地，语义 =「恢复到导出时状态」（全量替换）。

### Added

- **数据导入（管理模式）**：管理模式横幅「导入数据」按钮（「导出数据」旁）→ `POST /api/import` 全量替换恢复。
  - 语义：事务内清空五张业务表（records / subjects / tags / record_tags / reminder_items）后按导入数据原样插入（保留原 id，record_tags 引用一致）；任何一行不合法（NOT NULL / UNIQUE / CHECK 约束）整个事务回滚、导入不生效
  - 数据流：前端读文件 → 解析并校验顶层结构（`app`=FOCUS、`data` 五表均为数组）→ 确认弹窗（文件名/导出时间/来源版本/导入统计/红字风险提示「将替换当前全部数据」）→ 确认后提交；弹窗内含「先下载当前备份」入口（复用导出 API）
  - 成功后 alert「导入完成」→ 整页刷新（数据重拉、计时器回 idle、管理模式退出）；失败 alert 错误信息、弹窗保持可重试
  - 学习中（计时非空闲态）点击导入提示「请先结束当前学习」；不补默认科目，完全信任文件内容
  - 服务端：新增 `routes/import.js`（records 的 segments 数组序列化回 TEXT 存储，与导出解析对称）；`express.json` limit 调大至 10mb；客户端：`importApi` + App 导入流程（下载逻辑抽 `downloadBlob` 供导出/备份共用）
  - 版本号：client `0.4.4`→`0.4.5`，server `0.3.5`→`0.3.6`，git tag `v0.4.5`（0.4 分支发布，merge 回 master）

### Tests

- 服务端：140 全绿（新增 import 路由 7 条：空五表信任文件清空默认科目 / 全量替换旧数据消失保留原 id 与引用 / segments 序列化与再导出对称 / app 非 FOCUS 400 / data 缺表 400 / NOT NULL 违反整体回滚旧数据保留 / sqlite_sequence 续接）
- 客户端：254 全绿（新增 importApi 2 条 + App 导入交互 10 条：按钮管理模式门控 / 学习中禁止 / 文件解析确认弹窗（文件名/统计/风险提示）/ 取消 / 先下载当前备份 / 确认导入整页刷新 / 导入中禁用态 / 失败 alert 可重试 / 非法 JSON / app 非 FOCUS）

### Docs

- `docs/adr/0010-data-export-import.md` — 新增数据导出与导入设计文档（备份/恢复配对方案）
- `CONTEXT.md` — 新增「数据导入」领域概念（含 Avoid 词：合并/增量导入、按 id 覆盖、补默认科目、multipart 上传）
- `README.md` — 功能列表新增数据导入条目 + API 表 `POST /api/import` + 项目结构 `routes/import.js`
- `code/ROADMAP.md` — 💡 日常点子「数据库导入功能」移入已实现 + 版本头更新至 0.4.5
- `CLAUDE.md` — App.jsx/importApi/routes/import.js/测试表补导入
- `code/client/TESTING.md` — 计数 242→254
- `code/server/TESTING.md` — 计数 133→140，边界值清单补 import 行
- `code/client/docs/CODE_STRUCTURE.md` — 依赖图新增 `App → importApi → api`、App.jsx/importApi 职责与状态
- `docs/INDEX.md` — ADR 0010 索引

## [0.4.4] — 2026-08-27

### 版本线：0.4.x 维护

日常点子「数据库导出功能」落地——管理模式内一键把全部数据导出为 JSON 文件下载，备份留存。纯后端数据读取 + 管理模式横幅按钮，无新增依赖。

### Added

- **数据导出（管理模式）**：管理模式横幅「导出数据」按钮 → `GET /api/export` 全量导出五张业务表（records / subjects / tags / record_tags / reminder_items）为 JSON 文件下载（`focus-export-YYYYMMDD-HHMMSS.json`）。
  - 导出结构：顶层 `app` / `version` / `exported_at` 元数据，`data` 下按表名分组；records 的 `segments` 从 JSON 文本解析为数组（导出物更友好）；不含 `_migrations` 内部表
  - 交互：点击后按钮禁用显示「导出中…」，失败 alert 提示错误；仅导出，导入留待后续评估
  - 版本号：client `0.4.3`→`0.4.4`，server `0.3.4`→`0.3.5`，git tag `v0.4.4`（0.4 分支发布，merge 回 master）

### Tests

- 服务端：133 全绿（新增 export 路由 5 条：空库含默认科目 + 元数据/exported_at 格式、Content-Disposition 附件文件名、全量导出各表 + segments 解析、无 segments 保持 null、不含 _migrations）
- 客户端：242 全绿（新增 exportApi 3 条：blob + Content-Disposition 文件名解析 / 无响应头回退默认名 / HTTP 错误抛出；App 导出 4 条：按钮管理模式门控 / 点击触发下载 / 导出中禁用态 / 失败 alert）

### Docs

- `CONTEXT.md` — 新增「数据导出」领域概念（含 Avoid 词：导入恢复、按日期范围过滤、CSV/原始 .db、包含内部表）
- `README.md` — 功能列表新增数据导出条目 + API 表 `GET /api/export` + 项目结构 `routes/export.js`
- `code/ROADMAP.md` — 💡 日常点子「数据库导出功能」移入已实现 + 版本头更新至 0.4.4
- `CLAUDE.md` — 客户端结构表 App.jsx 补导出按钮、服务端结构表新增 export.js、测试表更新 api/App 描述
- `code/client/TESTING.md` — 计数 235→242
- `code/server/TESTING.md` — 计数 128→133，边界值清单补 export 行
- `code/client/docs/CODE_STRUCTURE.md` — 依赖图新增 `App → exportApi → api`、App.jsx/exportApi 职责表

## [0.4.3] — 2026-08-27

### 版本线：0.4.x 维护

日常点子「逻辑移除学习中离开页面暂停的功能」落地——学习中离开页面（切标签页/最小化/锁屏）不再自动暂停计时，计时持续走时（Date.now() 绝对时间戳），回来后时长与真实时间一致。按「不删代码、不加开关」的要求实施：只注释 `App.jsx` 中 `useFreezeOnLeave` 的 import 与调用点，hook、`useTimer` 的 freeze/thaw/frozen、冻结灰化 UI 全部保留待用，无开关配置。

### Changed

- **移除「学习中离开页面暂停」行为**：`App.jsx` 中 `useFreezeOnLeave` 的 import 与调用注释停用（v0.4.3），恢复只需取消注释两处；`useFreezeOnLeave.js`、`useTimer.js` 的 `freeze()`/`thaw()`/`frozen`、`TimerPage.jsx` 冻结态灰化 UI 均未删
- 行为变化：学习中离开页面计时继续，回来后时长与真实时间一致（此前为自动冻结计时、回来自动恢复，不产生暂停记录）
- 版本号：client `0.4.2`→`0.4.3`，server 保持 `0.3.4`，git tag `v0.4.3`

### Tests

- 客户端：235 全绿（新增 App 冻结停用回归 1 条：渲染 App 不接入 `useFreezeOnLeave`；冻结相关既有测试——hook 8 条、useTimer 冻结 6 条、TimerPage 冻结 UI——全部保留通过）

### Docs

- `CONTEXT.md` — 删除「冻结」领域概念条目
- `README.md` — 功能列表/流程图移除冻结描述，说明改为「离开页面（切标签/锁屏）时计时继续，回来后时长与真实时间一致」
- `code/ROADMAP.md` — 已实现条目标注 v0.4.3 逻辑移除，💡 日常点子移除该项
- `CLAUDE.md` — App.jsx/useTimer.js/useFreezeOnLeave.js 标注冻结停用（代码保留）
- `docs/adr/0003-freeze-on-leave.md` — Status 改为 **deprecated**（v0.4.3 逻辑移除说明）
- `docs/INDEX.md` — ADR 0003 描述同步标注已废弃
- `code/client/TESTING.md` — 计数 234→235

## [0.4.2] — 2026-08-11

### 版本线：0.4.x 维护

日常点子「复习方法和提醒」落地——把想到的复习方法记下来，学习中随时给自己提个醒。新增独立数据表与 CRUD 路由（前后端同步升级），是 0.4.2 的功能核心。

### Added

- **复习方法和提醒区**：用户自维护的提醒语句库，学习中「结束学习」大按钮下方小字提醒条（💡 浅灰不抢眼）展示一条，每 15 分钟按插入顺序自动轮换（1→2→3→1…）。
  - 数据模型：`005_add_reminder_items.sql` — 新增 `reminder_items` 表（`content` ≤200 字、`sort_order` 插入顺序、`created_at`）
  - 接口：`GET /api/reminders`（按 sort_order）、`POST /api/reminders`（新增排末尾，≤200 字，trim 判空）、`PATCH /api/reminders/:id`（改内容）、`DELETE /api/reminders/:id`
  - 前端：新组件 `ReminderBar.jsx`（学习中「结束学习」大按钮下方展示 + 15 分钟轮换 + 提醒条旁 ＋ 弹框新增「随时记录」）；管理模式开启时出现「管理」按钮 → 弹窗列表编辑（✏️）/删除（confirm）全部条目；数据存后端跨设备可见
  - 仅学习中显示，空闲/休息/暂停均不显示；无条目时只留 ＋ 入口
  - 版本号：client `0.4.1`→`0.4.2`，server `0.3.3`→`0.3.4`，git tag `v0.4.2`（0.4 分支发布，merge 回 master）

### Tests

- 服务端：128 全绿（新增 reminders 路由 19 条：GET 排序/空库、POST 校验/trim/递增/超长/200 字边界、PATCH 修改/404/非数字 id/空内容/sort_order 不变、DELETE 删除/404/非数字 id/多条互不影响）
- 客户端：234 全绿（新增 ReminderBar 12 条：空库/展示/轮换循环/不足 2 条不轮换/＋新增/空内容 disabled/管理模式门控/编辑/删除/confirm 拒绝/关闭 + remindersApi 4 条）

### Docs

- `CONTEXT.md` — 新增「复习提醒」领域概念（含 Avoid 词）+ 学习流程补充记录提醒
- `README.md` — 功能列表 + 项目结构（ReminderBar.jsx、routes/reminders.js）+ 数据库五张表 + API 表 4 个端点 + 使用流程提醒条说明
- `code/ROADMAP.md` — 已实现新增复习提醒 + 版本头更新至 0.4.2 + 日常点子/开发中移除该项
- `CLAUDE.md` — 组件表新增 ReminderBar、服务端结构新增 reminders.js、数据库表新增 reminder_items、测试表新增 ReminderBar.test.jsx
- `code/client/TESTING.md` — 文件树新增 ReminderBar 与 remindersApi、计数 218→234
- `code/server/TESTING.md` — 文件树新增 reminders.test.js、边界值清单补 reminders 行、计数 109→128

## [0.4.1] — 2026-08-10

### 版本线：0.4.x 维护

纯前端结构重构，无用户可见功能变化——「文件庞大逐步拆分」第一轮落地：把最大的 HistoryPage 拆成职责清晰的小文件，后续轮次继续拆 TimerPage/TagPicker/useTimer。

### Changed

- **代码结构拆分**（[改动说明](code/client/docs/adr/0001-v0.4.1-code-structure-changes.md)）：
  - 新增 `RecordCard.jsx`：单条记录卡片纯展示壳（查看态 + ✏️ 编辑态表单渲染），9 个编辑状态仍由 HistoryPage 持有通过 props 传入——纯搬家，行为与 v0.4.0 完全一致
  - 新增 `SegmentStack.jsx`：千层饼堆叠条独立组件
  - 格式化函数合并：`utils/fmtTime.js` 新增 `fmtClock`（原 TimerPage 本地 HH:MM:SS 函数）+ `fmtShortClock`（原 HistoryPage 本地 MM:SS 函数），中文 `fmtTime` 不动；TimerPage/HistoryPage 本地重复定义删除，展示格式不变
  - HistoryPage 567 → ~330 行（删除死 import）
  - 版本号：client `0.4.0`→`0.4.1`，server 保持 `0.3.3`，git tag `v0.4.1`（0.4 分支发布，merge 回 master）

### Tests

- 客户端：218 全绿（原 HistoryPage.test.jsx 39 条拆为：页面级 29 条 + RecordCard 33 条 + SegmentStack 5 条 + fmtTime 8 条，用例全部转移无遗漏）

### Docs

- `code/client/docs/CODE_STRUCTURE.md` — 客户端代码结构总览（mermaid 依赖图 + 文件职责/状态归属 + 格式化函数分工 + 测试文件对应）
- `code/client/docs/adr/0001-v0.4.1-code-structure-changes.md` — v0.4.1 改动说明（改动前后依赖图对比 + 文件直接映射 + 行为不变保证 + 测试迁移映射）
- `CLAUDE.md` — 客户端结构表新增 RecordCard/SegmentStack、fmtTime 三函数分工说明
- `code/ROADMAP.md` — 已实现新增 v0.4.1 条目 + 开发中列后续拆分轮次 + 版本头更新
- `code/client/TESTING.md` — 文件树新增 RecordCard/SegmentStack/fmtTime、计数 182→218
- `docs/INDEX.md` — 新增两个结构文档索引

## [0.4.0] — 2026-08-09

### 版本线：0.4.x 开启

管理模式的设计思路在 0.3.x 中逐渐清晰：从 v0.3.4 历史页局部的隐藏管理模式（连点标题进入、删除按钮才可见），到「把删除和修改的功能放到管理模式里」的全局构想，最终在 v0.4.0 落地为**全局管理模式**（统一隐藏入口 + App 级开关 + 跨页面生效）。管理模式由此成为 0.4.x 版本线的主线，0.3 分支完结，后续版本继续围绕「隐藏入口与隔离度」演进。

### Added

- **全局管理模式**：把删除类功能统一收进隐藏模式（日常点子①落地，[设计文档](docs/adr/0008-global-admin-mode.md)）。
  - 定位：删除类（记录删除、科目删除、标签删除、标签排序）统一由一个 App 级开关控制；修改类（✏️ 备注/页数/标签修改）保持常态入口
  - 入口：右上角考研倒计时连点 5 下（间隔 ≤2s，超时重置）——任何页面、任何计时状态（含学习中）都可见；共用新 hook `useMultiTap`
  - 生效范围：历史页卡片删除按钮（v0.3.4 已有，改由 App 层 prop 驱动）；计时页自定义科目 × 删除按钮（admin 时恒显，顺带修复移动端非选中科目 × 不可见）；TagPicker 标签 × 删除与 ⚙ 排序（日常只剩点选/新增）
  - 横幅：App 层「管理模式已开启 — 删除与管理入口已解锁」+ 退出按钮，跨 tab 常驻；刷新复位，不持久化
  - 服务端零改动（API 均已存在），纯前端
  - 版本号：client `0.3.4`→`0.4.0`，server 保持 `0.3.3`，git tag `v0.4.0`（0.3 分支发布，merge 回 master）

### Tests

- 客户端：182 全绿（新增 useMultiTap 5 条 + ExamCountdown 连点入口 2 条 + App 全局模式 5 条 + SubjectSelector/TagPicker 门控 + HistoryPage 管理模式 prop 化改造；原 HistoryPage 标题连点用例随入口迁移移除）

### Docs

- `docs/adr/0008-global-admin-mode.md` — 全局管理模式设计决策（定位/入口/组件改造/不做清单）
- `code/ROADMAP.md` — 已实现新增全局管理模式 + 版本头更新至 0.4.0 + 日常点子移除「开发管理模式」「v0.4.0 整合上线」
- `CLAUDE.md` — App/ExamCountdown/SubjectSelector/TagPicker/HistoryPage 组件描述 + 新增 `hooks/useMultiTap.js`
- `docs/INDEX.md` — ADR 索引新增 0008
- `code/client/TESTING.md` — 文件树新增 useMultiTap、各文件计数更新、总计 166→182

## [0.3.4] — 2026-08-06

### Added

- **历史记录删除（管理模式）**：隐藏的管理员功能，正常使用无感知（[设计文档](docs/adr/0007-record-delete.md)）。
  - 进入：连续点击历史页标题「📋 历史记录」5 下（间隔 ≤2s，超时重置）→ 黄色横幅「管理模式已开启」+ 每张卡片右上角出现红色「删」按钮（学习/休息记录都可删，编辑中的记录互斥不显示）
  - 退出：横幅「退出管理模式」按钮；切 Tab 历史页卸载重建，状态自然复位（不持久）
  - 删除：`window.confirm('删除这条学习记录？此操作不可恢复')` 确认 → `DELETE /records/:id` 硬删除（`record_tags` 外键级联清理，标签库条目保留）→ 成功本地移除（今日概览/标签筛选/千层饼自动同步），失败内联「删除失败: xxx」保留记录
  - 服务端：`records.js` 新增 DELETE 路由（id 非法/不存在 404，沿用 subjects/tags delete 惯例返回 `{ success: true }`）
  - 版本号：client `0.3.3`→`0.3.4`，server `0.3.2`→`0.3.3`，git tag `v0.3.4`（0.3 分支发布，merge 回 master）

### Tests

- 服务端：109 全绿（records 67→74：新增 DELETE 删除成功/404/级联清理/统计排除 7 条）
- 客户端：166 全绿（新增 HistoryPage 管理模式 9 条：连点进入/超时重置/退出/confirm 取消与确认/失败提示/编辑态互斥/休息可删）

### Docs

- `docs/adr/0007-record-delete.md` — 历史记录删除设计决策（管理模式定位/进入退出/API/前端交互/备选方案）
- `code/ROADMAP.md` — 从「日常点子」移到「已实现」+ 版本头更新至 0.3.4 + 设计文档链接
- `CONTEXT.md` — 新增「管理模式」领域概念（含 Avoid 词）
- `README.md` / `docs/INDEX.md` — 功能列表 + API 表（DELETE /records/:id）+ ADR 索引
- `CLAUDE.md` — HistoryPage / records 路由描述补充管理模式与删除
- `code/client/TESTING.md` — HistoryPage 31→40、总计数 157→166
- `code/server/TESTING.md` — records 67→74

## [0.3.3] — 2026-08-05

### Added

- **每次复习的页数**：每条学习记录可记录本次复习的页数，回答「今天/这个科目复习了多少页」（[设计文档](docs/adr/0006-pages-per-review.md)）。
  - 数据模型：`004_add_pages_to_records.sql` — `records` 表新增 `pages` 列（正整数 1~9999 选填，旧记录 NULL，休息记录无条件忽略）
  - 接口：`POST /records` 支持 `pages`（学习模式校验 1~9999 整数，非法 → 400）；`PATCH /records/:id` 支持改/清空 pages（`null` 清空，仅学习记录）；`GET /records/today` 新增 `total_pages` 与 `by_subject[].total_pages`
  - 前端：TimerPage 标签与备注之间新增「页数（选填）」区块（数字输入框 + 固定 +1/+5/+10 快捷累加芯片，冻结/暂停态灰化同备注）；历史页有页数显示「📖 N 页」徽标、✏️ 编辑态可改可清空；今日概览顶部「📖 今日 N 页」+ 科目分组行附「· N 页」文字（条形图仍按时长渲染）
  - 版本号：client `0.3.2`→`0.3.3`，server `0.3.1`→`0.3.2`，git tag `v0.3.3`（0.3 分支发布，merge 回 master）

### Tests

- 服务端：102 全绿（records 50→67：新增 POST pages 校验 9 条 + PATCH pages 4 条 + /today 页数汇总 2 条 + 无记录零值断言补 total_pages）
- 客户端：157 全绿（新增 TimerPage 页数交互 6 条 + HistoryPage 徽标/编辑 4 条 + TodayOverview 汇总 3 条）

### Docs

- `docs/adr/0006-pages-per-review.md` — 复习页数设计决策（字段形态/录入时机/输入形式/展示/统计）
- `code/ROADMAP.md` — 已实现新增复习页数 + 版本头更新至 0.3.3，日常点子/开发中移除该项
- `CLAUDE.md` — TimerPage/HistoryPage/TodayOverview/records 路由/数据库表描述补充页数
- `README.md` / `CONTEXT.md` / `docs/INDEX.md` — 功能列表、records 表结构、API 列表、ADR 索引同步

## [0.3.2] — 2026-08-04

### Added

- **标签拖拽排序**：标签库顺序可自定义排列，常用标签稳定排在前面（[设计文档](docs/adr/0005-tag-reorder.md)）。
  - 数据模型：`003_add_tag_sort_order.sql` — `tags` 表新增 `sort_order` 列，存量标签回填为创建顺序（id），现有顺序不变
  - 接口：`PUT /api/tags/order` — 批量全量提交新顺序 id 数组，事务内重编号 `sort_order=数组下标`；缺 id/集合不匹配/含重复 → 400
  - 前端：TagPicker 行尾新增 ⚙ 排序按钮（≥2 个标签可用），排序模式下芯片带 ≡ 手柄，sortablejs 拖拽换位（handle 限定手柄区，触屏可用）；「完成」批量提交、「取消」恢复原序；排序模式下隐藏删除/新增防误触
  - 新标签自动排到末尾（`MAX(sort_order)+1`，与科目的 `sort_order` 模式一致）
- 版本号：client `0.3.1`→`0.3.2`，server `0.3.0`→`0.3.1`，git tag `v0.3.2`（0.3 分支发布，merge 回 master）

### Tests

- 服务端：85 全绿（tags 13→22：新增 PUT /order 全量校验/重编号/顺序断言 9 条）
- 客户端：144 全绿（新增 TagPicker 排序模式 7 条 + tagsApi.reorder 1 条）

### Docs

- `docs/adr/0005-tag-reorder.md` — 标签拖拽排序设计决策（排序范围/交互/持久化/实现选型）
- `code/ROADMAP.md` — 已实现新增标签拖拽排序 + 版本头更新至 0.3.2，日常点子移除该项
- `CLAUDE.md` — TagPicker/tags 路由/数据库表描述补充排序
- `README.md` / `CONTEXT.md` / `docs/INDEX.md` — 功能列表、tags 表结构、API 列表、ADR 索引同步

## [0.3.1] — 2026-08-04

### Fixed

- **学习中「结束学习」大按钮偏移**：暂停/继续按钮改为绝对定位悬浮于大按钮右缘，不再占据 flex 布局空间——学习/暂停两态大按钮始终居中（此前桌面端隐形暂停按钮仍占位、手机端双按钮组居中，均导致大按钮偏左 36px）。
  - `TimerPage.jsx` — 按钮容器加 `relative`，小按钮改 `absolute left-full ml-4 top-1/2 -translate-y-1/2`；桌面 hover 浮现保留（大按钮 hover + 小按钮自身 hover 双轨，避免鼠标移向按钮途中淡出消失）
- **自定义科目芯片删除叉号占位**：删除 × 改为绝对定位悬浮于芯片右缘（`absolute right-1.5 top-1/2 -translate-y-1/2`），不再占据布局空间——科目名在芯片内始终居中，× 与文字保持 6px 间隙（此前未选中时 × 隐形占位 22px，科目名左偏 11px、芯片虚宽）。
  - `SubjectSelector.jsx` — × 从 `ml-1.5` 流内改 absolute 悬浮，自定义科目芯片对称内边距 `px-4`→`px-7` 给 × 留位；hover 浮现、选中态恒显、手机上"点选→选中态删"路径均不变
- 版本号：client `0.3.0`→`0.3.1`，server 不变 `0.3.0`，git tag `v0.3.1`（0.3 分支发布，merge 回 master）

### Tests

- 客户端：136 全绿（纯布局修复，无新增用例，现有断言不受影响）

### Docs

- `docs/adr/0002-pause-feature.md` — 暂停/继续按钮改为绝对定位悬浮，学习/暂停两态大按钮始终居中
- `code/ROADMAP.md` — 已实现新增大按钮和科目芯片居中修复 + 版本头更新至 0.3.1
- `CLAUDE.md` — TimerPage 描述补充大按钮居中、悬浮按钮

## [0.3.0] — 2026-08-03

### Added

- **学习标签**：科目之下的知识点二级细分，扁平全局标签库，一条学习记录可挂多个标签。解决「科目太粗，想知道今天高数/线代各学了多久」的精细统计与检索。
  - 数据模型：`002_add_tags.sql` — 新增 `tags` 表（name 唯一）+ `record_tags` 多对多关联表（外键级联删除）
  - `server/routes/tags.js` — 新增 `GET /api/tags`、`POST /api/tags`（幂等复用、≤12 字）、`DELETE /api/tags/:id`（级联清关联）
  - `server/routes/records.js` — POST 接受 `tags`、GET 返回每条 `tags`、PATCH 扩展支持整组替换标签（备注与标签均可选，空 body 为无操作）
  - `client/components/TagPicker.jsx` — 新组件，学习中与历史编辑态共用：点选/新增/删除标签（重名幂等复用）
  - `TimerPage.jsx` — 学习中标签选择区（备注上方），结束保存时随记录提交
  - `HistoryPage.jsx` — 查看态标签 chips（点标签即筛选）+ 列表上方筛选行 + ✏️ 编辑态可增删标签，备注与标签一起保存
  - `TodayOverview.jsx` — 按标签分组时长（纯前端从当天记录聚算，统计仅学习记录）
- 版本号：client `0.2.6`→`0.3.0`，server `0.2.4`→`0.3.0`，git tag `v0.3.0`

### Tests

- 服务端：+24 条（tags 路由 13 + records×标签联动 11）52→76 全绿
- 客户端：+18 条（api tags 4 + useTimer 标签态 5 + TimerPage 标签 3 + HistoryPage 标签 5 + TodayOverview 分组 1）118→136 全绿

### Docs

- `docs/adr/0004-study-tags.md` — 新建设计文档（标签定位、扁平全局库、多对多模型、交互、边界规则）
- `CONTEXT.md` — 新增「标签」领域概念，更新「科目」「学习时段」「Flow」
- `README.md` — 功能列表 + 数据库表（四张表）+ API 表（tags 端点）+ 项目结构 tags.js
- `code/ROADMAP.md` — 从「日常点子」移到「已实现」
- `docs/INDEX.md` — 加入 ADR-0004 链接
- `CLAUDE.md` — 组件/路由表 + 数据库 + 核心概念（移除"没有二级标签"）

## [0.2.9] — 2026-08-01

### Added

- **历史记录备注复制**：点击历史页学习记录的备注文字即复制到剪贴板，内联显示「已复制✓」/「复制失败」；编辑入口从备注文字移入 ✏️ 按钮（hover 样式保持一致）。
  - `client/utils/clipboard.js` — 新增 `copyText`：优先 `navigator.clipboard`（仅安全上下文），降级隐藏 textarea + `document.execCommand('copy')`（兼容 Tailscale 手机 HTTP 访问）
  - `HistoryPage.jsx` — 备注文字变为复制按钮，✏️ 升级为真实编辑按钮；复制反馈 1.5s 自动消失，单条互斥（新编辑/复制自动收起旧反馈）
- 版本号：client `0.2.5`→`0.2.6`，server 不变 `0.2.4`，git tag `v0.2.9`

### Tests

- 客户端：+6 条（HistoryPage 复制成功/降级/失败 3 条 + clipboard 工具 3 条）112→118 全绿

### Docs

- `CONTEXT.md` — 「学习时段」备注补充"点击复制"
- `README.md` — 功能列表「备注」补充点击复制 + 项目结构新增 clipboard.js
- `code/ROADMAP.md` — 从「日常点子」移到「已实现」+ 版本头更新
- `CLAUDE.md` — HistoryPage 描述补充 + utils 新增 clipboard.js
- `code/client/TESTING.md` — HistoryPage 19→22、总计数 112→118、文件树新增 clipboard.js

## [0.2.8] — 2026-07-31

### Changed

- **历史页千层饼自下而上显示**：单个学习记录内学习/暂停段堆叠顺序改为自下而上的时间顺序（最早段在最下、最晚段在最上）。存储仍为时间正序，仅渲染反转。
  - `HistoryPage.jsx` — `SegmentStack` 反转渲染 + data-testid
- 版本号：client `0.2.4`→`0.2.5`，server 不变 `0.2.4`，git tag `v0.2.8`

### Tests

- 客户端：+1 条（千层饼段自下而上顺序断言）111→112 全绿

### Docs

- `docs/adr/0002-pause-feature.md` — 千层饼图同步自下而上
- `code/ROADMAP.md` — 已实现新增「千层饼自下而上显示」

## [0.2.7] — 2026-07-31

### Added

- **历史记录修改备注**：学习记录的备注可在历史页内联编辑/补充/清空，休息记录不可编辑。
  - `server/routes/records.js` — 新增 `PATCH /api/records/:id`（仅学习记录；id 非法/不存在 404，notes 非字符串或休息记录 400，trim 后存储，空串清空备注）
  - `client/utils/api.js` — 新增 `recordsApi.update(id, { notes })`
  - `HistoryPage.jsx` — 备注文字可点进入内联编辑（无备注时显示「＋ 添加备注」），保存成功静默原地更新，失败保持编辑态并显示错误，取消丢弃草稿，单条互斥
- 版本号：client `0.2.3`→`0.2.4`，server `0.2.3`→`0.2.4`，git tag `v0.2.7`

### Tests

- 服务端：+9 条（PATCH 成功更新、trim、空串清空、404、rest 拒绝、notes 非字符串、缺字段、segments 保留）43→52 全绿
- 客户端：+7 条（进编辑、添加空备注、保存原地更新、取消丢弃、失败提示、rest 无入口、单条互斥）104→111 全绿

### Docs

- `CONTEXT.md` — 「学习时段」定义补充备注可修改
- `README.md` — 功能列表 + API 表新增 PATCH
- `code/ROADMAP.md` — 从「日常点子」移到「已实现」
- `CLAUDE.md` — HistoryPage / records.js 描述补充
- `code/client/TESTING.md` — HistoryPage 计数 11→18、总计数 104→111
- `code/server/TESTING.md` — records.test.js 计数 30→39

## [0.2.6] — 2026-07-29

### Added

- **离开页面自动冻结**：学习中离开页面（切标签页/最小化/切换应用）时自动停止计时但**不产生暂停记录**，回来后自动恢复，时间无缝续接。
  - `useTimer.js` — 新增 `frozen` state、`freeze()`/`thaw()` 方法，冻结仅快照累计时长，不产生 `paused_ms` 或 pause segment
  - `useFreezeOnLeave.js` — 新 hook，监听 `visibilitychange`/`blur`/`focus`，零缓冲，纯前端
  - `App.jsx` — 挂载 `useFreezeOnLeave`（持续监听，不受标签切换影响）
  - `TimerPage.jsx` — 冻结态计时器数字及科目标签变灰（与暂停态同色），无"暂停中"标签

### Tests

- 客户端：+18 条（useTimer freeze/thaw 6 + useFreezeOnLeave 8 + TimerPage 冻结 UI 4）86→104 全绿

### Docs

- `docs/adr/0003-freeze-on-leave.md` — 新建设计文档（冻结 vs 暂停区别、关注点分离、边界情况）
- `CONTEXT.md` — 新增"冻结"领域概念定义
- `code/ROADMAP.md` — 从"日常点子"移到"开发中"
- `docs/INDEX.md` — 加入 ADR-0003 链接
- `code/client/TESTING.md` — 新增 useFreezeOnLeave 文件树 + 计数 86→104
- `CLAUDE.md` — 新增 useFreezeOnLeave 组件描述

## [0.2.5] — 2026-07-25

### Added

- **MIT 开源协议**：项目根 `LICENSE` 文件 + `package.json` license 字段。
  - 协议：MIT © 2026 Bingwen Bao (baobingwen)
  - 三个 `package.json`（根/server/client）均添加 `"license": "MIT"`
  - README 底部添加许可声明、ROADMAP 已实现

## [0.2.4] — 2026-07-25

### Added

- **暂停功能**：学习途中可暂停/继续，暂停时间计入今日休息统计，历史记录千层饼可视化。
  - `useTimer.js` — 新增 `paused` phase、`pauseStudy()`/`resumeStudy()`、segments 追踪、paused_ms 累计
  - `TimerPage.jsx` — 学习中/暂停中合并渲染，桌面 hover/移动端常驻 ⏸ 按钮，暂停态灰化 + 暂停计时，暂停态结束弹窗确认
  - `HistoryPage.jsx` — `SegmentStack` 千层饼组件（按时间比例堆叠蓝/灰条展示学习/暂停段）
- **数据库迁移**：`001_add_pause_fields.sql` — records 表新增 `segments TEXT`、`paused_ms INTEGER`

### Changed

- `server/routes/records.js` — POST 接受可选 `segments`/`paused_ms`，GET 返回解析后的 segments，今日概览 rest 统计含暂停时长
- `docs/adr/0002-pause-feature.md` — 暂停功能设计文档
- `CONTEXT.md` — 新增"暂停段"领域定义
- 版本号：client `0.2.1`→`0.2.2`，server `0.2.2`→`0.2.3`，git tag `v0.2.4`

### Tests

- 服务端：+5 条（segments 存读、paused_ms 统计兼容性）43→43 全绿
- 客户端：+16 条（暂停态机 6 + TimerPage 暂停交互 6 + 千层饼渲染 3 + 兼容性 1）86→86 全绿

## [0.2.3] — 2026-07-23

### Added

- **空闲态可直接休息**：SubjectSelector 新增「☕ 休息」芯片（与科目互斥），选中后大按钮变为「开始休息」，点击进入已有休息流程。休息存库（mode: rest），结束后自动清空选中态。纯前端改动，useTimer.js 零改动。
  - `SubjectSelector.jsx` — 新增 `REST` 标记对象、休息芯片渲染、防止添加"休息"科目
  - `TimerPage.jsx` — idle 态支持休息选择与启动
  - `SubjectSelector.test.jsx` — +4 条测试
  - `TimerPage.test.jsx` — +3 条测试（含提示文字更新）

### Changed

- **版本策略重构**：分为三轨独立管理——`client/package.json`（客户端版本 0.2.1）、`server/package.json`（服务端版本 0.2.2）、git tag `v0.2.3`（项目里程碑标记）。运行时不再依赖 `git describe`。
  - `server/version.js` — 从 `git describe` 改为读自身 `package.json#version`
  - `client/vite.config.js` — 从 `git describe` 改为读自身 `package.json#version`
- docs: 测试计数更新 64 → 70（`TESTING.md`）
- docs: 版本声明从单号改为三轨显示（`README.md` / `ROADMAP.md`）

## [0.2.2] — 2026-07-20

### Fixed

- **今日概览时区错误**：北京时间 0:00~8:00 间今日概览显示前一日数据。根因为 `/api/records/today`
  用 UTC 计算"今天"（`toISOString().slice(0,10)`），而 `created_at` 用本地时间存储，二者不一致。
  改为使用本地时间取得日期字符串。
  - `server/routes/records.js` — `/today` 端点日期计算从 UTC 改为本地时间
  - `server/__tests__/records.test.js` — 新增凌晨边界测试，防止回归

### Changed

- docs: 测试计数从 `CLAUDE.md` 移至 `TESTING.md` 统一管理，避免重复维护
- docs: `README.md` / `ROADMAP.md` 版本号同步至 v0.2.2
- **版本号修正**：此前错误使用了 v2.0.x 系列号，实际应为 v0.2.x。已创建正确 tag（v0.2.1、v0.2.2），移除错误 tag（v2.0.1、v2.0.2）。

## [0.2.1] — 2026-07-13

### Added

- **考研倒计时**：右上角常驻显示「距离考研 X 天」，写死 2026-12-19，考研日提示，过期自动隐藏
  - `ExamCountdown.jsx` — 新组件
  - `ExamCountdown.test.jsx` — 3 条测试
  - `App.jsx` — 全局渲染
- **版本自动检测**：前后端统一从 git tag 读取版本号
  - `server/version.js` — `getVersion()` 运行 `git describe --tags`
  - `server/index.js` — `/api/version` 端点 + `/health` 返回 version
  - `client/vite.config.js` — `__APP_VERSION__` 全局常量，build 时注入
- **手动构建脚本**：`code/build-client.ps1`，改完前端代码后手动运行再启动服务
- **文档索引**：`docs/INDEX.md`，列出项目所有文档及位置
- **`.gitignore`**：加入 `/dist/`，构建产物不再进版本控制

### Changed

- `CLAUDE.md` — 组件清单新增 ExamCountdown、测试计数更新 61→64、新增 build-client.ps1 命令、新增 docs index 链接
- `code/client/TESTING.md` — 测试文件树新增 ExamCountdown、计数 61→64
- `code/ROADMAP.md` — 已实现列表新增考研倒计时
- `code/client/package-lock.json` — 更新依赖锁

## [0.2.0] — 2026-07-09

### Fixed

- **切换标签页计时状态重置**：切换「计时/历史」标签时 TimerPage 卸载重挂导致 useTimer() state 全部丢失。将 useTimer() 上提到 App 组件，计时状态不再随标签切换销毁。
  - `App.jsx` — 引入并调用 `useTimer()`，将 timer 对象传入 TimerPage
  - `TimerPage.jsx` — 改为接收 timer prop，不再自建 useTimer 实例
