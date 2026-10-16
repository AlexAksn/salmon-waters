import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves project sites under /<repo>/; the workflow passes BASE_PATH accordingly.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Salmon Waters · Lower Mainland',
        short_name: 'Salmon Waters',
        description: 'Where can I fish for salmon right now? DFO Region 2 openings, closures, boundaries and river flows.',
        theme_color: '#1f5f8b',
        background_color: '#0d1317',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // App shell is precached. Region data JSON is cached on first use instead (precaching it would download every region's 2 MB base map up front).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          // Status files are small and change between builds: network first, so a new notice shows on the next load rather than the one after.
          { urlPattern: /\/data\/[^/]+\/(notices|dfo-status)\.json$/, handler: 'NetworkFirst', options: { cacheName: 'status', networkTimeoutSeconds: 5, expiration: { maxEntries: 16 } } },
          { urlPattern: /\/data\/.+\.json$/, handler: 'StaleWhileRevalidate', options: { cacheName: 'data', expiration: { maxEntries: 16 } } },
          { urlPattern: /^https:\/\/api\.weather\.gc\.ca\//, handler: 'NetworkFirst', options: { cacheName: 'hydrometric', networkTimeoutSeconds: 10, expiration: { maxEntries: 80, maxAgeSeconds: 6 * 3600 } } },
          { urlPattern: /^https:\/\/(tile\.openstreetmap\.org|[abc]\.tile\.opentopomap\.org|server\.arcgisonline\.com|api\.maptiler\.com)\//, handler: 'CacheFirst', options: { cacheName: 'tiles', expiration: { maxEntries: 800, maxAgeSeconds: 14 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 3600 } } },
        ],
      },
    }),
  ],
  build: { target: 'es2020', sourcemap: false },
});
