// LayerPanel.js - Manages left shell panel navigation and content
import { createLogger } from '../utils/logger.js';
import { getOrCreateNoticeContainer } from '../utils/noticeContainer.js';
import { trackClick as trackClickSentry } from '../services/SentryService.js';
import { trackClick, trackFeatureUsage } from '../services/AnalyticsService.js';

// Initialize logger for this module
const log = createLogger('LayerPanel');

export class LayerPanel {
    constructor() {
        this.shellPanel = document.getElementById('shell-panel-start');
        this.panel = document.getElementById('panel-content');
        this.panelCollapseToggle = document.getElementById('panel-collapse-toggle');

        // Get all actions
        this.actions = this.shellPanel?.querySelectorAll('calcite-action');

        // Content sections
        this.layersContent = document.getElementById('layers-content');
        this.ospContent = document.getElementById('osp-content');
        this.vehiclesContent = document.getElementById('vehicles-content');
        this.searchContent = document.getElementById('search-content');
        this.powerOutagesContent = document.getElementById('power-outages-content');
        this.networkParentContent = document.getElementById('network-parent-content');
        this.toolsContent = document.getElementById('tools-content');
        this.infoContent = document.getElementById('info-content');

        // Initialize state
        this.currentVehicleData = [];
        this.vehiclePopupPending = false;
        this.lastFocusedVehicle = null; // { point, name }
        this.vehiclePopupWatcherSetup = false;
        this.isPanelCollapsed = false;

        this.init();
    }

    async init() {
        await customElements.whenDefined('calcite-shell-panel');
        await customElements.whenDefined('calcite-action-bar');
        await customElements.whenDefined('calcite-action');
        await customElements.whenDefined('calcite-panel');

        this.setupActionBarNavigation();
        this.setupCacheManagement();
        this.setupPanelCollapse();

        // Show layers content by default
        this.showContent('layers');

        // Set up vehicle popup watcher when map view becomes available
        this.ensureVehiclePopupWatcher();
    }

    async ensureVehiclePopupWatcher() {
        if (this.vehiclePopupWatcherSetup) return;
        const mapView = window.mapView;
        if (!mapView) {
            // Retry shortly if view not yet available
            setTimeout(() => this.ensureVehiclePopupWatcher(), 500);
            return;
        }
        try {
            const reactiveUtilsModule = await import('@arcgis/core/core/reactiveUtils');
            const reactiveUtils = reactiveUtilsModule;
            const vehiclePopupScaleThreshold = 144000; // Zoom level ~12

            reactiveUtils.watch(() => mapView.scale, (scale) => {
                try {
                    if (this.vehiclePopupPending && this.lastFocusedVehicle && scale <= vehiclePopupScaleThreshold) {
                        const { point, name } = this.lastFocusedVehicle;
                        mapView.popup.open({
                            title: name,
                            content: `Vehicle Name: ${name}`
                        });
                        this.vehiclePopupPending = false;
                    }
                } catch (err) {
                    log.error('Vehicle popup on zoom error:', err);
                }
            });

            this.vehiclePopupWatcherSetup = true;
        } catch (error) {
            log.error('Failed to set up vehicle popup watcher:', error);
        }
    }

    setupPanelCollapse() {
        if (!this.panelCollapseToggle || !this.shellPanel) {
            log.warn('Panel collapse toggle or shell panel not found');
            return;
        }

        // Get the action bar
        const actionBar = this.shellPanel.querySelector('calcite-action-bar');
        log.info(`Action bar found: ${!!actionBar}`);

        // Restore collapsed state from localStorage (default to expanded)
        const savedState = localStorage.getItem('panel-collapsed');
        this.isPanelCollapsed = savedState === 'true';
        
        // Force action bar to always be expanded (CSS hides the collapse button)
        if (actionBar) {
            actionBar.expanded = true;
            log.info(`Action bar expanded set to true`);
        } else {
            log.error('❌ Action bar element NOT FOUND!');
        }
        
        // Apply the saved panel state (or default to expanded)
        this.shellPanel.collapsed = this.isPanelCollapsed;
        
        if (this.isPanelCollapsed) {
            this.panelCollapseToggle.icon = 'chevrons-right';
            this.panelCollapseToggle.text = 'Expand panel';
            this.panelCollapseToggle.title = 'Expand panel';
            log.info('Panel restored to collapsed state from localStorage');
        } else {
            this.panelCollapseToggle.icon = 'chevrons-left';
            this.panelCollapseToggle.text = 'Collapse panel';
            this.panelCollapseToggle.title = 'Collapse panel';
            log.info('Panel set to expanded state (default or from localStorage)');
        }

        // Set up click handler for collapse toggle (in panel header)
        this.panelCollapseToggle.addEventListener('click', () => {
            this.togglePanelCollapse();
        });

        log.info('Panel collapse functionality initialized with localStorage support');
    }

    togglePanelCollapse() {
        this.isPanelCollapsed = !this.isPanelCollapsed;
        
        // Toggle the collapsed attribute on the shell panel
        this.shellPanel.collapsed = this.isPanelCollapsed;

        // Update the button icon and text
        if (this.isPanelCollapsed) {
            this.panelCollapseToggle.icon = 'chevrons-right';
            this.panelCollapseToggle.text = 'Expand panel';
            this.panelCollapseToggle.title = 'Expand panel';
        } else {
            this.panelCollapseToggle.icon = 'chevrons-left';
            this.panelCollapseToggle.text = 'Collapse panel';
            this.panelCollapseToggle.title = 'Collapse panel';
        }

        // Save state to localStorage
        localStorage.setItem('panel-collapsed', this.isPanelCollapsed.toString());

        // Track usage for analytics
        trackFeatureUsage('panel-collapse', { collapsed: this.isPanelCollapsed });
        
        log.info(`Panel ${this.isPanelCollapsed ? 'collapsed' : 'expanded'}`);
    }

    setupActionBarNavigation() {
        // Set up action click handlers following the Calcite example pattern
        this.actions?.forEach(action => {
            action.addEventListener('click', (event) => {
                const actionId = action.id;

                // Map action IDs to content names
                const contentMap = {
                    'layers-action': 'layers',
                    'osp-action': 'osp',
                    'vehicles-action': 'vehicles',
                    'search-action': 'search',
                    'power-outages-action': 'power-outages',
                    'network-parent-action': 'network-parent',
                    'tools-action': 'tools',
                    'info-action': 'info'
                };

                const contentName = contentMap[actionId];

                if (contentName) {
                    // If panel is collapsed, expand it when any action is clicked
                    if (this.isPanelCollapsed) {
                        this.isPanelCollapsed = false;
                        this.shellPanel.collapsed = false;
                        this.panelCollapseToggle.icon = 'chevrons-left';
                        this.panelCollapseToggle.text = 'Collapse panel';
                        this.panelCollapseToggle.title = 'Collapse panel';
                        localStorage.setItem('panel-collapsed', 'false');
                        log.info('Panel expanded via action click');
                    }

                    // Track navigation click (both Sentry and PostHog)
                    trackClickSentry(actionId, {
                        section: 'navigation',
                        content: contentName,
                        actionText: action.text || ''
                    });
                    trackClick(actionId, {
                        section: 'navigation',
                        content: contentName,
                        action_text: action.text || ''
                    });
                    trackFeatureUsage(`navigation_${contentName}`, {
                        action_id: actionId
                    });

                    // Update all action states
                    this.actions.forEach(a => a.active = false);
                    action.active = true;

                    // Update panel heading
                    if (this.panel) {
                        this.panel.heading = action.text;
                    }

                    // Show appropriate content
                    this.showContent(contentName);
                }
            });
        });
    }

