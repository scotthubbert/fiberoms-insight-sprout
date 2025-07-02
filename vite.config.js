import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  resolve: {
    conditions: ['import', 'module', 'browser', 'default'],
    mainFields: ['module', 'main', 'browser']
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020'
    },
    include: [
      '@arcgis/core/intl',
      '@arcgis/map-components',
      '@esri/calcite-components',
      '@supabase/supabase-js'
    ]
  },
  plugins: [
    // Copy essential assets for production build
    viteStaticCopy({
      targets: [
        // Copy only the specific icons we actually use (much more efficient than copying 3,945 icons)
        // Fixed: Use 'spinner' instead of 'loading' and only copy sizes that exist
        ...['search', 'layer', 'apps', 'circle', 'polygon', 'line', 'ellipsis', 'rain',
          'exclamationMarkTriangle', 'flash', 'car', 'person', 'information', 'clock',
          'spinner', 'arrowRight', 'refresh', 'brightness', 'download', 'x',
          'users', 'linkChart', 'layers'].flatMap(iconName => {
            return [16, 24, 32].map(size => ({
              src: `node_modules/@esri/calcite-components/dist/calcite/assets/icon/${iconName}${size}.json`,
              dest: 'calcite/assets/icon',
              // Don't fail if the icon doesn't exist in this size
              noErrorOnMissing: true
            }));
          }),
        // Copy ArcGIS theme CSS files for proper theming
        {
          src: 'node_modules/@arcgis/core/assets/esri/themes/light/main.css',
          dest: 'assets/esri/themes/light'
        },
        {
          src: 'node_modules/@arcgis/core/assets/esri/themes/dark/main.css',
          dest: 'assets/esri/themes/dark'
        }
      ]
    }),
    // Node.js polyfills for Supabase compatibility
    nodePolyfills({
      // Only polyfill what Supabase needs
      include: ['stream', 'util', 'buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    }),
    // Only use SSL in production or when explicitly requested
    ...(process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.svg'],
      manifest: false, // We're using our own manifest.json
      injectRegister: 'auto',
      strategies: 'generateSW',
      devOptions: {
        enabled: true,
        suppressWarnings: true // Suppress PWA warnings in dev without HTTPS
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB to handle large ArcGIS chunks
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
    https: process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS,
    host: true
  },
  build: {
    target: 'es2020',
    sourcemap: false, // Disable source maps in production for security and performance
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      external: [],
      // Remove manual chunking - let Vite handle optimization automatically
      // This prevents circular dependency issues and follows best practices
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000
  }
});