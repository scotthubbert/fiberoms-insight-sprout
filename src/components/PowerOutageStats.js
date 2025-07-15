/**
 * PowerOutageStats.js - Power outage statistics component
 * Mobile-first Web Component for displaying real-time power outage data
 * Follows SOLID principles and Calcite Design System
 * 
 * @component PowerOutageStatsComponent
 * @author FiberOMS Development Team
 * @version 1.0.0
 */

import { subscriberDataService } from '../dataService.js';

/**
 * Production logging utility - only warnings and errors in production
 * @type {Object}
 */
const isDevelopment = import.meta.env.DEV;
const log = {
    info: (...args) => isDevelopment && console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

/**
 * PowerOutageStatsComponent - Web Component for displaying power outage statistics
 * 
 * Features:
 * - Real-time outage data display
 * - Mobile-first responsive design
 * - Company logo integration
 * - Interactive outage location mapping
 * - Layer visibility toggles
 * - Calcite Design System compliance
 * 
 * @extends HTMLElement
 */
export class PowerOutageStatsComponent extends HTMLElement {
    /**
     * Initialize component with default state
     * @constructor
     */
    constructor() {
        super();
        this.outagesData = {
            apco: [],
            tombigbee: []
        };
        this.isVisible = false;
        this.isInitialLoad = true;
        this.lastKnownCounts = {
            apco: null,
            tombigbee: null
        };
    }

    /**
     * Component lifecycle - called when element is added to DOM
     * Sets up initial render, event listeners, and data fetching
     */
    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.updateStats();

        // Ensure component is ready for layer interaction
        setTimeout(() => {
            this.setupOutageListeners();
        }, 500);
    }

    /**
     * Set up event listeners for layer visibility changes
     * @private
     */
    setupEventListeners() {
        document.addEventListener('layerVisibilityChanged', (event) => {
            if (event.detail.layerId === 'apco-outages' || event.detail.layerId === 'tombigbee-outages') {
                this.updateStats();
            }
        });
    }

    /**
     * Update outage statistics and handle notifications
     * @param {boolean} skipNotification - Whether to skip showing update notifications
     * @returns {Promise<void>}
     */
    async updateStats(skipNotification = false) {
        try {
            // Fetch current outage data
            const [apcoData, tombigbeeData] = await Promise.all([
                subscriberDataService.getApcoOutages(),
                subscriberDataService.getTombigbeeOutages()
            ]);

            this.outagesData.apco = apcoData.data || [];
            this.outagesData.tombigbee = tombigbeeData.data || [];

            // Get current counts
            const currentApcoCount = this.outagesData.apco.length;
            const currentTombigbeeCount = this.outagesData.tombigbee.length;

            // Show notification for data changes (production-ready)
            if (!skipNotification &&
                !this.isInitialLoad &&
                this.lastKnownCounts.apco !== null &&
                this.lastKnownCounts.tombigbee !== null &&
                (this.lastKnownCounts.apco !== currentApcoCount ||
                    this.lastKnownCounts.tombigbee !== currentTombigbeeCount)) {

                this.showUpdateToast(
                    this.lastKnownCounts.apco,
                    currentApcoCount,
                    this.lastKnownCounts.tombigbee,
                    currentTombigbeeCount
                );
            }

            // Update stored counts
            this.lastKnownCounts.apco = currentApcoCount;
            this.lastKnownCounts.tombigbee = currentTombigbeeCount;
            this.isInitialLoad = false;

            this.renderStats();
        } catch (error) {
            log.error('Failed to update outage stats:', error);
            this.renderError();
        }
    }

    /**
     * Initial render with loading state
     * Mobile-first design with proper loading indicators
     * @private
     */
    render() {
        this.innerHTML = `
            <div class="power-outage-stats-container" style="padding: 4px 0; height: 100%; display: flex; flex-direction: column;">
                <div class="stats-content" style="flex: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; justify-content: center; padding: 20px; color: var(--calcite-color-text-2);">
                        <calcite-icon icon="loading" scale="s" style="margin-right: 8px;"></calcite-icon>
                        <span style="font-size: 14px;">Loading outage data...</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render statistics with mobile-first responsive design
     * @private
     */
    renderStats() {
        const statsContent = this.querySelector('.stats-content');
        if (!statsContent) return;

        const apcoCount = this.outagesData.apco.length;
        const tombigbeeCount = this.outagesData.tombigbee.length;

        const apcoCustomers = this.outagesData.apco.reduce((sum, outage) => sum + (outage.customers_affected || 0), 0);
        const tombigbeeCustomers = this.outagesData.tombigbee.reduce((sum, outage) => sum + (outage.customers_affected || 0), 0);

        const currentTime = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Combine all outages and sort by customer count (highest first)
        const allOutages = [
            ...this.outagesData.apco.map(o => ({ ...o, company: 'APCo' })),
            ...this.outagesData.tombigbee.map(o => ({ ...o, company: 'Tombigbee' }))
        ].sort((a, b) => (b.customers_affected || 0) - (a.customers_affected || 0));

        statsContent.innerHTML = `
            <!-- Static Summary Section -->
            <div class="power-stats-summary" style="margin-bottom: 16px; flex-shrink: 0;">
                ${this.renderCompanySummary('APCo', apcoCount, apcoCustomers)}
                ${this.renderCompanySummary('Tombigbee', tombigbeeCount, tombigbeeCustomers)}
                <div style="text-align: center; font-size: 11px; color: var(--calcite-color-text-3); margin-top: 8px;">
                    Last updated: ${currentTime}
                </div>
            </div>

            <!-- Scrollable Outages List -->
            <div class="outages-list-container" style="border-top: 1px solid var(--calcite-color-border-2); padding-top: 12px; flex: 1; display: flex; flex-direction: column;">
                <div style="font-size: 12px; font-weight: 600; color: var(--calcite-color-text-2); margin-bottom: 8px; text-transform: uppercase;">
                    Active Outages (${allOutages.length})
                </div>
                <calcite-list class="outages-list" style="flex: 1; overflow-y: auto; overflow-x: hidden; border: 1px solid var(--calcite-color-border-2); border-radius: var(--calcite-border-radius); background: var(--calcite-color-background);">
                    ${allOutages.length > 0 ?
                allOutages.map(outage => this.renderCalciteOutageItem(outage)).join('') :
                `<calcite-list-item label="No active outages" description="All systems are operational" disabled>
                            <calcite-icon slot="content-start" icon="circle-check" style="color: var(--calcite-color-status-success);"></calcite-icon>
                        </calcite-list-item>`
            }
                </calcite-list>
            </div>
        `;

        this.setupOutageListeners();
    }

    /**
     * Render company summary section with toggle controls
     * Mobile-optimized with proper touch targets (44px minimum)
     * @param {string} company - Company identifier ('APCo' or 'Tombigbee')
     * @param {number} outageCount - Number of outages
     * @param {number} customerCount - Number of affected customers
     * @returns {string} HTML template for company summary
     * @private
     */
    renderCompanySummary(company, outageCount, customerCount) {
        const bgColor = company === 'APCo' ? 'rgba(30, 95, 175, 0.1)' : 'rgba(74, 124, 89, 0.1)';
        const layerId = company === 'APCo' ? 'apco-outages' : 'tombigbee-outages';
        const logoPath = company === 'APCo' ? '/apco-logo.png' : '/tombigbee-logo.png';
        const companyFullName = company === 'APCo' ? 'Alabama Power' : 'Tombigbee Electric';

        // Get the current visibility state of the layer
        let isChecked = true;
        try {
            const layer = window.app?.services?.layerManager?.getLayer(layerId);
            if (layer) {
                isChecked = layer.visible;
            }
        } catch (error) {
            // Layer might not be loaded yet, use default
            log.warn(`Layer ${layerId} not found, using default visibility`);
        }

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: ${bgColor}; border-radius: 4px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; flex: 1;">
                    <img src="${logoPath}" alt="${company} Logo" style="width: 24px; height: 24px; object-fit: contain; margin-right: 8px;">
                    <div style="flex: 1;">
                        <span style="font-weight: 600; font-size: 14px;">${companyFullName}</span>
                        <div style="font-size: 11px; color: var(--calcite-color-text-3);">${customerCount.toLocaleString()} affected</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="text-align: center;">
                        <span style="font-size: 20px; font-weight: 700; color: var(--calcite-color-text-1);">${outageCount}</span>
                        <div style="font-size: 11px; color: var(--calcite-color-text-2);">outages</div>
                    </div>
                    <calcite-switch scale="s" ${isChecked ? 'checked' : ''} 
                        class="power-company-toggle" 
                        data-layer-id="${layerId}"
                        data-company="${company}"
                        id="toggle-${layerId}">
                    </calcite-switch>
                </div>
            </div>
        `;
    }

    /**
     * Render individual outage item using Calcite List component
     * Mobile-first design with proper touch targets
     * @param {Object} outage - Outage data object
     * @returns {string} HTML template for outage list item
     * @private
     */
    renderCalciteOutageItem(outage) {
        const logoPath = outage.company === 'APCo' ? '/apco-logo.png' : '/tombigbee-logo.png';
        const companyFullName = outage.company === 'APCo' ? 'Alabama Power' : 'Tombigbee Electric';

        return `
            <calcite-list-item
                label="${(outage.customers_affected || 0).toLocaleString()} customers affected"
                description="${companyFullName}"
                class="outage-item clickable-outage"
                data-outage-id="${outage.outage_id}"
                data-lat="${outage.latitude}"
                data-lng="${outage.longitude}"
                style="cursor: pointer;"
                title="Click to view on map">
                <img slot="content-start" src="${logoPath}" alt="${outage.company} Logo" style="width: 20px; height: 20px; object-fit: contain;">
            </calcite-list-item>
        `;
    }

    /**
     * Set up event listeners for outage interactions
     * Handles both new calcite-list-item clicks and legacy button clicks
     * @private
     */
    setupOutageListeners() {
        // Clickable outage items (primary interaction)
        const clickableOutages = this.querySelectorAll('.clickable-outage');
        clickableOutages.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                const outageId = item.dataset.outageId;

                if (lat && lng && window.mapView) {
                    this.flyToOutage(lat, lng, outageId);
                }
            });
        });

        // Legacy locate outage buttons (backward compatibility)
        const locateButtons = this.querySelectorAll('.locate-outage');
        locateButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const outageItem = button.closest('.outage-item');
                if (outageItem) {
                    const lat = parseFloat(outageItem.dataset.lat);
                    const lng = parseFloat(outageItem.dataset.lng);
                    const outageId = outageItem.dataset.outageId;

                    if (lat && lng && window.mapView) {
                        this.flyToOutage(lat, lng, outageId);
                    }
                }
            });
        });

        // Power company toggle switches
        setTimeout(() => {
            const toggleSwitches = this.querySelectorAll('.power-company-toggle');
            toggleSwitches.forEach(toggle => {
                // Remove existing listeners to prevent duplicates
                const newToggle = toggle.cloneNode(true);
                toggle.parentNode.replaceChild(newToggle, toggle);

                newToggle.addEventListener('calciteSwitchChange', async (e) => {
                    const layerId = newToggle.dataset.layerId;
                    const isChecked = e.target.checked;

                    try {
                        if (window.app?.services?.layerManager) {
                            const result = await window.app.services.layerManager.toggleLayerVisibility(layerId, isChecked);
                            if (!result) {
                                log.error(`Failed to toggle ${newToggle.dataset.company} layer visibility`);
                            }
                        } else {
                            // Fallback: dispatch custom event
                            document.dispatchEvent(new CustomEvent('powerOutageToggle', {
                                detail: { layerId, visible: isChecked }
                            }));
                        }
                    } catch (error) {
                        log.error('Error toggling layer visibility:', error);
                    }
                });
            });
        }, 100);
    }

    /**
     * Navigate to outage location on map with appropriate zoom level
     * @param {number} lat - Latitude coordinate
     * @param {number} lng - Longitude coordinate
     * @param {string} outageId - Unique outage identifier
     * @returns {Promise<void>}
     */
    async flyToOutage(lat, lng, outageId) {
        if (!window.mapView) {
            log.error('Map view not available');
            return;
        }

        try {
            // Find the outage to determine if it's a polygon for better zoom level
            let isPolygon = false;
            const allOutages = [...this.outagesData.apco, ...this.outagesData.tombigbee];
            const outage = allOutages.find(o => o.outage_id === outageId);

            // Check if this outage has polygon characteristics
            if (outage && outage.area_description && outage.area_description.toLowerCase().includes('area')) {
                isPolygon = true;
            }

            // Fly to the outage location with appropriate zoom
            await window.mapView.goTo({
                center: [lng, lat],
                zoom: isPolygon ? 12 : 15
            });

            // Find and show popup for the outage
            const point = {
                type: 'point',
                longitude: lng,
                latitude: lat
            };

            const apcoLayer = window.app?.services?.layerManager?.getLayer('apco-outages');
            const tombigbeeLayer = window.app?.services?.layerManager?.getLayer('tombigbee-outages');

            let targetLayer = null;
            if (apcoLayer && apcoLayer.visible) {
                const apcoResults = await apcoLayer.queryFeatures({
                    where: `outage_id = '${outageId}'`,
                    returnGeometry: true,
                    outFields: ['*']
                });
                if (apcoResults.features.length > 0) {
                    targetLayer = apcoLayer;
                }
            }

            if (!targetLayer && tombigbeeLayer && tombigbeeLayer.visible) {
                const tombigbeeResults = await tombigbeeLayer.queryFeatures({
                    where: `outage_id = '${outageId}'`,
                    returnGeometry: true,
                    outFields: ['*']
                });
                if (tombigbeeResults.features.length > 0) {
                    targetLayer = tombigbeeLayer;
                }
            }

            if (targetLayer) {
                window.mapView.popup.open({
                    location: point,
                    features: await targetLayer.queryFeatures({
                        where: `outage_id = '${outageId}'`,
                        returnGeometry: true,
                        outFields: ['*']
                    }).then(result => result.features)
                });
            }

        } catch (error) {
            log.error('Failed to fly to outage:', error);
        }
    }

    /**
     * Show update notification toast for outage changes
     * Production-ready user feedback system
     * @param {number} prevApco - Previous APCo outage count
     * @param {number} currApco - Current APCo outage count
     * @param {number} prevTombigbee - Previous Tombigbee outage count
     * @param {number} currTombigbee - Current Tombigbee outage count
     * @private
     */
    showUpdateToast(prevApco, currApco, prevTombigbee, currTombigbee) {
        // Remove any existing notice
        const existingNotice = document.querySelector('#outage-update-notice');
        if (existingNotice) {
            existingNotice.remove();
        }

        // Determine what changed
        const apcoChange = currApco - prevApco;
        const tombigbeeChange = currTombigbee - prevTombigbee;

        let message = 'Power outage data updated: ';
        const changes = [];

        if (apcoChange !== 0) {
            const changeText = apcoChange > 0 ? `+${apcoChange}` : `${apcoChange}`;
            changes.push(`APCo ${changeText}`);
        }

        if (tombigbeeChange !== 0) {
            const changeText = tombigbeeChange > 0 ? `+${tombigbeeChange}` : `${tombigbeeChange}`;
            changes.push(`Tombigbee ${changeText}`);
        }

        if (changes.length === 0) {
            message = 'Power outage data refreshed';
        } else {
            message += changes.join(', ');
        }

        // Create notice container if it doesn't exist
        let noticeContainer = document.querySelector('#notice-container');
        if (!noticeContainer) {
            noticeContainer = document.createElement('div');
            noticeContainer.id = 'notice-container';
            noticeContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px;';
            document.body.appendChild(noticeContainer);
        }

        // Create notice
        const notice = document.createElement('calcite-notice');
        notice.id = 'outage-update-notice';
        notice.setAttribute('open', '');
        notice.setAttribute('kind', apcoChange > 0 || tombigbeeChange > 0 ? 'warning' : 'success');
        notice.setAttribute('closable', '');
        notice.setAttribute('icon', 'flash');
        notice.setAttribute('width', 'auto');

        const titleDiv = document.createElement('div');
        titleDiv.slot = 'title';
        titleDiv.textContent = 'Outage Update';

        const messageDiv = document.createElement('div');
        messageDiv.slot = 'message';
        messageDiv.textContent = message;

        notice.appendChild(titleDiv);
        notice.appendChild(messageDiv);

        noticeContainer.appendChild(notice);

        // Listen for close event
        notice.addEventListener('calciteNoticeClose', () => {
            notice.remove();
            if (noticeContainer.children.length === 0) {
                noticeContainer.remove();
            }
        });

        // Auto-remove after 5 seconds
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
        }, 5000);
    }

    /**
     * Render error state with user-friendly message
     * Production-ready error handling
     * @private
     */
    renderError() {
        const statsContent = this.querySelector('.stats-content');
        if (statsContent) {
            statsContent.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; padding: 20px; text-align: center;">
                    <calcite-icon icon="exclamation-mark-triangle" scale="m" style="color: var(--calcite-color-status-danger); margin-bottom: 8px;"></calcite-icon>
                    <span style="font-size: 14px; color: var(--calcite-color-text-1); margin-bottom: 4px;">Unable to load outage data</span>
                    <span style="font-size: 12px; color: var(--calcite-color-text-3);">Please check your connection and try again</span>
                </div>
            `;
        }
    }
}

// Register the custom element
customElements.define('power-outage-stats', PowerOutageStatsComponent); 