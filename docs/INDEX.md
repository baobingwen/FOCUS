# 📚 FOCUS 文档索引

本文件列出了项目所有文档及位置。新增文档时请在此追加一条。

---

## 项目总览

| 文件 | 位置 | 说明 |
|------|------|------|
| `README.md` | 仓库根目录 | 项目总览、功能说明、快速开始、技术栈、数据库结构、API 列表 |
| `CLAUDE.md` | 仓库根目录 | Claude Code 项目指令 — 架构、测试命令、部署方案、核心概念 |
| `CHANGELOG.md` | 仓库根目录 | 版本变更记录 |
| `CONTEXT.md` | 仓库根目录 | 领域语言和核心概念定义（什么是"学习"、"休息"、"模式"、"科目"） |

## 功能与路线图

| 文件 | 位置 | 说明 |
|------|------|------|
| `code/ROADMAP.md` | `code/` | 功能路线图 — 已实现清单、P1-P4 推荐方向、存档方案、日常点子 |

## 协作流程

| 文件 | 位置 | 说明 |
|------|------|------|
| `docs/WORKFLOW.md` | `docs/` | 开发协作流程 — grill → 文档先行 → 代码 → 测试 → 发版，版本三轨与文档同步检查清单 |

## 测试

| 文件 | 位置 | 说明 |
|------|------|------|
| `code/client/TESTING.md` | `code/client/` | 客户端测试指南 — Vitest 配置、mock 策略、测试文件结构、常见问题 |
| `code/server/TESTING.md` | `code/server/` | 服务端测试指南 — Jest 配置、:memory: SQLite、时间隔离技巧 |

## 部署

| 文件 | 位置 | 说明 |
|------|------|------|
| `code/LOCAL_DEPLOY.md` | `code/` | 本地 + Tailscale 部署方案（当前在用，0 元） |
| `code/start-local.bat` | `code/` | 一键启动脚本（构建前端 + 启动服务） |
| `code/build-client.ps1` | `code/` | 手动构建前端脚本（改完代码后运行，再执行 start-local.bat） |
| `code/build-client-static.ps1` | `code/` | 手动构建纯静态版脚本（改完代码后运行，产物 `client/dist-static/`） |
| `code/deploy-static.ps1` | `code/` | 纯静态版部署到 GitHub Pages 脚本（构建 + 推送到 gh-pages 分支） |
| `code/DEPLOY_STATIC.md` | `code/` | GitHub Pages 部署指南（纯静态版，地址 `https://baobingwen.github.io/FOCUS/`） |
| `feat/deploy` 分支 | — | Fly.io 云部署方案（Dockerfile + fly.toml，需外币卡暂搁置） |

## 架构决策记录 (ADR)

