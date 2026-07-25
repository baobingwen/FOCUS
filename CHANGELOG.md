# Changelog

All notable changes to this project will be documented in this file.

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
