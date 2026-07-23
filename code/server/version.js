// code/server/version.js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { version } = require('./package.json');

/**
 * 从 server/package.json 读取服务端版本号
 * @returns {string}
 */
export function getVersion() {
  return version;
}
