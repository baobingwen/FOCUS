# 0001: Timer state lifted to App component

条件渲染导致标签切换时 TimerPage 卸载，useTimer() 内部状态（phase、elapsed、selectedSubject）全部丢失。将 useTimer() 上提到 App 组件持有，TimerPage 改为接收 props，使计时状态跨越标签切换保持存活。

Status: **accepted**

## Considered Options

- **Lift state to App** (chosen) — 标准 React 方案，零依赖，最小改动，TimerPage 保持纯展示组件。
- **CSS `display:none`** 替代条件渲染 — 两个页面同时存在于 DOM 中，不卸载也就不丢状态。但浪费内存，且 Toast 弹窗等 UI 残留可能跨标签可见。
- **Context API** 存储 timer state — 全组件可读，但此场景只需要 TimerPage 访问，用 Context 过度设计。
- **外部状态管理（zustand 等）** — 引入依赖，复杂度不匹配。

## Consequences

- 新增标签页时需要同样用 props 传递 timer，否则无法访问计时状态。
- TimerPage 的 UI-only state（saving、toast）保持就地管理，设计清晰。
