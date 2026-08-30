# 0012: 计时器状态持久化 — 快照入 localStorage，刷新/崩溃后自动恢复

日常点子「计时器状态不持久化，刷新即丢失」落地——进行中的学习/休息计时（studying / paused / resting 三态）的关键状态快照写入浏览器 localStorage，页面刷新、误关标签页、浏览器崩溃后重新打开自动恢复计时，解决「计时直接丢失」问题。

## Status

**accepted**

## Design

### 快照内容与存储

- **存储**：localStorage，键 `focus:timer:snapshot`，JSON 序列化，顶层 `version` 字段（当前 1）。解析失败 / 结构非法（version 不符、phase 非法、字段类型错）一律忽略、按无快照处理回 idle，绝不影响正常启动。
- **快照字段**：`phase`（仅 studying / paused / resting 三态）、`segmentStart`（当前段绝对时间戳）、`accumulatedStudy` / `accumulatedPause`（已完成段累计）、`segments`（段列表，与记录格式一致）、`subject`（{id, name}，与记录按名字存一致）、`notes`、`tags`（名字数组）、`pages`、`updatedAt`（最后写入时刻，算「离开时长」用）。
- **elapsed 不落盘**：恢复后由 `accumulated + (now − segmentStart)` 绝对时间戳推导，延续双轨时间哲学（与锁屏休眠恢复一致）；因此 tick 每秒更新**不写**存储。

### 写时机（持久化触发点）

| 触发 | 说明 |
|------|------|
| startStudy / pauseStudy / resumeStudy / startRest | 状态切换即写 |
| updateNotes / toggleTag / removeTag / updatePages / addPages | 用户输入即写（快照小，同步写无压力） |
| pagehide / beforeunload | 关标签 / 刷新前最后时刻补写 |
| 活跃态每 10 秒 | 周期兜底，防浏览器崩溃（beforeunload 不触发） |
| endStudy / skipRest / endRest | 会话结束，清空快照 |

### 恢复与提示条

- App 挂载时同步读快照 → 校验通过即作为 useTimer 初始状态水合，**第一帧渲染即恢复态**（不闪 idle）。
- 顶部提示条（App 层，计时/历史 tab 都可见）：「已恢复上次学习：{科目} · 已学 {时长} · 离开 {时长}」
  - **默认计入离开时间**：绝对时间戳继续累计（与锁屏恢复一致）。
  - **「忽略离开时间」**：当前段起点前移离开时长（`now − updatedAt`），缺口不计入，恢复到关页面前的瞬间状态；内存记忆位移量，可再点切回「计入」。
  - **「放弃本次学习」**：清快照回 idle。
  - **「✕ 关闭」**：仅隐藏提示条——快照保留、计时继续（离开时间按当前选择计入/忽略），下次刷新/崩溃仍可恢复。
- **陈旧快照不设上限**：提示条醒目展示离开时长，当场决定（计入/忽略/放弃）——不设硬性作废上限，避免误删可找回的学习（如昨晚忘结束今早补上）。

### 阶段范围与边界

- 只持久化 **studying / paused / resting**；**rest_prompt 不持久化**（endStudy 即清快照——此时记录已进入保存流程；刷新时若保存未完成会丢，属「保存失败无法重试」事项边界，另行处理）。
- 计时快照是 **UI 运行状态而非业务数据**：不进五张业务表/五仓库、不参与导出/导入、不纳入数据层（utils/api.js）——双版本（服务端版/纯静态版）共用 useTimer，天然都生效。

### 组件改造

| 组件 | 变化 |
|------|------|
| `utils/timerStorage.js` | 新模块：save / load / clear + 校验，localStorage 隔离于此 |
| `hooks/useTimer.js` | 接受初始快照水合（state/refs 初始化 + 按 phase 启动 ticker）+ 内部持久化写入 + ignoreAwayTime / countAwayTime / discardRestore |
| `components/TimerRestoreBar.jsx` | 新组件：恢复提示条（科目/已学/离开时长展示 + 计入/忽略切换 + 放弃按钮） |
| `App.jsx` | 挂载时 load 快照传入 useTimer；水合成功时渲染 TimerRestoreBar；TimerPage 零改动 |

### 不做的

- **rest_prompt 持久化**：与「保存失败无法重试」事项边界重叠，另行处理。
- **陈旧快照自动作废上限**：会误删可找回的学习，交给提示条当场决定。
- **快照并入导出/导入文件**：快照是运行态不是业务数据，导出语义 = 业务数据备份。
- **恢复默认忽略离开时间**：双轨时间哲学下「计入」才是咬合真实时间的默认语义；「忽略」作为显式选项提供。

## Consequences

- 纯前端改动：服务端零改动、数据层（utils/api.js）零改动、useFreezeOnLeave（v0.4.3 停用）保持不动；双版本（服务端版/纯静态版）共用 useTimer 天然都生效。
- 客户端测试：useTimer.test.js 新增持久化写入/水合恢复/忽略离开时间/放弃清除/非法快照忽略/pagehide 写入等用例；TimerRestoreBar 组件测试 + App 集成测试；用例数同步 `code/client/TESTING.md`。
- 版本号：client `0.5.1`→`0.5.2`，git tag `v0.5.2`（server 不 bump）。