| 文件 | 位置 | 说明 |
|------|------|------|
| `docs/adr/0001-timer-state-lift.md` | `docs/adr/` | 计时状态上提到 App 组件（解决标签切换状态丢失） |
| `docs/adr/0002-pause-feature.md` | `docs/adr/` | 暂停功能 — 学习中的暂停/继续、千层饼可视化、暂停段计入休息统计 |
| `docs/adr/0003-freeze-on-leave.md` | `docs/adr/` | 离开页面自动冻结 — 学习中离开时自动冻结/恢复计时，不产生暂停记录（v0.4.3 已废弃：逻辑移除，代码保留） |
| `docs/adr/0004-study-tags.md` | `docs/adr/` | 学习标签 — 科目之下的知识点二级细分、扁平全局标签库、多对多数据模型、统计与筛选 |
| `docs/adr/0005-tag-reorder.md` | `docs/adr/` | 标签拖拽排序 — ⚙ 排序模式 + sortablejs、tags 加 sort_order 列、PUT /tags/order 批量重排 |
| `docs/adr/0006-pages-per-review.md` | `docs/adr/` | 复习页数 — records 加 pages 字段、学习中快捷累加、历史徽标/编辑、今日概览页数汇总 |
| `docs/adr/0007-record-delete.md` | `docs/adr/` | 历史记录删除 — 连点 5 下标题进入隐藏管理模式、卡片删除按钮、单条硬删除（DELETE /records/:id） |
| `docs/adr/0008-global-admin-mode.md` | `docs/adr/` | 全局管理模式 — 删除类功能（记录/科目/标签删除 + 排序）统一收进隐藏模式、App 级开关跨 tab 常驻、useMultiTap hook |
| `docs/adr/0009-review-reminders.md` | `docs/adr/` | 复习方法和提醒区 — 用户自维护提醒语句库、学习中提醒条 15 分钟顺序轮换、点＋新增、管理模式弹窗管理、后端新表存储 |
| `docs/adr/0010-data-export-import.md` | `docs/adr/` | 数据导出与导入 — 备份/恢复配对方案：导出 JSON 下载（v0.4.4）、导入全量替换恢复（事务内清空五表原样插入、确认弹窗、学习中禁止、整页刷新） |
| `docs/adr/0011-no-backend-local-first.md` | `docs/adr/` | 无后端方案 — Local-First 双版本数据层：同一代码库 + 构建开关 `VITE_DATA_LAYER` 产出服务端版/纯静态版、IndexedDB 五仓库 1:1 模拟五表、接口契约不变组件零改动、导出/导入双版本互通、迭代拆分 A/B/C |
| `docs/adr/0012-timer-persistence.md` | `docs/adr/` | 计时器状态持久化 — 学习中/暂停中/休息中三态快照定时写入 localStorage、刷新/误关标签/崩溃后自动恢复 + 顶部提示条（计入/忽略离开时间、放弃本次学习）、elapsed 不落盘绝对时间戳推导、rest_prompt 不持久化、会话结束清空 |
| `docs/adr/0013-import-validation-unified.md` | `docs/adr/` | 双版本导入校验统一 — 共用 `code/shared/importValidation.js` 显式行级校验（顶层结构 + 行级规则：重复科目/重复关联拒绝、duration_ms>0、名称非空、引用存在、默认值归一化）、SQLite 约束保留兜底、错误消息统一中文「导入数据不合法」 |
| `docs/adr/0014-save-retry.md` | `docs/adr/` | 学习记录保存失败可重试 — 学习中/暂停中结束确认弹窗（结束学习/返回学习）、保存失败变「重试保存/放弃记录」、待重试记录存 localStorage（`focus:pending-record`）刷新不丢、仅学习记录 |
| `docs/adr/0015-static-pwa.md` | `docs/adr/` | 纯静态版 PWA 化 — 仅 static 模式注入 vite-plugin-pwa（服务端版构建零变化）、图标全套资源文件（public/icon*.svg + 生成 PNG）、SW autoUpdate（public/registerSW.js 完整注册 + 计时快照兜底）、Rich Install UI screenshots（narrow/wide）、manifest 元数据软编码集中定义 |
| `code/client/docs/CODE_STRUCTURE.md` | `code/client/docs/` | 客户端代码结构关系 — 源码依赖图（mermaid）、文件职责与状态归属、格式化函数分工、测试文件对应关系 |
| `code/client/docs/adr/0001-v0.4.1-code-structure-changes.md` | `code/client/docs/adr/` | v0.4.1 结构拆分改动说明 — HistoryPage 拆出 RecordCard/SegmentStack、格式化函数并入 utils/fmtTime.js，前后依赖图对比 + 文件直接映射 + 行为不变保证 |

---

## 贡献指南

- **新增功能/组件** → 更新 `ROADMAP.md`（已实现添加新条目）
- **新增测试** → 更新 `code/client/TESTING.md` 或 `code/server/TESTING.md`（文件树 + 计数）
- **新增组件** → 更新 `CLAUDE.md`（组件清单表）
- **架构变化** → 添加 `docs/adr/` 新记录
- **实例数目变更** → 更新所有文档中的计数（搜索关键字 "条"）
