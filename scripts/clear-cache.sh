#!/bin/bash
echo "🧹 Clearing browser caches..."
echo ""
echo "Instructions:"
echo "1. Open Chrome DevTools (F12 or Cmd+Option+I)"
echo "2. Go to Application tab"
echo "3. Click 'Clear site data' button"
echo "4. OR use keyboard shortcut: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo ""
echo "Or run this in your browser console:"
echo "-------------------------------------"
cat << 'JS'
// Clear all caches
(async () => {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  // Unregister service workers
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(r => r.unregister()));
  console.log('✅ All caches cleared and service workers unregistered');
  console.log('🔄 Refreshing page...');
  window.location.reload(true);
})();
JS
echo "-------------------------------------"
