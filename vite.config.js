import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base must match the GitHub Pages repo name so asset URLs resolve at
// https://<user>.github.io/ChessAnalysis/
export default defineConfig({
  base: '/ChessAnalysis/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We ship our own public/manifest.webmanifest, so let the plugin only
      // generate the service worker.
      manifest: false,
      workbox: {
        // Precache the app shell + the big static data/engine assets so the
        // whole thing works offline.
        globPatterns: ['**/*.{js,css,html,svg,wasm,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
})
