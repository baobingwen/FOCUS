# FOCUS 客户端代码结构关系

> 当前版本：v0.5.5（纯静态版 PWA 化见 [docs/adr/0015-static-pwa.md](../../../docs/adr/0015-static-pwa.md)，构建层变化、src 依赖结构不变；保存失败可重试见 [docs/adr/0014-save-retry.md](../../../docs/adr/0014-save-retry.md)；双版本导入校验统一见 [docs/adr/0013-import-validation-unified.md](../../../docs/adr/0013-import-validation-unified.md)；计时快照持久化见 [docs/adr/0012-timer-persistence.md](../../../docs/adr/0012-timer-persistence.md)；数据层双实现结构变动见 [docs/adr/0011-no-backend-local-first.md](../../../docs/adr/0011-no-backend-local-first.md)；v0.4.1 结构拆分见 [adr/0001-v0.4.1-code-structure-changes.md](adr/0001-v0.4.1-code-structure-changes.md)）

## 源码依赖图

箭头表示 import 方向，边上标注使用的导出符号：

```mermaid
graph TD
    %% 组件
    App[App.jsx]
    TimerPage[TimerPage.jsx]
    HistoryPage[HistoryPage.jsx]
    RecordCard[RecordCard.jsx]
    SegmentStack[SegmentStack.jsx]
    SubjectSelector[SubjectSelector.jsx]
    TagPicker[TagPicker.jsx]
    TodayOverview[TodayOverview.jsx]
    ExamCountdown[ExamCountdown.jsx]
    TimerRestoreBar[TimerRestoreBar.jsx]
    %% hooks
    useTimer[hooks/useTimer.js]
    useFreeze[hooks/useFreezeOnLeave.js]
    useMultiTap[hooks/useMultiTap.js]
    %% utils
    api[utils/api.js]
    apiRest[utils/apiRest.js]
    apiLocal[utils/apiLocal.js]
    importValidation[shared/importValidation.js]
    clipboard[utils/clipboard.js]
    fmtTime[utils/fmtTime.js]
    timerStorage[utils/timerStorage.js]
    pendingRecord[utils/pendingRecord.js]

    App -->|useTimer| useTimer
    App -->|freeze/thaw 运行时传入| useFreeze
    App --> TimerPage
    App --> HistoryPage
    App --> ExamCountdown
    App -->|timer.restored 时渲染| TimerRestoreBar
    App -->|exportApi| api
    App -->|importApi| api

    useTimer -->|save/load/clear| timerStorage

    TimerPage --> SubjectSelector
    TimerPage --> TagPicker
    TimerPage -->|recordsApi| api
    TimerPage -->|fmtClock, fmtTime| fmtTime
    TimerPage -->|save/load/clear| pendingRecord

    HistoryPage --> TodayOverview
    HistoryPage --> RecordCard
    HistoryPage -->|recordsApi| api
    HistoryPage -->|copyText| clipboard

    RecordCard --> TagPicker
    RecordCard --> SegmentStack
    RecordCard -->|fmtShortClock| fmtTime

    SegmentStack -->|fmtShortClock| fmtTime

    TodayOverview -->|recordsApi| api
    TodayOverview -->|fmtTime| fmtTime

    SubjectSelector -->|subjectsApi| api
    TagPicker -->|tagsApi| api
    TagPicker --> Sortable

    ExamCountdown --> useMultiTap

    %% 数据层分发：组件只依赖 api 统一入口
    api -->|VITE_DATA_LAYER=rest| apiRest
    api -->|VITE_DATA_LAYER=local| apiLocal

    %% 共享校验：双版本共用（服务端 import.js 亦引用同一模块）
    apiLocal -->|validatePayload/validateImportRows| importValidation
```

> 说明：`useFreezeOnLeave` 不 import `useTimer`，通过 App 层把 timer 的 freeze/thaw 作为参数传入（运行时依赖）；`useTimer`/`useMultiTap`/`utils/*` 除 `useTimer → utils/timerStorage`（计时快照存取）与 `apiLocal → shared/importValidation`（导入校验）外不 import 任何项目内模块。

