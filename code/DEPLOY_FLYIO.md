# FOCUS 部署方案：Fly.io

> 本文档记录了使用 Fly.io 部署 FOCUS 学习计时器的完整方案。
> 当前因注册需要外币信用卡，暂未实际部署，留作参考资料。

## 架构

```
用户 → https://focus-timer.fly.dev
         │
     Fly.io Hong Kong (hkg)
     免费 VM：shared-cpu-1x, 256MB
         │
     8080 PORT
         │
    ┌────┴──────────┐
    │  Express 5     │
    │  /health       │ → 健康检查
    │  /api/records  │ → 学习记录
    │  /api/subjects │ → 科目管理
    │  /*            │ → SPA 回退
    │                │
    │  better-sqlite3│ → /data/focus.db
    └────────────────┘
```

## 费用

| 项目 | 明细 |
|------|------|
| VM     | shared-cpu-1x 256MB × 3 台免费 |
| 持久卷 | 3GB 免费 |
| 流量   | 每月 160GB 免费 |
| **合计** | **$0/月** |

## 使用资源

- 香港节点 (hkg) — 对大陆延迟最低
- 持久卷 `/data` — 存储 SQLite 数据，重启不丢
- 无活动 30 天后自动休眠 + 访问时自动唤醒（秒级）

## 部署步骤

```bash
# 1. 登录
fly auth login

# 2. 创建应用
cd code
fly apps create focus-timer

# 3. 创建持久卷 (1GB)
fly volumes create focus_data --region hkg --size 1

# 4. 部署
fly deploy

# 5. 验证
curl https://focus-timer.fly.dev/health
# → {"status":"ok","timestamp":...}
```

## 后续更新

```bash
cd code
# 改代码 → 加迁移脚本（如有需要）→
fly deploy
```

## 数据库迁移

`code/server/migrations/` 目录下放 `.sql` 文件，命名示例：

```
001_add_notes_index.sql
002_add_category_column.sql
```

启动时自动执行未记录的迁移，已执行的不重跑。  
仅允许增（ADD / CREATE），不删不改已有结构。

## 相关文件

| 文件 | 说明 |
|------|------|
| `code/Dockerfile` | 多阶段构建（前端 Vite → 后端 Node） |
| `code/fly.toml` | Fly.io 配置（hkg 区域、持久卷、256MB） |
| `code/.dockerignore` | 构建上下文排除清单 |
| `code/server/migrations/` | 数据库迁移脚本目录 |
| `code/server/index.js` | 入口，含 `/health` 路由 |
| `code/server/database.js` | SQLite 初始化 + 迁移引擎 |
