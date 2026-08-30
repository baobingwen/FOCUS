# 0011: 无后端方案 — Local-First 双版本数据层

日常点子「设计一套无后端方案，逐步转向无后端」——让 FOCUS 摆脱对 Node 服务 + SQLite 的依赖，产出纯静态的浏览器版本：数据存本地、可部署到任意静态托管（如 GitHub Pages）。设计经 grill 逐条确认后落地，按迭代拆分推进（A 本地数据层 → B 静态托管部署 → C 移除后端）。

## Status

**accepted**

## Design

### 定位：双版本共存，不是推翻重来

无后端是方向，但现有服务端版（Node + Tailscale 手机访问）仍在使用。因此采用**同一套代码库 + 构建时开关**产出两种形态，两版功能、界面、交互完全一致，仅数据存储位置不同：

- **服务端版**（默认构建 `npm run build`）：数据层走 REST API → Express → SQLite 五张表，部署方式不变。
- **纯静态版**（`npm run build:static`）：数据层走浏览器 IndexedDB 五个对象仓库，可部署任意静态托管。

构建开关为环境变量 `VITE_DATA_LAYER`（`rest` / `local`），构建时选定打进产物；不做运行时切换（静态版不应携带后端代码）。

### 数据层抽象：接口契约不变，组件零改动

- 现有 `utils/api.js` 改为**统一入口**，按构建开关分发到两个实现：`apiRest.js`（原 fetch 封装迁移）与 `apiLocal.js`（IndexedDB 实现）。
- 五个 API 对象（recordsApi / subjectsApi / tagsApi / remindersApi / exportApi+importApi）的函数签名、返回数据形态、错误语义（Promise 拒绝抛 Error）**与现有完全一致**——组件层与组件测试均零改动。
- 数据读取无内存缓存：每次调用直接读写存储，与 REST 时代「每次取最新」语义一致。

### IndexedDB 存储：五仓库 1:1 模拟五表

- `focus-db` 库，五个对象仓库 `records` / `subjects` / `tags` / `record_tags` / `reminder_items`，与五张业务表 1:1 对应（`record_tags` 独立仓库保存多对多）。
- id 用 `autoIncrement`（与 SQLite AUTOINCREMENT 行为一致：删除不复用）；显式写入原 id 可推进计数器，导入保留原 id 后新增不冲突。
- `tags.name` 建 unique index → 重名幂等复用语义天然成立。
- 级联删除（删记录/删标签 → 清 record_tags）在本地 DAL 内实现。
- 建库用 IndexedDB 原生版本升级机制（首次打开建五仓库 + 索引），不需要 `_migrations` 表。

### 种子数据与默认科目：与后端行为一致

- 首次建库时写入默认科目 数学、英语、专业课（sort_order 0/1/2）。
- 删除科目时按名字（数学/英语/专业课）禁止删除。
- 导入不补默认科目，完全信任文件。

### 导出/导入本地化：格式一致、事务原子、双版本互通

- 导出：本地 DAL 读五仓库生成与后端**完全一致**的 JSON 结构（`app` / `version` / `exported_at` / `data` 五表，segments 为数组），浏览器端直接生成 Blob 下载，文件名 `focus-export-YYYYMMDD-HHMMSS.json`；`version` 字段纯静态版填 client 版本（仅元数据）。
- 导入：校验规则逐条对齐后端（`app`=FOCUS、`data` 五表数组）→ IndexedDB **事务**内清空五仓库后原样插入（保留原 id），任何一行不合法整体回滚——原子性语义与后端 SQLite 事务一致。
- 互通：服务端版导出的文件可直接导入纯静态版，反之亦然；组件层确认弹窗/备份下载/学习中禁止等交互不动。

### 构建形态

| 命令 | 形态 | 产物 | 数据层 |
| ---- | ---- | ---- | ------ |
| `npm run build`（默认） | 服务端版 | `dist/` | REST |
| `npm run build:static` | 纯静态版 | `dist-static/` | IndexedDB |
| `npm run dev` | 服务端版开发 | - | REST |
| `npm run dev:static` | 纯静态版开发 | - | IndexedDB |

现有部署脚本（`start-local.bat` / `build-client.ps1`）不改，仍服务端版。

### 测试策略

- 组件测试零改动（继续 mock 统一入口 `utils/api`）。
- 新增 `fake-indexeddb` devDependency，本地 DAL 用真实 IndexedDB API 直测：CRUD、排序、标签幂等、级联删除、种子、todayOverview、导出结构、导入事务回滚与校验。
- 现有 `api.test.js` 迁移为 `apiRest.test.js`（断言行为不变）；分发入口加轻量测试。

### 迭代拆分

- **A（v0.5.0 已完成）**：数据层抽象 + IndexedDB 实现 + 前端切换 + 导出/导入本地化 + 测试。产出纯静态可跑的最小闭环，后端保留。
- **B（v0.5.1 已完成）**：GitHub Pages 部署——部署到 FOCUS 源码仓库 `gh-pages` 分支、地址 `https://baobingwen.github.io/FOCUS/`（项目页子路径：`focus` 名字已被源码仓库占用、根地址被其他站占用，故不能用根路径或另建同名仓库；GitHub Pages URL 大小写不敏感，小写 `/focus/` 亦可访问）；vite base 按 mode 区分（`static` 模式 `/FOCUS/`，默认 `'/'` 服务端版部署不受影响）；新增 `code/deploy-static.ps1`（构建 → 同步到独立部署工作区 `code/.deploy-static/` → commit → 普通快进 push，保留每次部署的 git 历史、非强制覆盖、远程分叉时停下提示手动处理）与 `code/DEPLOY_STATIC.md`（一次性设置、发布流程、本地预览验证、数据 origin 隔离迁移说明、回滚、常见问题）。
- **C（v0.5.1 修改）**：不再移除 Express/SQLite 代码、部署文档清理。决定保留后端，服务端版 + 纯静态版长期共存，各自演进；纯前端版后续按纯前端特性持续优化，不取代服务端版。

## Consequences

- 客户端：新增 `apiRest.js` / `apiLocal.js`，`api.js` 改为分发入口，package.json 加 `build:static` / `dev:static` scripts 与 `fake-indexeddb` devDependency；client 版本递增至 0.5.0。
- 服务端：迭代 A 不改后端代码，server 版本不动（0.3.6）。
- 文档：CONTEXT.md（新增「数据层」「双版本」概念、导出导入/复习提醒条目兼容双版本）、README.md（功能/快速开始/构建形态/迁移/技术栈/项目结构/数据存储）、ROADMAP.md（无后端条目标记设计已确定）、docs/INDEX.md（新增本 ADR）。
- 测试：新增本地 DAL 测试文件与分发入口测试，用例数同步 TESTING.md。
- 不做（迭代 A）：多端实时同步、冲突合并、运行时数据层切换、移除后端代码（C 迭代）、GitHub Pages 部署（B 迭代）。
