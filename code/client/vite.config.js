import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const APP_VERSION = pkg.version;

export default defineConfig(({ mode }) => {
  const isStatic = mode === 'static';
  return {
    plugins: [react()],
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
