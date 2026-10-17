import { defineConfig } from '@vite-pwa/assets-generator/config';
/** All PNG and ICO variants derive from the same safe-zone SVG artwork. */
export default defineConfig({
  images: ['frontend/public/icons/source.svg'],
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[64, 'favicon.ico']] },
    maskable: { sizes: [512], padding: 0.15, resizeOptions: { background: '#315c46' } },
    apple: { sizes: [180], padding: 0.15, resizeOptions: { background: '#315c46' } },
  },
});