## 文件职责与状态归属

| 文件                             | 职责                                                                               | 持有状态                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `App.jsx`                        | 主布局 + 底部导航 + 计时状态托管（useTimer）+ 计时快照恢复（挂载时读快照水合 useTimer，恢复时渲染 TimerRestoreBar）+ 全局管理模式 state/横幅（含「导出数据」按钮导出中/失败提示、「导入数据」按钮文件解析/确认弹窗/备份下载/导入中/整页刷新） | 是（timer、adminMode、exporting、importing、importPreview）                                                                              |
| `components/TimerPage.jsx`       | 计时器 5 状态机渲染（idle→studying→paused→rest_prompt→resting）+ 保存学习/休息记录 | 是（saving/toast/结束确认弹窗）                                                                                |
| `components/HistoryPage.jsx`     | 历史记录页面：日期导航 + 列表加载 + 全部编辑/删除/复制/筛选逻辑                    | 是（9 个编辑状态：editingId/draft/draftTags/draftPages/savingId/editError/copyFeedback/deleteError/filterTag） |
| `components/RecordCard.jsx`      | 单条记录卡片渲染（查看态 + ✏️ 编辑态表单 + 删除按钮 + 千层饼 + 时间戳）            | 否（纯展示壳，所有状态与回调由 HistoryPage 通过 props 传入）                                                   |
| `components/SegmentStack.jsx`    | 千层饼堆叠条（学习/暂停段按时间比例显示 + 总计/含暂停汇总）                        | 否                                                                                                             |
| `components/TodayOverview.jsx`   | 今日概览（总时长 + 科目条形图 + 标签分组 + 页数）                                  | 否（records 由 props 传入，自取 /today 聚合）                                                                  |
| `components/SubjectSelector.jsx` | 科目选择（固定列表 + 自定义 + 休息）                                               | 是（自身 CRUD 表单态）                                                                                         |
| `components/TagPicker.jsx`       | 标签选择器（点选/新增/删除/拖拽排序）                                              | 是（标签库 + 排序模式）                                                                                        |
| `components/ExamCountdown.jsx`   | 考研倒计时 + 全局管理模式隐藏入口（连点 5 下）                                     | 否（数据写死）                                                                                                 |
| `components/TimerRestoreBar.jsx` | 计时快照恢复提示条（科目/已学/离开时长展示 + 计入/忽略切换 + 放弃按钮 + ✕ 关闭） | 否（timer 由 App 传入）                                                                                       |
| `hooks/useTimer.js`              | 计时状态机 + 快照水合/持久化（utils/timerStorage）+ 忽略离开时间 + freeze/thaw 冻结机制 | 是（计时核心）                                                                                                 |
| `hooks/useFreezeOnLeave.js`      | 页面离开自动冻结                                                                   | 否（调用传入的 freeze/thaw）                                                                                   |
| `hooks/useMultiTap.js`           | 连点检测                                                                           | 否                                                                                                             |
| `utils/api.js`                   | 数据访问统一入口——按构建开关 `VITE_DATA_LAYER`（rest/local）分发到 apiRest/apiLocal，组件只依赖此入口 | 否                                                                                                             |
| `utils/apiRest.js`               | REST 数据层实现（fetch 封装：recordsApi / subjectsApi / tagsApi / remindersApi / exportApi / importApi），服务端版使用 | 否                                                                                                             |
| `utils/apiLocal.js`              | IndexedDB 数据层实现（`focus-db` 库五仓库 1:1 模拟五表，CRUD/排序/幂等/级联/种子/今日概览/导出导入本地实现），纯静态版使用 | 否（数据在浏览器）                                                                                             |
| `utils/clipboard.js`             | 剪贴板复制（navigator.clipboard + execCommand 降级）                               | 否                                                                                                             |
| `utils/fmtTime.js`               | 时长格式化纯函数（fmtTime / fmtClock / fmtShortClock）                             | 否                                                                                                             |
| `utils/timerStorage.js`          | 计时快照存取（save / load / clear + 校验，localStorage 键 `focus:timer:snapshot`） | 否                                                                                                             |
| `utils/pendingRecord.js`         | 待重试记录存取（save / load / clear + 校验，localStorage 键 `focus:pending-record`，学习记录保存失败后暂存，TimerPage 使用） | 否                                                                                                             |
| `shared/importValidation.js`     | 双版本共用导入校验纯函数，见 [ADR 0013](../../../docs/adr/0013-import-validation-unified.md) | 否                                                                                                             |

