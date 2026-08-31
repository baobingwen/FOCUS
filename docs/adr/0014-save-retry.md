# 0014: 学习记录保存失败可重试 — 待重试记录 + 结束确认弹窗

## 背景

日常点子「保存失败无法重试，且阶段已推进」：`TimerPage.handleEndStudy` 中 `timer.endStudy()` 立即把状态推进到 `rest_prompt`（计时快照清空），保存数据只存在局部变量，`recordsApi.create` 失败仅弹 toast，用户在 rest_prompt 弹窗选「休息一下 / 不休息」后状态进入 resting/idle，**这条学习记录永久丢失、无重试入口**。休息记录 `handleEndRest` 同样：`endRest()` 立即回 idle，保存失败即丢失。

根因：**状态推进与保存成功未解耦，失败路径上没有暂存待保存数据**。且学习中点大按钮即直接结束保存，没有误触保护。

## 决策

1. **学习中结束加确认弹窗**：学习中点中央大按钮不再直接结束，弹「结束学习？」确认框，按钮「结束学习 / 返回学习」。返回学习 = 关弹窗继续计时（尚未结束、未保存、不产生记录，无重复保存问题）。暂停态已有的结束确认弹窗文案/按钮统一为同一套「结束学习 / 返回学习」（暂停态返回学习 = 关弹窗继续暂停）。
2. **保存失败 → 待重试记录**：`handleEndStudy` 把提交给 `recordsApi.create` 的完整 payload（mode/subject/duration_ms/paused_ms/segments/notes/tags/pages）暂存为「待重试记录」（组件 state + localStorage 键 `focus:pending-record`，新工具模块 `utils/pendingRecord.js` save/load/clear）。
3. **rest_prompt 弹窗分两态**：
   - 正常（无待重试）：「休息一下 / 不休息」（现状不变）；
   - 保存失败（有待重试）：「重试保存 / 放弃记录」。重试保存 = 用待重试 payload 重新 `recordsApi.create`，成功 → 清待重试、恢复正常「要休息吗？」弹窗并刷新历史；再失败 → toast 提示、保持待重试。放弃记录 = 丢弃待重试、`timer.skipRest()` 直接回 idle（不再问休息）。
4. **待重试记录跨刷新保留**：`TimerPage` 挂载时从 localStorage 读取待重试记录；存在（phase 非 rest_prompt，即刷新/误关后回来）→ 弹出恢复弹窗「重试保存 / 放弃记录」，处理后才继续正常使用。endStudy 已清计时快照，恢复场景 phase 必为 idle，无状态冲突。
5. **仅学习记录**：休息记录保存失败保持现状（toast 提示，不重试）——休息记录时长短、损失小，不纳入本次机制。
6. **useTimer 零改动**：endStudy 已把时长/段结算进 refs 且不清理，返回学习发生在结束前（不调 endStudy），放弃记录复用 skipRest；无需新增 hook 方法。
7. **待重试记录是 UI 运行态而非业务数据**：不进五表/五仓库、不参与导出/导入（与计时快照 ADR 0012 同原则）；双版本（服务端版/纯静态版）共用 localStorage 天然生效。

## 影响

- **学习中交互变化**：结束学习多一步确认（返回学习 / 结束学习），消除误触；暂停态按钮文案从「确定 / 取消」改为「结束学习 / 返回学习」。
- **行为收紧**：保存失败不再静默丢数据——rest_prompt 弹窗变「重试保存 / 放弃记录」，用户必须显式处理；刷新后也不会丢。
- **存储新增**：localStorage 键 `focus:pending-record`（带 version），仅存学习记录保存失败后的 payload；成功/放弃即清。
- **对正常流程零影响**：保存成功路径与现状一致（rest_prompt 弹「要休息吗？」、onRecordSaved 刷新历史）；恢复弹窗只在「有待重试记录」时出现。

## 关联

- 相关概念见 CONTEXT.md「待重试记录」。
- 与 ADR 0012（计时快照）同原则：运行态数据放 localStorage、不进业务数据层、不参与导出/导入；两者键分离（`focus:timer:snapshot` vs `focus:pending-record`）、互不干扰。
