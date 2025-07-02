// PowerOutageStats.js - Power outage statistics component
import { subscriberDataService } from '../dataService.js';

// Production logging utility
const isDevelopment = import.meta.env.DEV;
const log = {
    info: (...args) => isDevelopment && console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

export class PowerOutageStatsComponent extends HTMLElement {
    constructor() {
        super();
        this.outagesData = {
            apco: [],
            tombigbee: []
        };
        this.isVisible = false;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        // Update statistics when component is connected
        this.updateStats();
    }

    setupEventListeners() {
        // Listen for layer visibility changes
        document.addEventListener('layerVisibilityChanged', (event) => {
            if (event.detail.layerId === 'apco-outages' || event.detail.layerId === 'tombigbee-outages') {
                this.updateStats();
            }
        });

        // Refresh icon
        const refreshIcon = this.querySelector('.refresh-outages');
        if (refreshIcon) {
            refreshIcon.addEventListener('click', () => this.refreshOutages());
        }
    }

    async updateStats() {
        try {
            // Fetch current outage data
            const [apcoData, tombigbeeData] = await Promise.all([
                subscriberDataService.getApcoOutages(),
                subscriberDataService.getTombigbeeOutages()
            ]);

            this.outagesData.apco = apcoData.data || [];
            this.outagesData.tombigbee = tombigbeeData.data || [];

            this.renderStats();
        } catch (error) {
            log.error('Failed to update outage stats:', error);
            // Show error state
            this.renderError();
        }
    }

    async refreshOutages() {
        const refreshIcon = this.querySelector('.refresh-outages');
        if (refreshIcon) {
            refreshIcon.style.opacity = '0.5';
            refreshIcon.style.pointerEvents = 'none';
        }

        try {
            // Clear cache to get fresh data
            subscriberDataService.clearCache();
            await this.updateStats();
        } catch (error) {
            log.error('Failed to refresh outages:', error);
        } finally {
            if (refreshIcon) {
                refreshIcon.style.opacity = '1';
                refreshIcon.style.pointerEvents = 'auto';
            }
        }
    }

    render() {
        this.innerHTML = `
            <div style="padding: 4px 0;">
                <div style="display: flex; align-items: center; justify-content: flex-end; margin-bottom: 8px;">
                    <calcite-icon 
                        icon="refresh" 
                        scale="s" 
                        class="refresh-outages"
                        style="color: var(--calcite-color-text-3); cursor: pointer; padding: 4px;"
                        title="Refresh outage data">
                    </calcite-icon>
                </div>
                <div class="stats-content">
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

        const apcoCount = this.outagesData.apco.length;
        const tombigbeeCount = this.outagesData.tombigbee.length;

        const apcoCustomers = this.outagesData.apco.reduce((sum, outage) => sum + (outage.customers_affected || 0), 0);
        const tombigbeeCustomers = this.outagesData.tombigbee.reduce((sum, outage) => sum + (outage.customers_affected || 0), 0);

        const currentTime = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        statsContent.innerHTML = `
            ${this.renderCompanySection('APCo', 'Alabama Power (APCo)', '/apco-logo.png', apcoCount, apcoCustomers, this.outagesData.apco, currentTime)}
            ${this.renderCompanySection('Tombigbee', 'Tombigbee Electric Cooperative', '/tombigbee-logo.png', tombigbeeCount, tombigbeeCustomers, this.outagesData.tombigbee, 'Loading...')}
        `;

        this.setupOutageListeners();
    }

    renderCompanySection(companyKey, companyName, logoPath, outageCount, customerCount, outages, lastUpdated) {
        const logoIcon = companyKey === 'APCo' ? 'triangle' : 'circle';
        const logoColor = companyKey === 'APCo' ? '#dc2626' : '#16a34a';

        return `
            <div style="background: var(--calcite-color-foreground-1); border: 1px solid var(--calcite-color-border-2); border-radius: 4px; padding: 16px; margin-bottom: 16px;">
                <!-- Header with logo and company name -->
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                    <calcite-icon icon="${logoIcon}" scale="s" style="color: ${logoColor}; margin-right: 8px;"></calcite-icon>
                    <span style="font-weight: 600; font-size: 16px; color: var(--calcite-color-text-1);">${companyName}</span>
                </div>

                <!-- Statistics display -->
                <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                    <div style="text-align: center; flex: 1;">
                        <div style="font-size: 32px; font-weight: 700; color: var(--calcite-color-text-1); margin-bottom: 4px;">${outageCount}</div>
                        <div style="font-size: 11px; color: var(--calcite-color-text-3); text-transform: uppercase; letter-spacing: 0.5px;">ACTIVE OUTAGES</div>
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <div style="font-size: 32px; font-weight: 700; color: var(--calcite-color-text-1); margin-bottom: 4px;">${customerCount}</div>
                        <div style="font-size: 11px; color: var(--calcite-color-text-3); text-transform: uppercase; letter-spacing: 0.5px;">CUSTOMERS AFFECTED</div>
                    </div>
                </div>

                <!-- Last updated -->
                <div style="text-align: center; font-size: 12px; color: var(--calcite-color-text-3); margin-bottom: 16px;">
                    Last updated: ${lastUpdated}
                </div>

                <!-- Outages list or no outages message -->
                ${outages.length > 0 ?
                outages.map(outage => this.renderOutageCard(outage)).join('') :
                `<div style="text-align: center; color: var(--calcite-color-text-2); font-size: 14px; padding: 20px;">No active outages</div>`
            }
            </div>
        `;
    }

    renderOutageCard(outage) {
        return `
            <div style="border: 1px solid var(--calcite-color-border-2); border-radius: 4px; padding: 12px; margin-bottom: 8px; background: var(--calcite-color-foreground-1);" 
                 class="outage-item" data-outage-id="${outage.outage_id}" data-lat="${outage.latitude}" data-lng="${outage.longitude}">
                
                <!-- First row: Outage ID and customer count -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 600; font-size: 14px; color: var(--calcite-color-text-1);">
                        ${outage.outage_id || 'Unknown'}
                    </div>
                    <div style="color: #dc2626; font-weight: 500; font-size: 13px;">
                        ${outage.customers_affected || 0} customers
                    </div>
                </div>
                
                <!-- Cause -->
                <div style="color: var(--calcite-color-text-2); font-size: 13px; margin-bottom: 8px;">
                    Cause: ${outage.cause || 'Under investigation'}
                </div>
                
                <!-- Click to view on map link -->
                <div style="display: flex; align-items: center;">
                    <calcite-icon icon="pin-tear" scale="s" style="color: var(--calcite-color-brand); margin-right: 4px;"></calcite-icon>
                    <span style="color: var(--calcite-color-brand); font-size: 13px; cursor: pointer;" class="fly-to-outage">
                        Click to view on map
                    </span>
                </div>
            </div>
        `;
    }

    setupOutageListeners() {
        // Fly to outage location links
        const flyToLinks = this.querySelectorAll('.fly-to-outage');
        flyToLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                const outageItem = link.closest('.outage-item');
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
    }

    async flyToOutage(lat, lng, outageId) {
        if (!window.mapView) return;

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
                zoom: isPolygon ? 12 : 15 // Zoom out more for polygon outages
            });

            // Find and highlight the outage feature
            const apcoLayer = window.app?.services?.layerManager?.getLayer('apco-outages');
            const tombigbeeLayer = window.app?.services?.layerManager?.getLayer('tombigbee-outages');

            // Show popup for the outage
            const point = {
                type: 'point',
                longitude: lng,
                latitude: lat
            };

            // Query the appropriate layer
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
                // Show popup at the outage location
                window.mapView.popup.open({
                    location: point,
                    features: await targetLayer.queryFeatures({
                        where: `outage_id = '${outageId}'`,
                        returnGeometry: true,
                        outFields: ['*']
                    }).then(result => result.features)
                });
            }

            log.info(`🎯 Flew to outage: ${outageId} at ${lat}, ${lng}`);
        } catch (error) {
            log.error('Failed to fly to outage:', error);
        }
    }

    renderError() {
        const statsContent = this.querySelector('.stats-content');
        if (statsContent) {
            statsContent.innerHTML = `
                <div class="stats-error">
                    <calcite-icon icon="exclamation-mark-triangle"></calcite-icon>
                    <span>Failed to load outage data</span>
                </div>
            `;
        }
    }
}

// Register the custom element
customElements.define('power-outage-stats', PowerOutageStatsComponent); 