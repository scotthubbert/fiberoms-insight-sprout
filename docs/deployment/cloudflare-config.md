# Cloudflare Configuration for FiberOMS Insight PWA

## Important: Cloudflare Pages Settings

To ensure your static URL (`pwa.fiberoms.com`) always shows the latest deployment, you need to configure the following in your Cloudflare dashboard:

### 1. Page Rules (if using Cloudflare CDN)

Create these page rules for `pwa.fiberoms.com`:

```
URL: pwa.fiberoms.com/*
Settings:
- Cache Level: Bypass
- Always Use HTTPS: On
```

```
URL: pwa.fiberoms.com/index.html
Settings:
- Cache Level: Bypass
- Browser Cache TTL: Respect Existing Headers
```

```
URL: pwa.fiberoms.com/assets/*
Settings:
- Cache Level: Standard
- Browser Cache TTL: 1 year
- Edge Cache TTL: 1 month
```

### 2. Cloudflare Pages Settings

In your Cloudflare Pages project settings:

1. **Build Settings**:
   - Build command: `npm run build`
   - Build output directory: `dist`

2. **Environment Variables**:
   - Add all your `VITE_*` environment variables

3. **Custom Domains**:
   - Primary: `pwa.fiberoms.com`
   - Ensure "Always use latest deployment" is enabled

### 3. Cache Purge Strategy

After each deployment:

1. **Automatic purge** (recommended):
   - Set up a build hook to purge cache after deployment
   - Use Cloudflare API: `POST /zones/{zone_id}/purge_cache`

2. **Manual purge**:
   - Go to Caching → Configuration
   - Click "Purge Everything" or use Custom Purge for specific files

### 4. Transform Rules (Business/Enterprise plans)

If available, create a transform rule:

```
When: hostname equals "pwa.fiberoms.com" AND URI path equals "/index.html"
Then: Add response header "Cache-Control: no-cache, no-store, must-revalidate"
```

### 5. Workers (Optional but Recommended)

Create a Cloudflare Worker to force fresh content:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Force bypass cache for HTML files
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    const response = await fetch(request, {
      cf: {
        cacheTtl: 0,
        cacheEverything: false
      }
    })
    
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    newResponse.headers.set('Pragma', 'no-cache')
    newResponse.headers.set('Expires', '0')
    
    return newResponse
  }
  
  // Default behavior for other assets
  return fetch(request)
}
```

### 6. Build Hook for Auto Cache Purge

Add this to your build process or CI/CD:

```bash
# After successful build
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://pwa.fiberoms.com/index.html","https://pwa.fiberoms.com/"]}'
```

## Testing Cache Behavior

To verify cache is properly bypassed:

1. Check response headers:
   ```bash
   curl -I https://pwa.fiberoms.com/
   ```
   
   Should show:
   ```
   Cache-Control: no-cache, no-store, must-revalidate
   CF-Cache-Status: DYNAMIC or BYPASS
   ```

2. Use Chrome DevTools:
   - Open Network tab
   - Disable cache
   - Hard reload (Cmd+Shift+R)
   - Check response headers

## Troubleshooting

If changes still don't appear:

1. **Purge Everything** in Cloudflare dashboard
2. **Check DNS** - ensure no proxy between Cloudflare and origin
3. **Verify Build** - confirm new build was deployed to Pages
4. **Browser Cache** - test in incognito/private mode
5. **Service Worker** - unregister old service workers in DevTools