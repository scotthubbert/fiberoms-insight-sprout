import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import viteCompression from 'vite-plugin-compression';
import { execSync } from 'child_process';
import fs from 'fs';

// Get build information
function getBuildInfo() {
  const date = new Date();
  let gitHash = 'dev';
  let gitBranch = 'local';

  try {
    gitHash = execSync('git rev-parse --short HEAD').toString().trim();
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (e) {
    console.warn('Git information not available, using defaults');
  }

  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

  return {
    version: packageJson.version || '1.0.0',
    buildTime: date.toISOString(),
    buildDate: date.toLocaleDateString(),
    gitHash,
    gitBranch,
    buildId: `${packageJson.version}-${gitHash}`,
    environment: process.env.NODE_ENV || 'development'
  };
}

const buildInfo = getBuildInfo();

export default defineConfig({
  base: process.env.NODE_ENV === 'production'
    ? '/dev/insight/'
    : '/',

  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    reporters: 'default',
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html']
    }
  },
  define: {
    global: 'globalThis',
    __BUILD_TIME__: JSON.stringify(buildInfo.buildTime),
    __BUILD_VERSION__: JSON.stringify(buildInfo.version),
    __BUILD_HASH__: JSON.stringify(buildInfo.gitHash),
    __BUILD_BRANCH__: JSON.stringify(buildInfo.gitBranch),
    __BUILD_ID__: JSON.stringify(buildInfo.buildId),
    __BUILD_DATE__: JSON.stringify(buildInfo.buildDate),
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
      '@supabase/supabase-js',
      'dexie'
    ]
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@esri/calcite-components/dist/calcite/assets/**/*',
          dest: 'calcite/assets'
        },
        {
          src: 'node_modules/@arcgis/core/assets/esri/themes/light/main.css',
          dest: 'assets/esri/themes/light'
        },
        {
          src: 'node_modules/@arcgis/core/assets/esri/themes/dark/main.css',
          dest: 'assets/esri/themes/dark'
        },
        {
          src: 'node_modules/@arcgis/core/assets/esri/themes/base/fonts/**/*',
          dest: 'assets/esri/themes/base/fonts'
        }
      ]
    }),

    nodePolyfills({
      include: ['stream', 'util', 'buffer', 'process', 'http'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    }),

    ...(process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS ? [basicSsl()] : []),

    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false
    }),

    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false
    }),

    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.svg'],
      manifest: false,
      injectRegister: 'auto',
      strategies: 'generateSW',
      devOptions: {
        enabled: false,
        suppressWarnings: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: true,
        dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,

        // ✅ REQUIRED FIX FOR NON-ROOT DEPLOYMENT
        navigateFallback: '/dev/insight/index.html',

        navigateFallbackDenylist: [/^\/(api|storage)\//],
        navigationPreload: false,

        additionalManifestEntries: [],
        mode: 'production',

        manifestTransforms: [
          (manifestEntries) => {
            const manifest = manifestEntries.map(entry => {
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
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/(public|sign)\/(fsa-data|esri-files)\/.*\.geojson/i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'osp-geojson-skip',
              fetchOptions: {
                mode: 'cors'
              }
            }
          },
          {
            urlPattern: /^https:\/\/js\.arcgis\.com\/.*$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'arcgis-js-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              fetchOptions: {
                mode: 'cors',
                credentials: 'omit'
              },
              matchOptions: {
                ignoreVary: true
              }
            }
          },
          {
            urlPattern: /^https:\/\/basemaps\.arcgis\.com\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'arcgis-basemap-cache',
              expiration: {
                maxEntries: 5000,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              fetchOptions: {
                mode: 'cors',
                credentials: 'omit'
              },
              matchOptions: {
                ignoreVary: true
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5
              },
              cacheableResponse: {
                statuses: [0, 200, 204]
              },
              networkTimeoutSeconds: 10,
              fetchOptions: {
                mode: 'cors'
              },
              matchOptions: {
                ignoreVary: true
              }
            }
          }
        ]
      }
    }),

    {
      name: 'no-cache-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          next();
        });
      }
    }
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
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/@arcgis\/core\//.test(id)) {
              if (/\/(config|intl|request|kernel|core)/.test(id)) return 'vendor_arcgis-core';
              if (/\/geometry\//.test(id)) return 'vendor_arcgis-geometry';
              if (/\/layers\//.test(id)) return 'vendor_arcgis-layers';
              return 'vendor_arcgis-other';
            }
            if (/@arcgis\/map-components/.test(id)) return 'vendor_arcgis-widgets';
            if (/@esri\/calcite-components/.test(id)) return 'vendor_calcite';
            if (/@supabase\//.test(id)) return 'vendor_supabase';
            return 'vendor_other';
          }
        }
      },
      plugins: [
        ...(process.env.ANALYZE
          ? [
            visualizer({
              filename: 'dist/stats.html',
              template: 'treemap',
              gzipSize: true,
              brotliSize: true,
              open: false
            })
          ]
          : [])
      ]
    },
    chunkSizeWarningLimit: 1000,
    manifest: true,
    cssCodeSplit: true
  }
});