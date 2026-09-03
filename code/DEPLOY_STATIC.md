# 🚀 FOCUS 纯静态版部署指南（GitHub Pages）

纯静态版（`dist-static`，数据存浏览器 IndexedDB）可部署到任意静态托管。本指南以 GitHub Pages 为例。

## 部署地址

**`https://baobingwen.github.io/FOCUS/`**

- 部署在 FOCUS 源码仓库（`github.com/baobingwen/FOCUS`）的 `gh-pages` 分支，与 `master` 源码隔离
- `focus` 名字已被源码仓库 `FOCUS` 占用（GitHub 仓库名不区分大小写），无法另建同名仓库；根地址 `baobingwen.github.io` 也被其他站占用，故采用项目页子路径
- GitHub Pages 项目页 URL 大小写不敏感：小写访问 `https://baobingwen.github.io/focus/` 也会重定向到 `/FOCUS/`
- 构建时 `vite base` 为 `/FOCUS/`（仅 static 模式，服务端版部署不受影响）

## 一次性设置（首次）

1. 在 GitHub 打开 `github.com/baobingwen/FOCUS` → **Settings → Pages**
2. **Build and deployment → Source** 选 **Deploy from a branch**
3. **Branch** 选 `gh-pages` / `/(root)`，保存
4. 等待数分钟，访问 `https://baobingwen.github.io/FOCUS/` 验证（部署前该地址 404 属正常）

> 注意：只要 gh-pages 分支存在，GitHub Pages 就会持续展示其内容；`gh-pages` 分支仅存放构建产物，不参与源码开发。

## 每次发布流程

```bash
# 1. 构建 + 部署（构建 dist-static → 同步到独立工作区 → commit → 快进 push gh-pages）
cd code && pwsh -File deploy-static.ps1

# 2. 等待 GitHub Pages 构建（约 1 分钟），访问验证
#    https://baobingwen.github.io/FOCUS/
```

`deploy-static.ps1` 会自动完成：

1. 调用 `build-client-static.ps1` 构建 `client/dist-static/`
2. 把产物同步到独立部署工作区 `code/.deploy-static/`（该目录保留 `.git` 历史，仅首次初始化，已被 .gitignore 忽略）
3. 无变更时跳过部署；有变更则 commit（提交信息带版本号）
4. **普通快进 push**（非强制覆盖）：每次部署在 `gh-pages` 分支留下一个提交，历史可查、可回滚
5. 若远程 `gh-pages` 被外部改动导致 push 被拒，脚本停下提示，由你确认后手动 `git push --force-with-lease` 处理（绝不自动覆盖）

**本地预览（推送前可选）**：验证子路径资源可访问：

```bash
cd code/client && npx vite preview --outDir dist-static --base /FOCUS/
# 浏览器访问 http://localhost:4173/FOCUS/
```

> 本地预览亦可先行验证 PWA：localhost 属安全上下文，Service Worker 可注册——DevTools → Application 面板可见 Manifest/Service Workers/缓存，可勾选 Offline 后刷新验证离线可用。

## PWA 验收（部署后）

纯静态版为 PWA（manifest + Service Worker 离线缓存，见 `docs/adr/0015-static-pwa.md`）。部署后在手机上或 Chrome 验收：

1. **可安装**：手机浏览器打开 `https://baobingwen.github.io/FOCUS/`，Chrome/Edge 地址栏或菜单出现「安装应用/添加到主屏幕」入口（Android 多访问几次会自动横幅）；iOS Safari 用「分享 → 添加到主屏幕」（无自动提示）
2. **主屏启动**：从主屏图标打开为全屏独立窗口（无浏览器地址栏），标题「FOCUS 学习计时」、图标为蓝底 target
3. **离线可用**：断网/飞行模式后从主屏打开，页面正常加载，历史数据（IndexedDB）可查看、可继续学习计时
4. **更新生效**：再次部署新版后打开，页面自动刷新一次到新版（后台 SW 更新）；学习中被刷新的极端情形由计时快照恢复兜底
5. Lighthouse（可选）：Chrome DevTools → Lighthouse → 勾选 PWA 类别 → 生成报告查看安装/离线项

## 数据说明

IndexedDB 按**浏览器 origin** 隔离：

- 部署到 GitHub Pages 后，新 origin 下数据是全新起点（默认科目种子 + 空记录）
- 旧设备（服务端版或旧静态托管）的数据不会自动跟随——通过「管理模式 → 导出数据」下载 JSON，再到新地址「导入数据」完成迁移
- 清除站点数据 / 换浏览器 / 换设备，均需重新导入；重要数据建议定期导出备份

## 回滚

gh-pages 分支保留每次部署的提交历史（本地工作区 `code/.deploy-static/` 亦保留）。需要回滚时：

1. 回到上一次部署的提交：`cd code/.deploy-static && git checkout <旧部署提交>`（`git log` 查看提交号）
2. 或检出旧版本源码（如 `git checkout v0.5.0`，注意先保存当前未提交改动）后重新跑 `deploy-static.ps1`
3. 回滚内容确认无误后推送：`git push origin gh-pages`（快进）

## 常见问题

| 现象 | 处理 |
| ---- | ---- |
| 地址 404 | 确认 gh-pages 分支存在、Settings → Pages 已选 gh-pages 分支，等待部署完成 |
| 页面白屏 / 资源 404 | 确认浏览器访问路径为 `/FOCUS/`（含斜杠），子路径部署必须与 vite base 一致 |
| 数据为空 | IndexedDB 按 origin 隔离，首次部署本就没有数据；用旧版导出文件导入 |
| push 被拒 | 远程 gh-pages 存在未知改动（非快进），脚本已停下并提示；确认无误后手动 `cd code/.deploy-static && git push --force-with-lease origin gh-pages` |
