import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// GitHub Pages serves the project site from this sub-path.
const BASE = '/last-z-clone/';
const THEME = '#0b0f14';

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Phaser ships as one ~1.2 MB chunk; splitting it buys nothing here.
    chunkSizeWarningLimit: 1600,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // src/pwa.ts registers the worker itself so it can control update checks and reloads.
      injectRegister: false,
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
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json,webmanifest}'],
        // iOS fetches launch screens itself when the app is added to the Home Screen.
        globIgnores: ['**/splash/**'],
        // The Phaser bundle is well above workbox's 2 MiB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
