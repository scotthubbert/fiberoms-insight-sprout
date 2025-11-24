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
import { outageService } from '../services/OutageService.js';
import { getOrCreateNoticeContainer } from '../utils/noticeContainer.js';

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
        // Track individual outages by ID for specific notifications
        this.lastKnownOutages = {
            apco: new Set(),
            tombigbee: new Set()
        };
    }

    /**
     * Component lifecycle - called when element is added to DOM
     * Sets up initial render, event listeners, and data fetching
     */
    connectedCallback() {
        this.render();
        this.setupEventListeners();

        // Delay initial stats update to allow layers to initialize first
        setTimeout(() => {
            this.updateStats();
        }, 2000); // 2 second delay to allow layer initialization

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
        // Listen for layer visibility changes
        document.addEventListener('layerVisibilityChanged', (event) => {
            if (event.detail.layerId === 'apco-outages' || event.detail.layerId === 'tombigbee-outages') {
                this.updateStats();
            }
        });

        // Listen for layer data updates (when polling updates the layers)
        document.addEventListener('layerDataUpdated', (event) => {
            if (event.detail.layerId === 'apco-outages' || event.detail.layerId === 'tombigbee-outages') {
                this.updateStats();
            }
        });

        // Listen for power outage data updates from polling
        document.addEventListener('powerOutageDataUpdated', () => {
            this.updateStats();
        });
    }

    /**
     * Update outage statistics and handle notifications
     * Gets data from existing layers instead of fetching directly
     * @param {boolean} skipNotification - Whether to skip showing update notifications
     * @returns {Promise<void>}
     */
    async updateStats(skipNotification = false) {
        try {
            // Get data from existing layers instead of fetching directly
            const layerManager = window.app?.services?.layerManager;
            let apcoData = { data: [] };
            let tombigbeeData = { data: [] };

            if (layerManager) {
                // Try to get data from existing layers first
                const apcoLayer = layerManager.getLayer('apco-outages');
                const tombigbeeLayer = layerManager.getLayer('tombigbee-outages');

                log.info(`🔌 Layer manager found. APCo layer: ${!!apcoLayer}, Tombigbee layer: ${!!tombigbeeLayer}`);

                if (apcoLayer) {
                    log.info(`🔌 APCo layer details: graphics=${!!apcoLayer.graphics}, graphics.items=${apcoLayer.graphics?.items?.length || 'none'}`);
                }

                if (tombigbeeLayer) {
                    log.info(`🔌 Tombigbee layer details: graphics=${!!tombigbeeLayer.graphics}, graphics.items=${tombigbeeLayer.graphics?.items?.length || 'none'}`);
                }

                if (apcoLayer && apcoLayer.graphics && apcoLayer.graphics.items) {
                    // Extract data from layer graphics and deduplicate by outage_id
                    const outageMap = new Map();

                    apcoLayer.graphics.items.forEach(graphic => {
                        const attributes = graphic.attributes || {};
                        const geometry = graphic.geometry;

                        // Use outage_id as key for deduplication
                        const outageId = attributes.outage_id || attributes.id || 'unknown';

                        // Skip if we already have this outage (prevents double counting)
                        if (outageMap.has(outageId)) {
                            return;
                        }

                        // Handle different geometry types
                        let latitude, longitude;
                        if (geometry) {
                            if (geometry.type === 'point') {
                                latitude = geometry.latitude || geometry.y;
                                longitude = geometry.longitude || geometry.x;
                            } else if (geometry.type === 'polygon' && geometry.centroid) {
                                latitude = geometry.centroid.latitude || geometry.centroid.y;
                                longitude = geometry.centroid.longitude || geometry.centroid.x;
                            } else if (geometry.extent) {
                                latitude = geometry.extent.center.latitude || geometry.extent.center.y;
                                longitude = geometry.extent.center.longitude || geometry.extent.center.x;
                            }
                        }

                        outageMap.set(outageId, {
                            ...attributes,
                            latitude: latitude || attributes.latitude,
                            longitude: longitude || attributes.longitude
                        });
                    });

                    // Convert map values to array
                    apcoData.data = Array.from(outageMap.values());
                    log.info(`🔌 APCo deduplication: ${apcoLayer.graphics.items.length} graphics → ${apcoData.data.length} unique outages`);
                }

                if (tombigbeeLayer && tombigbeeLayer.graphics && tombigbeeLayer.graphics.items) {
                    // Extract data from layer graphics and deduplicate by outage_id
                    const outageMap = new Map();

                    tombigbeeLayer.graphics.items.forEach(graphic => {
                        const attributes = graphic.attributes || {};
                        const geometry = graphic.geometry;

                        // Use outage_id as key for deduplication
                        const outageId = attributes.outage_id || attributes.id || 'unknown';

                        // Skip if we already have this outage (prevents double counting)
                        if (outageMap.has(outageId)) {
                            return;
                        }

                        // Handle different geometry types
                        let latitude, longitude;
                        if (geometry) {
                            if (geometry.type === 'point') {
                                latitude = geometry.latitude || geometry.y;
                                longitude = geometry.longitude || geometry.x;
                            } else if (geometry.type === 'polygon' && geometry.centroid) {
                                latitude = geometry.centroid.latitude || geometry.centroid.y;
                                longitude = geometry.centroid.longitude || geometry.centroid.x;
                            } else if (geometry.extent) {
                                latitude = geometry.extent.center.latitude || geometry.extent.center.y;
                                longitude = geometry.extent.center.longitude || geometry.extent.center.x;
                            }
                        }

                        outageMap.set(outageId, {
                            ...attributes,
                            latitude: latitude || attributes.latitude,
                            longitude: longitude || attributes.longitude
                        });
                    });

                    // Convert map values to array
                    tombigbeeData.data = Array.from(outageMap.values());
                    log.info(`🔌 Tombigbee deduplication: ${tombigbeeLayer.graphics.items.length} graphics → ${tombigbeeData.data.length} unique outages`);
                }

                // If no layer data available, fall back to direct fetch (only during initialization)
                if ((!apcoData.data || apcoData.data.length === 0) && (!tombigbeeData.data || tombigbeeData.data.length === 0)) {
                    log.info('🔌 No layer data available, fetching directly (initialization only)');
                    log.info(`🔌 APCo layer data: ${apcoData.data?.length || 0} items, Tombigbee layer data: ${tombigbeeData.data?.length || 0} items`);
                    const [fetchedApcoData, fetchedTombigbeeData] = await Promise.all([
                        outageService.getApcoOutages(),
                        outageService.getTombigbeeOutages()
                    ]);
                    apcoData = fetchedApcoData;
                    tombigbeeData = fetchedTombigbeeData;
                } else {
                    log.info(`🔌 Using layer data - APCo: ${apcoData.data?.length || 0} outages (deduplicated), Tombigbee: ${tombigbeeData.data?.length || 0} outages (deduplicated)`);
                }
            } else {
                // Fallback for when layer manager is not available (early initialization)
                log.info('🔌 Layer manager not available, fetching directly (early initialization)');
                const [fetchedApcoData, fetchedTombigbeeData] = await Promise.all([
                    outageService.getApcoOutages(),
                    outageService.getTombigbeeOutages()
                ]);
                apcoData = fetchedApcoData;
                tombigbeeData = fetchedTombigbeeData;
            }

            this.outagesData.apco = apcoData.data || [];
            this.outagesData.tombigbee = tombigbeeData.data || [];

            // Get current counts
            const currentApcoCount = this.outagesData.apco.length;
            const currentTombigbeeCount = this.outagesData.tombigbee.length;

            // Track individual outages for specific notifications
            const currentApcoOutages = new Set(this.outagesData.apco.map(o => o.outage_id).filter(id => id));
            const currentTombigbeeOutages = new Set(this.outagesData.tombigbee.map(o => o.outage_id).filter(id => id));

            // Show notification for specific outage changes (new/removed outages only)
            if (!skipNotification && !this.isInitialLoad) {
                this.checkAndNotifyOutageChanges(
                    'APCo',
                    this.lastKnownOutages.apco,
                    currentApcoOutages,
                    this.outagesData.apco
                );

                this.checkAndNotifyOutageChanges(
                    'Tombigbee',
                    this.lastKnownOutages.tombigbee,
                    currentTombigbeeOutages,
                    this.outagesData.tombigbee
                );
            }

            // Update stored counts and outage sets
            this.lastKnownCounts.apco = currentApcoCount;
            this.lastKnownCounts.tombigbee = currentTombigbeeCount;
            this.lastKnownOutages.apco = new Set(currentApcoOutages);
            this.lastKnownOutages.tombigbee = new Set(currentTombigbeeOutages);
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

        // Combine all outages, filter out resolved outages (0 customers), and sort by customer count (highest first)
        const allOutages = [
            ...this.outagesData.apco.map(o => ({ ...o, company: 'APCo' })),
            ...this.outagesData.tombigbee.map(o => ({ ...o, company: 'Tombigbee' }))
        ]
            .filter(outage => (outage.customers_affected || 0) > 0) // Filter out resolved outages
            .sort((a, b) => (b.customers_affected || 0) - (a.customers_affected || 0));

        // Count filtered outages for display purposes
        const filteredApcoCount = this.outagesData.apco.filter(o => (o.customers_affected || 0) === 0).length;
        const filteredTombigbeeCount = this.outagesData.tombigbee.filter(o => (o.customers_affected || 0) === 0).length;
        const totalFiltered = filteredApcoCount + filteredTombigbeeCount;

        statsContent.innerHTML = `
            <!-- Static Summary Section -->
            <div class="power-stats-summary" style="margin-bottom: 16px; flex-shrink: 0;">
                ${this.renderCompanySummary('APCo', apcoCount, apcoCustomers)}
                ${this.renderCompanySummary('Tombigbee', tombigbeeCount, tombigbeeCustomers)}
                <div style="text-align: center; font-size: 11px; color: var(--calcite-color-text-3); margin-top: 8px;">
                    Last updated: ${currentTime}
                </div>
            </div>

            <!-- Refresh Button -->
            <div class="refresh-section" style="margin: 12px 0; flex-shrink: 0;">
                <calcite-button id="refresh-power-outages" icon-start="refresh" scale="s" width="full">
                    Refresh Power Outages
                </calcite-button>
            </div>

            <!-- Scrollable Outages List -->
            <div class="outages-list-container" style="border-top: 1px solid var(--calcite-color-border-2); padding-top: 12px; flex: 1; display: flex; flex-direction: column; min-height: 0;">
                <div style="font-size: 12px; font-weight: 600; color: var(--calcite-color-text-2); margin-bottom: 8px; text-transform: uppercase;">
                    Active Outages (${allOutages.length})${totalFiltered > 0 ?
                ` <span style="font-size: 10px; color: var(--calcite-color-text-3); font-weight: normal;">(${totalFiltered} resolved hidden)</span>` :
                ''}
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
            <calcite-card class="power-company-card" data-company="${company.toLowerCase()}">
                <div class="company-header">
                    <div class="company-info">
                        <img src="${logoPath}" alt="${company} Logo" class="company-logo">
                        <div class="company-details">
                            <div class="company-name">${companyFullName}</div>
                            <div class="customers-affected">${customerCount.toLocaleString()} affected</div>
                        </div>
                    </div>
                    <div class="company-actions">
                        <div class="outage-counter">
                            <div class="counter-value">${outageCount}</div>
                            <div class="counter-label">outages</div>
                        </div>
                        <calcite-switch scale="s" ${isChecked ? 'checked' : ''} 
                            class="power-company-toggle" 
                            data-layer-id="${layerId}"
                            data-company="${company}"
                            id="toggle-${layerId}">
                        </calcite-switch>
                    </div>
                </div>
            </calcite-card>
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

        // Refresh button event listener
        const refreshButton = this.querySelector('#refresh-power-outages');
        if (refreshButton) {
            // Remove existing listeners to prevent duplicates
            const newRefreshButton = refreshButton.cloneNode(true);
            refreshButton.parentNode.replaceChild(newRefreshButton, refreshButton);

            newRefreshButton.addEventListener('click', async () => {
                log.info('⚡ Manual power outage refresh triggered');
                newRefreshButton.setAttribute('loading', '');

                try {
                    // Set global flag to skip notifications during manual refresh
                    window._isManualRefresh = true;

                    // Clear cache for power outage data
                    const subscriberDataService = await import('../dataService.js').then(m => m.subscriberDataService);
                    subscriberDataService.refreshData('outages');

                    // Update power outage stats without notification
                    await this.updateStats(true); // Skip notification

                    // Trigger polling manager update if available
                    if (window.app?.pollingManager) {
                        await window.app.pollingManager.performUpdate('power-outages');
                    }
                } catch (error) {
                    log.error('Failed to refresh outage data:', error);
                } finally {
                    newRefreshButton.removeAttribute('loading');
                    // Clear manual refresh flag
                    window._isManualRefresh = false;
                }
            });
        }

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
            // Use consistent zoom level 15 for both APCo and Tombigbee outages
            await window.mapView.goTo({
                center: [lng, lat],
                zoom: 15
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
            let targetFeatures = [];

            const collectMatchingGraphics = (layer) => {
                const items = layer?.graphics?.items || layer?.graphics || [];
                return items.filter(g => {
                    const id = g?.attributes?.outage_id || g?.attributes?.id;
                    return id && id.toString() === String(outageId);
                });
            };

            // Prefer APCo if visible and has matching features
            if (apcoLayer && apcoLayer.visible) {
                if (typeof apcoLayer.queryFeatures === 'function') {
                    const apcoResults = await apcoLayer.queryFeatures({ where: `outage_id = '${outageId}'`, returnGeometry: true, outFields: ['*'] });
                    if (apcoResults?.features?.length) {
                        targetLayer = apcoLayer;
                        targetFeatures = apcoResults.features;
                    }
                } else {
                    const matches = collectMatchingGraphics(apcoLayer);
                    if (matches.length) {
                        targetLayer = apcoLayer;
                        targetFeatures = matches;
                    }
                }
            }

            // Fallback to Tombigbee
            if (!targetLayer && tombigbeeLayer && tombigbeeLayer.visible) {
                if (typeof tombigbeeLayer.queryFeatures === 'function') {
                    const tombigbeeResults = await tombigbeeLayer.queryFeatures({ where: `outage_id = '${outageId}'`, returnGeometry: true, outFields: ['*'] });
                    if (tombigbeeResults?.features?.length) {
                        targetLayer = tombigbeeLayer;
                        targetFeatures = tombigbeeResults.features;
                    }
                } else {
                    const matches = collectMatchingGraphics(tombigbeeLayer);
                    if (matches.length) {
                        targetLayer = tombigbeeLayer;
                        targetFeatures = matches;
                    }
                }
            }

            if (targetLayer) {
                window.mapView.popup.open({
                    features: targetFeatures
                });
            }

        } catch (error) {
            log.error('Failed to fly to outage:', error);
        }
    }

    /**
     * Check for specific outage changes and notify users
     * Only notifies for new outages or resolved outages
     * @param {string} company - Company name ('APCo' or 'Tombigbee')
     * @param {Set} previousOutages - Set of previous outage IDs
     * @param {Set} currentOutages - Set of current outage IDs
     * @param {Array} currentOutageData - Array of current outage objects
     * @private
     */
    checkAndNotifyOutageChanges(company, previousOutages, currentOutages, currentOutageData) {
        // Find new outages
        const newOutages = [...currentOutages].filter(id => !previousOutages.has(id));

        // Find resolved outages
        const resolvedOutages = [...previousOutages].filter(id => !currentOutages.has(id));

        // Only notify if there are actual new or resolved outages
        if (newOutages.length > 0 || resolvedOutages.length > 0) {
            this.showSpecificOutageNotification(company, newOutages, resolvedOutages, currentOutageData);
        }
    }

    /**
     * Show specific notification for new or resolved outages
     * Production-ready user feedback system with detailed outage information
     * @param {string} company - Company name ('APCo' or 'Tombigbee')
     * @param {Array} newOutages - Array of new outage IDs
     * @param {Array} resolvedOutages - Array of resolved outage IDs
     * @param {Array} currentOutageData - Array of current outage objects
     * @private
     */
    showSpecificOutageNotification(company, newOutages, resolvedOutages, currentOutageData) {
        // Remove any existing notice
        const existingNotice = document.querySelector('#outage-update-notice');
        if (existingNotice) {
            existingNotice.remove();
        }

        const companyFullName = company === 'APCo' ? 'Alabama Power' : 'Tombigbee Electric';
        let title = '';
        let message = '';
        let kind = 'info';

        // Build notification content
        const notifications = [];

        if (newOutages.length > 0) {
            kind = 'warning'; // New outages are concerning

            if (newOutages.length === 1) {
                // Single new outage - show specific details
                const outage = currentOutageData.find(o => o.outage_id === newOutages[0]);
                if (outage) {
                    const customersAffected = outage.customers_affected || 0;
                    const area = outage.area_description || 'Area';
                    notifications.push(`New ${companyFullName} outage: ${customersAffected.toLocaleString()} customers affected in ${area}`);
                } else {
                    notifications.push(`New ${companyFullName} outage reported`);
                }
            } else {
                // Multiple new outages - show summary
                const totalCustomers = newOutages.reduce((sum, id) => {
                    const outage = currentOutageData.find(o => o.outage_id === id);
                    return sum + (outage?.customers_affected || 0);
                }, 0);
                notifications.push(`${newOutages.length} new ${companyFullName} outages affecting ${totalCustomers.toLocaleString()} customers`);
            }
        }

        if (resolvedOutages.length > 0) {
            if (kind !== 'warning') {
                kind = 'success'; // Resolved outages are good news
            }

            if (resolvedOutages.length === 1) {
                notifications.push(`${companyFullName} outage resolved`);
            } else {
                notifications.push(`${resolvedOutages.length} ${companyFullName} outages resolved`);
            }
        }

        // Set title and message
        if (newOutages.length > 0 && resolvedOutages.length > 0) {
            title = 'Power Outage Updates';
        } else if (newOutages.length > 0) {
            title = 'New Power Outage';
        } else {
            title = 'Power Outage Resolved';
        }

        message = notifications.join('. ');

        // Skip on mobile devices
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768) {
            console.log('📱 Mobile outage notification skipped');
            return;
        }

        // Use shared notice container
        const noticeContainer = getOrCreateNoticeContainer();

        // Create notice
        const notice = document.createElement('calcite-notice');
        notice.id = 'outage-update-notice';
        notice.setAttribute('open', '');
        notice.setAttribute('kind', kind);
        notice.setAttribute('closable', '');
        notice.setAttribute('icon', 'flash');
        notice.setAttribute('width', 'auto');

        const titleDiv = document.createElement('div');
        titleDiv.slot = 'title';
        titleDiv.textContent = title;

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

        // Auto-remove after 8 seconds (longer for more detailed messages)
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
        }, 8000);
    }

    /**
     * Show update notification toast for outage changes (DEPRECATED - kept for backward compatibility)
     * Production-ready user feedback system
     * @param {number} prevApco - Previous APCo outage count
     * @param {number} currApco - Current APCo outage count
     * @param {number} prevTombigbee - Previous Tombigbee outage count
     * @param {number} currTombigbee - Current Tombigbee outage count
     * @private
     * @deprecated Use checkAndNotifyOutageChanges instead for specific outage tracking
     */
    showUpdateToast(prevApco, currApco, prevTombigbee, currTombigbee) {
        // Skip on mobile devices
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768) {
            console.log('📱 Mobile outage notification skipped');
            return;
        }

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

        // Use shared notice container
        const noticeContainer = getOrCreateNoticeContainer();

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