// PWAInstaller.js - Handles PWA install prompt and update notifications

export class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.updateAvailable = false;
        this.registration = null;
    }

    init() {
        // Handle install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
        });

        // Handle successful installation
        window.addEventListener('appinstalled', () => {
        });

        // Register service worker and handle updates
        this.registerServiceWorker();
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator && import.meta.env.PROD) {
            try {
                // Add error handler for service worker errors
                navigator.serviceWorker.addEventListener('error', (event) => {
                    console.warn('Service worker error:', event);
                });

                // Add handler for cache errors from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data && event.data.type === 'CACHE_ERROR') {
                        console.warn('Service worker cache error:', event.data.error);
                        // Don't throw - just log the error
                    }
                });

                const registration = await navigator.serviceWorker.register('/sw.js');
                this.registration = registration;

                // Check for updates every time the page loads
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker is available
                                this.handleUpdateAvailable();
                            }
                        });
                    }
                });

                // Check for updates periodically
                setInterval(() => {
                    registration.update().catch(err => {
                        console.warn('Service worker update check failed:', err);
                    });
                }, 60000); // Check every minute

            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    handleUpdateAvailable() {
        this.updateAvailable = true;
        this.showUpdateNotification();
    }

    showUpdateNotification() {
        // Check if notification already exists
        if (document.querySelector('#pwa-update-notice')) {
            return;
        }

        // Use the same notification system as other components
        let noticeContainer = document.querySelector('#notice-container');
        if (!noticeContainer) {
            noticeContainer = document.createElement('div');
            noticeContainer.id = 'notice-container';
            noticeContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px;';
            document.body.appendChild(noticeContainer);
        }

        // Create notice using same system as other notifications
        const notice = document.createElement('calcite-notice');
        notice.id = 'pwa-update-notice';
        notice.setAttribute('open', '');
        notice.setAttribute('kind', 'brand');
        notice.setAttribute('closable', '');
        notice.setAttribute('icon', 'refresh');
        notice.setAttribute('width', 'auto');

        const titleDiv = document.createElement('div');
        titleDiv.slot = 'title';
        titleDiv.textContent = 'App Update Available';

        const messageDiv = document.createElement('div');
        messageDiv.slot = 'message';
        messageDiv.textContent = 'A new version of the app is available. Refresh to get the latest features and improvements.';

        const refreshButton = document.createElement('calcite-button');
        refreshButton.slot = 'actions-end';
        refreshButton.setAttribute('appearance', 'solid');
        refreshButton.setAttribute('scale', 's');
        refreshButton.textContent = 'Refresh Now';
        refreshButton.onclick = () => {
            notice.remove();
            if (noticeContainer.children.length === 0) {
                noticeContainer.remove();
            }
            window.location.reload(true);
        };

        notice.appendChild(titleDiv);
        notice.appendChild(messageDiv);
        notice.appendChild(refreshButton);

        noticeContainer.appendChild(notice);

        // Listen for close event
        notice.addEventListener('calciteNoticeClose', () => {
            notice.remove();
            if (noticeContainer.children.length === 0) {
                noticeContainer.remove();
            }
        });

        // Auto-remove after 15 seconds (longer for important updates)
        setTimeout(() => {
            if (document.body.contains(notice)) {
                notice.setAttribute('open', 'false');
                setTimeout(() => {
                    notice.remove();
                    if (noticeContainer.children.length === 0) {
                        noticeContainer.remove();
                    }
                }, 300);
            }
        }, 15000);
    }

    // Method to force update
    async forceUpdate() {
        if (this.registration && this.registration.waiting) {
            // Tell the waiting service worker to skip waiting
            this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    }

    // Method to clear all caches
    async clearAllCaches() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }
    }
}

export default PWAInstaller;

