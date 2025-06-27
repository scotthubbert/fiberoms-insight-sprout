import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.svg'],
      manifest: false, // We're using our own manifest.json
      injectRegister: 'auto',
      strategies: 'generateSW',
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/js\.arcgis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'arcgis-js-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/basemaps\.arcgis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'arcgis-basemap-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    https: true,
    host: true
  },
  build: {
    target: 'es2020',
    sourcemap: false, // Disable source maps in production for security and performance
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large dependencies into separate chunks for better caching
          'arcgis-core': ['@arcgis/core'],
          'arcgis-components': ['@arcgis/map-components'],
          'calcite-ui': ['@esri/calcite-components'],
          'vendor': ['@supabase/supabase-js']
        }
      }
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000
  }
});