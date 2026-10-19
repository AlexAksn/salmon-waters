import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served at the root of salmonwaters.ca (public/CNAME). A fork on <you>.github.io/<repo>/ sets BASE_PATH=/<repo>/ in the workflow.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    // No offline caching: the service worker is kept only as a self-destroying stub (2026-10-19) so browsers that
    // installed the earlier caching worker on this origin unregister it and drop its caches. The plugin still
    // writes the web manifest, which is what "Add to Home Screen" needs.
    VitePWA({
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Salmon Waters · BC',
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
    }),
  ],
  build: { target: 'es2020', sourcemap: false },
});
