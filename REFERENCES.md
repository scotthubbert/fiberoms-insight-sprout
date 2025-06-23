  # FiberOMS Insight PWA - Development References

  ## Primary Documentation

  ### ArcGIS Maps SDK for JavaScript
  - **Main Documentation**: https://developers.arcgis.com/javascript/latest/
  - **Map Components Guide**: https://developers.arcgis.com/javascript/latest/components/
  - **Tutorials**: https://developers.arcgis.com/javascript/latest/tutorials/
  - **API Reference**: https://developers.arcgis.com/javascript/latest/api-reference/

  ### Key ArcGIS Tutorials We're Following
  - **Map Components Tutorial**: https://developers.arcgis.com/javascript/latest/tutorials/create-a-web-app-using-components/
  - **Blog Post (Our Primary Guide)**:
  https://www.esri.com/arcgis-blog/products/js-api-arcgis/developers/build-gis-web-apps-with-javascript-maps-sdk-components
  - **Layer Management**: https://developers.arcgis.com/javascript/latest/sample-code/layers-portal/
  - **Mobile Best Practices**: https://developers.arcgis.com/javascript/latest/guide/best-practices/

  ### Calcite Design System
  - **Components Library**: https://developers.arcgis.com/calcite-design-system/components/
  - **Design Tokens**: https://developers.arcgis.com/calcite-design-system/foundations/
  - **Mobile Patterns**: https://developers.arcgis.com/calcite-design-system/patterns/

  ## PWA Development

  ### Service Workers & Caching
  - **Workbox**: https://developers.google.com/web/tools/workbox
  - **PWA Checklist**: https://web.dev/pwa-checklist/
  - **Offline First**: https://web.dev/offline-cookbook/

  ### Mobile Performance
  - **Core Web Vitals**: https://web.dev/vitals/
  - **Mobile Performance**: https://web.dev/mobile/
  - **3G Testing**: https://developers.google.com/web/tools/chrome-devtools/network#throttle

  ## Build Tools

  ### Vite Configuration
  - **Vite Guide**: https://vitejs.dev/guide/
  - **Bundle Analysis**: https://vitejs.dev/guide/build.html#build-optimizations
  - **PWA Plugin**: https://vite-pwa-org.netlify.app/

  ## API Integrations

  ### Supabase
  - **JavaScript Client**: https://supabase.com/docs/reference/javascript
  - **Real-time**: https://supabase.com/docs/guides/realtime

  ### MyGeotab API
  - **API Documentation**: https://my.geotab.com/sdk/
  - **JavaScript Examples**: https://github.com/Geotab/sdk-js-samples

  ### RainViewer Weather
  - **API Documentation**: https://www.rainviewer.com/api.html
  - **Tile Integration**: https://www.rainviewer.com/api/weather-maps-api.html

  ## Code Examples & Patterns

  ### ArcGIS Code Samples
  - **Layer Loading**: https://developers.arcgis.com/javascript/latest/sample-code/layers-geojson/
  - **Mobile Navigation**: https://developers.arcgis.com/javascript/latest/sample-code/widgets-fullscreen/
  - **Search Widget**: https://developers.arcgis.com/javascript/latest/sample-code/widgets-search-3d/

  ### PWA Examples
  - **ArcGIS PWA Sample**: https://github.com/Esri/jsapi-resources/tree/master/pwa
  - **Mobile-First Examples**: https://github.com/Esri/calcite-design-system/tree/dev/packages/calcite-components/src/components

  ## Performance & Testing

  ### Testing Tools
  - **Lighthouse**: https://developers.google.com/web/tools/lighthouse
  - **WebPageTest**: https://www.webpagetest.org/
  - **Chrome DevTools**: https://developers.google.com/web/tools/chrome-devtools

  ### ArcGIS Performance
  - **Best Practices**: https://developers.arcgis.com/javascript/latest/performance-best-practices/
  - **Memory Management**: https://developers.arcgis.com/javascript/latest/guide/managing-memory/

  ## Enterprise Deployment

  ### Security Considerations
  - **Content Security Policy**: https://developers.arcgis.com/javascript/latest/guide/csp/
  - **HTTPS Requirements**: https://developers.arcgis.com/javascript/latest/guide/https-required/

  ### Build Optimization
  - **Tree Shaking**: https://developers.arcgis.com/javascript/latest/guide/using-webpack/
  - **Chunk Optimization**: https://vitejs.dev/guide/build.html#chunking-strategy

  ## Troubleshooting References

  ### Common Issues
  - **Module Loading**: https://developers.arcgis.com/javascript/latest/guide/troubleshooting/
  - **Mobile Debugging**: https://developers.google.com/web/tools/chrome-devtools/remote-debugging
  - **PWA Debugging**: https://web.dev/debug-pwas/

  ### Browser Compatibility
  - **ArcGIS Support**: https://developers.arcgis.com/javascript/latest/system-requirements/
  - **PWA Support**: https://caniuse.com/serviceworkers

  .vscode/settings.json (for VSCode users)

  {
    "emmet.includeLanguages": {
      "javascript": "html"
    },
    "files.associations": {
      "*.js": "javascript"
    },
    "editor.codeActionsOnSave": {
      "source.fixAll": true
    },
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "typescript.preferences.importModuleSpecifier": "relative"
  }

  .vscode/extensions.json (recommended extensions)

  {
    "recommendations": [
      "esbenp.prettier-vscode",
      "bradlc.vscode-tailwindcss",
      "ms-vscode.vscode-typescript-next",
      "formulahendry.auto-rename-tag",
      "christian-kohler.path-intellisense",
      "ms-vscode.vscode-json"
    ]
  }

  .gitignore

  # Dependencies
  node_modules/

  # Build outputs
  dist/
  dist-modern/

  # Environment variables
  .env
  .env.local
  .env.production

  # Cache
  .vite/
  *.log

  # OS generated files
  .DS_Store
  Thumbs.db

  # IDE
  .vscode/settings.local.json
  .idea/

  # Runtime
  *.pid
  *.seed
  *.log

  # Coverage
  coverage/

  Additional Quick Reference File: QUICK_START.md

  # Quick Start Guide

  ## Development Setup
  1. `npm install`
  2. Copy `.env.example` to `.env` and add your API keys
  3. `npm run dev`
  4. Open http://localhost:3000

  ## Key Directories
  - `src/` - Application source code
  - `public/` - Static assets and PWA files
  - `public/icons/` - PWA app icons (need to be created)

  ## Essential Commands
  - `npm run dev` - Development server
  - `npm run build` - Production build
  - `npm run preview` - Test production build locally

  ## Phase 1 Checklist
  - [ ] Map loads with satellite basemap
  - [ ] Theme toggle works (moon/sun icon)
  - [ ] Responsive on mobile and desktop
  - [ ] PWA manifest validates
  - [ ] Service worker registers
  - [ ] No console errors

  ## Testing URLs
  - Desktop: http://localhost:3000
  - Mobile: http://[your-ip]:3000 (for device testing)

  ## Key Files to Know
  - `src/main.js` - Main application entry
  - `src/style.css` - Mobile-first styles
  - `vite.config.js` - Build configuration
  - `public/manifest.json` - PWA configuration

  These references will save you hours of searching and provide the exact patterns you need for each phase. The most important ones
   are:

  1. The Esri blog post - Your primary architectural guide
  2. ArcGIS Map Components tutorial - For declarative patterns
  3. Calcite Components library - For UI consistency
  4. PWA checklist - For mobile app functionality

  Add these to your new repo and you'll have everything needed to build systematically! 🚀
