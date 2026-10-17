import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { PWA } from './src/pwa/pwa.constants.ts';
/** Vite emits a static shell; Express remains a separate self-hosted API. */
export default defineConfig({
  root: 'frontend',
  envDir: '..',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: PWA.name,
        short_name: PWA.shortName,
        description: PWA.description,
        lang: PWA.language,
        dir: PWA.direction,
        id: PWA.id,
        start_url: PWA.startUrl,
        scope: PWA.scope,
        display: 'standalone',
        theme_color: PWA.themeColor,
        background_color: PWA.backgroundColor,
        categories: ['finance', 'productivity'],
        icons: [
          { src: PWA.icon192, sizes: '192x192', type: 'image/png' },
          { src: PWA.icon512, sizes: '512x512', type: 'image/png' },
          { src: PWA.maskable, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Transactions', url: '/transactions', icons: [{ src: PWA.icon192, sizes: '192x192' }] },
          { name: 'Calendar', url: '/calendar', icons: [{ src: PWA.icon192, sizes: '192x192' }] },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,wasm}'],
        globIgnores: ['screenshots/**'],
        maximumFileSizeToCacheInBytes: 3000000,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-runtime', test: /node_modules\/\.pnpm\/(react|react-dom|scheduler)@/ },
            { name: 'router', test: /node_modules\/\.pnpm\/react-router/ },
          ],
        },
      },
    },
  },
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
});
