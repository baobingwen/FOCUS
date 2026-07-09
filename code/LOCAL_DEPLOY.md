# FOCUS 学习计时器 —— 本地部署 + Tailscale 远程访问

> 方案：在自己电脑上运行服务，通过 Tailscale 组网，手机在外面也能访问。
> **费用：0 元**。需要一张手机能装的 SIM 卡（注册 Tailscale 用）。

## 整体架构

```
Windows 电脑
  ┌─────────────────┐
  │  Node.js         │  ← 双击 start-local.bat
  │  Express :3001   │
  │  SQLite (本地)   │
  │  Tailscale 客户端 │  ← 分配虚拟 IP
  └────────┬────────┘
           │ Tailscale 加密隧道
           │
  ┌────────┴────────┐
  │  手机 Tailscale  │  ← 安装客户端，登录同一账号
  │  浏览器访问      │
  └─────────────────┘
```

## 前提条件

- 电脑能正常 `npm install` 和 `npm run build`（需要 Node.js）
- 手机能装 App

## 一、安装 Tailscale

### 电脑端

1. 去 [tailscale.com/download](https://tailscale.com/download) 下载 Windows 版
2. 安装，登录（用 Google/GitHub/Microsoft 账号都行）
3. 任务栏右下角出现 Tailscale 图标 ✓

### 手机端

1. iOS → App Store 搜 "Tailscale"
   Android → 应用商店搜 "Tailscale"
2. 安装后用**同一个账号**登录
3. 连接后手机上能看到电脑的设备名 ✓

## 二、启动 FOCUS

双击 `code/start-local.bat`：

```
========================================
  FOCUS 学习计时器 — 本地启动
========================================

[1/2] 前端已构建，跳过
[2/2] 启动服务端...

========================================
  ✅ 正在启动...
  本地访问:  http://localhost:3001
  手机访问:  http://100.x.x.x:3001       ← 这是 Tailscale IP
  按 Ctrl+C 停止服务
========================================
```

### 首次启动前需要做的事

如果是第一次拉代码，先安装依赖：

```bash
cd code/server
npm install

cd ../client
npm install
```

然后双击 `start-local.bat` 即可。

## 三、从手机访问

1. 手机连上 Tailscale（确保显示 "Connected"）
2. 打开浏览器，输入电脑的 Tailscale IP + 端口
   - 例如 `http://100.64.0.1:3001`
   - 这个 IP 在启动脚本里会打印出来
3. 正常使用 FOCUS 计时 ✓

### 查看 Tailscale IP 的方法

```bash
# 在电脑终端运行
tailscale ip -4
# 输出类似: 100.x.x.x
```

或者在 Tailscale 客户端界面里也能看到。

## 四、日常使用流程

```bash
# 1. 开电脑
# 2. 双击 start-local.bat
# 3. 学完关掉终端窗口即可
```

或者你保持电脑常开，每次学习时双击脚本就能用。

## 五、数据库

数据存在 `code/server/data/focus.db`。

- 这是 SQLite 单文件，直接拷贝就能备份
- 想备份：复制 `focus.db` 到别处
- 想重置：删掉这个文件，重启服务，自动重建空库

## 六、更新代码

```bash
git pull
cd code/client
npm install
npm run build      # 重新构建前端
# 然后启动脚本即可
```

如果加了数据库迁移（`server/migrations/` 下的 `.sql` 文件），启动时自动执行，无需手动操作。

## 常见问题

**Q: 脚本报 "前端构建失败"**
A: 确认安装了 Node.js，且在 `code/client` 目录下执行过 `npm install`

**Q: 手机连不上**
A: 检查三点：
1. 手机和电脑登录了**同一个** Tailscale 账号
2. 手机 Tailscale 显示 "Connected"
3. 浏览器输入的是 `http://` 不是 `https://`，且端口号是 `:3001`

**Q: 电脑休眠/关机后手机连不上**
A: 正常。电脑必须开着，Tailscale 和 Node.js 都在运行才能访问。

**Q: 电脑不休眠**
A: Windows 电源设置里把睡眠改成"从不"。笔记本插电使用。

**Q: 不想每次开终端，想开机自启**
A: 按 `Win + R`，输入 `shell:startup`，把 `start-local.bat` 的快捷方式放进去。每次开机自动启动。
