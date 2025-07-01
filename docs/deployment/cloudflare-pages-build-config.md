# Cloudflare Pages Build Configuration

**Date**: January 1, 2025  
**Purpose**: Build configuration for deploying FiberOMS Insight PWA to Cloudflare Pages

## Build Settings

### Framework Preset
- **Framework**: None (Custom Vite build)

### Build Command
```bash
npm run build
```

### Build Output Directory
```
dist
```

### Root Directory
```
/
```

### Environment Variables
Set these in Cloudflare Pages dashboard:
```
VITE_ARCGIS_API_KEY=your_arcgis_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_GEOTAB_USERNAME=mygeotab_user
VITE_GEOTAB_PASSWORD=mygeotab_pass
VITE_GEOTAB_DATABASE=mygeotab_db
```

## Build Configuration Details

### Vite Configuration Updates
The following changes were made to `vite.config.js` to ensure compatibility:

1. **Module Resolution**:
   ```javascript
   resolve: {
     conditions: ['import', 'module', 'browser', 'default'],
     mainFields: ['module', 'main', 'browser']
   }
   ```

2. **Dependency Optimization**:
   ```javascript
   optimizeDeps: {
     esbuildOptions: {
       target: 'es2020'
     },
     include: [
       '@arcgis/core/intl',
       '@esri/calcite-components',
       '@supabase/supabase-js'
     ]
   }
   ```

3. **PWA Configuration**:
   - Increased `maximumFileSizeToCacheInBytes` to 15MB to handle large ArcGIS chunks
   - This ensures the service worker can cache the mapping libraries

4. **Build Options**:
   - CommonJS transformation enabled for mixed ES modules
   - Manual chunking function for optimal code splitting
   - Disabled source maps for production

## Known Issues and Solutions

### 1. ArcGIS Module Resolution
**Issue**: `Failed to resolve entry for package "@arcgis/core"`
**Solution**: Added proper resolve configuration and optimizeDeps settings

### 2. Large Chunk Warnings
**Issue**: ArcGIS core library creates 12MB chunks
**Solution**: This is expected and handled by:
- Increasing PWA cache limit
- Manual chunk splitting
- Runtime caching for map assets

### 3. Node.js Module Warnings
**Issue**: Warnings about stream, http, url modules from Supabase
**Solution**: These warnings are expected and harmless:
- Supabase includes `node-fetch` which references Node.js modules
- Vite properly externalizes these for browser compatibility
- The warnings don't affect functionality - Supabase handles browser compatibility internally
- No polyfills needed - adding them causes more issues than they solve

## Performance Considerations

1. **Code Splitting**: Libraries are split into separate chunks:
   - `arcgis-core`: ArcGIS mapping library
   - `arcgis-components`: ArcGIS UI components
   - `calcite-ui`: Calcite design system
   - `vendor`: Supabase and other utilities

2. **Caching Strategy**: PWA service worker caches:
   - All static assets
   - ArcGIS JavaScript API resources
   - Basemap tiles

3. **Build Size**: Total build ~15MB (3.5MB gzipped)
   - Acceptable for enterprise mapping application
   - Cached by service worker for offline use

## Deployment Checklist

- [ ] Set all environment variables in Cloudflare dashboard
- [ ] Verify build command: `npm run build`
- [ ] Verify output directory: `dist`
- [ ] Enable Auto Deployments for main branch
- [ ] Configure custom domain (if applicable)
- [ ] Test PWA installation after deployment
- [ ] Verify service worker registration
- [ ] Test offline functionality

## Build Logs Reference

Successful build output should show:
```
✓ built in ~12s
PWA v1.0.0
mode      generateSW
precache  72 entries (14959.54 KiB)
files generated
  dist/sw.js
  dist/workbox-74f2ef77.js
```

## Troubleshooting

If build fails on Cloudflare:
1. Check environment variables are set correctly
2. Verify Node.js version (should use latest LTS)
3. Clear build cache and retry
4. Check build logs for specific errors
5. Ensure all dependencies are in package.json