    showContent(contentName) {
        // Hide all content sections
        if (this.layersContent) this.layersContent.hidden = true;
        if (this.ospContent) this.ospContent.hidden = true;
        if (this.vehiclesContent) this.vehiclesContent.hidden = true;
        if (this.searchContent) this.searchContent.hidden = true;
        if (this.powerOutagesContent) this.powerOutagesContent.hidden = true;
        if (this.networkParentContent) this.networkParentContent.hidden = true;
        if (this.toolsContent) this.toolsContent.hidden = true;
        if (this.infoContent) this.infoContent.hidden = true;

        // Show selected content
        switch (contentName) {
            case 'layers':
                if (this.layersContent) {
                    this.layersContent.hidden = false;
                    this.layersContent.style.display = '';
                }
                break;
            case 'osp':
                if (this.ospContent) {
                    this.ospContent.hidden = false;
                    this.ospContent.style.display = '';
                }
                break;
            case 'vehicles':
                if (this.vehiclesContent) {
                    this.vehiclesContent.hidden = false;
                    this.vehiclesContent.style.display = '';
                }
                this.updateVehicleStatus();
                this.loadSimpleVehicleList();
                break;
            case 'search':
                if (this.searchContent) {
                    this.searchContent.hidden = false;
                    this.searchContent.style.display = '';
                }
                break;
            case 'power-outages':
                if (this.powerOutagesContent) {
                    this.powerOutagesContent.hidden = false;
                    this.powerOutagesContent.style.display = '';
                }
                break;
            case 'network-parent':
                if (this.networkParentContent) {
                    this.networkParentContent.hidden = false;
                    this.networkParentContent.style.display = '';
                }
                break;
            case 'tools':
                if (this.toolsContent) {
                    this.toolsContent.hidden = false;
                    this.toolsContent.style.display = '';
                }
                this.updateCacheStatus();
                break;
            case 'info':
                if (this.infoContent) {
                    this.infoContent.hidden = false;
                    this.infoContent.style.display = '';
                }
                this.updateBuildInfo();
                break;
        }
    }

    updateVehicleStatus() {
        // Update the GeotabService status in the vehicles panel
        this.updateGeotabStatus();
        this.setupVehicleButtons();
    }

    async updateGeotabStatus() {
        try {
            const { geotabService } = await import('../services/GeotabService.js');
            const status = geotabService.getStatus();

            const statusChip = document.getElementById('geotab-status-chip');
            if (statusChip) {
                if (status.enabled && status.authenticated) {
                    statusChip.textContent = 'Connected';
                    statusChip.kind = 'success';
                } else if (status.enabled && !status.authenticated) {
                    statusChip.textContent = 'Connecting...';
                    statusChip.kind = 'info';
                } else {
                    statusChip.textContent = 'Disabled';
                    statusChip.kind = 'neutral';
                }
            }
        } catch (error) {
            log.error('Failed to update GeotabService status:', error);
            const statusChip = document.getElementById('geotab-status-chip');
            if (statusChip) {
                statusChip.textContent = 'Error';
                statusChip.kind = 'danger';
            }
        }
    }

