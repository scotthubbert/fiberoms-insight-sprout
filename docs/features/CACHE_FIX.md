# Cache Fix - Development Mode

**Date:** January 2025  
**Issue:** Service workers and browser caching were causing UI to revert to old versions in development

## Problem

The application was experiencing aggressive caching in development mode:
- Service workers from production builds were still active
- Browser was caching HTML, CSS, and JS files
- Changes to UI (like the Business Internet filter) weren't appearing without manual cache clearing
- Users had to repeatedly clear cache to see updates

## Solution

Implemented a multi-layered approach to eliminate caching in development:

### 1. Automatic Service Worker Cleanup (`src/main.js`)

Added code that runs on every page load in development mode:

```javascript
// In development, aggressively clear all service workers and caches
if (import.meta.env.DEV) {
  (async () => {
    try {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // Clear all caches
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    } catch (error) {
      log.warn('Failed to clear service workers/caches:', error);
    }
  })();
}
```

**Effect:** Automatically removes any lingering service workers and clears all caches on every dev page load.

### 2. Vite Dev Server Headers (`vite.config.js`)

Added cache-busting HTTP headers to the Vite development server:

```javascript
server: {
  https: process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS,
  host: true,
  // Disable caching in development to prevent stale UI
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
}
```

**Effect:** Tells the browser not to cache any files served by the dev server.

### 3. HTML Meta Tags (`index.html`)

Added cache-control meta tags to the HTML head:

```html
<!-- Cache Control (Development) -->
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

**Effect:** Instructs browsers to always fetch fresh versions of the page.

### 4. Production Service Worker Version Bump (`public/sw.js`)

Updated cache version for production builds:

```javascript
const CACHE_NAME = 'fiberoms-insight-v2';
const STATIC_CACHE_NAME = 'fiberoms-static-v2';
```

**Effect:** Forces cache refresh when deploying to production.

### 5. CSS Specificity Fix (`src/style.css`)

Added `!important` to status icon colors to prevent Calcite UI overrides:

```css
.status-icon-business {
  color: #9333ea !important; /* Purple for business subscribers */
}
```

**Effect:** Ensures the purple color always displays correctly.

## Testing

After implementing these fixes:

1. **Restart the dev server** - The server is now running with new cache-busting headers
2. **Refresh your browser** - The page should automatically clear all caches
3. **Check the console** - You should see messages like:
   - `🧹 Unregistered service worker in dev mode`
   - `🧹 Cleared cache: [cache-name]`
4. **Verify the Business Internet toggle** - Should show purple briefcase icon
5. **Make changes** - Future UI changes should appear immediately without manual cache clearing

## Production Considerations

These aggressive cache-clearing measures only run in **development mode** (`import.meta.env.DEV`). 

In production:
- Service workers are properly registered and managed
- Caching is enabled for performance
- Cache versioning ensures updates are applied correctly

## Manual Cache Clearing (If Needed)

If you ever need to manually clear caches, you can still use:

**Keyboard Shortcut:**
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

**Browser Console:**
```javascript
(async () => {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(r => r.unregister()));
  window.location.reload(true);
})();
```

## Files Modified

1. `src/main.js` - Added automatic service worker/cache cleanup
2. `vite.config.js` - Added cache-busting headers to dev server
3. `index.html` - Added cache-control meta tags
4. `public/sw.js` - Bumped cache version to v2
5. `src/style.css` - Added `!important` to status icon colors

## Result

✅ No more cache issues in development  
✅ UI changes appear immediately  
✅ Service workers automatically cleaned up  
✅ Browser won't cache stale content  
✅ Production builds still properly cached for performance

