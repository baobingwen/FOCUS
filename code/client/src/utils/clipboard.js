// code/client/src/utils/clipboard.js
/**
 * 复制文本到剪贴板
 * 优先 navigator.clipboard（仅安全上下文 HTTPS/localhost 可用），
 * 失败或不存在时降级为隐藏 textarea + document.execCommand('copy')，
 * 兼容 Tailscale 手机 HTTP 访问。
 * @param {string} text
 * @returns {Promise<boolean>} 是否复制成功
 */
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // 权限被拒等 → 走降级路径
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  let ok = false;
  try {
    ta.select();
    ok = document.execCommand('copy');
  } catch (err) {
    ok = false;
  } finally {
    ta.remove();
  }
  return ok;
}
