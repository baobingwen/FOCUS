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
| `code/client/docs/CODE_STRUCTURE.md` | `code/client/docs/` | 客户端代码结构关系 — 源码依赖图（mermaid）、文件职责与状态归属、格式化函数分工、测试文件对应关系 |
| `code/client/docs/adr/0001-v0.4.1-code-structure-changes.md` | `code/client/docs/adr/` | v0.4.1 结构拆分改动说明 — HistoryPage 拆出 RecordCard/SegmentStack、格式化函数并入 utils/fmtTime.js，前后依赖图对比 + 文件直接映射 + 行为不变保证 |

---

## 贡献指南

- **新增功能/组件** → 更新 `ROADMAP.md`（已实现添加新条目）
- **新增测试** → 更新 `code/client/TESTING.md` 或 `code/server/TESTING.md`（文件树 + 计数）
- **新增组件** → 更新 `CLAUDE.md`（组件清单表）
- **架构变化** → 添加 `docs/adr/` 新记录
- **实例数目变更** → 更新所有文档中的计数（搜索关键字 "条"）
