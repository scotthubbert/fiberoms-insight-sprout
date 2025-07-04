// Version Check Utility
// Checks for new deployments by comparing build hashes

const VERSION_KEY = 'app-version';
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || Date.now().toString();

export function initVersionCheck() {
  // Check version on load
  checkVersion();
  
  // Check version periodically (every 5 minutes)
  setInterval(checkVersion, 5 * 60 * 1000);
  
  // Check version when window regains focus
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkVersion();
    }
  });
}

async function checkVersion() {
  try {
    // Skip if we've already shown notification this session
    if (sessionStorage.getItem('version-notification-shown')) {
      return;
    }
    
    // Fetch the main JS file's actual URL to get the current hash
    // Add timestamp to URL to bypass all caches
    const timestamp = Date.now();
    const response = await fetch(`/index.html?_t=${timestamp}`, {
      cache: 'no-cache',
      method: 'GET',
      headers: {
        'pragma': 'no-cache',
        'cache-control': 'no-cache, no-store, must-revalidate',
        'expires': '0'
      }
    });
    
    if (!response.ok) return;
    
    const html = await response.text();
    
    // Extract the main JS file hash from the HTML
    // Look for pattern like: /assets/index-[hash].js
    const scriptMatch = html.match(/\/assets\/index-([a-zA-Z0-9]+)\.js/);
    
    if (scriptMatch && scriptMatch[1]) {
      const currentHash = scriptMatch[1];
      const storedHash = localStorage.getItem('app-build-hash');
      
      // First visit - just store the hash
      if (!storedHash) {
        localStorage.setItem('app-build-hash', currentHash);
        return;
      }
      
      // Check if hash has changed (new deployment)
      if (storedHash !== currentHash) {
        console.log('New version detected:', currentHash, 'was:', storedHash);
        
        // Update stored hash immediately
        localStorage.setItem('app-build-hash', currentHash);
        
        // Show notification
        showUpdateNotification();
        sessionStorage.setItem('version-notification-shown', 'true');
      }
    }
    
  } catch (error) {
    console.error('Version check failed:', error);
  }
}

function showUpdateNotification() {
  // Check if notification already exists
  if (document.querySelector('#update-notification')) {
    return;
  }
  
  // Get or create notice container
  let noticeContainer = document.querySelector('#notice-container');
  if (!noticeContainer) {
    noticeContainer = document.createElement('div');
    noticeContainer.id = 'notice-container';
    noticeContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px;';
    document.body.appendChild(noticeContainer);
  }
  
  // Create calcite-notice
  const notice = document.createElement('calcite-notice');
  notice.id = 'update-notification';
  notice.setAttribute('open', '');
  notice.setAttribute('kind', 'brand');
  notice.setAttribute('closable', '');
  notice.setAttribute('icon', 'information');
  notice.setAttribute('width', 'auto');
  
  const titleDiv = document.createElement('div');
  titleDiv.slot = 'title';
  titleDiv.textContent = 'Update Available';
  
  const messageDiv = document.createElement('div');
  messageDiv.slot = 'message';
  messageDiv.textContent = 'A new version is available. Refresh to get the latest features.';
  
  const refreshButton = document.createElement('calcite-button');
  refreshButton.slot = 'actions-end';
  refreshButton.setAttribute('appearance', 'solid');
  refreshButton.setAttribute('scale', 's');
  refreshButton.textContent = 'Refresh Now';
  refreshButton.onclick = () => {
    // Clear session storage to allow notification on next deployment
    sessionStorage.removeItem('version-notification-shown');
    // Force hard reload
    window.location.reload(true);
  };
  
  notice.appendChild(titleDiv);
  notice.appendChild(messageDiv);
  notice.appendChild(refreshButton);
  
  noticeContainer.appendChild(notice);
  
  // Listen for close event
  notice.addEventListener('calciteNoticeClose', () => {
    notice.remove();
    // Remove container if empty
    if (noticeContainer.children.length === 0) {
      noticeContainer.remove();
    }
  });
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (document.body.contains(notice)) {
      notice.setAttribute('open', 'false');
      setTimeout(() => {
        notice.remove();
        if (noticeContainer.children.length === 0) {
          noticeContainer.remove();
        }
      }, 300); // Allow animation to complete
    }
  }, 30000);
}

// Force hard reload function for manual use
export function forceHardReload() {
  // Clear all caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  // Clear local storage version
  localStorage.removeItem(VERSION_KEY);
  localStorage.removeItem('deployment-id');
  
  // Force reload with cache bypass
  window.location.reload(true);
}