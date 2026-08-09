# 0008: 全局管理模式 — 删除类功能统一收进隐藏模式

v0.3.4 的历史记录删除引入了「隐藏管理模式」：连点标题 5 下进入，删除按钮才可见。日常点子「把删除和修改的功能放到管理模式里」将其推广为**全局管理模式**：所有不可恢复的删除类功能（记录删除、科目删除、标签删除、标签排序）统一由一个 App 级开关控制，日常界面不再出现任何删除/管理入口。

## Status

**accepted**

## Design

### 定位：全局开关 = 一个入口，管所有页面的删除类功能

管理模式从历史页局部提升为 **App 级全局状态**：

- **范围限定为删除类**：记录删除（已有）、科目删除、标签删除、标签排序。修改类（✏️ 备注/页数/标签修改）保持常态入口——修改可逆且日常高频（每次学完补备注），收进模式反而碍事。
- **入口**：右上角考研倒计时连点 5 下（间隔 ≤2s，超时重置）。倒计时在任何页面（计时/历史）、任何计时状态（idle/学习中/暂停/休息中）都常驻可见——学习中途也能进管理模式，这是选它当入口的关键（页面标题只在部分状态出现）。
- **横幅**：App 层显示「管理模式已开启 — 删除与管理入口已解锁」+ 「退出管理模式」按钮，跨 tab 常驻（App 层 state，切 tab 不重置）。
- **持久性**：不写 localStorage，刷新即复位；退出按钮关闭。

### 组件改造

| 组件 | 变化 |
|------|------|
| `App.jsx` | 新增 `adminMode` state + `enterAdminMode`/`exitAdminMode` 回调 + 全局横幅；向 TimerPage / HistoryPage 传 prop；倒计时接 `onMultiTap` |
| `useMultiTap.js` | 新 hook：count 次点击（间隔 ≤windowMs，超时重置）触发 onComplete（含独立测试） |
| `ExamCountdown.jsx` | 倒计时组件挂连点 5 下入口（`onMultiTap` prop，`data-testid="exam-countdown"`），样式与隐藏性不变 |
| `HistoryPage.jsx` | 移除内部 adminMode state、横幅与标题连点，改收 `adminMode` prop；删除按钮逻辑不变 |
| `TimerPage.jsx` | 传 `admin` 给 SubjectSelector / TagPicker |
| `SubjectSelector.jsx` | 新 `admin` prop：自定义科目 × 删除按钮仅 admin 时渲染（恒显，不再 hover 浮现——顺带修复移动端非选中科目 × 不可见的怪癖） |
| `TagPicker.jsx` | 新 `admin` prop：× 删除与 ⚙ 排序仅 admin 时显示；日常只剩点选/新增 |

### 不做的（沿用 ADR 0007 结论）

- **批量删除 / 整日清空 / 清空全部**：UI 复杂度显著上升，单条删除已覆盖主场景。
- **修改类收进模式**：可逆 + 日常高频，收进去徒增操作成本。
- **默认科目 is_default 字段**（日常点子④）：继续用硬编码 `['数学','英语','专业课']` 判定「默认科目不可删」，后续单独做。
- **持久化开关（localStorage）**：可能忘记关闭导致删除按钮常驻，隔离效果打折。

## Consequences

- 纯前端改动，服务端零改动（API 均已存在：DELETE /records/:id、DELETE /subjects/:id、DELETE /tags/:id、PUT /tags/order），server 版本不 bump。
- 客户端测试：新增 useMultiTap 5 条、ExamCountdown 连点入口 2 条、App 全局模式 5 条、SubjectSelector/TagPicker 门控、HistoryPage 管理模式 prop 化改造；总计 182 条全绿。
- 版本号：client `0.3.4`→`0.4.0`，git tag `v0.4.0`（0.3 分支发布，merge 回 master）。
