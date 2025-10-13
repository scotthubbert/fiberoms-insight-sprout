// DashboardManager.js - Manages dashboard refresh and counters

import { subscriberDataService } from '../dataService.js';
import { loadingIndicator } from '../utils/loadingIndicator.js';
import { createLogger } from '../utils/logger.js';

// Initialize logger for this module
const log = createLogger('DashboardManager');

export class DashboardManager {
    constructor() {
        this.refreshButton = null;
        this.lastUpdated = null;
    }

    async init() {
        await customElements.whenDefined('calcite-button');
        await customElements.whenDefined('calcite-chip');
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.refreshButton = document.getElementById('refresh-dashboard');
        if (this.refreshButton) {
            this.refreshButton.addEventListener('click', () => this.refreshDashboard());
        }
    }

    updateLastUpdatedTime() {
        this.lastUpdated = new Date();
    }

    async updateDashboard() {
        try {
            // Get subscriber summary with offline count
            const summary = await subscriberDataService.getSubscribersSummary();

            // Update the offline count display
            this.updateOfflineCount(summary.offline || 0);

        } catch (error) {
            log.error('Failed to update dashboard:', error);
            // Show 0 if there's an error to prevent showing stale data
            this.updateOfflineCount(0);
        }

        // Update the timestamp
        this.updateLastUpdatedTime();
    }

    updateOfflineCount(count) {
        const offlineCountElement = document.getElementById('offline-count');
        if (offlineCountElement) {
            offlineCountElement.textContent = count.toString();

            // Update alert count in popover
            const alertCountElement = document.getElementById('alert-count');
            if (alertCountElement) {
                const alertText = count > 0 ? `${count} New` : '0 New';
                alertCountElement.textContent = alertText;
            }
        }

        // Update mobile overlay counter
        const mobileOfflineCountElement = document.getElementById('mobile-offline-count');
        if (mobileOfflineCountElement) {
            mobileOfflineCountElement.textContent = count.toString();
        }
    }

    async refreshDashboard() {
        // Add loading state to refresh button
        if (this.refreshButton) {
            this.refreshButton.setAttribute('loading', '');
        }

        try {
            // Set global flag to skip notifications during manual refresh
            window._isManualRefresh = true;

            // Clear any existing loading notifications
            loadingIndicator.clearConsolidated();

            // Clear cache to ensure fresh data
            subscriberDataService.clearCache();

            // Use consolidated update method to prevent duplicate fetches
            if (window.app && window.app.updateSubscriberStatistics) {
                await window.app.updateSubscriberStatistics();
            }

            // Also refresh power outage stats without notification
            const powerStats = document.querySelector('power-outage-stats');
            if (powerStats && typeof powerStats.updateStats === 'function') {
                await powerStats.updateStats(true); // Skip notification
            }

            // Simulate brief loading for user feedback
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            log.error('Error refreshing dashboard:', error);
        } finally {
            // Force clear all loading indicators regardless of completion state
            loadingIndicator.clearConsolidated();
            loadingIndicator.clear(); // Clear any individual notices too

            // Remove loading state
            if (this.refreshButton) {
                this.refreshButton.removeAttribute('loading');
            }
            // Clear manual refresh flag
            window._isManualRefresh = false;
        }
    }
}


