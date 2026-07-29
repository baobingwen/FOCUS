# 0003: 离开页面自动冻结 — 学习中离开时自动冻结/恢复计时

学习过程中用户离开页面（切换标签页、最小化窗口、切换应用等）时，自动暂停计时计时但**不产生暂停记录**，回来后自动恢复计时。

## Status

**accepted**

## Design

### 核心概念：冻结（Freeze）

"冻结"与手动"暂停（Pause）"是两种不同的操作：

| 维度 | 手动暂停 | 离开冻结 |
|------|---------|---------|
| 触发 | 用户主动点击 ⏸ | 离开页面（visibilitychange / blur） |
| 恢复 | 用户手动点击 ▶ | 回到页面后自动恢复 |
| 产生 `paused_ms` | ✅ 是 | ❌ 否 |
| 产生 pause segment | ✅ 是 | ❌ 否 |
| 计入今日休息统计 | ✅ 是 | ❌ 否 |
| 意图 | 主动休息 | 被动中断（查资料、切窗口等短暂场景） |

冻结的本质：**仅停止计时器走字，不产生任何记录**。回来的那一刻，时间无缝续接，仿佛没有离开过。

### 状态机

仅对 `studying` 阶段生效。冻结不改变 phase，而是引入一个 `frozen` 布尔标志：

```
studying
  ├── 离开页面 → studying (frozen=true) → 回到页面 → studying (frozen=false)
  └── 主动点暂停 → paused（正常暂停流程）
```

其他阶段不受影响：

- `paused` — 已经暂停，无需额外操作
- `idle` / `rest_prompt` — 本来静止
- `resting` — 休息计时属于主动选择离开，不冻结

### 时机：零缓冲

一检测到页面隐藏/失焦，立即冻结。不加 `setTimeout` 缓冲，简单可靠。

### 浏览器事件监听

| 事件 | 触发场景 | 动作 |
|------|---------|------|
| `visibilitychange` → `document.hidden === true` | 切标签页、最小化窗口、手机切 App | `freeze()` |
| `visibilitychange` → `document.hidden === false` | 回到标签页 | `thaw()` |
| `blur` | 切到另一个桌面应用（浏览器窗口仍在但失焦） | `freeze()` |
| `focus` | 回到浏览器窗口 | `thaw()` |

### 实现方案

#### 关注点分离

将"冻结"的**核心逻辑**与**浏览器事件监听**分离：

- **`useTimer.js`**（核心 hook）
  - 新增 state: `frozen`（布尔值）
  - 新增方法: `freeze()` / `thaw()`
  - `freeze()`: 结束当前 study segment → accumulated 快照 → 停 ticker
  - `thaw()`: 新建 segmentStartRef → 恢复 ticker → 无任何暂停记录产生

- **`useFreezeOnLeave.js`**（新 hook）
  - 监听 `visibilitychange` / `blur` / `focus`
  - 仅在 `phase === 'studying' && !frozen` 时调用 `freeze()`
  - 仅在 `frozen` 时调用 `thaw()`
  - 只关心浏览器事件 → 只做冻结开关，不参与计时逻辑

- **`TimerPage.jsx`**（UI）
  - 消费 `timer.frozen`：冻结态计时数字变灰（与暂停态相同的灰色样式）
  - 不额外显示"冻结中 XX:XX"标签（与暂停态区分：无暂停计时显示）

#### 如何做到"不产生暂停记录"

```
freeze():
  if phase !== 'studying' → return
  1. 记录当前时间段 duration = Date.now() - segmentStartRef.current
  2. accumulatedStudyRef.current += duration  // 快照至今累计
  3. segmentStartRef.current = null            // 清零段起始（段未完成，不在 segments 数组中记录）
  4. stopTicker()                              // 停掉 tick
  5. setFrozen(true)

thaw():
  if phase !== 'studying' → return
  1. segmentStartRef.current = Date.now()      // 新建段起始
  2. startTicker()                             // 恢复 tick
  3. setFrozen(false)
```

关键：freeze 时 **不 push 段到 segmentsRef**，也 **不增加 accumulatedPauseRef**。segmentStartRef 置空再新建相当于"冻结这段时间不存在于任何段中"，tick 自动从快照累积继续走。

### UI 表现

- **冻结态**：计时数字变灰（与暂停态使用同一灰色样式 `text-gray-300`），但下方不显示"暂停中 XX:XX"
- **非冻结态**：正常蓝色/深色显示
- 其他 UI 元素（备注、结束按钮、暂停按钮）保持可用状态（与正常 studying 一致）

### 实施要点

| 文件 | 改动 |
|------|------|
| `client/src/hooks/useTimer.js` | 新增 `frozen` state + `freeze()` / `thaw()` 方法；暴露 `frozen` |
| `client/src/hooks/useFreezeOnLeave.js` | **新文件** — 浏览器事件监听 hook |
| `client/src/components/TimerPage.jsx` | 消费 `timer.frozen` 控制计时器样式 |
| `client/src/hooks/useTimer.test.js` | 新增 freeze/thaw 状态机测试 |
| `client/src/hooks/useFreezeOnLeave.test.js` | **新文件** — 事件监听测试 |
| `client/src/components/TimerPage.test.jsx` | 新增冻结态渲染快照测试 |

### 边界情况

| 场景 | 行为 |
|------|------|
| 离开时 `frozen=true`，回来前主动点了暂停（无法发生，因为不在页面） | 不发生，因为冻结和暂停是互斥路径 |
| 离开又快速回来（< 100ms） | 正常 freeze → thaw，时间误差在 tick 精度内 |
| 多层嵌套冻结（多个 blur 事件连续触发） | `freeze()` 开头检查 `phase !== 'studying'`，重复调用无副作用 |
| 冻结态下点击"结束学习" | `endStudy()` 应兼容 freeze 态——如果 frozen，先结束当前段（由于 segmentStartRef 已置空，不产生额外段） |
| 浏览器 tab 在后台长时间休眠后恢复 | Date.now() 绝对时间戳机制天然兼容，thaw 后 tick 从 accumulated 快照继续 |
| 冻结后回来时 `phase` 已被外部改为非 studying | `thaw()` 开头检查 `phase !== 'studying'`，不执行 |

## Considered Alternatives

- **视为普通暂停（paused）**：最简单，复用现有暂停逻辑。但 pause 产生 `paused_ms` 和 segment，冻结期间不计入今日休息更符合"不是我有意休息"的语义。
- **加缓冲的冻结（setTimeout 延迟）**：避免短暂切回触发冻结。但需要精细的定时器管理，且"短暂"的阈值难以界定。零缓冲更简单可靠。
- **只在 `visibilitychange` 监听，不监听 blur**：blur 事件触发场景太多（点击地址栏、弹出浏览器菜单等），可能过于敏感。但讨论后认为"失焦即冻结"的语义更统一，且 freeze() 幂等无副作用。

## Consequences

- "冻结"成为学习时段的一个新概念，需在 CONTEXT.md 中定义
- useTimer 暴露的新状态和方法需要充分测试
- 无服务端改动（纯前端功能），不涉及数据库迁移
- 版本号变更，v0.2.6