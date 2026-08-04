# 0002: 暂停功能 — 学习中的暂停/继续

学习过程中支持暂停/继续，暂停部分计入今日休息时长，并在历史记录中以千层饼堆叠条可视化显示。

## Status

**accepted**

## Design

### 状态机

```
idle → studying → paused → studying → paused → ... → rest_prompt → resting → idle
```

- `paused` 是 `studying` 的子态（独立 phase，非布尔标志）
- 暂停态下计时器数字变灰，暂停按钮切换为「继续」按钮
- 暂停态下可编辑备注
- 暂停态下点击结束 → 弹窗确认 → 保存所有段（含当前暂停段）→ 进入 rest_prompt
- 暂停段 **每段时长单独实时计时**，暂停态数字下方显示"暂停中 XX:XX"

### 数据模型（服务端）

**迁移** — records 表新增两列：

```sql
ALTER TABLE records ADD COLUMN segments TEXT;     -- JSON 数组
ALTER TABLE records ADD COLUMN paused_ms INTEGER DEFAULT 0;
```

- `segments`：JSON 数组 `[{type, duration_ms}, ...]`，type 为 `"study"` 或 `"pause"`
- `paused_ms`：本次学习中所有暂停段的总时长（毫秒），冗余存储以简化统计查询
- 老数据兼容：`segments IS NULL` 视为单段 `[{type: "study", duration_ms}]`

**POST /records** 新增可选字段：

```json
{
  "mode": "study",
  "subject": "数学",
  "duration_ms": 600000,
  "paused_ms": 300000,
  "segments": [
    {"type": "study", "duration_ms": 600000},
    {"type": "pause", "duration_ms": 300000},
    {"type": "study", "duration_ms": 900000}
  ],
  "notes": "微分中值定理"
}
```

- 无 segments/paused_ms 的请求保持兼容（老客户端不受影响）
- 学习结束时只保存一条记录，**不额外生成 rest 记录**
- 手动走 rest_prompt → resting 流程生成的 rest 记录不受影响

**今日概览统计**：

```sql
-- 总学习时长（不变）
SUM(duration_ms) WHERE mode='study'

-- 总休息时长 = 手动休息 + 暂停段
COALESCE(SUM(duration_ms), 0) FILTER(WHERE mode='rest') +
COALESCE(SUM(paused_ms), 0) FILTER(WHERE mode='study')
```

总休息中不单独标注暂停时长，数字自然变大。

### 前端交互

#### 学习中态

| 设备 | 暂停按钮 |
|------|---------|
| 桌面浏览器 | hover 大按钮时，右侧滑出 ⏸ 按钮 |
| 移动端浏览器 | ⏸ 按钮永久显示在大按钮右侧 |

> v0.3.1 修正：⏸ 按钮改为 absolute 定位悬浮于大按钮右缘（`left-full ml-4 top-1/2 -translate-y-1/2`），不再占据布局空间——学习/暂停两态大按钮始终居中。桌面 hover 用容器 group-hover + 按钮自身 hover 双轨触发，鼠标移向按钮途中不会淡出。

#### 暂停态

- 计时器数字变灰（灰色）
- 计时器下方显示"暂停中 XX:XX"（暂停段实时计时）
- ⏸ 按钮切换为 ▶ 继续按钮
- 右侧结束按钮仍可用，点击弹出确认弹窗

#### 结束确认弹窗（仅暂停态下点击结束时出现）

```
当前处于暂停中，确定结束吗？
               [取消] [确定]
```

#### rest_prompt

弹窗内容不变，不展示暂停信息。

### 历史记录千层饼

有 segments 的记录展开堆叠条，位于备注下方：

```
┌──────────────────────────────────┐
│ 🟦 学习    数学             60min│
│ 备注：微分中值定理               │
│ ←──────────────────────────────→│
│ 🟦 学习                      35min│
│ ⬜ 暂停                      10min│
│ 🟦 学习                      30min│
│ 09:00 · 总计 65min（含 10min 暂停）│
└──────────────────────────────────┘
```

- 蓝色 = 学习段，灰色 = 暂停段
- 每层标注文字 + 时长
- 每层高度按时间比例
- 自下而上按时间正序显示：最早段在最下，最晚段在最上（渲染时反转，存储仍为时间正序）
- 无 segments 的记录保持原卡片样式不变

### 实施要点

| 文件 | 改动 |
|------|------|
| `server/database.js` | `initTables()` 无需改；新增迁移脚本添加 `segments` + `paused_ms` |
| `server/routes/records.js` | POST 接收可选 `segments`/`paused_ms`；GET /today 统计含 `paused_ms` |
| `server/__tests__/records.test.js` | 暂停相关测试用例 |
| `client/src/hooks/useTimer.js` | 新增 `paused` phase；新增暂停段追踪逻辑；`endStudy()` 返回 segments + paused_ms |
| `client/src/components/TimerPage.jsx` | 暂停态渲染（灰化+暂停中计时+继续按钮）；暂停态结束弹窗；hover 暂停按钮（桌面，absolute 悬浮不占布局） |
| `client/src/components/HistoryPage.jsx` | 千层饼堆叠条渲染 |
| `client/src/hooks/useTimer.test.js` | 暂停段状态机全路径测试 |
| `client/src/components/TimerPage.test.jsx` | 暂停态 UI + 交互测试 |
| `client/src/components/HistoryPage.test.jsx` | 千层饼渲染 + 兼容性测试 |

### 范围外（不做）

- 暂停段独立备注（每个学习段单独记录该段在学什么）
- 暂停总时长在今日概览中单独标注
- rest_prompt 中显示暂停信息

## Considered Alternatives

- **纯布尔标志 `isPaused`**：phase 保持 studying，加一个布尔来区分。但 UI 分支增多后条件判断容易混乱，独立 phase 更清晰。
- **多记录方案**：每次暂停生成一条 rest 记录。查询简单但数据语义歧义（暂停段和学习段无法保持在一笔记录里）。
- **混合策略自动生成 rest 记录**：学习记录带 segments + 额外生成 rest 记录。数据冗余导致今日概览重复计数。

## Consequences

- CONTEXT.md 中"学习时段"定义需更新：学习时段可由多个学习段和暂停段组成
- 新 UI 元素（千层饼、暂停按钮）需要配套的测试用例
- 历史记录卡片高度不再固定，取决于 segments 数量
