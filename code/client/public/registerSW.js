// FOCUS 纯静态版 PWA — Service Worker 注册（autoUpdate 语义，见 docs/adr/0015-static-pwa.md）
// 插件检测到 public/ 下存在本文件即直接复用（不生成极简版）。
// 语义：注册后检测新版本 → 新版 SW 安装激活后自动刷新页面一次使新版生效；
// 若刷新恰逢学习中，计时快照（focus:timer:snapshot）会自动恢复，数据不丢。
// 相对路径注册：页面位于子路径（/FOCUS/），sw.js 与页面同目录，scope 为当前目录。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js', { scope: './' })
      .then((reg) => {
        watchInstalling(reg);
        reg.addEventListener('updatefound', () => watchInstalling(reg));
      })
      .catch(() => {
        /* 注册失败不打扰用户（如隐私模式），静默忽略 */
      });
  });
}

function watchInstalling(reg) {
  const worker = reg.installing || reg.waiting;
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    // 仅「更新后激活」自动刷新（首次安装时页面尚无 controller，不刷新）
    if (worker.state === 'activated' && navigator.serviceWorker.controller) {
      window.location.reload();
    }
  });
}
