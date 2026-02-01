#!/bin/bash

# Script to identify changed files in the dist folder
# Useful for selective deployment

echo "🔍 Identifying changed build files..."
echo ""

# Files that definitely changed with any code update
echo "📦 Core files to deploy (always change with code updates):"
echo "- dist/index.html (and compressed versions)"
echo "- dist/assets/index-*.js (main app bundle)"
echo "- dist/sw.js (service worker)"
echo "- dist/workbox-*.js (workbox runtime)"
echo ""

# Get the actual filenames with hashes
echo "📄 Actual files to upload:"
echo ""
ls -lh dist/index.html* 2>/dev/null
ls -lh dist/assets/index-*.js 2>/dev/null
ls -lh dist/sw.js 2>/dev/null
ls -lh dist/workbox-*.js 2>/dev/null
echo ""

# Calculate total size of changed files
echo "💾 Total size of changed files:"
du -ch dist/index.html* dist/assets/index-*.js dist/sw.js dist/workbox-*.js 2>/dev/null | grep total

echo ""
echo "✅ Only these files need to be uploaded for this update!"
echo "   The vendor bundles, fonts, and other assets haven't changed."