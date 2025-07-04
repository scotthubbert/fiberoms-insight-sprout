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
        this.isInitialLoad = true; // Track if this is the first load
        this.lastKnownCounts = {
            apco: null,
            tombigbee: null
        };
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        // Update statistics when component is connected
        this.updateStats();
        
        // Ensure component is ready for layer interaction
        setTimeout(() => {
            // Re-setup listeners in case DOM wasn't ready
            this.setupOutageListeners();
        }, 500);
    }

    setupEventListeners() {
        // Listen for layer visibility changes
        document.addEventListener('layerVisibilityChanged', (event) => {
            if (event.detail.layerId === 'apco-outages' || event.detail.layerId === 'tombigbee-outages') {
                this.updateStats();
            }
        });
    }

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
            
            // Only show notification if:
            // 1. Not skipping notifications
            // 2. Not the initial load
            // 3. We have previous counts to compare
            // 4. The counts have actually changed
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
            // Show error state
            this.renderError();
        }
    }


    render() {
        this.innerHTML = `
            <div style="padding: 4px 0;">
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
            hour12: true
        });

        // Combine all outages and sort by customer count (highest first)
        const allOutages = [
            ...this.outagesData.apco.map(o => ({...o, company: 'APCo'})),
            ...this.outagesData.tombigbee.map(o => ({...o, company: 'Tombigbee'}))
        ].sort((a, b) => (b.customers_affected || 0) - (a.customers_affected || 0));

        statsContent.innerHTML = `
            <!-- Static Summary Section -->
            <div style="margin-bottom: 16px;">
                ${this.renderCompanySummary('APCo', apcoCount, apcoCustomers)}
                ${this.renderCompanySummary('Tombigbee', tombigbeeCount, tombigbeeCustomers)}
                <div style="text-align: center; font-size: 11px; color: var(--calcite-color-text-3); margin-top: 8px;">
                    Last updated: ${currentTime}
                </div>
            </div>

            <!-- Scrollable Outages List -->
            <div style="border-top: 1px solid var(--calcite-color-border-2); padding-top: 12px;">
                <div style="font-size: 12px; font-weight: 600; color: var(--calcite-color-text-2); margin-bottom: 8px; text-transform: uppercase;">
                    Active Outages (${allOutages.length})
                </div>
                <div class="outages-list" style="max-height: 250px; overflow-y: auto; overflow-x: hidden;">
                    ${allOutages.length > 0 ?
                        allOutages.map(outage => this.renderSimpleOutageItem(outage)).join('') :
                        `<div style="text-align: center; color: var(--calcite-color-text-3); font-size: 14px; padding: 20px;">No active outages</div>`
                    }
                </div>
            </div>
        `;

        this.setupOutageListeners();
    }

    renderCompanySummary(company, outageCount, customerCount) {
        const bgColor = company === 'APCo' ? 'rgba(30, 95, 175, 0.1)' : 'rgba(74, 124, 89, 0.1)';
        const layerId = company === 'APCo' ? 'apco-outages' : 'tombigbee-outages';
        const logoPath = company === 'APCo' ? '/apco-logo.png' : '/tombigbee-logo.png';
        const companyFullName = company === 'APCo' ? 'Alabama Power' : 'Tombigbee Electric';
        
        // Get the current visibility state of the layer
        let isChecked = true; // Default to checked
        try {
            const layer = window.app?.services?.layerManager?.getLayer(layerId);
            if (layer) {
                isChecked = layer.visible;
            }
        } catch (error) {
            // Layer might not be loaded yet, use default
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

    renderSimpleOutageItem(outage) {
        const companyColor = outage.company === 'APCo' ? '#1e5faf' : '#4a7c59';
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--calcite-color-border-3);" 
                 class="outage-item" data-outage-id="${outage.outage_id}" data-lat="${outage.latitude}" data-lng="${outage.longitude}">
                <div style="flex: 1;">
                    <span style="font-size: 18px; font-weight: 600; color: #dc2626;">${(outage.customers_affected || 0).toLocaleString()}</span>
                    <span style="font-size: 12px; color: var(--calcite-color-text-2); margin-left: 8px;">customers</span>
                    <div style="font-size: 11px; color: ${companyColor}; margin-top: 2px;">${outage.company}</div>
                </div>
                <calcite-button scale="s" appearance="transparent" icon-start="pin-tear" class="locate-outage" title="View on map">
                    Locate
                </calcite-button>
            </div>
        `;
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
        // Locate outage buttons
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

        // Power company toggle switches - wait for them to be ready
        setTimeout(() => {
            const toggleSwitches = this.querySelectorAll('.power-company-toggle');
            log.info(`Found ${toggleSwitches.length} power company toggles in PowerOutageStats`);
            toggleSwitches.forEach(toggle => {
                // Remove any existing listeners first
                const newToggle = toggle.cloneNode(true);
                toggle.parentNode.replaceChild(newToggle, toggle);
                
                // Add the listener to the new element
                newToggle.addEventListener('calciteSwitchChange', async (e) => {
                    const layerId = newToggle.dataset.layerId;
                    const isChecked = e.target.checked;
                    
                    log.info(`⚡ Toggle clicked: ${newToggle.dataset.company} (${layerId}) - ${isChecked}`);
                    
                    // Try direct LayerManager access first
                    if (window.app?.services?.layerManager) {
                        const result = await window.app.services.layerManager.toggleLayerVisibility(layerId, isChecked);
                        if (result) {
                            log.info(`✅ Successfully toggled ${newToggle.dataset.company} layer visibility`);
                        } else {
                            log.error(`❌ Failed to toggle ${newToggle.dataset.company} layer visibility`);
                        }
                    } else {
                        // Fallback: dispatch custom event
                        log.info('Using custom event fallback for power outage toggle');
                        document.dispatchEvent(new CustomEvent('powerOutageToggle', {
                            detail: { layerId, visible: isChecked }
                        }));
                    }
                });
            });
        }, 100); // Small delay to ensure DOM is ready
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
            // No actual count changes, just data refresh
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
            // Remove container if empty
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
                }, 300); // Allow animation to complete
            }
        }, 5000);
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