# FOCUS 服务端测试指南

## 快速开始

```bash
# 跑全部测试
npm test

# 监听模式
npm run test:watch
```

## 技术栈

| 工具 | 版本 | 用途 |
|------|------|------|
| Jest | ^30 | 测试框架，原生 ESM 支持 |
| supertest | ^7 | HTTP 断言，直接驱动 Express app |

## 架构决策

### 为什么用 `:memory:` 数据库？

- 每个测试文件启动一个全新的空 SQLite 内存数据库，完全隔离
- `beforeEach` 中 `closeDb(); getDb();` 重置所有数据，测试间互不影响
- 无需 mock `better-sqlite3`，真实 SQL 语句跑在内存中
- 无需 mock 文件系统，无需建/删临时 `.db` 文件

### 为什么不用真实端口？

- Supertest 将 Express app 对象注入 Node HTTP 层，直接处理请求
- 不需要 `app.listen()`，不需要担心端口冲突
- CI 环境中 0 配置
- 需要真实端口的场景（如 WebSocket）用 `app.listen(0)` 取随机端口

### 测试文件位置

所有测试在 `__tests__/` 目录下，Jest 自动发现。

```
├── __tests__/
│   ├── records.test.js     # 记录路由（67 条用例，含暂停/segments + PATCH 备注/标签/页数 + records×标签/页数联动）
│   ├── subjects.test.js    # 科目路由（13 条用例）
│   └── tags.test.js        # 标签路由（22 条用例，GET 排序/POST 幂等复用/DELETE 级联/PUT 全量重排）
├── jest.setup.cjs          # 环境变量初始化（CJS，在 ESM 加载前执行）
└── package.json            # Jest 配置内联于此
```

## 配置详解

### `jest.setup.cjs`

```js
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
```

为什么是 `.cjs`？因为 `package.json` 的 `"type": "module"` 使所有 `.js` 文件默认为 ESM，但 `setupFiles` 需要在 ESM 模块加载前执行。使用 CommonJS 扩展名 `.cjs` 确保它在模块加载前运行。

### Jest 配置（`package.json` 内联）

```json
{
  "jest": {
    "transform": {},
    "testEnvironment": "node",
    "extensionsToTreatAsEsm": [".ts"],
    "moduleNameMapper": {
      "^(\\.{1,2}/.*)\\.js$": "$1"
    },
    "setupFiles": ["./jest.setup.cjs"]
  }
}
```

- `"transform": {}` —— 无转译，使用 Node 原生加载器
- `"extensionsToTreatAsEsm"` —— 只包含 `.ts`，`.js` 从 `package.json` 的 `"type": "module"` 自动推断
- `"moduleNameMapper"` —— 把 ESM 的 `.js` 扩展名 import 映射回无扩展名，Jest 原生 ESM 解析所需

## 测试模式与最佳实践

### 数据库生命周期

```js
import { getDb, closeDb } from '../database.js';

beforeEach(() => {
  closeDb();  // 关闭上一个内存 DB
  getDb();    // 创建全新内存 DB + 建表
});

afterAll(() => {
  closeDb();
});
```

### 直接插入测试数据

尽量直接通过数据库 API 插入测试数据，而不是通过 HTTP POST（减少耦合、精确控制时间）：

```js
const db = getDb();
db.prepare(
  'INSERT INTO records (mode, subject, duration_ms, created_at) VALUES (?, ?, ?, ?)'
).run('study', '数学', 3600000, '2026-07-06 10:00:00');
```

### 时间边界测试

`/api/records/today` 端点使用**本地时间**计算"今天"（`Date` 的 `getFullYear / getMonth / getDate` 方法），与 SQLite 的 `created_at` 存储时区（`datetime('now','localtime')`）一致。测试时不能依赖系统时间，采用：

1. 插入记录时指定精确的 `created_at`
2. Mock 系统时间使端点日期与插入数据对齐
3. 测试完毕立即恢复真实时间

```js
import { jest } from '@jest/globals';

// Mock 时间
jest.useFakeTimers({ now: new Date('2026-07-06T23:00:00') });
const res = await request(app).get('/api/records/today');
jest.useRealTimers();
```

> ⚠️ **历史教训**：原实现曾用 `new Date().toISOString().slice(0, 10)`（UTC 日期），与本地时间存储的 `created_at` 不一致，导致北京时间 0:00~8:00 间今日概览显示昨日数据。已在 `records.test.js` 中增加凌晨边界测试，防止回归。

