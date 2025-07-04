// Version Check Utility
// Forces cache refresh when new version is deployed

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
    
    // Fetch the index.html with cache bypass
    const response = await fetch('/', {
      method: 'HEAD',
      cache: 'no-cache',
      headers: {
        'pragma': 'no-cache',
        'cache-control': 'no-cache'
      }
    });
    
    // Check if we got a new deployment (Cloudflare adds deployment headers)
    const deploymentId = response.headers.get('cf-deployment-id') || 
                        response.headers.get('x-deployment-id') ||
                        response.headers.get('etag');
    
    if (deploymentId) {
      const lastDeploymentId = localStorage.getItem('deployment-id');
      
      // Only show notification if:
      // 1. We have a previous deployment ID stored
      // 2. The deployment ID has changed
      // 3. We haven't shown the notification this session
      if (lastDeploymentId && lastDeploymentId !== deploymentId) {
        console.log('New deployment detected:', deploymentId);
        // Update stored deployment ID BEFORE showing notification
        localStorage.setItem('deployment-id', deploymentId);
        showUpdateNotification();
        sessionStorage.setItem('version-notification-shown', 'true');
        return; // Exit early to avoid duplicate notifications
      }
      
      // Store deployment ID on first run
      if (!lastDeploymentId) {
        localStorage.setItem('deployment-id', deploymentId);
      }
    }
    
    // Also check our version constant (only if deployment check didn't trigger)
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    // Only show notification if we have a stored version that's different
    if (storedVersion && storedVersion !== CURRENT_VERSION) {
      console.log('New version detected:', CURRENT_VERSION);
      // Update stored version BEFORE showing notification
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      showUpdateNotification();
      sessionStorage.setItem('version-notification-shown', 'true');
    } else if (!storedVersion) {
      // First time - just store the version
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
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