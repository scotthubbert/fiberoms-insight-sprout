import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { viteStaticCopy } from 'vite-plugin-static-copy';
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

  // Read package.json version
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
      '@arcgis/map-components',
      '@esri/calcite-components',
      '@supabase/supabase-js',
      'dexie'
    ]
  },
  plugins: [
    // Copy essential assets for production build
    viteStaticCopy({
      targets: [
        // Copy ALL CalciteUI assets (complete approach)
        {
          src: 'node_modules/@esri/calcite-components/dist/calcite/assets/**/*',
          dest: 'calcite/assets'
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
        // Disable navigation preload completely
        navigationPreload: false,
        // Add custom service worker code
        additionalManifestEntries: [],
        mode: 'production',
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
          // Skip service worker caching for OSP GeoJSON data - handled by IndexedDB
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/(public|sign)\/(fsa-data|esri-files)\/.*\.geojson/i,
            handler: 'NetworkOnly',
            options: {
              // Let our IndexedDB cache handle these files
              cacheName: 'osp-geojson-skip',
              fetchOptions: {
                mode: 'cors'
              }
            }
          },
          {
            urlPattern: /^https:\/\/js\.arcgis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'arcgis-js-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
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
            urlPattern: /^https:\/\/basemaps\.arcgis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'arcgis-basemap-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 3 // 3 days
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
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
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