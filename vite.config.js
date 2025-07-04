import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  define: {
    global: 'globalThis',
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
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
        // Copy only the specific icons we actually use
        ...['search', 'layer', 'apps', 'circle', 'polygon', 'line', 'ellipsis', 'rain',
          'exclamationMarkTriangle', 'flash', 'car', 'person', 'information', 'clock',
          'spinner', 'arrowRight', 'refresh', 'brightness', 'download', 'x',
          'users', 'linkChart', 'layers', 'triangle', 'organization', 'utilityNetwork', 'utility-network', 'diamond', 'square',
          // Popup action icons
          'duplicate', 'map', 'pinTear', 'check',
          // ArcGIS popup widget icons
          'dockRight', 'magnifyingGlassPlus', 'tables', 'minimize',
          // ArcGIS Map widget icons
          'zoomOutFixed', 'zoomInFixed', 'compassNorthCircle', 'home', 'chevronsRight',
          'basemap', 'pause', 'moon', 'chevronUp', 'chevronDown', 'chevronLeft', 'chevronRight',
          // Additional icons for list items and UI elements
          'close', 'checkCircle', 'xCircle', 'gear', 'loading', 'chevron-right',
          'chevron-left', 'chevron-up', 'chevron-down', 'link-chart', 'link', 'warning',
          // Notice component icons
          'exclamationMarkCircle', 'checkCircleF', 'exclamationMarkTriangleF', 'informationF'
        ].flatMap(iconName => {
          return [16, 24, 32].map(size => ({
            src: `node_modules/@esri/calcite-components/dist/calcite/assets/icon/${iconName}${size}.json`,
            dest: 'calcite/assets/icon',
            noErrorOnMissing: true
          }));
        }),
        // Copy minimal t9n files
        {
          src: 'node_modules/@esri/calcite-components/dist/calcite/assets/t9n/en.json',
          dest: 'calcite/assets/t9n'
        },
        // Copy ArcGIS theme CSS files for proper theming
        {
          src: 'node_modules/@arcgis/core/assets/esri/themes/light/main.css',
          dest: 'assets/esri/themes/light'
        },
        {
          src: 'node_modules/@arcgis/core/assets/esri/themes/dark/main.css',
          dest: 'assets/esri/themes/dark'
        },
        // Copy ArcGIS fonts for proper text rendering
        {
          src: 'node_modules/@arcgis/core/assets/esri/themes/base/fonts/**/*',
          dest: 'assets/esri/themes/base/fonts'
        }
      ]
    }),
    // Node.js polyfills for Supabase compatibility
    nodePolyfills({
      // Only polyfill what Supabase needs
      include: ['stream', 'util', 'buffer', 'process', 'http'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    }),
    // Only use SSL in production or when explicitly requested
    ...(process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS ? [basicSsl()] : []),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.svg'],
      manifest: false,
      injectRegister: 'auto',
      strategies: 'generateSW',
      devOptions: {
        enabled: true,
        suppressWarnings: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Add revision info to ensure cache busting
        dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
        // Navigation fallback for SPA
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(api|storage)\//],
        // Force update on navigation
        navigationPreload: true,
        // Add custom cache headers
        manifestTransforms: [
          (manifestEntries) => {
            const manifest = manifestEntries.map(entry => {
              // Force revision for HTML files
              if (entry.url.endsWith('.html')) {
                entry.revision = Date.now().toString();
              }
              return entry;
            });
            return { manifest };
          }
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/js\.arcgis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'arcgis-js-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/basemaps\.arcgis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'arcgis-basemap-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 3 // 3 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
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
  preview: {
    https: false,
    host: true
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      external: [],
      output: {
        // Ensure consistent hashing for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    chunkSizeWarningLimit: 1000,
    // Generate manifest for tracking file versions
    manifest: true,
    // Ensure CSS is extracted with hash
    cssCodeSplit: true
  }
});