注意：`jest` 在 ESM 模式下不是全局变量，必须从 `@jest/globals` 导入。

### 验证路径的三种写法

按清晰度优先排序：

```js
// 1. toMatchObject —— 推荐，只验证关心的字段
expect(res.body).toMatchObject({ mode: 'study', subject: '数学' });

// 2. 直接属性断言
expect(res.status).toBe(200);
expect(res.body.notes).toBe('');

// 3. 存在性断言
expect(res.body).toHaveProperty('id');
expect(res.body).toHaveProperty('created_at');
```

## Express 5 注意事项

### 路由通配符

Express 5 内建 `path-to-regexp` v8，语法有破坏性变更：

```js
// ❌ Express 4 —— 在 Express 5 中抛出 TypeError
app.get('*', handler);

// ✅ Express 5
app.get('/{*path}', handler);
```

### 其他已知差异

- `res.json()` 默认仍返回 200（未变）
- 路由中间件签名不变
- 异步错误处理：Express 5 自动捕获 `async` handler 的 reject，无需手动 `catch` 传给 `next()`
- `req.query`：带点号的查询参数（如 `?date=2026.07.06`）在 Express 5 中解析可能不同

## 边界值清单

| 字段 | 测试的边界 |
|------|-----------|
| `duration_ms` | 0（无效）、-1（无效）、字符串（无效）、Infinity（溢出）、正整数（有效） |
| `mode` | `study`（有效）、`rest`（有效）、`walk`（无效）、缺失 |
| `subject` | 学习模式缺失（400）、休息模式可以没有、空白字符串（服务端 trim 后判空） |
| `notes` | 不传（默认空字符串）、传空字符串、传普通字符串 |
| `created_at` | 23:59:59（算当天）、00:00:00（算当天）、凌晨 0~8 点本地 vs UTC 日期分歧（算当天）、昨日（不算当天）、无效日期 |
| `id` (DELETE) | 数字有效、非数字（abc）、超大数字（不存在） |
| `PATCH /:id` 备注/标签/页数 | id 非数字（404）、不存在（404）、notes 非字符串（400）、tags 非数组（400）、pages 非法值（400，0/负/小数/字符串/超 9999）、休息记录（400）、空串清空备注（200）、tags 空数组清空（200）、pages null 清空（200）、整组替换（200） |
| `pages` | 1~9999 整数（合法）、0/负数/小数/字符串/10000（400）、休息记录无条件忽略（200，存 null）、GET 返回每条 pages、PATCH 改/清空、`/today` total_pages 与 by_subject 汇总（NULL 忽略） |
| `tags` | 重名幂等复用（200）、新建（201）、trim（200）、空名（400）、超 12 字（400）、DELETE 级联清关联（200）、标签不存在（404）、id 非数字（404） |
| `PUT /tags/order` | 重排后 GET 顺序更新（200）、缺 id 非全量（400）、含不存在 id（400）、含重复（400）、ids 非数组（400）、含非正整数（400）、空库空数组幂等（200）、新标签排末尾（含经 records 创建的标签） |

## 添加新测试

1. 创建 `__tests__/xxx.test.js`
2. 在 `beforeEach` 中 `closeDb(); getDb();`
3. 直接插入测试数据，通过 supertest 驱动 API
4. 总是包含边界值和错误路径
5. 运行 `npm test` 确认全部通过

```js
import request from 'supertest';
import { jest } from '@jest/globals';
import { getDb, closeDb } from '../database.js';
import { app } from '../index.js';

beforeEach(() => { closeDb(); getDb(); });
afterAll(() => { closeDb(); });

describe('GET /api/xxx', () => {
  it('正常情况', async () => {
    const res = await request(app).get('/api/xxx');
    expect(res.status).toBe(200);
  });

  it('边界值', async () => {
    // ...
  });
});
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `__tests__/records.test.js` | 67 条用例，含暂停/segments + PATCH 备注/标签/页数 + records×标签/页数联动 |
| `__tests__/subjects.test.js` | 13 条用例，默认科目保护等 |
| `__tests__/tags.test.js` | 22 条用例，GET 排序/POST 幂等复用/DELETE 级联/PUT 全量重排 |
| `jest.setup.cjs` | 环境变量初始化 |
| `../database.js` | 支持 `DB_PATH` 环境变量和 `closeDb()` |
| `../index.js` | 导出 `app`，测试环境不监听端口 |
