# 0013: 双版本导入校验统一 — 共用共享校验模块

## 背景

v0.4.4 数据导入落地（ADR 0010）与 v0.5.0 双版本本地化（ADR 0011）之后，导入校验在两个版本之间不一致：

- **服务端版**（`routes/import.js`）：仅顶层结构校验（`app` = FOCUS、`data` 五表均为数组），行级合法性完全依赖 SQLite 约束兜底（UNIQUE / 复合主键 / 外键 / NOT NULL / CHECK），错误消息为 SQLite 英文原文。
- **纯静态版**（`utils/apiLocal.js`）：顶层校验 + 事务外显式行级校验 `validateImportRows`，错误消息为中文具体描述。

差异导致同一份「手工构造 / 损坏」的 JSON 文件两端行为不同：

| 场景 | 服务端版 | 纯静态版 |
|------|---------|---------|
| 重复 subjects.name | 拒绝（UNIQUE） | 接受（无唯一索引） |
| 重复 record_tags (record_id, tag_id) | 拒绝（复合主键） | 接受（普通索引） |
| records.duration_ms ≤ 0 | 接受（schema 仅 NOT NULL，无 CHECK） | 拒绝（校验要求 > 0） |
| 空串 name / content | 接受（NOT NULL 放行空串） | 拒绝（trim 后为空） |
| sort_order 缺失 / null | 拒绝（NOT NULL） | 接受（归一为 0） |
| 错误消息 | `导入数据失败: NOT NULL constraint failed: ...` | `导入数据不合法: subjects 行 name 缺失` |

## 决策

1. **校验规则统一为「显式行级校验」**：双版本共用同一套校验逻辑，抽公共模块 `code/shared/importValidation.js`（纯函数，无任何运行时依赖）。客户端经 Vite `resolve.alias` 引用，服务端相对路径引用。
2. **规则清单（双端完全一致）**：
   - 顶层结构：`app` = FOCUS、`data` 五表均为数组；
   - subjects：id 正整数、name 非空；重复科目名拒绝（对齐 SQLite UNIQUE 语义）；
   - tags：id 正整数、name 非空；
   - records：id 正整数、mode ∈ {study, rest}、duration_ms > 0；
   - record_tags：record_id / tag_id 正整数、引用的记录与标签必须存在、重复 (record_id, tag_id) 拒绝（对齐复合主键语义）；
   - reminder_items：id 正整数、content 非空。
3. **默认值归一化双端一致**：sort_order 非整数 → 0；notes 非字符串 → ''；paused_ms 非整数 → 0；pages 非整数 → null；created_at 非字符串 → null；segments 数组/字符串解析语义一致。
4. **错误消息统一为中文**「导入数据不合法: \<具体规则\>」；服务端 400 响应的 `error` 字段同格式。
5. **不改 schema**：服务端 SQLite 现有约束（UNIQUE / 复合主键 / 外键 / NOT NULL）保留作最终兜底（双保险），不加新 migration / CHECK 约束；纯静态版 IndexedDB 唯一索引同样仅作兜底。
6. **任何一行不合法 → 整体拒绝**：服务端事务回滚返回 400，纯静态版事务回滚抛错，导入不生效、旧数据保留。

## 影响

- **行为收紧（原来接受 → 现在拒绝）**：duration_ms ≤ 0、空串 name/content、重复科目名、重复 record_tags——对正常流程零影响（应用层新增/编辑时已保证这些值合法，FOCUS 自身导出的文件必然通过校验）。
- **行为放宽（原来拒绝 → 现在接受）**：sort_order 缺失 / null → 归一为 0 接受；同 sort_order 条目展示按 id 次级排序（GET 均 `ORDER BY sort_order, id`），无副作用。
- **错误消息变化**：服务端从 SQLite 英文原文变为「导入数据不合法: …」中文规则描述（更可读，与纯静态版一致）。
- **存量数据 / 旧导出文件**：零影响——校验只作用于导入入口，不触碰存量数据；FOCUS 导出的文件字段齐全、值合法。
- **规则等价性**：显式校验与 SQLite 约束规则等价（sort_order 归一化后不再触发 NOT NULL，duration_ms > 0 校验后不触发任何约束），不会出现「校验放行、约束拒绝」的漏洞。

## 关联

- ADR 0010（数据导出与导入）中「任何一行不合法由 SQLite 约束兜底」的描述被本决策细化：行级校验前置到共享模块，SQLite 约束降为兜底。
- ADR 0011（无后端方案）中「导入校验逐条对齐后端」被本决策做实：不再是「各端自校验 + 底层各自兜底」，而是双端共用同一份规则。
