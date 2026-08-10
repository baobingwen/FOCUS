# FOCUS 客户端测试指南

## 快速开始

```bash
cd code/client
npm install          # 确保依赖已安装
npm test             # 运行一次
npm run test:watch   # 监听模式
```

## 技术栈

| 工具 | 版本 | 用途 |
|------|------|------|
| **Vitest** | ^4.1 | 测试框架，Vite 原生集成 |
| **@testing-library/react** | — | 组件渲染与交互 |
| **@testing-library/jest-dom** | — | 自定义 DOM 匹配器 (toBeInTheDocument 等) |
| **@testing-library/user-event** | — | 用户交互模拟（更贴近浏览器行为） |
| **jsdom** | — | 浏览器环境模拟 |

依赖已在 `package.json#devDependencies` 中，`vitest.config.js` 配置在项目根。

## 架构决策

### 配置 (`vitest.config.js`)

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
  },
});
```

- **独立配置文件** — 不混入 `vite.config.js`，避免影响开发构建
- **jsdom** — 模拟浏览器 DOM API，足够覆盖 React 组件渲染测试
- **globals: true** — `describe`/`it`/`expect`/`vi` 全局可用，无需逐文件 import
- **setupFiles** — `./src/test-setup.js` 导入 `@testing-library/jest-dom/vitest`

### Mock 策略

#### 1. API 模块 (`utils/api.js`)

组件测试使用 `vi.mock('../utils/api')` 模块级 mock：

```js
vi.mock('../utils/api');

// 在每个测试中控制返回值
subjectsApi.list.mockResolvedValue([...]);
recordsApi.create.mockResolvedValue({ id: 1 });
```

#### 2. Fetch 全局 (API 单元测试)

```js
globalThis.fetch = vi.fn();
globalThis.fetch.mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ ... }),
});
```

#### 3. 日期固定

使用 `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime()`：

```js
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-07T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});
```

⚠️ **只 fake Date，不 fake 定时器** — `{ toFake: ['Date'] }` 确保 `setTimeout`/`Promise` 正常工作，避免 `waitFor` 超时。

#### 4. confirm 弹窗

```js
window.confirm = vi.fn(() => true);   // 确认删除
window.confirm = vi.fn(() => false);  // 取消删除
```

#### 5. 第三方库（sortablejs）

拖拽排序测试用假类替换 sortablejs，测试内手动触发 `onUpdate` 模拟拖拽：

```js
vi.mock('sortablejs', () => {
  class MockSortable {
    constructor(el, options) { this.options = options; MockSortable.instances.push(this); }
    destroy() { MockSortable.instances = MockSortable.instances.filter(i => i !== this); }
  }
  MockSortable.instances = [];
  MockSortable.simulateUpdate = (oldIndex, newIndex) => {
    MockSortable.instances.at(-1)?.options.onUpdate?.({ oldIndex, newIndex });
  };
  return { default: MockSortable };
});
```

### Loading 态测试

将 API mock 返回永远不会 resolve 的 Promise，避免组件状态异步更新导致 `act()` 警告：

```js
subjectsApi.list.mockReturnValueOnce(new Promise(() => {}));
recordsApi.todayOverview.mockReturnValueOnce(new Promise(() => {}));
```

## 测试文件结构

```
src/
├── test-setup.js              # 全局测试 setup
├── utils/
│   ├── api.js
│   ├── api.test.js            # API 层 16 条（含 tagsApi 5 条）
│   ├── clipboard.js
│   ├── clipboard.test.js      # 剪贴板复制工具 3 条
│   ├── fmtTime.js             # 时长格式化（fmtTime 中文 + fmtClock + fmtShortClock）
│   └── fmtTime.test.js        # 三个格式化函数 8 条
├── hooks/
│   ├── useTimer.js
│   ├── useTimer.test.js       # 状态机 26 条（含暂停态 6 条 + 冻结 6 条 + 标签态 5 条）
│   ├── useFreezeOnLeave.js
│   ├── useFreezeOnLeave.test.js # 页面离开冻结事件 8 条
│   ├── useMultiTap.js         # 连点检测 hook（管理模式隐藏入口共用：count 次点击/超时重置）
│   └── useMultiTap.test.js    # 连点检测 5 条（达标触发/计数重置/超时重置/自定义参数/回调更新）
└── components/
    ├── App.jsx
    ├── App.test.jsx           # Tab 切换 + 全局管理模式（倒计时连点入口/横幅跨 tab/退出）8 条
    ├── ExamCountdown.jsx      # 考研倒计时（右上角常驻）+ 管理模式隐藏入口（连点 5 下）
    ├── ExamCountdown.test.jsx # 考研倒计时 3 条 + 连点入口 2 条
    ├── TimerPage.jsx
    ├── TimerPage.test.jsx     # 5 态渲染 + 保存 + 休息 + 暂停交互 + 弹窗确认 + 冻结 UI + 标签交互 + 页数交互 + 管理模式标签门控 37 条
    ├── SubjectSelector.jsx
    ├── SubjectSelector.test.jsx # CRUD + 休息 + 管理模式门控（日常无 × / admin × 恒显）16 条
    ├── TagPicker.jsx          # 标签选择器（点选/新增 + 管理模式删除 × / ⚙ 排序模式拖拽换位）
    ├── TagPicker.test.jsx     # 管理模式门控 2 条 + 排序模式 7 条（⚙ 入口禁用态/模式切换/拖拽换位/完成提交/取消恢复/失败留在模式）
    ├── HistoryPage.jsx
    ├── HistoryPage.test.jsx   # 页面级：加载 + 日期导航 + 编辑流（互斥/保存/取消/失败）+ 复制 + 标签展示/筛选/编辑 + 页数编辑 + 管理模式删除 confirm 29 条
    ├── RecordCard.jsx         # 单条记录卡片纯展示壳（查看态 + 编辑态，v0.4.1 从 HistoryPage 拆分）
    ├── RecordCard.test.jsx    # 卡片直测：查看态渲染/编辑态渲染 + 回调转发 + 千层饼显示条件 + 管理模式按钮 33 条
    ├── SegmentStack.jsx       # 千层饼堆叠条（v0.4.1 从 HistoryPage 拆分）
    ├── SegmentStack.test.jsx  # 段行渲染/自下而上顺序/汇总/空/无暂停 5 条
    ├── TodayOverview.jsx
    └── TodayOverview.test.jsx  # 概览 + 条形图 + 按标签分组 + 页数汇总 10 条
