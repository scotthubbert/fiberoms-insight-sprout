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
      
      if (lastDeploymentId && lastDeploymentId !== deploymentId) {
        console.log('New deployment detected:', deploymentId);
        showUpdateNotification();
      }
      
      localStorage.setItem('deployment-id', deploymentId);
    }
    
    // Also check our version constant
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (storedVersion && storedVersion !== CURRENT_VERSION) {
      console.log('New version detected:', CURRENT_VERSION);
      showUpdateNotification();
    }
    
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    
  } catch (error) {
    console.error('Version check failed:', error);
  }
}

function showUpdateNotification() {
  // Check if notification already exists
  if (document.querySelector('#update-notification')) {
    return;
  }
  
  // Create update notification
  const notification = document.createElement('div');
  notification.id = 'update-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--calcite-color-brand);
    color: white;
    padding: 16px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 100000;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 400px;
  `;
  
  // Create the structure
  const icon = document.createElement('calcite-icon');
  icon.setAttribute('icon', 'information');
  icon.setAttribute('scale', 'm');
  
  const textContainer = document.createElement('div');
  textContainer.style.flex = '1';
  textContainer.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">Update Available</div>
    <div style="font-size: 14px;">A new version is available. Refresh to get the latest features.</div>
  `;
  
  const refreshButton = document.createElement('calcite-button');
  refreshButton.setAttribute('appearance', 'solid');
  refreshButton.setAttribute('color', 'inverse');
  refreshButton.setAttribute('scale', 's');
  refreshButton.textContent = 'Refresh Now';
  refreshButton.onclick = () => {
    // Remove notification immediately
    notification.remove();
    // Force hard reload
    window.location.reload(true);
  };
  
  notification.appendChild(icon);
  notification.appendChild(textContainer);
  notification.appendChild(refreshButton);
  
  document.body.appendChild(notification);
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
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