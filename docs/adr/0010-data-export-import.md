# 0010: 数据导出与导入 — 备份/恢复配对的数据管理方案

日常点子「数据库导入功能（先考虑做从导出的数据导入）」——在 v0.4.4 数据导出落地后，补齐配对的恢复能力：把导出的 JSON 文件重新恢复到本地。导出与导入构成一套完整的数据管理方案：**导出 = 备份留存，导入 = 恢复到导出时状态**。

## Status

**accepted**

## Design

### 定位：个人工具的备份/恢复，不是多设备同步

单用户、单数据库（本地 + Tailscale 手机访问同一库）是主场景。导入解决的现实问题是：换机/换设备迁移、数据库损坏后恢复、误操作回退。因此导入语义为**全量替换**（恢复到导出时状态），不做合并/增量——合并需要处理 id 冲突、标签引用、重复记录，复杂度高而个人场景收益低（多设备本就共用同一库）。

### 导出（v0.4.4 已实现，本 ADR 一并记录）

- `GET /api/export`：全量读取五张业务表（records / subjects / tags / record_tags / reminder_items），顶层带 `app` / `version` / `exported_at` 元数据，`data` 下按表名分组。
- records 的 `segments` 从数据库 JSON 文本解析为数组（导出物更友好），其余字段保持原值；不含 `_migrations` 内部表。
- 响应为 `attachment` 下载，文件名 `focus-export-YYYYMMDD-HHMMSS.json`。
- 入口：管理模式横幅「导出数据」按钮（client v0.4.4）。

### 导入

#### 语义：全量替换

事务内先清空五张业务表（records / subjects / tags / record_tags / reminder_items），再按导入数据**原样插入**——保留原 id，record_tags 的引用关系因此保持一致。任何一行数据不合法（SQLite 约束：NOT NULL / UNIQUE）→ 整个事务回滚 → 导入不生效，不留半截数据。

**不补默认科目**：完全信任文件内容，导入文件里没有数学/英语/专业课那就是没有（恢复语义纯粹）。与建表时 `INSERT OR IGNORE` 的默认科目兜底互不冲突——兜底只发生在全新建库时。

#### 数据流：前端读文件 → POST JSON

1. 管理模式横幅「导入数据」按钮（「导出数据」旁，学习中即 timer 非空闲态时禁用/提示先结束学习——防止替换科目表后当前学习记录以旧科目名保存）
2. `<input type="file">` 选择导出 JSON 文件 → FileReader 读文本 → `JSON.parse` 并校验顶层结构（`app` = FOCUS、`data` 五表均为数组）
3. 确认弹窗：文件名 + 导出时间（exported_at）+ 来源版本 + 导入统计（学习记录数/科目数/标签数/提醒数）+ 红字风险提示「将替换全部现有数据」+「先下载当前备份」按钮（复用导出 API）+ 确认/取消
4. 确认后 `POST /api/import`（body 为完整导出 JSON），服务端在事务内校验 + 写入
5. 成功后提示「导入完成」→ `window.location.reload()` 整页刷新（所有数据重拉、计时器回 idle、管理模式退出）；失败 alert 错误信息

#### 服务端实现要点

- 新路由 `routes/import.js`：顶层校验（app / data 结构）→ 事务（清空五表 → 按序插入：subjects → tags → records → record_tags → reminder_items，先父后子保证引用）→ 返回 `{ success: true, counts }`。
- records 的 `segments` 数组需 `JSON.stringify` 回 TEXT 存储（与导出解析对称）；`null` 原样保留。
- `express.json()` 默认 body 限制 100kb 可能不够（考研一年上千条记录），导入路由挂载时调大 limit。
- 清空表用 `DELETE FROM` 而非 DROP（保留表结构）；显式插入原 id 后 SQLite 自动维护 `sqlite_sequence`。

#### 校验强度：顶层校验 + SQLite 约束兜底

不做逐行深度校验（列名/类型白名单）——个人工具里坏文件是小概率事件，SQLite 约束在事务内的整体回滚已经保证「要么全成要么全败」，错误信息统一 alert 提示。

## Consequences

- 服务端：新路由 `routes/import.js` + `POST /api/import`，server 版本递增。
- 客户端：App.jsx 管理模式横幅加「导入数据」按钮 + 确认弹窗 + 学习中禁用；`utils/api.js` 新增 `importApi`；client 版本递增。
- 测试：服务端 import 路由（顶层校验/事务回滚/全量替换/segments 序列化/默认科目信任）；客户端 importApi + App 导入交互（按钮门控/文件解析/确认弹窗/成功刷新/失败提示）。
- 不做：合并/增量导入、按 id 覆盖、导入时补默认科目、multipart 上传文件、按日期范围选择性导入、CSV/原始 .db 文件导入。
