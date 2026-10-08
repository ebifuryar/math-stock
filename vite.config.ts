// vite.config.ts
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 新しい版の配信時は画面で更新を確認する（解答中に勝手に再読み込みしないため）
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        id: '/',
        name: '数学ストック｜出題者目線で学ぶ高校数学',
        short_name: '数学ストック',
        description: '高校数学を学校数学から入試レベルまで、出題者目線のメタデータ付きで復習する学習アプリ',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#1e3a8a',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 教材JSONもプリキャッシュし、初回起動後は全単元をオフラインで解けるようにする
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,json}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // 本体チャンクは React・Zod・Dexie などで約175KB(gzip)。Service Worker でキャッシュされ2回目以降は通信しないため許容する
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // グラフ描画ライブラリは分析画面でしか使わないので別チャンクにする
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts';
          if (id.includes('node_modules/katex')) return 'katex';
          return undefined;
        },
      },
    },
  },
});
