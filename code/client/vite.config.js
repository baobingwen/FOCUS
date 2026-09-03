import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const APP_VERSION = pkg.version;

const PWA_MANIFEST = {
  name: 'FOCUS 学习计时',
  short_name: 'FOCUS',
  description: '极简学习计时器（考研备考）',
  lang: 'zh-CN',
  display: 'standalone',
  theme_color: '#f8f9fa',
  background_color: '#f8f9fa',
};

export default defineConfig(({ mode }) => {
  const isStatic = mode === 'static';
  const base = isStatic ? '/FOCUS/' : '/';
  return {
    plugins: [
      react(),
      ...(isStatic
        ? [
            VitePWA({
              registerType: 'autoUpdate', // 新版部署后下次打开自动刷新生效（计时数据由快照兜底）
              injectRegister: 'auto', // 复用 public/registerSW.js（完整 autoUpdate 注册，非插件极简版）
              manifest: {
                ...PWA_MANIFEST,
                start_url: base,
                scope: base,
                icons: [
                  { src: `${base}pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
                  { src: `${base}pwa-512x512.png`, sizes: '512x512', type: 'image/png' },
                  {
                    src: `${base}maskable-icon-512x512.png`,
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
                // Rich Install UI：移动端（narrow）+ 桌面端（wide）各一（web.dev/richer-install-ui）
                screenshots: [
                  {
                    src: `${base}screenshots/phone.png`,
                    sizes: '1316x2646',
                    type: 'image/png',
                    form_factor: 'narrow',
                    label: 'FOCUS 学习计时（手机）',
                  },
                  {
                    src: `${base}screenshots/desktop.png`,
                    sizes: '2154x1406',
                    type: 'image/png',
                    form_factor: 'wide',
                    label: 'FOCUS 学习计时（桌面）',
                  },
                ],
              },
              workbox: {
                navigateFallback: 'index.html',
                globPatterns: ['**/*.{js,css,html,svg,png}'],
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        // 双版本共用导入校验模块（code/shared），服务端经相对路径引用
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
    base,
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
