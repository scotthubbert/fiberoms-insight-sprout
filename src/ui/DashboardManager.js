// DashboardManager.js - Manages dashboard refresh and counters

import { subscriberDataService } from '../dataService.js';
import { infrastructureService } from '../services/InfrastructureService.js';
import { loadingIndicator } from '../utils/loadingIndicator.js';
import { createLogger } from '../utils/logger.js';
import { trackClick, trackFeatureUsage } from '../services/AnalyticsService.js';

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
        // Header refresh button - consolidated all refresh operations here (2025-01-22)
        // Previously there were 2 redundant buttons: #refresh-dashboard and #refresh-data
        // The #refresh-data button was removed from the Actions panel
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

    /**
     * Comprehensive dashboard refresh operation
     * Consolidated on 2025-01-22 to replace redundant #refresh-data button
     * This performs ALL refresh operations:
     * - Clears subscriber data cache
     * - Performs polling manager update for subscribers
     * - Updates subscriber statistics
     * - Refreshes power outage stats
     */
    async refreshDashboard() {
        log.info('🔄 Manual dashboard refresh triggered');

        // Track refresh action
        trackClick('refresh-dashboard', {
            section: 'header',
            action: 'refresh'
        });
        trackFeatureUsage('dashboard_refresh');

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
            infrastructureService.clearCache();

            // Perform polling manager update for subscribers and power outages data
            if (window.app?.pollingManager) {
                await window.app.pollingManager.performUpdate('subscribers');
                await window.app.pollingManager.performUpdate('power-outages');
            }

            // Use consolidated update method to prevent duplicate fetches
            if (window.app && window.app.updateSubscriberStatistics) {
                await window.app.updateSubscriberStatistics();
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


