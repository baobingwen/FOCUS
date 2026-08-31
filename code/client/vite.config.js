import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const APP_VERSION = pkg.version;

export default defineConfig(({ mode }) => {
  const isStatic = mode === 'static';
  return {
    plugins: [react()],
    resolve: {
      alias: {
        // 双版本共用导入校验模块（code/shared），服务端经相对路径引用
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
    base: isStatic ? '/FOCUS/' : '/', // 纯静态版部署 GitHub Pages 子路径 /FOCUS/
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [path.resolve(__dirname, '..')], // 放行 code/shared 共享模块（dev server 源码读取）
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
  };
});