## 格式化函数分工（utils/fmtTime.js）

| 函数            | 格式                                | 使用方                                          |
| --------------- | ----------------------------------- | ----------------------------------------------- |
| `fmtTime`       | 中文「1小时30分」                   | TodayOverview（概览汇总）                       |
| `fmtClock`      | HH:MM:SS / MM:SS（≥1 小时带小时位） | TimerPage（计时显示 + 休息 toast）              |
| `fmtShortClock` | MM:SS（分钟不折叠，如 75:00）       | RecordCard（时长）、SegmentStack（段时长/汇总） |

## 测试文件对应关系

| 测试文件                              | 被测单元                                                                | 层级                   |
| ------------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| `App.test.jsx`                        | App 布局与 Tab 切换 + 管理模式 + 数据导出 + 数据导入 + 计时快照恢复提示条                  | 集成                   |
| `components/TimerPage.test.jsx`       | TimerPage 5 态 + 保存/休息/暂停/冻结 UI + 结束确认弹窗 + 保存失败重试（待重试记录/重试/放弃/刷新恢复） | 组件                   |
| `components/HistoryPage.test.jsx`     | HistoryPage 页面级逻辑（加载/日期导航/编辑流/复制/筛选/删除 confirm）   | 组件（页面）           |
| `components/RecordCard.test.jsx`      | RecordCard 查看态/编辑态渲染 + 回调转发 + 千层饼显示条件 + 管理模式按钮 | 组件（卡片直测 props） |
| `components/SegmentStack.test.jsx`    | 千层饼段行渲染/顺序/汇总                                                | 组件                   |
| `components/TodayOverview.test.jsx`   | 今日概览 + 条形图                                                       | 组件                   |
| `components/SubjectSelector.test.jsx` | 科目 CRUD + confirm + 休息                                              | 组件                   |
| `components/TagPicker.test.jsx`       | 标签选择器                                                              | 组件                   |
| `components/ExamCountdown.test.jsx`   | 考研倒计时                                                              | 组件                   |
| `components/TimerRestoreBar.test.jsx` | 恢复提示条（展示/计入忽略切换/放弃/✕ 关闭）                                     | 组件                   |
| `hooks/useTimer.test.js`              | 计时状态机全路径 + 快照持久化/水合恢复/忽略离开/放弃/关闭                           | 单元                   |
| `hooks/useFreezeOnLeave.test.js`      | 页面离开冻结事件                                                        | 单元                   |
| `hooks/useMultiTap.test.js`           | 连点检测                                                                | 单元                   |
| `utils/api.test.js`                   | 数据访问入口分发（VITE_DATA_LAYER 不同值导出不同实现）                  | 单元                   |
| `utils/apiRest.test.js`               | REST 数据层（fetch 封装，含 exportApi / importApi）                     | 单元                   |
| `utils/apiLocal.test.js`              | 本地数据层（fake-indexeddb 直测：CRUD/排序/幂等/级联/种子/统计/导出/导入事务） | 单元                |
| `utils/clipboard.test.js`             | 剪贴板工具                                                              | 单元                   |
| `utils/fmtTime.test.js`               | 三个格式化函数                                                          | 单元                   |
| `utils/pendingRecord.test.js`         | 待重试记录存取（往返/非法数据校验/清空）                                 | 单元                   |

> 测试依赖：所有组件测试通过 `vi.mock('../utils/api')` 拦截 API 调用；RecordCard/SegmentStack 直测时由调用方传入 mock 回调。
