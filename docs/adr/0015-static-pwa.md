# 0015: 纯静态版 PWA 化 — 可安装 + Service Worker 离线缓存

## 背景

纯静态版（v0.5.1 起可部署 GitHub Pages，见 ADR 0011）形态为无后端 SPA + 浏览器 IndexedDB，静态托管天然适合 PWA：可添加到手机主屏幕像原生 App 一样使用、断网离线仍能查看/记录。ROADMAP P1「PWA 手机桌面化」与「开发中」的讨论思路确认落地：以纯静态版为 PWA 化目标，服务端版暂不做完整离线。

当前条件：Vite 8 + React SPA，`vite.config.js` 已按 mode 区分 `/` 与 `/FOCUS/` base（static 模式部署 GitHub Pages 子路径），GitHub Pages 为 HTTPS 适合 Service Worker；但项目无 `vite-plugin-pwa`、无 manifest、无 Service Worker、无独立图标资源（favicon 为内联 SVG emoji），`index.html` 仅有部分 apple/theme meta。

## 决策

1. **仅在 static 模式注入 PWA**：`vite.config.js` 中 `mode === 'static'` 时才启用 `vite-plugin-pwa` 插件，普通（服务端版）构建完全不加载——服务端版构建产物与现状零差异，验收「服务端版构建不受影响」天然满足。服务端版经 Tailscale `http://IP:3001` 访问非安全上下文，SW 无法注册，暂不纳入（后续 HTTPS 化时再评估）。
2. **依赖版本**：`vite-plugin-pwa` ^1.3.0（peerDependencies 显式支持 `vite: ^8.0.0`，与项目 Vite 8.1.3 匹配；自带 workbox-build/workbox-window 依赖，无需另装）。
3. **图标**：新建 SVG 源文件于 `public/`，用 `@vite-pwa/assets-generator` 生成全套——192/512 PNG、maskable、apple-touch-icon，输出为 `public/` 下的独立文件，由 manifest 引用。图案采用 flat-color-icons「target」图形（作者 Mary Akveo，PD 许可，用户确认）：`icon.svg` 为 blue-500 `#3b82f6` 圆角方块底 + 白色靶环 + 青色命中箭头（`#7dd3fc`）；`icon-maskable.svg` 为 maskable 专用源（满幅无圆角底 + 内容缩入 80% 安全区，适配系统遮罩裁切）。SVG 源留存 `public/`，日后换设计只改源文件重新生成。图标是资源文件不是代码内嵌（软编码原则）；后续换图标流程：用户提供 SVG → 改源文件重新生成。
4. **SW 更新策略：`registerType: 'autoUpdate'`**——新版部署后用户下次打开页面，新 SW 安装完成自动刷新一次生效，零 UI 提示。学习中被打断的极端情形（长时间挂着的页面恰好跨过 SW 更新检查点）由 v0.5.2 计时快照（ADR 0012）兜底：刷新后自动恢复计时，数据不丢。不为「学习中暂不刷新」做自定义延迟逻辑（复杂度高、收益小，个人工具发版频率低）。
5. **注册方式：自定义 `public/registerSW.js`**：`vite-plugin-pwa` 检测到 public/ 下存在该文件即复用、不再生成极简注册版——脚本提供 autoUpdate 完整语义（相对路径注册 scope `./`，监听新 SW 安装：更新后 activated 且已有 controller 时 `location.reload()` 一次，首次安装不刷新）。**不修改 `main.jsx`、不引入 virtual module**——客户端 React 代码零改动，现有 347 条 client 测试全部零影响，只需全量回归。
6. **manifest 元数据**：`name` = 「FOCUS 学习计时」、`short_name` = 「FOCUS」、`display` = `standalone`（全屏近原生体验）、`theme_color`/`background_color` 沿用 `#f8f9fa`（页面背景灰）。软编码：manifest 元数据集中定义在 `vite.config.js` 一处常量，`index.html` 对应 meta 不散落重复来源。
7. **子路径适配（static base `/FOCUS/`）**：`scope` / `start_url` 由 `isStatic` 统一派生为 `/FOCUS/`，不手写散落；`navigateFallback` 用相对 `'index.html'`（workbox 按 SW 所在目录解析，等效 `/FOCUS/index.html`）。
8. **Rich Install UI（screenshots）**：manifest `screenshots` 提供两张真实应用截图——`public/screenshots/phone.png`（1316×2646，`form_factor: narrow`，移动端）+ `public/screenshots/desktop.png`（2154×1406，`form_factor: wide`，桌面端），满足 Chromium 增强安装界面要求（宽高 ≥320、最大尺寸不超过最小尺寸 2.3 倍、PNG、需 sizes/type），消除 Edge/Chrome「更丰富的 PWA 安装 UI 不可用」警告、提升 Android Chrome/Edge 安装入口可见性；截图由用户提供后压缩入库。
9. **离线范围**：vite-plugin-pwa 默认预缓存全部构建产物（html/js/css/图标/截图），纯静态版无网络 API（数据全在 IndexedDB），无 runtime 缓存需求；断网打开即用，IndexedDB 数据离线可读写。
10. **开发体验**：dev 模式（`npm run dev:static`）不启用 SW（插件 dev 默认关闭），开发热更新不受影响；本地用 `npx vite preview --outDir dist-static --base /FOCUS/`（localhost 属安全上下文）即可先行验证安装/离线。
11. **不做安装引导、不含通知**：安装引导靠浏览器原生能力（Android 自动横幅 / iOS 手动分享）；通知/定时提醒为 P0 候选方向，另起迭代单独评估。HarmonyOS 华为浏览器与虚拟容器内 Chrome 等对 PWA 安装支持弱属浏览器能力限制，非应用缺陷。

## 影响

- **产物**：`dist-static` 新增 `manifest.webmanifest`（含 icons + screenshots）、`sw.js`、workbox 运行时、`public/` 图标文件与 `screenshots/` 截图；`deploy-static.ps1` 同步 `dist-static` 全部内容，无需改动即自动带上新产物。
- **构建形态**：普通 `npm run build`（服务端版 `dist/`）产物不变；`index.html` 增补 apple-touch-icon/manifest 链接与必要 meta（static 产物）。
- **测试**：客户端 React 源码零改动 → 测试仅全量回归（预期 347 条全绿、用例数不变）；构建脚本层面做双构建验证（dist / dist-static 均成功，dist-static 含 PWA 产物）。
- **验收（本地）**：`dist-static` 含 manifest/sw.js/图标；`vite preview` 本地可安装、断网刷新可用；普通服务端版构建无 PWA 痕迹。GitHub Pages 实际部署验收（Lighthouse 安装项 / 真机离线）由用户在部署后自行执行。

## 关联

- 相关概念见 CONTEXT.md「纯静态版 / 服务端版（双版本）」。
- 承接 ADR 0011（无后端 Local-First：纯静态版形态基础）、ADR 0012（计时快照：SW 自动更新打断计时的数据兜底）。
- 部署与数据迁移说明见 `code/DEPLOY_STATIC.md`；图标/配置软编码原则贯彻到 `vite.config.js` 与资源文件。
