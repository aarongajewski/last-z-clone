import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the project site from this sub-path.
const BASE = '/last-z-clone/';
const THEME = '#0b0f14';

export default defineConfig({
  base: BASE,
  build: {
    target: 'es2022',
    sourcemap: false,
    // Phaser ships as one ~1.2 MB chunk; splitting it buys nothing here.
    chunkSizeWarningLimit: 1600,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        id: BASE,
        name: 'Last Z Clone',
        short_name: 'Last Z',
        description: 'Browser clone of Last Z: Survival Shooter.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: THEME,
        theme_color: THEME,
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        // The Phaser bundle is well above workbox's 2 MiB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
