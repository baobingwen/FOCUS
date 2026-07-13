# Changelog

All notable changes to this project will be documented in this file.

## [2.0.1] — 2026-07-13

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

## [Unreleased]

### Fixed

- **切换标签页计时状态重置**：切换「计时/历史」标签时 TimerPage 卸载重挂导致 useTimer() state 全部丢失。将 useTimer() 上提到 App 组件，计时状态不再随标签切换销毁。
  - `App.jsx` — 引入并调用 `useTimer()`，将 timer 对象传入 TimerPage
  - `TimerPage.jsx` — 改为接收 timer prop，不再自建 useTimer 实例
