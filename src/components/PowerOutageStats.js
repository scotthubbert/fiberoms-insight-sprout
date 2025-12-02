/**
 * PowerOutageStats.js - Power outage statistics component
 * Mobile-first Web Component for displaying real-time power outage data
 * Follows SOLID principles and Calcite Design System
 * 
 * @component PowerOutageStatsComponent
 */

import { outageService } from '../services/OutageService.js';
import { getOrCreateNoticeContainer } from '../utils/noticeContainer.js';

/**
 * Production logging utility - only warnings and errors in production
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
    constructor() {
        super();
        this.outagesData = {
            cullman: []
        };
        this.isVisible = false;
        this.isInitialLoad = true;
        this.lastKnownCounts = {
            cullman: null
        };
        // Track individual outages by ID for specific notifications
        this.lastKnownOutages = {
            cullman: new Set()
        };
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();

        // Delay initial stats update to allow layers to initialize first
        setTimeout(() => {
            this.updateStats();
        }, 2000);

        // Ensure component is ready for layer interaction
        setTimeout(() => {
            this.setupOutageListeners();
        }, 500);
    }

    setupEventListeners() {
        // Listen for layer visibility changes
        document.addEventListener('layerVisibilityChanged', (event) => {
            if (event.detail.layerId === 'cullman-outages') {
                this.updateStats();
            }
        });

        // Listen for layer data updates (when polling updates the layers)
        document.addEventListener('layerDataUpdated', (event) => {
            if (event.detail.layerId === 'cullman-outages') {
                this.updateStats();
            }
        });

        // Listen for power outage data updates from polling
        document.addEventListener('powerOutageDataUpdated', () => {
            this.updateStats();
        });
    }

    async updateStats(skipNotification = false) {
        try {
            // Get data from existing layers instead of fetching directly
            const layerManager = window.app?.services?.layerManager;
            let cullmanData = { data: [] };

            if (layerManager) {
                const cullmanLayer = layerManager.getLayer('cullman-outages');

                log.info(`🔌 Layer manager found. Cullman layer: ${!!cullmanLayer}`);

                if (cullmanLayer) {
                    log.info(`🔌 Cullman layer details: graphics=${!!cullmanLayer.graphics}, graphics.items=${cullmanLayer.graphics?.items?.length || 'none'}`);
                }

                if (cullmanLayer && cullmanLayer.graphics && cullmanLayer.graphics.items) {
                    // Extract data from layer graphics and deduplicate by outage_id
                    const outageMap = new Map();

                    cullmanLayer.graphics.items.forEach(graphic => {
                        const attributes = graphic.attributes || {};
                        const geometry = graphic.geometry;

                        const outageId = attributes.outage_id || attributes.id || 'unknown';

                        if (outageMap.has(outageId)) {
                            return;
                        }

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

                    cullmanData.data = Array.from(outageMap.values());
                    log.info(`🔌 Cullman deduplication: ${cullmanLayer.graphics.items.length} graphics → ${cullmanData.data.length} unique outages`);
                }

                // If no layer data available, fall back to direct fetch
                if (!cullmanData.data || cullmanData.data.length === 0) {
                    log.info('🔌 No layer data available, fetching directly (initialization only)');
                    cullmanData = await outageService.getCullmanOutages();
                } else {
                    log.info(`🔌 Using layer data - Cullman: ${cullmanData.data?.length || 0} outages (deduplicated)`);
                }
            } else {
                // Fallback for when layer manager is not available
                log.info('🔌 Layer manager not available, fetching directly (early initialization)');
                cullmanData = await outageService.getCullmanOutages();
            }

            this.outagesData.cullman = cullmanData.data || [];

            const currentCullmanCount = this.outagesData.cullman.length;
            const currentCullmanOutages = new Set(this.outagesData.cullman.map(o => o.outage_id).filter(id => id));

            // Show notification for specific outage changes
            if (!skipNotification && !this.isInitialLoad) {
                this.checkAndNotifyOutageChanges(
                    'Cullman',
                    this.lastKnownOutages.cullman,
                    currentCullmanOutages,
                    this.outagesData.cullman
                );
            }

            this.lastKnownCounts.cullman = currentCullmanCount;
            this.lastKnownOutages.cullman = new Set(currentCullmanOutages);
            this.isInitialLoad = false;

            this.renderStats();
        } catch (error) {
            log.error('Failed to update outage stats:', error);
            this.renderError();
        }
    }

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

    renderStats() {
        const statsContent = this.querySelector('.stats-content');
        if (!statsContent) return;

        const cullmanCount = this.outagesData.cullman.length;
        const cullmanCustomers = this.outagesData.cullman.reduce((sum, outage) => sum + (outage.customers_affected || 0), 0);

        const currentTime = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Combine all outages, filter out resolved outages, and sort by customer count
        const allOutages = [
            ...this.outagesData.cullman.map(o => ({ ...o, company: 'Cullman' }))
        ]
            .filter(outage => (outage.customers_affected || 0) > 0)
            .sort((a, b) => (b.customers_affected || 0) - (a.customers_affected || 0));

        const filteredCullmanCount = this.outagesData.cullman.filter(o => (o.customers_affected || 0) === 0).length;
        const totalFiltered = filteredCullmanCount;

        statsContent.innerHTML = `
            <!-- Static Summary Section -->
            <div class="power-stats-summary" style="margin-bottom: 16px; flex-shrink: 0;">
                ${this.renderCompanySummary('Cullman', cullmanCount, cullmanCustomers)}
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

    renderCompanySummary(company, outageCount, customerCount) {
        const bgColor = 'rgba(74, 124, 89, 0.1)';
        const layerId = 'cullman-outages';
        const logoPath = '/logos/cec-logo.png';
        const companyFullName = 'Cullman Electric';

        let isChecked = true;
        try {
            const layer = window.app?.services?.layerManager?.getLayer(layerId);
            if (layer) {
                isChecked = layer.visible;
            }
        } catch (error) {
            log.warn(`Layer ${layerId} not found, using default visibility`);
        }

        return `
            <calcite-card class="power-company-card" data-company="cullman">
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

    renderCalciteOutageItem(outage) {
        const logoPath = '/logos/cec-logo.png';
        const companyFullName = 'Cullman Electric';

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

    setupOutageListeners() {
        // Clickable outage items
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

        // Refresh button event listener
        const refreshButton = this.querySelector('#refresh-power-outages');
        if (refreshButton) {
            const newRefreshButton = refreshButton.cloneNode(true);
            refreshButton.parentNode.replaceChild(newRefreshButton, refreshButton);

            newRefreshButton.addEventListener('click', async () => {
                log.info('⚡ Manual power outage refresh triggered');
                newRefreshButton.setAttribute('loading', '');

                try {
                    window._isManualRefresh = true;
                    await this.updateStats(true);

                    if (window.app?.pollingManager) {
                        await window.app.pollingManager.performUpdate('power-outages');
                    }
                } catch (error) {
                    log.error('Failed to refresh outage data:', error);
                } finally {
                    newRefreshButton.removeAttribute('loading');
                    window._isManualRefresh = false;
                }
            });
        }

        // Power company toggle switches
        setTimeout(() => {
            const toggleSwitches = this.querySelectorAll('.power-company-toggle');
            toggleSwitches.forEach(toggle => {
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

    async flyToOutage(lat, lng, outageId) {
        if (!window.mapView) {
            log.error('Map view not available');
            return;
        }

        try {
            await window.mapView.goTo({
                center: [lng, lat],
                zoom: 15
            });

            const cullmanLayer = window.app?.services?.layerManager?.getLayer('cullman-outages');

            let targetLayer = null;
            let targetFeatures = [];

            const collectMatchingGraphics = (layer) => {
                const items = layer?.graphics?.items || layer?.graphics || [];
                return items.filter(g => {
                    const id = g?.attributes?.outage_id || g?.attributes?.id;
                    return id && id.toString() === String(outageId);
                });
            };

            if (cullmanLayer && cullmanLayer.visible) {
                if (typeof cullmanLayer.queryFeatures === 'function') {
                    const cullmanResults = await cullmanLayer.queryFeatures({ where: `outage_id = '${outageId}'`, returnGeometry: true, outFields: ['*'] });
                    if (cullmanResults?.features?.length) {
                        targetLayer = cullmanLayer;
                        targetFeatures = cullmanResults.features;
                    }
                } else {
                    const matches = collectMatchingGraphics(cullmanLayer);
                    if (matches.length) {
                        targetLayer = cullmanLayer;
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

    checkAndNotifyOutageChanges(company, previousOutages, currentOutages, currentOutageData) {
        const newOutages = [...currentOutages].filter(id => !previousOutages.has(id));
        const resolvedOutages = [...previousOutages].filter(id => !currentOutages.has(id));

        if (newOutages.length > 0 || resolvedOutages.length > 0) {
            this.showSpecificOutageNotification(company, newOutages, resolvedOutages, currentOutageData);
        }
    }

    showSpecificOutageNotification(company, newOutages, resolvedOutages, currentOutageData) {
        const existingNotice = document.querySelector('#outage-update-notice');
        if (existingNotice) {
            existingNotice.remove();
        }

        const companyFullName = 'Cullman Electric';
        let title = '';
        let message = '';
        let kind = 'info';

        const notifications = [];

        if (newOutages.length > 0) {
            kind = 'warning';

            if (newOutages.length === 1) {
                const outage = currentOutageData.find(o => o.outage_id === newOutages[0]);
                if (outage) {
                    const customersAffected = outage.customers_affected || 0;
                    const area = outage.area_description || 'Area';
                    notifications.push(`New ${companyFullName} outage: ${customersAffected.toLocaleString()} customers affected in ${area}`);
                } else {
                    notifications.push(`New ${companyFullName} outage reported`);
                }
            } else {
                const totalCustomers = newOutages.reduce((sum, id) => {
                    const outage = currentOutageData.find(o => o.outage_id === id);
                    return sum + (outage?.customers_affected || 0);
                }, 0);
                notifications.push(`${newOutages.length} new ${companyFullName} outages affecting ${totalCustomers.toLocaleString()} customers`);
            }
        }

        if (resolvedOutages.length > 0) {
            if (kind !== 'warning') {
                kind = 'success';
            }

            if (resolvedOutages.length === 1) {
                notifications.push(`${companyFullName} outage resolved`);
            } else {
                notifications.push(`${resolvedOutages.length} ${companyFullName} outages resolved`);
            }
        }

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

        const noticeContainer = getOrCreateNoticeContainer();

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

        notice.addEventListener('calciteNoticeClose', () => {
            notice.remove();
            if (noticeContainer.children.length === 0) {
                noticeContainer.remove();
            }
        });

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