    setupVehicleButtons() {
        // Set up refresh vehicles button
        const refreshBtn = document.getElementById('refresh-vehicles');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.refreshVehicles();
                // Also refresh the simple vehicle list
                await this.loadSimpleVehicleList();
            });
        }

        // Set up vehicle layer toggle listeners
        this.setupVehicleLayerToggles();
    }

    setupVehicleLayerToggles() {
        // Listen for vehicle layer toggle changes and refresh the list
        const vehicleToggles = document.querySelectorAll('#vehicles-content calcite-checkbox');
        vehicleToggles.forEach(toggle => {
            toggle.addEventListener('calciteCheckboxChange', async () => {
                // Small delay to allow layer changes to process
                setTimeout(() => {
                    this.loadSimpleVehicleList();
                }, 100);
            });
        });
    }

    async refreshVehicles() {
        try {
            const { geotabService } = await import('../services/GeotabService.js');

            // Show loading indicator
            const refreshBtn = document.getElementById('refresh-vehicles');
            if (refreshBtn) {
                refreshBtn.loading = true;
                refreshBtn.disabled = true;
            }

            // Refresh vehicle data and get the actual truck data
            const truckData = await geotabService.getTruckData();

            // Update status
            this.updateGeotabStatus();

            // Update layer data with the actual truck data if available
            if (window.app?.services?.layerManager && truckData) {
                // Convert truck data to GeoJSON format for layer updates
                if (truckData.electric && truckData.electric.length > 0) {
                    const electricGeoJSON = {
                        type: "FeatureCollection",
                        features: truckData.electric.map(truck => ({
                            type: "Feature",
                            properties: truck,
                            geometry: {
                                type: "Point",
                                coordinates: [truck.longitude, truck.latitude]
                            }
                        }))
                    };
                    await window.app.services.layerManager.updateLayerData('electric-trucks', electricGeoJSON);
                }

                if (truckData.fiber && truckData.fiber.length > 0) {
                    const fiberGeoJSON = {
                        type: "FeatureCollection",
                        features: truckData.fiber.map(truck => ({
                            type: "Feature",
                            properties: truck,
                            geometry: {
                                type: "Point",
                                coordinates: [truck.longitude, truck.latitude]
                            }
                        }))
                    };
                    await window.app.services.layerManager.updateLayerData('fiber-trucks', fiberGeoJSON);
                }
            }

            // Show success notification
            // Get updated vehicle counts for specific message
            const geotabLayer = this.services?.layerManager?.getLayer?.('geotab-vehicles');
            const truckLayer = this.services?.layerManager?.getLayer?.('trucks');

            let vehicleCount = 0;
            if (geotabLayer?.graphics?.items) vehicleCount += geotabLayer.graphics.items.length;
            if (truckLayer?.graphics?.items) vehicleCount += truckLayer.graphics.items.length;

            const message = vehicleCount > 0
                ? `${vehicleCount.toLocaleString()} vehicle locations updated`
                : 'Vehicle locations refreshed (no active vehicles)';

            this.showVehicleNotification(message, 'success');

        } catch (error) {
            log.error('Failed to refresh vehicles:', error);
            this.showVehicleNotification('Failed to refresh vehicle locations', 'danger');
        } finally {
            // Reset button state
            const refreshBtn = document.getElementById('refresh-vehicles');
            if (refreshBtn) {
                refreshBtn.loading = false;
                refreshBtn.disabled = false;
            }
        }
    }

    async loadSimpleVehicleList() {
        log.info('🚛 Loading simple vehicle list...');
        const vehiclesList = document.getElementById('vehicle-list');
        if (!vehiclesList) {
            log.error('🚛 vehicle-list element not found');
            return;
        }

        // Clear existing vehicles
        vehiclesList.innerHTML = '';

        try {
            // Wait for CalciteUI components to be ready
            await customElements.whenDefined('calcite-list-item');
            await customElements.whenDefined('calcite-icon');

            // Get vehicle data from layers or GeotabService
            const allVehicles = await this.getVehicleData();
            log.info('🚛 Retrieved vehicles:', allVehicles.length);

            if (allVehicles.length === 0) {
                // Show empty state
                const emptyItem = document.createElement('calcite-list-item');
                emptyItem.setAttribute('label', 'No vehicles available');
                emptyItem.setAttribute('description', 'Enable Electric or Fiber truck layers to see vehicles');
                emptyItem.disabled = true;

                const infoIcon = document.createElement('calcite-icon');
                infoIcon.slot = 'content-start';
                infoIcon.icon = 'information';
                infoIcon.style.color = 'var(--calcite-color-text-3)';
                emptyItem.appendChild(infoIcon);

                vehiclesList.appendChild(emptyItem);
                log.info('🚛 Showing empty state');
                return;
            }

            // Populate the simple list
            allVehicles.forEach((vehicle, index) => {
                try {
                    const listItem = document.createElement('calcite-list-item');

                    // Safely set attributes with fallbacks
                    const vehicleName = (vehicle.name && String(vehicle.name).trim()) || `${vehicle.type || 'Unknown'} Truck`;
                    const installer = (vehicle.installer && String(vehicle.installer).trim()) || 'Unknown';

                    listItem.setAttribute('label', vehicleName);
                    listItem.setAttribute('description', installer);

                    // Add type icon
                    const typeIcon = document.createElement('calcite-icon');
                    typeIcon.slot = 'content-start';
                    typeIcon.icon = vehicle.type === 'Electric' ? 'flash' : 'car';
                    typeIcon.style.color = vehicle.type === 'Electric' ? 'var(--calcite-color-status-success)' : 'var(--calcite-color-brand)';
                    listItem.appendChild(typeIcon);

                    // Add click handler to zoom to vehicle
                    listItem.style.cursor = 'pointer';
                    listItem.addEventListener('click', () => {
                        this.zoomToVehicle(vehicle);
                    });

                    vehiclesList.appendChild(listItem);
                    log.info(`🚛 Added vehicle ${index + 1}: ${vehicleName}`);
                } catch (vehicleError) {
                    log.error('🚛 Error processing vehicle:', vehicleError, vehicle);
                }
            });

            log.info('🚛 Vehicle list populated successfully');

        } catch (error) {
            log.error('🚛 Error loading vehicle list:', error);
            // Show error state
            const errorItem = document.createElement('calcite-list-item');
            errorItem.setAttribute('label', 'Error Loading Vehicles');
            errorItem.setAttribute('description', error.message || 'Unable to load vehicle data');
            errorItem.disabled = true;

            const errorIcon = document.createElement('calcite-icon');
            errorIcon.slot = 'content-start';
            errorIcon.icon = 'exclamation-mark-triangle';
            errorIcon.style.color = 'var(--calcite-color-status-danger)';
            errorItem.appendChild(errorIcon);

            vehiclesList.appendChild(errorItem);
        }
    }

    async getVehicleData() {
        const allVehicles = [];

        try {
            // Get layer manager
            const layerManager = window.app?.layerManager || window.app?.services?.layerManager || window.layerManager;

            if (layerManager) {
                // Get data from fiber trucks layer
                const fiberLayer = layerManager.getLayer('fiber-trucks');
                if (fiberLayer && fiberLayer.source && fiberLayer.source.items.length > 0) {
                    fiberLayer.source.items.forEach(graphic => {
                        const attrs = graphic.attributes || {};
                        const geometry = graphic.geometry || {};

                        if (attrs.id && (geometry.latitude || geometry.y)) {
                            allVehicles.push({
                                id: attrs.id,
                                name: attrs.name || 'Fiber Truck',
                                latitude: geometry.latitude || geometry.y,
                                longitude: geometry.longitude || geometry.x,
                                installer: attrs.installer || attrs.name?.split(' ')?.slice(-1)[0] || 'Unknown',
                                type: 'Fiber'
                            });
                        }
                    });
                }

                // Get data from electric trucks layer
                const electricLayer = layerManager.getLayer('electric-trucks');
                if (electricLayer && electricLayer.source && electricLayer.source.items.length > 0) {
                    electricLayer.source.items.forEach(graphic => {
                        const attrs = graphic.attributes || {};
                        const geometry = graphic.geometry || {};

                        if (attrs.id && (geometry.latitude || geometry.y)) {
                            allVehicles.push({
                                id: attrs.id,
                                name: attrs.name || 'Electric Truck',
                                latitude: geometry.latitude || geometry.y,
                                longitude: geometry.longitude || geometry.x,
                                installer: attrs.installer || attrs.name?.split(' ')?.slice(-1)[0] || 'Unknown',
                                type: 'Electric'
                            });
                        }
                    });
                }
            }

            // If no data from layers, try GeotabService
            if (allVehicles.length === 0) {
                const geotabModule = await import('../services/GeotabService.js');
                const geotabService = geotabModule.geotabService;

                if (geotabService?.lastTruckData) {
                    const cachedData = geotabService.lastTruckData;

                    if (cachedData.fiber?.length > 0) {
                        cachedData.fiber.forEach(truck => {
                            allVehicles.push({
                                ...truck,
                                type: 'Fiber',
                                installer: truck.installer || truck.name?.split(' ')?.slice(-1)[0] || 'Unknown'
                            });
                        });
                    }

                    if (cachedData.electric?.length > 0) {
                        cachedData.electric.forEach(truck => {
                            allVehicles.push({
                                ...truck,
                                type: 'Electric',
                                installer: truck.installer || truck.name?.split(' ')?.slice(-1)[0] || 'Unknown'
                            });
                        });
                    }
                }
            }

        } catch (error) {
            log.error('Error getting vehicle data:', error);
        }

        return allVehicles;
    }

    async displayVehicleList(allVehicles) {
        console.log('🚛 displayVehicleList called with', allVehicles.length, 'vehicles');

        const simpleVehicleListBlock = document.getElementById('simple-vehicle-list');
        const vehicleList = document.getElementById('vehicle-list');

        console.log('🚛 DOM elements found:', {
            simpleVehicleListBlock: !!simpleVehicleListBlock,
            vehicleList: !!vehicleList
        });

        if (!vehicleList) {
            log.error('🚛 Vehicle list block element not found!');
            return;
        }

        // Store for filtering
        this.currentVehicleData = allVehicles;

        if (allVehicles.length === 0) {
            log.info('🚛 No vehicles found, hiding vehicle list');
            if (simpleVehicleListBlock) simpleVehicleListBlock.hidden = true;
        } else {
            log.info('🚛 Showing vehicle list with vehicles:', allVehicles.length);

            // Show the vehicle list container
            if (simpleVehicleListBlock) {
                simpleVehicleListBlock.hidden = false;
                simpleVehicleListBlock.style.display = '';
            }

            // Enhanced visibility restoration for production
            if (vehicleList) {
                this.forceVehicleListVisibility(vehicleList);
                log.info('🚛 Vehicle list visibility forced');
            }

            // Force CalciteUI components to render properly
            await this.forceCalciteListRendering(vehicleList);

            // Use the robust approach that avoids CalciteUI errors
            vehicleList.innerHTML = '';

            // Wait for CalciteUI components to be ready
            await customElements.whenDefined('calcite-list-item');
            await customElements.whenDefined('calcite-icon');

            // Populate using a robust approach
            allVehicles.forEach((vehicle, index) => {
                try {
                    // Create list item with defensive programming
                    const listItem = document.createElement('calcite-list-item');

                    // Sanitize and validate text values to prevent CalciteUI errors
                    const rawName = vehicle.name || vehicle.description || `${vehicle.type || 'Vehicle'} ${vehicle.id || index + 1}`;
                    const vehicleName = String(rawName).replace(/[^\w\s\-\.]/g, '').trim() || `Vehicle ${index + 1}`;

                    const rawInstaller = vehicle.installer || vehicle.operator || '';
                    const installer = String(rawInstaller).replace(/[^\w\s\-\.]/g, '').trim() || 'Unassigned';

                    // Set attributes safely with sanitized values
                    listItem.label = vehicleName;
                    listItem.description = installer;

                    // Set icon property instead of creating child element
                    listItem.icon = vehicle.type === 'Electric' ? 'flash' : 'car';

                    // Add click handler to zoom to vehicle
                    listItem.style.cursor = 'pointer';
                    listItem.addEventListener('click', () => {
                        this.zoomToVehicle(vehicle);
                    });

                    vehicleList.appendChild(listItem);
                    log.info(`🚛 Added vehicle ${index + 1}: ${vehicleName}`);
                } catch (vehicleError) {
                    log.error('🚛 Error processing vehicle:', vehicleError, vehicle);
                }
            });

            log.info('🚛 Vehicle list populated successfully');
        }
    }

    // Enhanced visibility restoration for production CalciteUI issues
    forceVehicleListVisibility(vehicleList) {
        // Multiple approaches to ensure visibility in production
        vehicleList.hidden = false;
        vehicleList.removeAttribute('hidden');

        // Force CSS properties
        vehicleList.style.display = 'block';
        vehicleList.style.visibility = 'visible';
        vehicleList.style.opacity = '1';
        vehicleList.style.position = 'static';
        vehicleList.style.height = 'auto';
        vehicleList.style.maxHeight = 'none';
        vehicleList.style.overflow = 'visible';

        // Force parent container visibility
        const parentContainer = vehicleList.closest('#vehicle-list-content');
        if (parentContainer) {
            parentContainer.style.display = 'block';
            parentContainer.style.visibility = 'visible';
            parentContainer.style.opacity = '1';
        }

        // Force CalciteUI internal visibility and height calculation
        requestAnimationFrame(() => {
            // First, check if height is the issue (common in production CalciteUI)
            const computedStyle = window.getComputedStyle(vehicleList);
            const currentHeight = parseFloat(computedStyle.height);

            log.info('🚛 Vehicle list height check:', {
                height: computedStyle.height,
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                childCount: vehicleList.children.length
            });

            // If height is 0 but we have children, force CalciteUI height recalculation
            if (currentHeight === 0 && vehicleList.children.length > 0) {
                console.warn('🚛 Vehicle list height is 0px despite having content - forcing height recalculation');

                // Force CalciteUI to recalculate internal dimensions
                vehicleList.style.height = 'auto';
                vehicleList.style.minHeight = 'min-content';

                // Trigger multiple reflows to force CalciteUI recalculation
                vehicleList.offsetHeight;
                vehicleList.getBoundingClientRect();

                // Force CalciteUI internal update if component has update methods
                if (typeof vehicleList.requestUpdate === 'function') {
                    vehicleList.requestUpdate();
                }

                // Force all child list items to be visible and have proper height
                Array.from(vehicleList.children).forEach((child, index) => {
                    if (child.tagName === 'CALCITE-LIST-ITEM') {
                        child.style.display = 'flex';
                        child.style.visibility = 'visible';
                        child.style.minHeight = '56px'; // Standard CalciteUI list item height
                        child.style.height = 'auto';

                        // Trigger reflow for each item
                        child.offsetHeight;

                        // Force CalciteUI list item update
                        if (typeof child.requestUpdate === 'function') {
                            child.requestUpdate();
                        }
                    }
                });

                // Final height override if still 0
                setTimeout(() => {
                    const finalHeight = parseFloat(window.getComputedStyle(vehicleList).height);
                    if (finalHeight === 0 && vehicleList.children.length > 0) {
                        console.warn('🚛 Final height override - calculating manual height');
                        const itemCount = vehicleList.children.length;
                        const estimatedHeight = itemCount * 56; // 56px per item (standard CalciteUI)
                        vehicleList.style.height = `${estimatedHeight}px`;
                        vehicleList.style.minHeight = `${estimatedHeight}px`;
                    }
                }, 100);
            }

            // Reset some properties to let CalciteUI manage them
            vehicleList.style.removeProperty('visibility');
            vehicleList.style.removeProperty('display');
            vehicleList.style.removeProperty('opacity');

            // Final visibility check
            if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
                console.warn('🚛 Vehicle list still hidden after force visibility - applying final override');
                vehicleList.style.display = 'block !important';
                vehicleList.style.visibility = 'visible !important';
                vehicleList.style.opacity = '1 !important';
            }
        });
    }

    // Force CalciteUI components to render their Shadow DOM properly
    async forceCalciteListRendering(vehicleList) {
        if (!vehicleList) return;

        log.info('🚛 Forcing CalciteUI components to render properly...');

        // Force the container to be visible
        const container = document.getElementById('simple-vehicle-list');
        if (container) {
            container.style.visibility = 'visible';
            container.style.display = 'flex';
            container.style.minHeight = '200px';
        }

        // Force the list to be visible and have dimensions
        vehicleList.style.visibility = 'visible';
        vehicleList.style.display = 'block';
        vehicleList.style.minHeight = '150px';
        vehicleList.style.height = 'auto';

        // Force list items to render
        const items = Array.from(vehicleList.children);
        items.forEach((item, index) => {
            item.style.visibility = 'visible';
            item.style.display = 'block';
            item.style.minHeight = '48px';
            item.style.height = 'auto';

            // Force CalciteUI component to update if method exists
            if (typeof item.requestUpdate === 'function') {
                item.requestUpdate();
            }
        });

        // Force the main list component to update
        if (typeof vehicleList.requestUpdate === 'function') {
            vehicleList.requestUpdate();
        }

        // Wait a moment for CalciteUI to process
        await new Promise(resolve => setTimeout(resolve, 100));

        // Final check and force rendering
        requestAnimationFrame(() => {
            const rect = vehicleList.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(vehicleList);

            log.info('🚛 After forced rendering:', {
                height: rect.height,
                width: rect.width,
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                childCount: vehicleList.children.length
            });

            // If still not visible, apply nuclear option
            if (rect.height === 0 || computedStyle.visibility === 'hidden') {
                log.info('🚛 Applying nuclear CalciteUI visibility fix...');
                vehicleList.style.cssText = `
          visibility: visible !important;
          display: block !important;
          min-height: 150px !important;
          height: auto !important;
          opacity: 1 !important;
          overflow-y: auto !important;
          border: 1px solid var(--calcite-color-border-2) !important;
          border-radius: var(--calcite-border-radius) !important;
          background: var(--calcite-color-background) !important;
        `;

                // Force each item to be visible
                items.forEach(item => {
                    item.style.cssText = `
            visibility: visible !important;
            display: block !important;
            min-height: 48px !important;
            height: auto !important;
            opacity: 1 !important;
          `;
                });
            }
        });
    }

    // Development testing function for vehicle list - disabled in production
    async testVehicleList() {
        if (!isDevelopment) {
            log.warn('🚛 testVehicleList: Development function disabled in production');
            return;
        }

        log.info('🚛 DEBUG: Testing vehicle list with real cached data...');

        try {
            const geotabModule = await import('../services/GeotabService.js');
            const cachedData = geotabModule.geotabService.lastTruckData;
            log.info('🚛 DEBUG: Raw cached data:', cachedData);

            if (cachedData && (cachedData.fiber?.length > 0 || cachedData.electric?.length > 0)) {
                const testVehicles = [];

                if (cachedData.fiber?.length > 0) {
                    cachedData.fiber.forEach(truck => {
                        testVehicles.push({
                            ...truck,
                            type: 'Fiber',
                            typeIcon: 'car',
                            installer: truck.installer || truck.name?.split(' ')?.slice(-1)[0] || 'Unknown'
                        });
                    });
                }

                if (cachedData.electric?.length > 0) {
                    cachedData.electric.forEach(truck => {
                        testVehicles.push({
                            ...truck,
                            type: 'Electric',
                            typeIcon: 'flash',
                            installer: truck.installer || truck.name?.split(' ')?.slice(-1)[0] || 'Unknown'
                        });
                    });
                }

                log.info('🚛 DEBUG: Processed vehicles for display:', testVehicles.length);
                await this.displayVehicleList(testVehicles);
            } else {
                log.info('🚛 DEBUG: No cached data available - no vehicle data to display');
                // Remove mock vehicle fallback - not appropriate for production
            }
        } catch (error) {
            log.error('🚛 DEBUG: Error in testVehicleList:', error);
        }
    }

    async populateVehicleList(vehicles) {
        log.info('🚛 populateVehicleList called with vehicles:', vehicles?.length || 0);
        const vehicleList = document.getElementById('vehicle-list');
        if (!vehicleList) {
            log.error('🚛 Vehicle list element not found!');
            return;
        }

        // Wait for CalciteUI list component to be ready
        if (customElements.get('calcite-list')) {
            await customElements.whenDefined('calcite-list');
        }

        // Debug visibility
        log.info('🚛 Vehicle list visibility before:', {
            hidden: vehicleList.hidden,
            display: window.getComputedStyle(vehicleList).display,
            visibility: window.getComputedStyle(vehicleList).visibility,
            opacity: window.getComputedStyle(vehicleList).opacity,
            height: window.getComputedStyle(vehicleList).height
        });

        // Validate vehicles array
        if (!Array.isArray(vehicles)) {
            log.error('🚛 Invalid vehicles data - not an array:', typeof vehicles);
            return;
        }

        // Clear existing items
        vehicleList.innerHTML = '';

        vehicles.forEach((vehicle, index) => {
            try {
                // Validate vehicle data to prevent CalciteUI errors
                if (!vehicle || typeof vehicle !== 'object') {
                    console.warn('🚛 Skipping invalid vehicle data at index', index, vehicle);
                    return;
                }

                // Ensure CalciteUI is loaded before creating components
                if (!customElements.get('calcite-list-item')) {
                    log.error('🚛 CalciteUI components not yet defined');
                    return;
                }

                const listItem = document.createElement('calcite-list-item');

                // Format vehicle name with strict validation for CalciteUI
                const vehicleName = (vehicle.name && typeof vehicle.name === 'string' && vehicle.name.trim().length > 0)
                    ? vehicle.name.trim()
                    : `${vehicle.type || 'Unknown'} Truck`;

                const installer = (vehicle.installer && typeof vehicle.installer === 'string' && vehicle.installer.trim().length > 0)
                    ? vehicle.installer.trim()
                    : 'Unknown';

                const status = this.getVehicleStatus(vehicle);
                const safeStatus = (status && typeof status === 'string' && status.trim().length > 0)
                    ? status.trim()
                    : 'Unknown';

                // Ensure all attributes are non-empty strings to prevent CalciteUI errors
                // CalciteUI components expect proper string values, not undefined/null
                const safeLabel = String(vehicleName || 'Vehicle').trim();
                const safeDescription = String(`${installer} • ${safeStatus}`).trim();

                // Use properties instead of setAttribute for CalciteUI components
                // This is the recommended approach and avoids internal CalciteUI processing errors
                listItem.label = safeLabel || 'Vehicle';
                listItem.description = safeDescription || 'Vehicle Information';

                // Add vehicle type icon with strict validation
                const typeIcon = document.createElement('calcite-icon');
                typeIcon.slot = 'content-start';
                const iconName = (vehicle.typeIcon && typeof vehicle.typeIcon === 'string' && vehicle.typeIcon.trim().length > 0)
                    ? vehicle.typeIcon.trim()
                    : 'car'; // Default icon

                // Use properties for CalciteUI icon component
                typeIcon.icon = iconName || 'car';
                typeIcon.className = 'vehicle-type-icon';
                listItem.appendChild(typeIcon);

                // Add status indicator using properties
                const statusIcon = document.createElement('calcite-icon');
                statusIcon.slot = 'content-end';
                statusIcon.scale = 's';

                // Safe status class name generation
                let safeStatusForClass = 'unknown';
                try {
                    const statusStr = String(safeStatus || 'unknown');
                    if (statusStr && typeof statusStr.replace === 'function') {
                        safeStatusForClass = statusStr.toLowerCase().replace(/[^a-z]/g, '');
                    }
                } catch (err) {
                    console.warn('🚛 Error processing status class:', err);
                }
                statusIcon.className = `vehicle-status-${safeStatusForClass}`;

                // Determine status icon based on safe status
                let statusIconName = 'circle';
                if (safeStatus === 'Online') {
                    statusIconName = 'circle-filled';
                } else if (safeStatus === 'Idle') {
                    statusIconName = 'circle-filled';
                }

                // Use property for status icon
                statusIcon.icon = statusIconName || 'circle';
                listItem.appendChild(statusIcon);

                listItem.addEventListener('click', () => {
                    this.zoomToVehicle(vehicle);
                });

                // Safely append to the list
                try {
                    vehicleList.appendChild(listItem);
                } catch (error) {
                    log.error('🚛 Error appending list item:', error);
                }

            } catch (error) {
                // Log error details but continue processing other vehicles
                log.error('🚛 Error creating list item for vehicle', index, ':', error);
                log.error('🚛 Vehicle data:', vehicle);

                if (error.message && error.message.includes('replace')) {
                    log.error('🚛 CalciteUI string processing error - likely an undefined value passed to component');
                }
            }
        });

        log.info('🚛 populateVehicleList completed, total items added:', vehicles.length);

        // Enable filtering after data is loaded to prevent filter errors
        if (vehicles.length > 0) {
            vehicleList.setAttribute('filter-enabled', '');
        }

        // Force CalciteUI list to be visible after populating
        requestAnimationFrame(() => {
            if (vehicleList && vehicleList.children.length > 0) {
                vehicleList.style.removeProperty('visibility');
                vehicleList.style.removeProperty('display');
                vehicleList.style.removeProperty('opacity');

                vehicleList.offsetHeight; // Trigger reflow

                const listContainer = vehicleList.closest('#vehicle-list-content > div');
                if (listContainer) {
                    listContainer.style.removeProperty('visibility');
                    listContainer.style.removeProperty('display');
                }
            }
        });

        log.info('🚛 Vehicle list visibility after:', {
            hidden: vehicleList.hidden,
            display: window.getComputedStyle(vehicleList).display,
            visibility: window.getComputedStyle(vehicleList).visibility,
            opacity: window.getComputedStyle(vehicleList).opacity,
            height: window.getComputedStyle(vehicleList).height,
            childCount: vehicleList.children.length
        });
    }

    getVehicleStatus(vehicle) {
        try {
            if (!vehicle || typeof vehicle !== 'object') {
                return 'Unknown';
            }

            const commStatus = vehicle.communication_status;
            if (!commStatus || typeof commStatus !== 'string' || commStatus.toLowerCase() === 'offline') {
                return 'Offline';
            }

            const isDriving = vehicle.is_driving === true || vehicle.is_driving === 'true';
            const speed = typeof vehicle.speed === 'number' ? vehicle.speed : 0;

            if (isDriving || speed > 5) {
                return 'Online';
            }

            return 'Idle';
        } catch (error) {
            log.error('🚛 Error determining vehicle status:', error);
            return 'Unknown';
        }
    }

    async zoomToVehicle(vehicle) {
        try {
            const { geotabService } = await import('../services/GeotabService.js');
            let currentVehicle = vehicle;
            let dataSource = 'layer';

            if (geotabService?.lastTruckData && vehicle.id) {
                const allTrucks = [
                    ...(geotabService.lastTruckData.fiber || []),
                    ...(geotabService.lastTruckData.electric || [])
                ];

                const freshVehicleData = allTrucks.find(truck => truck.id === vehicle.id);

                if (freshVehicleData && freshVehicleData.latitude && freshVehicleData.longitude) {
                    currentVehicle = freshVehicleData;
                    dataSource = 'api';
                }
            }

            if (!currentVehicle.latitude || !currentVehicle.longitude) {
                this.showVehicleNotification('Location not available for this vehicle', 'warning');
                return;
            }

            const mapView = window.mapView;
            if (!mapView) {
                this.showVehicleNotification('Map not available', 'danger');
                return;
            }

            import('@arcgis/core/geometry/Point').then(({ default: Point }) => {
                const point = new Point({
                    longitude: currentVehicle.longitude,
                    latitude: currentVehicle.latitude,
                    spatialReference: { wkid: 4326 }
                });

                // Prepare deferred popup opening when scale threshold is reached
                const vehicleName = currentVehicle.name || `${currentVehicle.type} Truck`;
                this.lastFocusedVehicle = { point, name: vehicleName };
                this.vehiclePopupPending = true;
                this.ensureVehiclePopupWatcher();

                mapView.goTo({
                    target: point,
                    zoom: 16
                }).then(() => {
                    const dataAge = dataSource === 'api' ? 'current location' : 'last known location';
                    this.showVehicleNotification(`Zoomed to ${vehicleName} (${dataAge})`, 'success');
                }).catch(error => {
                    log.error('Failed to zoom to vehicle:', error);
                    this.showVehicleNotification('Failed to zoom to vehicle location', 'danger');
                });
            });

        } catch (error) {
            log.error('Error in zoomToVehicle:', error);
            this.showVehicleNotification('Failed to get vehicle location', 'danger');
        }
    }

    setupVehicleListEventListeners() {
        if (this.vehicleListListenersSetup) return;
        this.vehicleListListenersSetup = true;

        console.log('🚛 Setting up vehicle list event listeners...');

        const vehicleListBlock = document.getElementById('vehicle-list-block');
        if (vehicleListBlock) {
            vehicleListBlock.addEventListener('calciteBlockToggle', async (e) => {
                console.log('🚛 Vehicle list block toggled, expanded:', e.target.expanded);
                if (e.target.expanded) {
                    await this.loadVehicleList();
                }
            });

            let isLoadingFromObserver = false;
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(async (mutation) => {
                    if (mutation.attributeName === 'expanded' && vehicleListBlock.hasAttribute('expanded') && !isLoadingFromObserver && !this.isLoadingVehicleList) {
                        isLoadingFromObserver = true;
                        console.log('🚛 Vehicle list block expanded via attribute change');
                        await this.loadVehicleList();
                        isLoadingFromObserver = false;
                    }
                });
            });
            observer.observe(vehicleListBlock, { attributes: true });
            console.log('🚛 Vehicle list block listeners added');
        }

        const searchInput = document.getElementById('vehicle-search');
        if (searchInput) {
            searchInput.addEventListener('calciteInputInput', (e) => {
                console.log('🚛 Search input changed:', e.target.value);
                this.filterVehicleList(e.target.value);
            });
            console.log('🚛 Search input listener added');
        } else {
            console.log('🚛 Search input not found');
        }

        const refreshBtn = document.getElementById('refresh-vehicle-list');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                console.log('🚛 Refresh button clicked');
                await this.loadVehicleList();
            });
            console.log('🚛 Refresh button listener added');
        }
    }

    filterVehicleList(searchTerm) {
        if (!this.currentVehicleData) return;

        const filtered = this.currentVehicleData.filter(vehicle => {
            const name = (vehicle.name || '').toLowerCase();
            const installer = (vehicle.installer || '').toLowerCase();
            const type = (vehicle.type || '').toLowerCase();
            const search = searchTerm.toLowerCase();

            return name.includes(search) ||
                installer.includes(search) ||
                type.includes(search);
        });

        this.populateVehicleList(filtered);

        const vehicleCount = document.getElementById('vehicle-count');
        if (vehicleCount) {
            vehicleCount.textContent = `${filtered.length} vehicles ${searchTerm ? '(filtered)' : ''}`;
        }
    }

    async loadTruckTableData() {
        console.log('🚛 loadTruckTableData called');

        const loadingDiv = document.getElementById('truck-table-loading');
        const emptyDiv = document.getElementById('truck-table-empty');
        const tableContainer = document.querySelector('.truck-table-container');
        const truckCountSpan = document.getElementById('truck-count');
        const lastUpdatedSpan = document.getElementById('truck-last-updated');

        if (loadingDiv) loadingDiv.hidden = false;
        if (emptyDiv) emptyDiv.hidden = true;
        if (tableContainer) tableContainer.style.display = 'none';

        try {
            const { geotabService } = await import('../services/GeotabService.js');
            const truckData = await geotabService.getTruckData();

            // Combine all trucks into a single array
            const allTrucks = [];

            if (truckData.fiber && truckData.fiber.length > 0) {
                allTrucks.push(...truckData.fiber.map(truck => ({
                    ...truck,
                    type: 'fiber',
                    typeIcon: 'car'
                })));
            }

            if (truckData.electric && truckData.electric.length > 0) {
                allTrucks.push(...truckData.electric.map(truck => ({
                    ...truck,
                    type: 'electric',
                    typeIcon: 'flash'
                })));
            }

            this.currentTruckData = allTrucks;

            if (loadingDiv) loadingDiv.hidden = true;

            if (allTrucks.length === 0) {
                if (emptyDiv) emptyDiv.hidden = false;
                if (tableContainer) tableContainer.style.display = 'none';
            } else {
                if (emptyDiv) emptyDiv.hidden = true;
                if (tableContainer) tableContainer.style.display = 'block';
                // Ensure dialog component is loaded before showing table
                (await import('../utils/calciteLazy.js')).ensureCalciteDialog().catch(() => { });
                const { populateTruckTable } = await import('./VehicleTable.js');
                populateTruckTable(allTrucks);
            }

            if (truckCountSpan) {
                truckCountSpan.textContent = `${allTrucks.length} truck${allTrucks.length !== 1 ? 's' : ''}`;
            }
            if (lastUpdatedSpan) {
                lastUpdatedSpan.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }

        } catch (error) {
            log.error('Failed to load truck data:', error);
            if (loadingDiv) loadingDiv.hidden = true;
            if (emptyDiv) {
                emptyDiv.hidden = false;
                const emptyTitle = emptyDiv.querySelector('h4');
                const emptyText = emptyDiv.querySelector('p');
                if (emptyTitle) emptyTitle.textContent = 'Error loading trucks';
                if (emptyText) emptyText.textContent = 'Failed to fetch vehicle data from MyGeotab.';
            }
            if (tableContainer) tableContainer.style.display = 'none';
        }
    }

    // populateTruckTable moved to ./ui/VehicleTable.js

    formatTruckName(truck) {
        if (truck.name) return truck.name;
        const type = truck.type === 'fiber' ? 'Fiber' : 'Electric';
        const installer = truck.installer || truck.driver || '';
        const shortInstaller = installer.split(' ')[0];
        return `${type} Truck${shortInstaller ? ` (${shortInstaller})` : ''}`;
    }

    getTruckStatus(truck) {
        if (!truck.communication_status || truck.communication_status === 'offline') {
            return 'Offline';
        }
        if (truck.is_driving || (truck.speed && truck.speed > 5)) {
            return 'Online';
        }
        return 'Idle';
    }

    formatTruckLocation(truck) {
        if (truck.address) return truck.address;
        if (truck.latitude && truck.longitude) {
            return `${truck.latitude.toFixed(4)}, ${truck.longitude.toFixed(4)}`;
        }
        return 'Location unknown';
    }

    async zoomToTruck(truck) {
        try {
            const { geotabService } = await import('../services/GeotabService.js');
            let currentTruck = truck;
            let dataSource = 'layer';

            if (geotabService?.lastTruckData && truck.id) {
                const allTrucks = [
                    ...(geotabService.lastTruckData.fiber || []),
                    ...(geotabService.lastTruckData.electric || [])
                ];

                const freshTruckData = allTrucks.find(t => t.id === truck.id);

                if (freshTruckData && freshTruckData.latitude && freshTruckData.longitude) {
                    currentTruck = freshTruckData;
                    dataSource = 'api';
                }
            }

            if (!currentTruck.latitude || !currentTruck.longitude) {
                this.showVehicleNotification('Location not available for this vehicle', 'warning');
                return;
            }

            const mapView = window.mapView;
            if (!mapView) {
                this.showVehicleNotification('Map not available', 'danger');
                return;
            }

            import('@arcgis/core/geometry/Point').then(({ default: Point }) => {
                const point = new Point({
                    longitude: currentTruck.longitude,
                    latitude: currentTruck.latitude,
                    spatialReference: { wkid: 4326 }
                });

                // Prepare deferred popup opening when scale threshold is reached
                const truckName = this.formatTruckName(currentTruck);
                this.lastFocusedVehicle = { point, name: truckName };
                this.vehiclePopupPending = true;
                this.ensureVehiclePopupWatcher();

                mapView.goTo({
                    target: point,
                    zoom: 16
                }).then(() => {
                    const modal = document.getElementById('truck-table-modal');
                    if (modal) modal.open = false;

                    const dataAge = dataSource === 'api' ? 'current location' : 'last known location';
                    this.showVehicleNotification(`Zoomed to ${truckName} (${dataAge})`, 'success');
                }).catch(error => {
                    log.error('Failed to zoom to truck:', error);
                    this.showVehicleNotification('Failed to zoom to vehicle location', 'danger');
                });
            });

        } catch (error) {
            log.error('Error in zoomToTruck:', error);
            this.showVehicleNotification('Failed to get vehicle location', 'danger');
        }
    }

    filterTruckTable(searchTerm) {
        if (!this.currentTruckData) return;

        const filtered = this.currentTruckData.filter(truck => {
            const name = this.formatTruckName(truck).toLowerCase();
            const installer = (truck.installer || truck.driver || '').toLowerCase();
            const location = this.formatTruckLocation(truck).toLowerCase();
            const search = searchTerm.toLowerCase();

            return name.includes(search) ||
                installer.includes(search) ||
                location.includes(search);
        });

        this.populateTruckTable(filtered);

        const truckCountSpan = document.getElementById('truck-count');
        if (truckCountSpan) {
            truckCountSpan.textContent = `${filtered.length} truck${filtered.length !== 1 ? 's' : ''} ${searchTerm ? '(filtered)' : ''}`;
        }
    }

    sortTruckTable(sortBy) {
        if (!this.currentTruckData) return;

        const sorted = [...this.currentTruckData].sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return this.formatTruckName(a).localeCompare(this.formatTruckName(b));
                case 'installer':
                    const installerA = a.installer || a.driver || '';
                    const installerB = b.installer || b.driver || '';
                    return installerA.localeCompare(installerB);
                case 'type':
                    return a.type.localeCompare(b.type);
                case 'status':
                    return this.getTruckStatus(a).localeCompare(this.getTruckStatus(b));
                default:
                    return 0;
            }
        });

        this.populateTruckTable(sorted);
    }

    showVehicleNotification(message, kind = 'info') {
        // Skip on mobile devices
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768) {
            console.log(`📱 Mobile vehicle notification skipped: ${message}`);
            return;
        }

        const noticeContainer = getOrCreateNoticeContainer();
        const notice = document.createElement('calcite-notice');
        notice.setAttribute('open', '');
        notice.setAttribute('kind', kind);
        notice.setAttribute('closable', '');
        notice.setAttribute('icon', kind === 'success' ? 'check-circle' :
            kind === 'danger' ? 'exclamation-mark-triangle' : 'information');

        const messageDiv = document.createElement('div');
        messageDiv.slot = 'message';
        messageDiv.textContent = message;

        notice.appendChild(messageDiv);
        noticeContainer.appendChild(notice);

        setTimeout(() => notice.remove(), 3000);
    }

    updateBuildInfo() {
        import('../utils/buildInfo.js').then(({ getFormattedBuildInfo }) => {
            const info = getFormattedBuildInfo();

            const buildVersionElement = document.getElementById('build-version-text');
            const buildDateElement = document.getElementById('build-date-text');
            const environmentElement = document.getElementById('environment-text');

            if (buildVersionElement) {
                buildVersionElement.textContent = info.displayVersion;
            }

            if (buildDateElement) {
                buildDateElement.textContent = info.buildDate;
            }

            if (environmentElement) {
                environmentElement.textContent = info.environment.charAt(0).toUpperCase() + info.environment.slice(1);
            }
        });

        const docsLink = document.getElementById('docs-link');
        const issueLink = document.getElementById('issue-link');

        if (docsLink) {
            docsLink.addEventListener('click', () => {
                window.open('https://github.com/your-org/fiberoms-insight-pwa/wiki', '_blank');
            });
        }

        if (issueLink) {
            issueLink.addEventListener('click', () => {
                window.open('https://github.com/your-org/fiberoms-insight-pwa/issues', '_blank');
            });
        }
    }

    setupCacheManagement() {
        const refreshBtn = document.getElementById('refresh-cache-btn');
        const clearBtn = document.getElementById('clear-cache-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.updateCacheStatus());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to clear all cached OSP data? This will require re-downloading all data on next use.')) {
                    await this.clearCache();
                }
            });
        }
    }

    async updateCacheStatus() {
        try {
            const { cacheService } = await import('../services/CacheService.js');
            const stats = await cacheService.getCacheStats();

            const cacheDetailsDiv = document.getElementById('cache-details');
            const cacheSizeText = document.getElementById('cache-size-text');

            if (stats.length === 0) {
                cacheSizeText.textContent = 'Empty';
                cacheDetailsDiv.innerHTML = '<p style="color: var(--calcite-color-text-3); font-size: 13px;">No cached data</p>';
                return;
            }

            const totalFeatures = stats.reduce((sum, stat) => sum + stat.size, 0);
            cacheSizeText.textContent = `${totalFeatures} features`;

            const detailsHTML = stats.map(stat => `
        <div style="margin-bottom: 8px; padding: 8px; background: var(--calcite-color-foreground-2); border-radius: 4px;">
          <div style="font-weight: 500; font-size: 13px;">${this.formatDataType(stat.dataType)}</div>
          <div style="font-size: 12px; color: var(--calcite-color-text-2);">
            ${stat.size} features • Cached ${stat.age} ago • ${stat.expires}
          </div>
        </div>
      `).join('');

            cacheDetailsDiv.innerHTML = detailsHTML;
        } catch (error) {
            log.error('Failed to get cache status:', error);
        }
    }

    formatDataType(dataType) {
        const names = {
            'fsa': 'FSA Boundaries',
            'mainFiber': 'Main Line Fiber',
            'mainOld': 'Main Line (Old)',
            'mstFiber': 'MST Fiber',
            'mstTerminals': 'MST Terminals',
            'closures': 'Closures',
            'splitters': 'Splitters',
            'poles': 'Poles',
            'nodeSites': 'Node Sites'
        };
        return names[dataType] || dataType;
    }

    async clearCache() {
        try {
            const { cacheService } = await import('../services/CacheService.js');
            await cacheService.clearAllCache();
            await this.updateCacheStatus();

            // Skip notification on mobile devices
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768) {
                console.log('📱 Mobile cache clear notification skipped');
                return;
            }

            const noticeContainer = getOrCreateNoticeContainer();
            const notice = document.createElement('calcite-notice');
            notice.setAttribute('open', '');
            notice.setAttribute('kind', 'success');
            notice.setAttribute('closable', '');
            notice.setAttribute('icon', 'check-circle');

            const titleDiv = document.createElement('div');
            titleDiv.slot = 'title';
            titleDiv.textContent = 'Cache Cleared';

            const messageDiv = document.createElement('div');
            messageDiv.slot = 'message';
            messageDiv.textContent = 'All OSP data cache has been cleared successfully.';

            notice.appendChild(titleDiv);
            notice.appendChild(messageDiv);
            noticeContainer.appendChild(notice);

            setTimeout(() => notice.remove(), 3000);
        } catch (error) {
            log.error('Failed to clear cache:', error);
        }
    }

}