```

总计 **218 条测试用例**，15 个测试文件。

## 测试模式详解

### 1. API 层测试 (`api.test.js`)

- mock `globalThis.fetch`
- 验证：成功路径返回 JSON、HTTP 错误抛 Error、非 JSON 响应 fallback、参数编码

### 2. useTimer 测试 (`useTimer.test.js`)

- `renderHook` + `act` 包裹状态变更
- `vi.useFakeTimers()` (全量 fake) + `vi.advanceTimersByTime()` 模拟时间流逝
- 状态机全路径覆盖：正常流程、跳过休息、duration=0 边界、状态隔离

### 3. 组件测试（JSX 文件）

通用模式：

```jsx
// 1. Mock API
vi.mock('../utils/api');

// 2. 设置 mock 返回值
beforeEach(() => {
  vi.clearAllMocks();
  subjectsApi.list.mockResolvedValue(defaultSubjects);
});

// 3. render + 断言
it('某某功能', async () => {
  render(<Component prop={value} />);
  
  // 同步断言（初始渲染）
  expect(screen.getByText('加载中...')).toBeInTheDocument();
  
  // 异步断言（等待数据加载）
  await waitFor(() => {
    expect(screen.getByText('目标文本')).toBeInTheDocument();
  });
  
  // 用户交互
  await userEvent.click(screen.getByText('按钮'));
});
```

### 4. 日期相关测试

`HistoryPage` 使用 `vi.setSystemTime()` 固定日期，需要导出 `getTodayStr()` 供测试使用：

```js
// HistoryPage.jsx — 导出
export function getTodayStr() { ... }
```

## 常见问题

### `wrapper should not be passed to act(...)`

Vitest 4 不再需要 `wrapper` 参数。去掉 `.wrapper` 调用即可。

### `Cannot read properties of undefined (reading 'style')`

DOM 查询路径不对。用 `closest('.flex')` 替代 `closest('div')` 避免匹配到内层容器，然后 `.parentElement` 到外层。

### `Found multiple elements with the text: 加载中...`

多个子组件同时处于 loading 态。改用 `getAllByText().length` 或更精确的选择器。

### 测试超时 (5000ms)

通常是 `vi.useFakeTimers()` 没有配置 `{ toFake: ['Date'] }`，导致 `setTimeout` 被 fake 了，`waitFor` 的轮询无法执行。修复：只 fake Date。
