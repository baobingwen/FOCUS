// code/server/version.js
import { execSync } from 'child_process';

/**
 * 从 git tag 读取当前版本号
 * 格式：v0.2.0 / v0.2.0-3-ge28d8fe / dev
 * 无 git 环境时返回 'dev'
 * @returns {string}
 */
export function getVersion() {
  try {
    return execSync('git describe --tags --always --dirty', {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
  } catch {
    return 'dev';
  }
}
