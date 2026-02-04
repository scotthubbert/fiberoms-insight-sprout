# FiberOMS Insight - Deployment Guide

## Build Summary

**Date**: February 1, 2026
**Changes**: Updated Splitter layer popup configuration
**Build Size**: 76MB total (only 120KB changed)

## Files Changed in This Build

Out of the entire 76MB build, only these files changed:

| File | Size | Purpose |
|------|------|---------|
| `dist/index.html` | 41KB | Main HTML file |
| `dist/index.html.br` | 6.3KB | Brotli compressed HTML |
| `dist/index.html.gz` | 7.8KB | Gzip compressed HTML |
| `dist/assets/index-D6kns56k.js` | 11KB | Application code (includes Splitter changes) |
| `dist/sw.js` | 24KB | Service Worker |
| `dist/workbox-06377e6b.js` | 23KB | PWA runtime |
| **Total** | **120KB** | |

## Deployment Methods

### Method 1: Using rsync (Recommended)

`rsync` is ideal for deployments because it only transfers changed files and can resume interrupted transfers.

#### Basic rsync deployment:
```bash
# Deploy HTML files
rsync -avz --progress \
  dist/index.html \
  dist/index.html.br \
  dist/index.html.gz \
  dist/sw.js \
  dist/workbox-*.js \
  username@your-server.com:/var/www/html/

# Deploy JavaScript assets (note the separate command for subdirectory)
rsync -avz --progress \
  dist/assets/index-*.js \
  username@your-server.com:/var/www/html/assets/
```

#### Advanced rsync with backup:
```bash
# This creates a backup of replaced files
rsync -avz --progress --backup --suffix=.$(date +%Y%m%d) \
  dist/index.html* dist/sw.js dist/workbox-*.js \
  username@your-server.com:/var/www/html/

rsync -avz --progress --backup --suffix=.$(date +%Y%m%d) \
  dist/assets/index-*.js \
  username@your-server.com:/var/www/html/assets/
```

#### rsync Options Explained:
- `-a` : Archive mode (preserves permissions, timestamps)
- `-v` : Verbose output
- `-z` : Compress during transfer
- `--progress` : Show transfer progress
- `--backup` : Keep backup of replaced files
- `--suffix` : Add date suffix to backups

### Method 2: Using scp (Simple Alternative)

`scp` is simpler but less efficient for large deployments.

#### Basic scp deployment:
```bash
# Deploy HTML and service worker files
scp dist/index.html* dist/sw.js dist/workbox-*.js \
  username@your-server.com:/var/www/html/

# Deploy JavaScript assets
scp dist/assets/index-*.js \
  username@your-server.com:/var/www/html/assets/
```

#### Using scp with specific port:
```bash
# If SSH is on a non-standard port (e.g., 2222)
scp -P 2222 dist/index.html* dist/sw.js dist/workbox-*.js \
  username@your-server.com:/var/www/html/
```

### Method 3: Full Deployment Script

Create a deployment script for repeated use:

```bash
#!/bin/bash
# save as: deploy.sh

# Configuration
SERVER="username@your-server.com"
REMOTE_PATH="/var/www/html"
LOCAL_DIST="dist"

echo "🚀 Deploying FiberOMS Insight updates..."

# Deploy main files
echo "📦 Uploading HTML and service worker files..."
rsync -avz --progress \
  $LOCAL_DIST/index.html* \
  $LOCAL_DIST/sw.js \
  $LOCAL_DIST/workbox-*.js \
  $SERVER:$REMOTE_PATH/

# Deploy assets
echo "📦 Uploading JavaScript assets..."
rsync -avz --progress \
  $LOCAL_DIST/assets/index-*.js \
  $SERVER:$REMOTE_PATH/assets/

echo "✅ Deployment complete!"
```

Make it executable: `chmod +x deploy.sh`
Run it: `./deploy.sh`

## Initial Full Deployment

If this is your FIRST deployment, you'll need to upload everything:

```bash
# Full deployment with rsync
rsync -avz --progress dist/ username@your-server.com:/var/www/html/

# Or with scp (less efficient for large transfers)
scp -r dist/* username@your-server.com:/var/www/html/
```

## Post-Deployment Checklist

1. **Clear Browser Cache** (or test in incognito mode)
2. **Test the Splitter Popup**:
   - Click on a Splitter feature
   - Verify fields show: Name, DA, Splitter Count, Part Number
   - Test the "Copy Info" button
3. **Check PWA Functionality**:
   - Verify app can be installed
   - Test offline mode
4. **Monitor Console** for any errors
5. **Test on Mobile Devices**

## Troubleshooting

### Permission Issues
```bash
# Fix permissions after upload if needed
ssh username@your-server.com
cd /var/www/html
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;
```

### Cache Issues
- Users may need to hard refresh: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- Service worker will update automatically within 24 hours
- Force update by changing version in manifest.json

### Connection Issues
```bash
# Test connection first
ssh username@your-server.com "echo 'Connection successful'"

# Use verbose mode for debugging
rsync -avz --progress --verbose --debug=ALL \
  dist/index.html username@your-server.com:/var/www/html/
```

## Server Requirements

- **Web Server**: Apache, Nginx, or similar
- **HTTPS**: Required for PWA features
- **CORS Headers**: Required for external API access
- **Compression**: Enable gzip/brotli (files already provided)
- **MIME Types**: Ensure proper types for .js, .json, .woff2

## Version History

- **v1.0.2** - February 1, 2026
  - Updated Splitter popup configuration
  - Changed field mapping: Name=equipmentn, DA=distribui, Splitter Count=outputport, Part Number=partnumber
  - Updated copy functionality for new field names

---

**Note**: Always test in a staging environment before deploying to production!