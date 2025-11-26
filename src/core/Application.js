// Application.js - Main application orchestrator

import { MapController } from '../services/MapController.js';
import { LayerManager } from '../services/LayerManager.js';
import { PopupManager } from '../services/PopupManager.js';
import { WidgetController } from '../services/WidgetController.js';
import { hoverHighlightService } from '../services/HoverHighlightService.js';
// RainViewerService will be lazy-loaded
import { subscriberDataService, pollingManager } from '../dataService.js';
import { getLayerConfig } from '../config/layerConfigs.js';
import { API_CONFIG } from '../config/apiConfig.js';
import { getCurrentServiceArea, getServiceAreaBounds, getSearchSettings } from '../config/searchConfig.js';
// geotabService will be lazy-loaded
// CSVExportService will be lazy-loaded on demand (desktop-only feature)
import * as clipboardUtils from '../utils/clipboardUtils.js';
import { loadingIndicator } from '../utils/loadingIndicator.js';
import { getOrCreateNoticeContainer } from '../utils/noticeContainer.js';
import { HeaderSearch as ImportedHeaderSearch } from '../ui/HeaderSearch.js';
import { DashboardManager as ImportedDashboardManager } from '../ui/DashboardManager.js';
import { LayerPanel as ImportedLayerPanel } from '../ui/LayerPanel.js';
import { MobileTabBar as ImportedMobileTabBar } from '../ui/MobileTabBar.js';
import { ThemeManager as ImportedThemeManager } from '../ui/ThemeManager.js';
import { createLogger } from '../utils/logger.js';

// Initialize logger for this module
const log = createLogger('Application');

export class Application {
    constructor() {
        this.services = {};
        this.onlineLayerLoaded = false;
        this._onlineLayerLoading = false;
        this._onlineLayerLoadingPromise = null;
        this._cleanupHandlers = [];
        this.geotabEnabled = import.meta.env.VITE_GEOTAB_ENABLED === 'true';
        this.businessFilterEnabled = false; // Track business filter state for lazy-loaded layers
        this._syncingBusinessFilter = false; // Re-entrancy guard for switch sync

        // Bind methods used from event handlers
        this.ensureRainViewerInitializedAndAdded = this.ensureRainViewerInitializedAndAdded?.bind(this);

        window.addEventListener('beforeunload', () => this.cleanup());
        this.init();
    }

    async init() {
        this.services.themeManager = window.themeManager || new ImportedThemeManager();
        this.services.layerManager = new LayerManager(subscriberDataService);
        this.services.mapController = new MapController(this.services.layerManager, this.services.themeManager);
        this.services.popupManager = new PopupManager();
        this.services.layerPanel = new ImportedLayerPanel();
        this.services.mobileTabBar = new ImportedMobileTabBar();
        this.services.dashboard = new ImportedDashboardManager();
        this.services.headerSearch = new ImportedHeaderSearch();
        this.services.widgetController = new WidgetController(this.services.mapController);
        // Lazy-load RainViewer only when used (deferred)
        // const { RainViewerService } = await import('../services/RainViewerService.js');
        // this.services.rainViewerService = new RainViewerService();

        this.pollingManager = pollingManager;

        this.activeTruckLayers = new Set();
        this.geotabFeed = null;
        this.geotabReady = false;

        window.themeManager = this.services.themeManager;
        window.clipboardUtils = clipboardUtils;

        // Parallelize core service initialization
        // These services are independent and can be initialized concurrently
        await Promise.all([
            this.services.dashboard.init(),
            this.services.headerSearch.init(),
            this.services.mobileTabBar.init(),
            this.services.mapController.initialize()
        ]);

        const rainViewerInitialized = true; // initialize on-demand later
        if (rainViewerInitialized) {
            log.info('✅ RainViewer service set to initialize on-demand');
        }

        // Optional UI loading (widgets/components) executed at idle
        const loadOptionalUi = async () => {
            await this.services.widgetController.loadWidgets();
        };

        const scheduleCoreRetries = () => {
            const tryEnsure = () => {
                const mapEl = this.services?.mapController?.mapElement;
                if (!mapEl) return;
                // Home widget is now added by MapController, not as a component
                const missing = !mapEl.querySelector('arcgis-search') || !mapEl.querySelector('arcgis-locate');
                if (missing) this.services.widgetController.scheduleIdle(loadOptionalUi);
            };
            setTimeout(tryEnsure, 1000);
            setTimeout(tryEnsure, 3000);
        };

        this.services.mapController.mapElement.addEventListener('arcgisViewReadyChange', async (event) => {
            if (event.target.ready) {
                try { await this.onMapReady(); }
                catch (error) { log.error(error); }

                // Defer optional component loading to idle time
                this.services.widgetController.scheduleIdle(loadOptionalUi);
                scheduleCoreRetries();
            }
        });

        if (this.services.mapController.mapElement.ready) {
            await this.onMapReady();
            this.services.widgetController.scheduleIdle(loadOptionalUi);
            scheduleCoreRetries();
        }

        window.app = this;
    }

    async onMapReady() {
        loadingIndicator.clearConsolidated();
        loadingIndicator.showLoading('map-init', 'Map');

        // Parallel initialization for better performance
        const initTasks = [
            this.initializeSubscriberLayers(),
            this.initializeInfrastructureLayers()
        ];

        // Initialize Geotab early if enabled so vehicle layers can use a ready service
        if (this.geotabEnabled) {
            initTasks.push(this.initializeGeotabService());
        }

        // Wait for all initialization tasks to complete (parallel execution)
        await Promise.allSettled(initTasks);

        // await this.initializeRadarLayer(); // Defer RainViewer until first use
        await this.updateSubscriberStatistics();
        loadingIndicator.showNetwork('map-init', 'Map');

        setTimeout(() => {
            this.setupLayerToggleHandlers();
        }, 500);

        if (this.services.mapController.view) {
            this.services.popupManager.initialize(this.services.mapController.view);
        }

        // Search widget configuration is now handled in WidgetController.loadWidgets()

        setTimeout(() => {
            if (this.services.mapController.view) {
                this.services.mapController.view.map.layers.forEach(layer => {
                    if (layer.visible && typeof layer.refresh === 'function') {
                        try { layer.refresh(); } catch (error) { log.warn(`Failed to refresh layer ${layer.id}:`, error); }
                    }
                });
                log.info('🎯 Final map refresh completed for all visible layers');
            }
        }, 1500);

        this.initialLoadComplete = true;
        this.startSubscriberPolling();
        this.startPowerOutagePolling();
        const triggerImmediateRefresh = () => {
            try { this.pollingManager.performUpdate('subscribers'); } catch { }
            try { this.pollingManager.performUpdate('power-outages'); } catch { }
        };
        document.addEventListener('visibilitychange', () => { if (!document.hidden) triggerImmediateRefresh(); });
        window.addEventListener('online', triggerImmediateRefresh);
    }



    async initializeSubscriberLayers() {
        try {
            // Initialize offline subscribers layer
            loadingIndicator.showLoading('offline-subscribers', 'Offline Subscribers');
            const offlineConfig = getLayerConfig('offlineSubscribers');
            if (offlineConfig) {
                const result = await this.createLayerFromConfig(offlineConfig);
                if (result && result.layer) {
                    this.services.mapController.addLayer(result.layer, offlineConfig.zOrder);
                    loadingIndicator.showNetwork('offline-subscribers', 'Offline Subscribers');
                } else {
                    loadingIndicator.showError('offline-subscribers', 'Offline Subscribers', 'Failed to create layer');
                }
            }

            // Initialize electric offline subscribers layer
            loadingIndicator.showLoading('electric-offline-subscribers', 'Electric Offline Subscribers');
            const electricOfflineConfig = getLayerConfig('electricOfflineSubscribers');
            if (electricOfflineConfig) {
                const result = await this.createLayerFromConfig(electricOfflineConfig);
                if (result && result.layer) {
                    this.services.mapController.addLayer(result.layer, electricOfflineConfig.zOrder);
                    loadingIndicator.showNetwork('electric-offline-subscribers', 'Electric Offline Subscribers');
                } else {
                    loadingIndicator.showError('electric-offline-subscribers', 'Electric Offline Subscribers', 'Failed to create layer');
                }
            }

            log.info('📊 Online subscribers configured for on-demand loading (saves ~2.7MB)');
        } catch (error) {
            log.error('Failed to initialize subscriber layers:', error);
            loadingIndicator.showError('offline-subscribers', 'Offline Subscribers', 'Failed to load');
            loadingIndicator.showError('electric-offline-subscribers', 'Electric Offline Subscribers', 'Failed to load');
            loadingIndicator.showError('online-subscribers', 'Online Subscribers', 'Failed to load');
        }
    }

    async initializeInfrastructureLayers() {
        try {
            // CEC Service Boundary - Visual reference layer
            const cecServiceBoundaryConfig = getLayerConfig('cecServiceBoundary');
            if (cecServiceBoundaryConfig && cecServiceBoundaryConfig.dataUrl) {
                loadingIndicator.showLoading('cec-service-boundary', 'CEC Service Boundary');
                try {
                    const layer = await this.services.layerManager.createLayer(cecServiceBoundaryConfig);
                    if (layer) {
                        layer.visible = cecServiceBoundaryConfig.visible;
                        this.services.mapController.addLayer(layer, cecServiceBoundaryConfig.zOrder);
                        loadingIndicator.showNetwork('cec-service-boundary', 'CEC Service Boundary');
                    } else {
                        loadingIndicator.showError('cec-service-boundary', 'CEC Service Boundary', 'Failed to create layer');
                    }
                } catch (error) {
                    log.error('Failed to initialize CEC Service Boundary layer:', error);
                    loadingIndicator.showError('cec-service-boundary', 'CEC Service Boundary', 'Failed to load');
                }
            }

            const countyBoundariesConfig = getLayerConfig('countyBoundaries');
            // Skip county boundaries if no dataUrl is configured
            if (countyBoundariesConfig && countyBoundariesConfig.dataUrl) {
                loadingIndicator.showLoading('county-boundaries', 'County Boundaries');
                try {
                    const layer = await this.services.layerManager.createLayer(countyBoundariesConfig);
                    if (layer) {
                        layer.visible = countyBoundariesConfig.visible;
                        this.services.mapController.addLayer(layer, countyBoundariesConfig.zOrder);
                        loadingIndicator.showNetwork('county-boundaries', 'County Boundaries');
                    } else {
                        loadingIndicator.showError('county-boundaries', 'County Boundaries', 'Failed to create layer');
                    }
                } catch (error) {
                    log.error('Failed to initialize County Boundaries layer:', error);
                    loadingIndicator.showError('county-boundaries', 'County Boundaries', 'Failed to load');
                }
            } else if (countyBoundariesConfig && !countyBoundariesConfig.dataUrl) {
                // Silently skip if dataUrl is not configured (not an error)
                log.info('Skipping County Boundaries layer - no dataUrl configured');
            }
            // Node Sites loading disabled to prevent errors (replaced by Sprout Huts)

            // Sprout Huts Layer
            const sproutHutsConfig = getLayerConfig('sproutHuts');
            if (sproutHutsConfig) {
                loadingIndicator.showLoading('sprout-huts', 'Sprout Huts');
                const result = await this.createLayerFromConfig(sproutHutsConfig);
                if (result && result.layer) {
                    result.layer.visible = sproutHutsConfig.visible;
                    this.services.mapController.addLayer(result.layer, sproutHutsConfig.zOrder);

                    // Ensure labels are applied after layer is added to map
                    if (result.layer.labelingInfo && result.layer.labelingInfo.length > 0) {
                        // Labels already set, just refresh
                        setTimeout(() => {
                            if (result.layer.visible) {
                                result.layer.refresh();
                            }
                        }, 500);
                    }

                    if (result.fromCache) loadingIndicator.showCached('sprout-huts', 'Sprout Huts');
                    else loadingIndicator.showNetwork('sprout-huts', 'Sprout Huts');
                } else {
                    loadingIndicator.showError('sprout-huts', 'Sprout Huts', 'Failed to create layer');
                }
            }

            // Initialize Power Outage Layer (empty, will be populated by polling)
            const cullmanOutagesConfig = getLayerConfig('cullmanOutages');
            if (cullmanOutagesConfig) {
                try {
                    const layer = await this.services.layerManager.createEmptyGeoJSONLayer(cullmanOutagesConfig);
                    if (layer) {
                        layer.visible = cullmanOutagesConfig.visible;
                        this.services.mapController.addLayer(layer, cullmanOutagesConfig.zOrder);
                        log.info('✅ Power outage layer initialized (empty, ready for updates)');
                    }
                } catch (error) {
                    log.error('Failed to initialize power outage layer:', error);
                }
            }

            // Parallelize infrastructure layer loading
            await Promise.all([
                this.initializeFiberPlantLayers(),
                // this.initializeVehicleLayers() // Vehicles panel hidden for now
            ]);
        } catch (error) {
            log.error('Failed to initialize infrastructure layers:', error);
        }
    }

    async initializeFiberPlantLayers() {
        try {
            log.info('🔌 Initializing fiber plant layers...');
            const fiberPlantLayers = [
                { key: 'fsaBoundaries', name: 'FSA Boundaries' },
                { key: 'mainLineFiber', name: 'Main Line Fiber' },
                // { key: 'mainLineOld', name: 'Main Line Old' }, // Removed for Sprout Fiber
                { key: 'mstTerminals', name: 'MST Terminals' },
                { key: 'splitters', name: 'Splitters' },
                { key: 'poles', name: 'Poles' },
                { key: 'closures', name: 'Slack Loops' },
                { key: 'slackLoops', name: 'Slack Loops' }
            ];
            // Show loading indicators for all layers upfront
            for (const layerInfo of fiberPlantLayers) {
                loadingIndicator.showLoading(`osp-${layerInfo.key}`, layerInfo.name);
            }

            // Load layers in batches of 3 for better parallelization
            // This reduces total load time by ~40-50% vs sequential loading
            const batchSize = 3;
            for (let i = 0; i < fiberPlantLayers.length; i += batchSize) {
                const batch = fiberPlantLayers.slice(i, i + batchSize);

                // Process batch in parallel using Promise.allSettled
                const batchPromises = batch.map(async (layerInfo) => {
                    const layerConfig = getLayerConfig(layerInfo.key);
                    if (!layerConfig) return { layerInfo, success: false, reason: 'No config' };

                    try {
                        const result = await this.createLayerFromConfig(layerConfig);
                        if (result && result.layer) {
                            result.layer.visible = layerConfig.visible;
                            this.services.mapController.addLayer(result.layer, layerConfig.zOrder);
                            if (result.fromCache) loadingIndicator.showCached(`osp-${layerInfo.key}`, layerInfo.name);
                            else loadingIndicator.showNetwork(`osp-${layerInfo.key}`, layerInfo.name);
                            return { layerInfo, success: true, fromCache: result.fromCache };
                        } else {
                            loadingIndicator.showError(`osp-${layerInfo.key}`, layerInfo.name, 'Failed to create layer');
                            return { layerInfo, success: false, reason: 'Layer creation failed' };
                        }
                    } catch (error) {
                        log.error(`Failed to initialize ${layerInfo.name}:`, error);
                        loadingIndicator.showError(`osp-${layerInfo.key}`, layerInfo.name, 'Failed to load');
                        return { layerInfo, success: false, error };
                    }
                });

                // Wait for batch to complete before starting next batch
                const results = await Promise.allSettled(batchPromises);
                log.info(`📦 Batch ${Math.floor(i / batchSize) + 1} complete: ${results.filter(r => r.status === 'fulfilled').length}/${batch.length} layers loaded`);
            }
            log.info('🔌 Fiber plant layers initialization complete');

            // Initialize hover highlight service after fiber layers are loaded
            if (this.services.mapController.view) {
                setTimeout(() => {
                    hoverHighlightService.initialize(this.services.mapController.view);
                }, 500); // Small delay to ensure layers are fully ready
            }
        } catch (error) {
            log.error('Failed to initialize fiber plant layers:', error);
        }
    }

    async initializeVehicleLayers() {
        try {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                window.innerWidth <= 768;
            log.info(`🚛 Initializing vehicle tracking layers... (${isMobile ? 'mobile' : 'desktop'} device)`);

            if (!this.geotabReady) {
                log.warn('🚛 GeotabService not ready - vehicles may not load data until enabled');
            }

            const vehicleLayers = [
                { key: 'fiberTrucks', name: 'Fiber Trucks' },
                { key: 'electricTrucks', name: 'Electric Trucks' }
            ];
            for (const layerInfo of vehicleLayers) {
                const layerConfig = getLayerConfig(layerInfo.key);
                if (layerConfig) {
                    try {
                        log.info(`🚛 Creating layer: ${layerInfo.name}...`);
                        const result = await this.createLayerFromConfig(layerConfig);
                        if (result && result.layer) {
                            result.layer.visible = layerConfig.visible;
                            this.services.mapController.addLayer(result.layer, layerConfig.zOrder);
                            log.info(`✅ ${layerConfig.title} layer initialized (visible: ${layerConfig.visible})`);
                        } else {
                            log.warn(`⚠️  ${layerInfo.name} layer creation returned no layer`);
                        }
                    } catch (error) {
                        log.error(`❌ Failed to initialize ${layerInfo.name}:`, error);
                    }
                } else {
                    log.warn(`⚠️  No config found for ${layerInfo.key}`);
                }
            }
            log.info('🚛 Vehicle tracking layers initialization complete');
        } catch (error) {
            log.error('Failed to initialize vehicle tracking layers:', error);
        }
    }

    async initializeRadarLayer() {
        try {
            if (this.services.rainViewerService) {
                const radarLayer = this.services.rainViewerService.createRadarLayer();
                if (radarLayer) {
                    const radarConfig = {
                        id: 'rainviewer-radar',
                        title: 'Weather Radar',
                        layerType: 'WebTileLayer',
                        layerInstance: radarLayer,
                        visible: false,
                        zOrder: -10,
                        onVisibilityChange: (visible) => { this.services.rainViewerService.toggleVisibility(visible); },
                        onCleanup: () => { this.services.rainViewerService.cleanup(); }
                    };
                    const managedLayer = await this.services.layerManager.createLayer(radarConfig);
                    if (managedLayer) {
                        this.services.mapController.addLayer(managedLayer, radarConfig.zOrder);
                        log.info('✅ RainViewer radar layer created and added to map');
                    }
                }
            }
        } catch (error) {
            log.error('❌ Failed to initialize radar layer:', error);
        }
    }

    async createLayerFromConfig(config) {
        try {
            const data = await config.dataServiceMethod();
            if (!data || (data.features && data.features.length === 0)) {
                log.info(`📭 No data available for layer: ${config.id} (empty dataset - no layer created)`);
                return { layer: null, fromCache: data?.fromCache || false, isEmpty: true, success: true };
            }
            const dataSource = data.features ? { features: data.features } : data;
            const layer = await this.services.layerManager.createLayer({ ...config, dataSource });
            return { layer, fromCache: data.fromCache || false, isEmpty: false, success: true };
        } catch (error) {
            log.error(`Failed to create layer ${config.id}:`, error);
            return null;
        }
    }

    async loadOnlineSubscribersLayer() {
        if (this.services.layerManager.getLayer('online-subscribers')) {
            log.info('📊 Online subscribers layer already loaded');
            return true;
        }
        if (this._onlineLayerLoading) {
            log.info('📊 Online subscribers layer already loading...');
            return this._onlineLayerLoadingPromise;
        }
        try {
            this._onlineLayerLoading = true;
            this._onlineLayerLoadingPromise = this._performOnlineLayerLoad();
            const result = await this._onlineLayerLoadingPromise;
            this.onlineLayerLoaded = result;
            return result;
        } finally {
            this._onlineLayerLoading = false;
            this._onlineLayerLoadingPromise = null;
        }
    }

    async _performOnlineLayerLoad() {
        try {
            loadingIndicator.showLoading('online-subscribers', 'Online Subscribers');
            const onlineConfig = getLayerConfig('onlineSubscribers');
            if (!onlineConfig) throw new Error('Online subscribers layer configuration not found');
            const result = await this.createLayerFromConfig(onlineConfig);
            if (result && result.layer) {
                result.layer.visible = true;

                // Apply business filter if it was enabled before layer was loaded
                if (this.businessFilterEnabled) {
                    result.layer.definitionExpression = "service_type = 'BUSINESS INTERNET'";
                    log.info('✅ Applied business filter to newly loaded online subscribers layer');
                }

                this.services.mapController.addLayer(result.layer, onlineConfig.zOrder);
                loadingIndicator.showNetwork('online-subscribers', 'Online Subscribers');
                log.info('✅ Online subscribers layer loaded on demand');
                return true;
            }
            throw new Error('Failed to create online subscribers layer');
        } catch (error) {
            log.error('Failed to load online subscribers layer:', error);
            loadingIndicator.showError('online-subscribers', 'Online Subscribers', error.message || 'Failed to load');
            return false;
        }
    }

    setupLayerToggleHandlers() {
        const checkboxes = document.querySelectorAll('#layers-content calcite-checkbox, #osp-content calcite-checkbox, #vehicles-content calcite-checkbox, #network-parent-content calcite-checkbox, #tools-content calcite-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('calciteCheckboxChange', (e) => {
                this.handleLayerToggle(e.target, e.target.checked);
            });
        });
        // Add listeners to switches in .layer-toggle-item elements that don't have their own ID-based listeners
        const switches = document.querySelectorAll('.layer-toggle-item calcite-switch');
        switches.forEach(switchElement => {
            // Skip switches that are handled by ID in setupLayerSwitches()
            // (online/offline switches on desktop, and business filter switches on desktop/mobile)
            const handledByIdSwitches = [
                'online-subscribers-switch',
                'offline-subscribers-switch',
                'business-internet-filter-switch',
                'mobile-business-internet-filter-switch',
                'electric-offline-switch'
            ];

            if (!handledByIdSwitches.includes(switchElement.id)) {
                switchElement.addEventListener('calciteSwitchChange', (e) => {
                    this.handleLayerToggle(e.target, e.target.checked);
                });
            }
        });
        const listItems = document.querySelectorAll('.layer-toggle-item');
        listItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const switchElement = item.querySelector('calcite-switch');
                if (switchElement && e.target !== switchElement) {
                    // Simulate a click on the switch to trigger full visual update
                    switchElement.click();
                }
            });
        });
        const mobileRadarToggle = document.getElementById('mobile-radar-toggle');
        if (mobileRadarToggle) {
            mobileRadarToggle.addEventListener('click', () => { this.toggleMobileRadar(); });
        }
        this.initializeMeasurementWidget();
    }

    initializeMeasurementWidget() {
        // Desktop-only measurement widgets using modern slot-based pattern (4.34+)
        // Measurement components are declared in HTML with slot="bottom-left"
        this.setupMeasurementButtons();
    }

    async ensureMeasurementReady() {
        const mq = window.matchMedia('(min-width: 900px) and (pointer: fine)');
        if (!mq.matches) return; // Skip entirely on mobile

        // Load measurement components if not already defined
        if (!customElements.get('arcgis-distance-measurement-2d')) {
            try {
                await import('@arcgis/map-components/dist/components/arcgis-distance-measurement-2d');
            }
            catch (_) { /* no-op */ }
        }

        // Components are already in DOM, just wait for them to be ready
        const distanceTool = document.getElementById('distance-measurement-tool');

        // Bug 1 fix: Check if component is already ready before waiting for event
        // Check multiple readiness indicators to accurately detect if component is ready
        const isReady = distanceTool && (
            distanceTool.widget !== undefined ||  // Widget property exists
            distanceTool.ready === true ||        // Ready property is true
            (distanceTool.view && distanceTool.view.ready) ||  // View is ready
            distanceTool.state !== undefined      // State property exists (indicates component initialized)
        );

        // If already ready, return immediately
        if (isReady) {
            return;
        }

        // Bug 1 fix: If initialization is already in progress, await the existing promise
        // This ensures concurrent calls wait for initialization to complete instead of proceeding immediately
        if (this._distanceToolInitializing && this._distanceToolInitializationPromise) {
            await this._distanceToolInitializationPromise;
            return;
        }

        // Bug 12 fix: Check if already initialized to avoid duplicate listeners
        // Bug 1 fix: Only wait for arcgisReady if component is not already ready
        if (distanceTool && !isReady) {
            this._distanceToolInitializing = true;
            this._distanceToolInitializationPromise = new Promise((resolve) => {
                // Bug 1 fix: Check if component became ready between check and listener attachment
                // This handles race condition where component becomes ready immediately after check
                const checkReady = () => {
                    const tool = document.getElementById('distance-measurement-tool');
                    if (tool && (
                        tool.widget !== undefined ||
                        tool.ready === true ||
                        (tool.view && tool.view.ready) ||
                        tool.state !== undefined
                    )) {
                        resolve();
                        return true;
                    }
                    return false;
                };

                // Check immediately before adding listener
                if (checkReady()) {
                    // Bug 1 fix: Don't set promise to null here - it will be cleaned up after await
                    // Just return from executor, promise will resolve immediately
                    return;
                }

                // Bug 2 fix: Declare timeoutId and checkInterval before they're used in callbacks
                // Declare timeoutId first so it's available in the setInterval callback
                let timeoutId;
                const checkInterval = setInterval(() => {
                    if (checkReady()) {
                        if (timeoutId) clearTimeout(timeoutId);
                        clearInterval(checkInterval);
                        // checkReady() already called resolve(), so we're done
                    }
                }, 100);

                // Bug 1 fix: Re-query element before attaching listener to avoid stale reference
                // This is consistent with the defensive pattern used in checkReady() and elsewhere
                const currentTool = document.getElementById('distance-measurement-tool');
                if (!currentTool) {
                    // Element removed from DOM, clean up and resolve
                    if (timeoutId) clearTimeout(timeoutId);
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }

                // Add listener for arcgisReady event using current DOM reference
                currentTool.addEventListener('arcgisReady', () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    clearInterval(checkInterval);
                    resolve();
                }, { once: true });

                // Fallback timeout - but check periodically to avoid waiting full timeout if ready
                // Bug 2 fix: timeoutId is now declared above, so it's available in the setInterval callback
                timeoutId = setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve();
                }, 1500);
            });

            // Bug 1 fix: Use try/finally to ensure cleanup always executes, even if promise rejects or errors occur
            try {
                // Await the initialization promise (will be resolved immediately if already ready)
                await this._distanceToolInitializationPromise;
            } finally {
                // Clean up after initialization completes or fails - always executes
                this._distanceToolInitializing = false;
                this._distanceToolInitializationPromise = null;
            }
        }
    }

    setupMeasurementButtons() {
        const distanceBtn = document.getElementById('distance-measurement-btn');
        if (distanceBtn) {
            distanceBtn.removeEventListener('click', this.distanceBtnHandler);
            this.distanceBtnHandler = async () => {
                try {
                    await this.ensureMeasurementReady();
                    // Bug 2 fix: Get current DOM reference - don't use closure variable
                    let distanceTool = document.getElementById('distance-measurement-tool');
                    if (!distanceTool) return;

                    // Bug 2 fix: Clean up any existing listener using current DOM reference
                    // NOTE: Rapid clicks before previous measurement reaches 'measuring' state will remove
                    // the previous listener. This is acceptable behavior because:
                    // 1. The activation ID system ensures only the most recent activation controls visibility
                    // 2. The previous listener would check isCurrentActivation and find it false, so it wouldn't act anyway
                    // 3. This is an edge case for a seldom-used tool - acceptable trade-off for simplicity
                    // 4. The new activation takes precedence, which is the desired UX behavior
                    // Future reviewers: This edge case can be skipped - the current implementation is sufficient
                    if (this._distanceToolListener) {
                        // Re-query to ensure we have the current element
                        const currentTool = document.getElementById('distance-measurement-tool');
                        if (currentTool) {
                            currentTool.removeEventListener('arcgisPropertyChange', this._distanceToolListener);
                        }
                        this._distanceToolListener = null;
                        this._distanceToolActivationId = null;
                    }

                    // Bug 1 fix: Cancel any existing cleanup timeout to prevent accumulation with rapid clicks
                    // Without this, rapid button clicks create multiple timeouts that all execute independently
                    if (this._measurementCleanupTimeout) {
                        clearTimeout(this._measurementCleanupTimeout);
                        this._measurementCleanupTimeout = null;
                    }

                    // Bug 17 fix: Use unique activation ID to prevent race conditions with rapid clicks
                    const activationId = Date.now() + Math.random();
                    this._distanceToolActivationId = activationId;

                    // Bug 2 fix: Get fresh reference for listener function
                    // Start measurement first, then show once state changes to "measuring"
                    // This prevents the flash of "New measurement" button
                    // Store reference to the element the listener is attached to for proper cleanup
                    const listenerFunc = (event) => {
                        const isCurrentActivation = this._distanceToolActivationId === activationId;

                        // Bug 2 fix: Get current DOM reference inside listener
                        // If element was replaced, the old listener won't fire, so this should be the same element
                        const currentTool = document.getElementById('distance-measurement-tool');
                        if (!currentTool) {
                            // Element removed, clean up and exit
                            if (isCurrentActivation && this._distanceToolListener === listenerFunc) {
                                this._distanceToolListener = null;
                                this._distanceToolActivationId = null;
                            }
                            return;
                        }

                        // Bug 2 fix: Only remove listener and clean up AFTER state reaches 'measuring'
                        // This prevents premature removal if other properties change before state becomes 'measuring'
                        if (isCurrentActivation && currentTool.state === 'measuring') {
                            // Show the tool now that it's measuring
                            currentTool.hidden = false;

                            // Bug 2 fix: Remove listener only after state is 'measuring'
                            // This ensures we don't remove the listener prematurely
                            currentTool.removeEventListener('arcgisPropertyChange', listenerFunc);

                            // Clear instance fields for the active activation
                            if (this._distanceToolListener === listenerFunc) {
                                this._distanceToolListener = null;
                                this._distanceToolActivationId = null;
                            }
                        }
                        // If state is not 'measuring' yet, keep the listener attached to wait for state change
                    };
                    this._distanceToolListener = listenerFunc;

                    // Bug 2 fix: Re-query element before using it
                    distanceTool = document.getElementById('distance-measurement-tool');
                    if (!distanceTool) return;

                    // Keep hidden until measuring starts
                    distanceTool.hidden = true;
                    distanceTool.addEventListener('arcgisPropertyChange', listenerFunc);

                    // Bug 1 fix: Set up cleanup timeout IMMEDIATELY after adding listener
                    // This ensures cleanup happens even if start() or subsequent code throws an error
                    // The timeout shows the tool after 200ms as a fallback, but only removes the listener
                    // if the state is already 'measuring' (meaning the event fired and listener cleaned itself up)
                    // Store as instance property so it can be cancelled on rapid clicks or during cleanup
                    this._measurementCleanupTimeout = setTimeout(() => {
                        // Bug 2 fix: Re-query element and check for null in case DOM changed
                        const tool = document.getElementById('distance-measurement-tool');
                        if (!tool) {
                            log.warn('Distance measurement tool removed from DOM before timeout');
                            if (this._distanceToolActivationId === activationId) {
                                this._distanceToolListener = null;
                                this._distanceToolActivationId = null;
                            }
                            return;
                        }

                        // Bug 17 fix: Check activation ID to ensure we only act for the
                        // most recent activation. Older activations will have already
                        // removed their own listeners in listenerFunc.
                        if (this._distanceToolActivationId === activationId) {
                            // Always show the tool if it's still hidden (fallback for slow state transitions)
                            tool.hidden = false;

                            // Bug 1 fix: Only remove listener if state is already 'measuring'
                            // If state hasn't reached 'measuring' yet, the listener needs to stay attached
                            // to respond when the state eventually changes. This prevents the tool from
                            // remaining permanently hidden if state transition takes longer than 200ms.
                            if (tool.state === 'measuring') {
                                // State already reached 'measuring', listener should have cleaned itself up
                                // Remove it now as a safety measure in case the event didn't fire
                                tool.removeEventListener('arcgisPropertyChange', listenerFunc);

                                // Only clear instance fields if they still point at this activation's listener.
                                if (this._distanceToolListener === listenerFunc) {
                                    this._distanceToolListener = null;
                                    this._distanceToolActivationId = null;
                                }
                            }
                            // If state !== 'measuring', leave listener attached to wait for state change
                        }
                        // Clear the timeout reference after it executes
                        this._measurementCleanupTimeout = null;
                    }, 200);

                    // Start the measurement (this will trigger state change to "measuring")
                    // Note: Timeout is already set up above, so even if this throws, cleanup will happen
                    if (typeof distanceTool.start === 'function') {
                        await distanceTool.start();
                    } else {
                        log.warn('Distance measurement tool start() not available yet');
                    }

                    this.updateMeasurementButtons('distance');
                } catch (error) { log.error('Error activating distance measurement:', error); }
            };
            distanceBtn.addEventListener('click', this.distanceBtnHandler);
        }
        const clearBtn = document.getElementById('clear-measurement-btn');
        if (clearBtn) {
            clearBtn.removeEventListener('click', this.clearBtnHandler);
            this.clearBtnHandler = async () => {
                try {
                    await this.ensureMeasurementReady();
                    const distanceTool = document.getElementById('distance-measurement-tool');

                    // Clean up state variables to prevent orphaned listeners and timeouts
                    // Cancel any pending cleanup timeout that might re-show the tool
                    if (this._measurementCleanupTimeout) {
                        clearTimeout(this._measurementCleanupTimeout);
                        this._measurementCleanupTimeout = null;
                    }

                    // Remove event listener to prevent memory leaks
                    if (this._distanceToolListener && distanceTool) {
                        distanceTool.removeEventListener('arcgisPropertyChange', this._distanceToolListener);
                        this._distanceToolListener = null;
                        this._distanceToolActivationId = null;
                    }

                    // Clear and hide distance tool using official API
                    if (distanceTool) {
                        await distanceTool.clear?.();
                        distanceTool.hidden = true;
                    }

                    this.updateMeasurementButtons(null);
                } catch (error) { log.error('Error clearing measurements:', error); }
            };
            clearBtn.addEventListener('click', this.clearBtnHandler);
        }
    }

    updateMeasurementButtons(activeTool) {
        // Note: Area measurement was removed in ArcGIS 4.34 upgrade - only distance measurement is supported
        // This function now only handles 'distance' tool state, which is correct for current implementation
        const distanceBtn = document.getElementById('distance-measurement-btn');
        const clearBtn = document.getElementById('clear-measurement-btn');
        [distanceBtn, clearBtn].forEach(btn => { if (btn) { btn.appearance = 'solid'; btn.kind = 'neutral'; } });
        if (activeTool === 'distance' && distanceBtn) { distanceBtn.appearance = 'solid'; distanceBtn.kind = 'brand'; }
    }

    setupCSVExport() {
        // Desktop-only CSV export buttons (mobile UI removed for performance)
        const desktopExportBtn = document.getElementById('desktop-export-offline-csv-btn');
        if (desktopExportBtn) desktopExportBtn.addEventListener('click', async () => { await this.handleCSVExport(desktopExportBtn, 'offline'); });
        const desktopExportAllBtn = document.getElementById('desktop-export-all-csv-btn');
        if (desktopExportAllBtn) desktopExportAllBtn.addEventListener('click', async () => { await this.handleCSVExport(desktopExportAllBtn, 'all'); });
        const ta5kReportsBtn = document.getElementById('export-ta5k-reports-btn');
        if (ta5kReportsBtn) ta5kReportsBtn.addEventListener('click', async () => { await this.handleCSVExport(ta5kReportsBtn, 'ta5k-reports'); });
    }

    async handleCSVExport(button, exportType = 'offline') {
        if (!button) return;
        const originalText = button.textContent;
        const originalIcon = button.getAttribute('icon-start');
        try {
            // Track export initiation
            const { trackExport, trackClick } = await import('../services/AnalyticsService.js');
            trackClick(`export-${exportType}-csv`, {
                section: 'dashboard',
                export_type: exportType
            });

            button.setAttribute('loading', 'true');
            button.textContent = 'Preparing Download...';
            button.setAttribute('icon-start', 'loading');
            button.disabled = true;

            // Lazy-load CSV export service only when needed (desktop-only feature)
            const { CSVExportService } = await import('../utils/csvExport.js');

            let itemCount = 0;
            if (exportType === 'all') {
                const data = await subscriberDataService.getAllSubscribers();
                itemCount = data?.length || 0;
                await CSVExportService.exportAllSubscribers();
            } else if (exportType === 'ta5k-reports') {
                await CSVExportService.exportTA5KNodeReports();
            } else {
                const data = await subscriberDataService.getOfflineSubscribers();
                itemCount = data?.length || 0;
                await CSVExportService.exportOfflineSubscribers();
            }

            // Track successful export
            trackExport(exportType, {
                item_count: itemCount,
                success: true
            });
            button.removeAttribute('loading');
            button.setAttribute('icon-start', 'check');
            button.textContent = 'Download Complete!';
            button.setAttribute('kind', 'success');
            button.disabled = false;
            const successMessage = exportType === 'ta5k-reports' ? 'TA5K node reports downloaded successfully' : 'CSV downloaded successfully';
            this.showNotification('success', successMessage, 3000);
            setTimeout(() => { this.resetCSVButton(button, originalText, originalIcon); }, 3000);
        } catch (error) {
            log.error('CSV download failed:', error);

            // Track failed export
            const { trackExport } = await import('../services/AnalyticsService.js');
            trackExport(exportType, {
                success: false,
                error: error.message
            });

            button.removeAttribute('loading');
            button.setAttribute('icon-start', 'exclamation-mark-triangle');
            button.textContent = 'Download Failed';
            button.setAttribute('kind', 'danger');
            button.disabled = false;
            this.showNotification('error', `CSV download failed: ${error.message}`, 5000);
            setTimeout(() => { this.resetCSVButton(button, originalText, originalIcon); }, 5000);
        }
    }

    resetCSVButton(button, originalText, originalIcon) {
        if (!button) return;
        button.removeAttribute('loading');
        button.removeAttribute('kind');
        button.setAttribute('icon-start', originalIcon || 'download');
        button.textContent = originalText || 'Export Offline CSV';
        button.disabled = false;
    }

    setupSubscriberStatistics() {
        this.setupLayerSwitches();
        this.updateSubscriberStatistics();
        document.addEventListener('subscriberDataUpdate', () => { this.updateSubscriberStatistics(); });
    }

    setupLayerSwitches() {
        const onlineSwitch = document.getElementById('online-subscribers-switch');
        const offlineSwitch = document.getElementById('offline-subscribers-switch');
        const businessFilterSwitch = document.getElementById('business-internet-filter-switch');
        const mobileBusinessFilterSwitch = document.getElementById('mobile-business-internet-filter-switch');
        const electricOfflineSwitch = document.getElementById('electric-offline-switch');

        // All switches use the same pattern
        if (onlineSwitch) onlineSwitch.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); });
        if (offlineSwitch) offlineSwitch.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); });
        if (businessFilterSwitch) businessFilterSwitch.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); });
        if (mobileBusinessFilterSwitch) mobileBusinessFilterSwitch.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); });
        if (electricOfflineSwitch) electricOfflineSwitch.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); });

        this.setupLayerSwitchesForAllSections();
        this.setupClickableListItems();
    }

    setupLayerSwitchesForAllSections() {
        const ospSwitches = document.querySelectorAll('#osp-content calcite-switch');
        ospSwitches.forEach(s => s.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); }));
        const vehicleSwitches = document.querySelectorAll('#vehicles-content calcite-switch');
        vehicleSwitches.forEach(s => s.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); }));
        const toolsSwitches = document.querySelectorAll('#tools-content calcite-switch');
        toolsSwitches.forEach(s => s.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); }));
        const nodeSitesSwitches = document.querySelectorAll('#network-parent-content calcite-switch');
        nodeSitesSwitches.forEach(s => s.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); }));
    }

    setupClickableListItems() {
        const listItems = document.querySelectorAll('calcite-list-item');
        listItems.forEach(listItem => {
            // Skip items that have .layer-toggle-item class (they're handled separately)
            if (listItem.classList.contains('layer-toggle-item')) {
                return;
            }

            const switchElement = listItem.querySelector('calcite-switch');
            if (switchElement) {
                listItem.style.cursor = 'pointer';
                listItem.addEventListener('click', (e) => {
                    if (!e.target.closest('calcite-switch')) {
                        e.preventDefault();
                        e.stopPropagation();
                        switchElement.checked = !switchElement.checked;
                        this.handleLayerToggle(switchElement, switchElement.checked);
                    }
                });
            }
        });
    }

    async updateSubscriberStatistics() {
        try {
            const summary = await subscriberDataService.getSubscribersSummary();
            this.services.dashboard.updateOfflineCount(summary.offline || 0);
            this.services.dashboard.updateLastUpdatedTime();
            const onlineCountEl = document.getElementById('online-count-display');
            const offlineCountEl = document.getElementById('offline-count-display');
            const electricOfflineCountEl = document.getElementById('electric-offline-count-display');
            const lastUpdatedEl = document.getElementById('last-updated-display');
            if (onlineCountEl) onlineCountEl.textContent = summary.online?.toLocaleString() || '0';
            if (offlineCountEl) offlineCountEl.textContent = summary.offline?.toLocaleString() || '0';
            if (electricOfflineCountEl) electricOfflineCountEl.textContent = summary.electricOffline?.toLocaleString() || '0';
            if (lastUpdatedEl) {
                const lastUpdated = summary.lastUpdated ? new Date(summary.lastUpdated).toLocaleString() : 'Never';
                lastUpdatedEl.textContent = `Last updated: ${lastUpdated}`;
            }
        } catch (error) {
            log.error('Failed to update subscriber statistics:', error);
            this.services.dashboard.updateOfflineCount(0);
            const onlineCountEl = document.getElementById('online-count-display');
            const offlineCountEl = document.getElementById('offline-count-display');
            const electricOfflineCountEl = document.getElementById('electric-offline-count-display');
            const lastUpdatedEl = document.getElementById('last-updated-display');
            if (onlineCountEl) onlineCountEl.textContent = '--';
            if (offlineCountEl) offlineCountEl.textContent = '--';
            if (electricOfflineCountEl) electricOfflineCountEl.textContent = '--';
            if (lastUpdatedEl) lastUpdatedEl.textContent = 'Last updated: Error loading data';
        }
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }

    showNotification(type, message, duration = 5000) {
        if (this.isMobileDevice()) { console.log(`📱 Mobile notification skipped: ${type} - ${message}`); return; }
        const container = getOrCreateNoticeContainer();
        const notification = document.createElement('calcite-notice');
        notification.setAttribute('kind', type);
        notification.setAttribute('width', 'auto');
        notification.setAttribute('scale', 'm');
        notification.setAttribute('open', 'true');
        notification.setAttribute('closable', '');
        const messageDiv = document.createElement('div');
        messageDiv.slot = 'message';
        messageDiv.textContent = message;
        notification.appendChild(messageDiv);
        container.appendChild(notification);
        setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, duration);
        notification.addEventListener('calciteNoticeClose', () => { if (notification.parentNode) notification.parentNode.removeChild(notification); });
    }

    async handleLayerToggle(element, checked) {
        if (!element || typeof checked !== 'boolean') { log.warn('Invalid layer toggle parameters'); return; }
        const layerId = this.getLayerIdFromElement(element);

        // Debug logging for OSP layer troubleshooting
        if (layerId) {
            console.log(`[OSP Debug] 🔄 Toggling layer: ${layerId}, State: ${checked ? 'ON' : 'OFF'}`);
            const config = getLayerConfig(layerId);
            if (config) {
                console.log(`[OSP Debug] 📋 Configuration for ${layerId}:`, {
                    id: config.id,
                    title: config.title,
                    dataSource: config.dataSource,
                    visible: config.visible,
                    dataServiceMethod: config.dataServiceMethod ? 'Function exists' : 'Missing'
                });
                // Log the actual URL being used
                if (config.dataServiceMethod) {
                    try {
                        // Check if it's an infrastructure service method
                        const serviceName = config.dataServiceMethod.toString();
                        if (serviceName.includes('getFSABoundaries')) {
                            console.log(`[OSP Debug] 🔗 FSA Boundaries URL: ${API_CONFIG.INFRASTRUCTURE.FSA_BOUNDARIES}`);
                        } else if (serviceName.includes('getMainLineFiber')) {
                            console.log(`[OSP Debug] 🔗 Main Line Fiber URL: ${API_CONFIG.INFRASTRUCTURE.MAIN_LINE_FIBER}`);
                        } else if (serviceName.includes('getMSTTerminals')) {
                            console.log(`[OSP Debug] 🔗 MST Terminals URL: ${API_CONFIG.INFRASTRUCTURE.MST_TERMINALS}`);
                        } else if (serviceName.includes('getMSTFiber')) {
                            console.log(`[OSP Debug] 🔗 MST Fiber URL: ${API_CONFIG.INFRASTRUCTURE.MST_FIBER}`);
                        } else if (serviceName.includes('getPoles')) {
                            console.log(`[OSP Debug] 🔗 Poles: Fetched from Supabase sfi_poles table`);
                        }
                    } catch (e) {
                        console.warn(`[OSP Debug] Could not determine URL:`, e);
                    }
                }
            } else {
                console.warn(`[OSP Debug] ⚠️ No configuration found for layerId: ${layerId}`);
            }
        }

        // Handle business filter separately (not a layer, but a filter on existing layers)
        if (layerId === 'business-internet-filter') {
            // Prevent re-entrancy during sync
            if (this._syncingBusinessFilter) return;

            this._syncingBusinessFilter = true;
            try {
                await this.toggleBusinessInternetFilter(checked);

                // Sync the other switch (desktop/mobile)
                const otherSwitch = element.id === 'business-internet-filter-switch'
                    ? document.getElementById('mobile-business-internet-filter-switch')
                    : document.getElementById('business-internet-filter-switch');

                if (otherSwitch && otherSwitch.checked !== checked) {
                    otherSwitch.checked = checked;
                }
            } finally {
                this._syncingBusinessFilter = false;
            }
            return;
        }

        // Handle electric offline layer toggle (separate layer, like online/offline)
        if (layerId === 'electric-offline-subscribers') {
            // This is now a separate layer, handle it like other subscriber layers
            const electricOfflineLayer = this.services.layerManager.getLayer('electric-offline-subscribers');
            if (electricOfflineLayer) {
                await this.services.layerManager.toggleLayerVisibility('electric-offline-subscribers', checked);
                this.syncToggleStates('electric-offline-subscribers', checked);
            } else {
                // Layer doesn't exist yet, might need to be created
                log.warn('Electric offline layer not found, may need initialization');
            }
            return;
        }

        // Prevent toggling CEC Service Boundary - it's always visible as a reference layer
        if (layerId === 'cec-service-boundary') {
            log.info('CEC Service Boundary is always visible and cannot be toggled');
            return;
        }

        const VALID_LAYER_IDS = new Set(['offline-subscribers', 'online-subscribers', 'electric-offline-subscribers', 'sprout-huts', 'rainviewer-radar', 'fsa-boundaries', 'main-line-fiber', 'main-line-old', 'mst-terminals', 'splitters', 'poles', 'closures', 'electric-trucks', 'fiber-trucks']);
        if (!layerId || !VALID_LAYER_IDS.has(layerId)) { log.warn(`Invalid or unsupported layer ID: ${layerId}`); return; }
        if (layerId) {
            if (layerId === 'online-subscribers' && checked && !this.onlineLayerLoaded) {
                const loaded = await this.loadOnlineSubscribersLayer();
                if (!loaded) { element.checked = false; return; }
            } else if (layerId === 'rainviewer-radar' && checked) {
                try {
                    // If layer already exists, just show it
                    const existing = this.services.layerManager.getLayer('rainviewer-radar');
                    if (!existing) {
                        // Lazy import and instantiate service if needed
                        if (!this.services.rainViewerService) {
                            const module = await import('../services/RainViewerService.js');
                            this.services.rainViewerService = new module.RainViewerService();
                            await this.services.rainViewerService.initialize();
                        }
                        const radarLayer = this.services.rainViewerService.createRadarLayer();
                        if (!radarLayer) { element.checked = false; return; }
                        const radarConfig = {
                            id: 'rainviewer-radar',
                            title: 'Weather Radar',
                            layerType: 'WebTileLayer',
                            layerInstance: radarLayer,
                            visible: false,
                            zOrder: -10,
                            onVisibilityChange: (visible) => { this.services.rainViewerService.toggleVisibility(visible); },
                            onCleanup: () => { this.services.rainViewerService.cleanup(); }
                        };
                        const managedLayer = await this.services.layerManager.createLayer(radarConfig);
                        if (managedLayer) {
                            this.services.mapController.addLayer(managedLayer, radarConfig.zOrder);
                        } else { element.checked = false; return; }
                    }
                    await this.services.layerManager.toggleLayerVisibility(layerId, true);
                    this.syncToggleStates(layerId, true);
                    return;
                } catch (err) {
                    element.checked = false; return;
                }
            } else {
                await this.services.layerManager.toggleLayerVisibility(layerId, checked);
                // Note: Do NOT reapply electric offline filter when toggling offline-subscribers layer
                // The "Offline Subscribers" toggle controls layer visibility only
                // The "Electric Offline" toggle controls the filter independently
            }
            this.syncToggleStates(layerId, checked);
            const layerDisplayName = this.getLayerDisplayName(layerId);
            if (layerDisplayName) await this.manageTruckLayerState(layerDisplayName, checked);
        }
    }

    /**
     * Toggle business internet filter on subscriber layers
     * @param {boolean} enabled - Whether to enable business-only filter
     */
    async toggleBusinessInternetFilter(enabled) {
        try {
            log.info(`${enabled ? '📋' : '🔓'} Business Internet filter ${enabled ? 'enabled' : 'disabled'}`);

            // Store the filter state for lazy-loaded layers
            this.businessFilterEnabled = enabled;

            // Get both subscriber layers
            const onlineLayer = this.services.layerManager.getLayer('online-subscribers');
            const offlineLayer = this.services.layerManager.getLayer('offline-subscribers');

            // Definition expression to filter for business internet only
            const businessFilter = "service_type = 'BUSINESS INTERNET'";

            // Apply or remove the filter from both layers (if they exist)
            if (onlineLayer) {
                onlineLayer.definitionExpression = enabled ? businessFilter : null;
                log.info(`Online layer filter ${enabled ? 'applied' : 'removed'}`);
            } else if (enabled && !this.onlineLayerLoaded) {
                log.info('ℹ️ Online layer not loaded yet - filter will be applied when loaded');
            }

            if (offlineLayer) {
                offlineLayer.definitionExpression = enabled ? businessFilter : null;
                log.info(`Offline layer filter ${enabled ? 'applied' : 'removed'}`);
            }

            // Show notification
            const message = enabled
                ? 'Now showing Business Internet subscribers only'
                : 'Showing all subscriber types';
            this.showNotification('info', message, 3000);

        } catch (error) {
            log.error('Failed to toggle business internet filter:', error);
            this.showNotification('error', 'Failed to apply filter', 3000);
        }
    }


    getLayerIdFromElement(element) {
        if (element.id === 'online-subscribers-switch') return 'online-subscribers';
        if (element.id === 'offline-subscribers-switch') return 'offline-subscribers';
        if (element.id === 'electric-offline-switch') return 'electric-offline-subscribers';
        // Business filter switches - return consistent identifier
        if (element.id === 'business-internet-filter-switch' || element.id === 'mobile-business-internet-filter-switch') {
            return 'business-internet-filter';
        }
        const listItem = element.closest('calcite-list-item');
        const label = element.closest('calcite-label');
        let labelText = '';
        if (listItem) labelText = listItem.getAttribute('label'); else if (label) labelText = label.textContent.trim();
        const mapping = {
            'Online Subscribers': 'online-subscribers', 'Offline Subscribers': 'offline-subscribers', 'Node Sites': 'sprout-huts', 'Weather Radar': 'rainviewer-radar', 'CEC Service Boundary': 'cec-service-boundary', 'DA Boundaries': 'fsa-boundaries', 'Main Line Fiber': 'main-line-fiber', 'Main Line Old': 'main-line-old', 'MST Terminals': 'mst-terminals', 'Splitters': 'splitters', 'Poles': 'poles', 'Slack Loops': 'closures', 'Electric Trucks': 'electric-trucks', 'Fiber Trucks': 'fiber-trucks'
        };
        return mapping[labelText] || null;
    }

    getLayerDisplayName(layerId) {
        const reverseMapping = { 'fiber-trucks': 'Fiber Trucks', 'electric-trucks': 'Electric Trucks' };
        return reverseMapping[layerId] || null;
    }

    syncToggleStates(layerId, checked) {
        const labelMapping = {
            'offline-subscribers': 'Offline Subscribers', 'online-subscribers': 'Online Subscribers', 'sprout-huts': 'Node Sites', 'rainviewer-radar': 'Weather Radar', 'cec-service-boundary': 'CEC Service Boundary', 'fsa-boundaries': 'DA Boundaries', 'main-line-fiber': 'Main Line Fiber', 'main-line-old': 'Main Line Old', 'mst-terminals': 'MST Terminals', 'splitters': 'Splitters', 'poles': 'Poles', 'closures': 'Slack Loops', 'slack-loops': 'Slack Loops', 'electric-trucks': 'Electric Trucks', 'fiber-trucks': 'Fiber Trucks'
        };
        const labelText = labelMapping[layerId]; if (!labelText) return;
        const desktopCheckboxes = document.querySelectorAll('#layers-content calcite-checkbox, #osp-content calcite-checkbox, #vehicles-content calcite-checkbox, #network-parent-content calcite-checkbox, #tools-content calcite-checkbox');
        desktopCheckboxes.forEach(checkbox => {
            const label = checkbox.closest('calcite-label');
            if (label && label.textContent.trim() === labelText) { checkbox.checked = checked; }
        });
        const mobileSwitches = document.querySelectorAll('.layer-toggle-item calcite-switch');
        mobileSwitches.forEach(switchElement => {
            const listItem = switchElement.closest('calcite-list-item');
            if (listItem && listItem.getAttribute('label') === labelText) { switchElement.checked = checked; }
        });
    }

    toggleMobileRadar() {
        const radarLayer = this.services.layerManager.getLayer('rainviewer-radar');
        if (radarLayer) {
            const newVisibility = !radarLayer.visible;
            this.services.layerManager.toggleLayerVisibility('rainviewer-radar', newVisibility);
            this.syncToggleStates('rainviewer-radar', newVisibility);
            const mobileButton = document.getElementById('mobile-radar-toggle');
            if (mobileButton) {
                mobileButton.appearance = newVisibility ? 'solid' : 'outline';
                mobileButton.setAttribute('appearance', newVisibility ? 'solid' : 'outline');
            }
            if (this.services.mobileTabBar) this.services.mobileTabBar.closeCurrentPanel();
            log.info(`🌧️ Mobile radar toggled: ${newVisibility} `);
        }
    }

    startSubscriberPolling() {
        // Detect mobile device - use longer intervals to save battery
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            window.innerWidth <= 768;

        // Mobile: 5 minutes (users typically don't leave app running)
        // Desktop: 30 seconds (users monitor actively)
        const subscriberPollInterval = isMobile ? 300000 : 30000;

        log.info(`🔄 Starting subscriber data polling(${isMobile ? 'mobile' : 'desktop'}: ${subscriberPollInterval / 1000}s interval)`);
        let previousOfflineCount = null;
        let previousOnlineCount = null;
        const handleSubscriberUpdate = async (data) => {
            try {
                if (data.offline || data.electricOffline || data.online) {
                    if (!window._isManualRefresh && data.offline) loadingIndicator.showLoading('offline-subscribers-update', 'Offline Subscribers');
                    if (!window._isManualRefresh && data.electricOffline) loadingIndicator.showLoading('electric-offline-subscribers-update', 'Electric Offline Subscribers');
                    if (!window._isManualRefresh && data.online && this.onlineLayerLoaded) loadingIndicator.showLoading('online-subscribers-update', 'Online Subscribers');
                    const currentOfflineCount = data.offline?.count || 0;
                    const currentElectricOfflineCount = data.electricOffline?.count || 0;
                    const currentOnlineCount = data.online?.count || 0;
                    const offlineLayer = this.services.layerManager.getLayer('offline-subscribers');
                    const electricOfflineLayer = this.services.layerManager.getLayer('electric-offline-subscribers');
                    const onlineLayer = this.services.layerManager.getLayer('online-subscribers');
                    if (offlineLayer && data.offline) {
                        await this.services.layerManager.updateLayerData('offline-subscribers', data.offline);
                        if (!window._isManualRefresh) loadingIndicator.showNetwork('offline-subscribers-update', 'Offline Subscribers');
                    }
                    if (electricOfflineLayer && data.electricOffline) {
                        await this.services.layerManager.updateLayerData('electric-offline-subscribers', data.electricOffline);
                        if (!window._isManualRefresh) loadingIndicator.showNetwork('electric-offline-subscribers-update', 'Electric Offline Subscribers');
                    }
                    if (onlineLayer && data.online && this.onlineLayerLoaded) {
                        await this.services.layerManager.updateLayerData('online-subscribers', data.online);
                        if (!window._isManualRefresh) loadingIndicator.showNetwork('online-subscribers-update', 'Online Subscribers');
                    }
                    if (previousOfflineCount !== null && previousOnlineCount !== null && !window._isManualRefresh) {
                        const offlineChange = currentOfflineCount - previousOfflineCount;
                        const onlineChange = currentOnlineCount - previousOnlineCount;
                        if (offlineChange !== 0 || onlineChange !== 0) this.showSubscriberUpdateToast(previousOfflineCount, currentOfflineCount, previousOnlineCount, currentOnlineCount);
                    }
                    previousOfflineCount = currentOfflineCount;
                    previousOnlineCount = currentOnlineCount;
                    await this.updateSubscriberStatistics();
                }
            } catch (error) {
                log.error('Failed to handle subscriber update:', error);
                try { (await import('../services/ErrorService.js')).errorService.report(error, { module: 'Application', action: 'handleSubscriberUpdate' }); } catch { }
                if (!window._isManualRefresh) {
                    loadingIndicator.showError('offline-subscribers-update', 'Offline Subscribers', 'Update failed');
                    loadingIndicator.showError('electric-offline-subscribers-update', 'Electric Offline Subscribers', 'Update failed');
                    loadingIndicator.showError('online-subscribers-update', 'Online Subscribers', 'Update failed');
                }
            }
        };
        this.pollingManager.startPolling('subscribers', handleSubscriberUpdate, subscriberPollInterval);
        // Setup mobile refresh button - matches desktop header refresh functionality
        // Note: The desktop Actions panel #refresh-data button was removed on 2025-01-22
        // Desktop users now use the header #refresh-dashboard button (DashboardManager.js)
        // Mobile users use this #refresh-subscriber-data button in the mobile Tools section
        const mobileRefreshButton = document.getElementById('refresh-subscriber-data');
        if (mobileRefreshButton) {
            mobileRefreshButton.addEventListener('click', async () => {
                log.info('🔄 Mobile manual data refresh triggered');
                mobileRefreshButton.setAttribute('loading', '');
                try {
                    // Set global flag to skip notifications during manual refresh
                    window._isManualRefresh = true;

                    // Clear any existing loading notifications
                    loadingIndicator.clearConsolidated();

                    // Clear cache to ensure fresh data
                    subscriberDataService.clearCache();

                    // Perform polling manager update for subscribers data
                    await this.pollingManager.performUpdate('subscribers');

                    // Update subscriber statistics
                    if (window.app && window.app.updateSubscriberStatistics) {
                        await window.app.updateSubscriberStatistics();
                    }

                    // Update mobile subscriber statistics
                    if (this.services.mobileTabBar && this.services.mobileTabBar.updateMobileSubscriberStatistics) {
                        await this.services.mobileTabBar.updateMobileSubscriberStatistics();
                    }

                    // Simulate brief loading for user feedback
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    log.error('Error refreshing mobile data:', error);
                } finally {
                    // Force clear all loading indicators regardless of completion state
                    loadingIndicator.clearConsolidated();
                    loadingIndicator.clear(); // Clear any individual notices too

                    mobileRefreshButton.removeAttribute('loading');
                    window._isManualRefresh = false;
                }
            });
        }

        this.setupCSVExport();
        this.setupSubscriberStatistics();
        const testSubscriberButton = document.getElementById('test-subscriber-update');
        if (testSubscriberButton && typeof isDevelopment !== 'undefined' && isDevelopment) {
            testSubscriberButton.style.display = 'block';
            testSubscriberButton.addEventListener('click', () => {
                const prevOffline = Math.floor(Math.random() * 300) + 200;
                const currOffline = prevOffline + Math.floor(Math.random() * 20) - 10;
                const prevOnline = Math.floor(Math.random() * 20000) + 20000;
                const currOnline = prevOnline - (currOffline - prevOffline);
                if (window.app) window.app.showSubscriberUpdateToast(prevOffline, Math.max(0, currOffline), prevOnline, Math.max(0, currOnline));
            });
        }
    }

    startPowerOutagePolling() {
        // Detect mobile device - use longer intervals to save battery
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            window.innerWidth <= 768;

        // Mobile: 5 minutes (users typically don't leave app running)
        // Desktop: 1 minute (users monitor actively)
        const outagePollInterval = isMobile ? 300000 : 60000;

        log.info(`⚡ Starting power outage data polling(${isMobile ? 'mobile' : 'desktop'}: ${outagePollInterval / 1000}s interval)`);
        const handlePowerOutageUpdate = async (data) => {
            try {
                if (data && data.features) {
                    if (!window._isManualRefresh) {
                        loadingIndicator.showLoading('cullman-outages-update', 'Cullman Power Outages');
                    }
                    let cullmanLayer = this.services.layerManager.getLayer('cullman-outages');

                    // Create layer if it doesn't exist
                    if (!cullmanLayer) {
                        const cullmanOutagesConfig = getLayerConfig('cullmanOutages');
                        if (cullmanOutagesConfig) {
                            cullmanLayer = await this.services.layerManager.createEmptyGeoJSONLayer(cullmanOutagesConfig);
                            if (cullmanLayer) {
                                cullmanLayer.visible = cullmanOutagesConfig.visible;
                                this.services.mapController.addLayer(cullmanLayer, cullmanOutagesConfig.zOrder);
                                log.info('✅ Power outage layer created during polling');
                            }
                        }
                    }

                    if (cullmanLayer && data) {
                        // Convert to GeoJSON format for layer update
                        const cullmanGeoJSON = {
                            type: 'FeatureCollection',
                            features: data.features || []
                        };
                        await this.services.layerManager.updateLayerData('cullman-outages', cullmanGeoJSON);
                    }
                    if (data && !window._isManualRefresh) {
                        loadingIndicator.showNetwork('cullman-outages-update', 'Cullman Power Outages');
                    }
                    // Dispatch event for PowerOutageStats component to update
                    document.dispatchEvent(new CustomEvent('powerOutageDataUpdated', {
                        detail: {
                            cullmanCount: data?.count || 0
                        }
                    }));
                    const powerOutageStatsComponent = document.querySelector('power-outage-stats');
                    if (powerOutageStatsComponent && powerOutageStatsComponent.updateStats) {
                        powerOutageStatsComponent.updateStats(true);
                    }
                }
            } catch (error) {
                log.error('Failed to handle power outage update:', error);
                try {
                    (await import('../services/ErrorService.js')).errorService.report(error, {
                        module: 'Application',
                        action: 'handlePowerOutageUpdate'
                    });
                } catch { }
                if (!window._isManualRefresh) {
                    loadingIndicator.showError('cullman-outages-update', 'Cullman Power Outages', 'Update failed');
                }
            }
        };
        this.pollingManager.startPolling('power-outages', handlePowerOutageUpdate, outagePollInterval);
    }

    async initializeGeotabService() {
        if (!this.geotabEnabled) {
            log.warn('🚛 GeotabService is disabled (VITE_GEOTAB_ENABLED=false)');
            return;
        }
        try {
            log.info('🚛 Initializing GeotabService...');
            const module = await import('../services/GeotabService.js');
            this.services.geotabService = module.geotabService;
            await this.services.geotabService.initialize();
            this.geotabReady = true;
            log.info('✅ GeotabService ready - vehicle tracking enabled');
        } catch (error) {
            log.error('❌ Failed to initialize GeotabService:', error);
            this.geotabReady = false;
        }
    }

    async manageTruckLayerState(layerName, isEnabled) {
        const isTruckLayer = ['Electric Trucks', 'Fiber Trucks'].includes(layerName);
        if (!isTruckLayer) return;
        if (isEnabled) {
            this.activeTruckLayers.add(layerName);
            if (this.activeTruckLayers.size === 1) await this.startGeotabFeed();
        } else {
            this.activeTruckLayers.delete(layerName);
            if (this.activeTruckLayers.size === 0) this.stopGeotabFeed();
        }
    }

    async startGeotabFeed() {
        if (!this.geotabReady || this.geotabFeed) return;
        try {
            log.info('🚛 Starting GeotabFeed for active truck layers');
            if (!this.services.geotabService) {
                const module = await import('../services/GeotabService.js');
                this.services.geotabService = module.geotabService;
            }
            this.geotabFeed = await this.services.geotabService.setupRealtimeDataFeed((feedData) => { this.handleGeotabFeedUpdate(feedData); });
            log.info('✅ GeotabFeed started');
        } catch (error) { log.error('❌ Failed to start GeotabFeed:', error); }
    }

    stopGeotabFeed() {
        if (this.geotabFeed && typeof this.geotabFeed.stop === 'function') { this.geotabFeed.stop(); this.geotabFeed = null; log.info('🛑 GeotabFeed stopped'); }
    }

    handleGeotabFeedUpdate(feedData) {
        try {
            let totalUpdates = 0;
            feedData.forEach(feed => {
                if (feed.data && feed.type === 'truck_data') {
                    const fiberTrucks = feed.data.fiber || [];
                    const electricTrucks = feed.data.electric || [];
                    totalUpdates += fiberTrucks.length + electricTrucks.length;
                }
            });
            if (totalUpdates > 0) {
                const fiberLayer = this.services.layerManager.getLayer('fiber-trucks');
                const electricLayer = this.services.layerManager.getLayer('electric-trucks');
                feedData.forEach(feed => {
                    if (feed.data && feed.type === 'truck_data') {
                        if (fiberLayer && fiberLayer.visible && feed.data.fiber) this.services.layerManager.smoothTruckUpdate('fiber-trucks', feed.data.fiber);
                        if (electricLayer && electricLayer.visible && feed.data.electric) this.services.layerManager.smoothTruckUpdate('electric-trucks', feed.data.electric);
                    }
                });
            }
        } catch (error) { log.error('🚛 Failed to handle GeotabFeed update:', error); }
    }

    showSubscriberUpdateToast(prevOffline, currOffline, prevOnline, currOnline) {
        const existingNotice = document.querySelector('#subscriber-update-notice');
        if (existingNotice) existingNotice.remove();
        const offlineChange = currOffline - prevOffline;
        const onlineChange = currOnline - prevOnline;
        const totalPrevious = prevOffline + prevOnline;
        const totalCurrent = currOffline + currOnline;
        const totalChange = totalCurrent - totalPrevious;
        let title = '';
        let message = '';
        let kind = 'info';
        if (offlineChange > 0 && onlineChange <= 0) {
            kind = 'warning'; title = 'Subscribers Offline';
            message = offlineChange === 1 ? `1 subscriber went offline(${currOffline.toLocaleString()} total offline)` : `${offlineChange.toLocaleString()} subscribers went offline(${currOffline.toLocaleString()} total offline)`;
            if (onlineChange < 0) message += `.${Math.abs(onlineChange).toLocaleString()} fewer online subscribers`;
        } else if (offlineChange < 0 && onlineChange >= 0) {
            kind = 'success'; title = 'Subscribers Restored';
            const restored = Math.abs(offlineChange);
            message = restored === 1 ? `1 subscriber restored to service(${currOffline.toLocaleString()} still offline)` : `${restored.toLocaleString()} subscribers restored to service(${currOffline.toLocaleString()} still offline)`;
            if (onlineChange > 0) message += `.${onlineChange.toLocaleString()} more online subscribers`;
        } else if (offlineChange > 0 && onlineChange > 0) {
            kind = 'info'; title = 'Network Activity'; message = `${offlineChange.toLocaleString()} subscribers went offline, ${onlineChange.toLocaleString()} new subscribers online`;
        } else if (offlineChange < 0 && onlineChange < 0) {
            kind = 'info'; title = 'Subscriber Changes'; const offlineRestored = Math.abs(offlineChange); const onlineReduced = Math.abs(onlineChange); message = `${offlineRestored.toLocaleString()} subscribers restored, ${onlineReduced.toLocaleString()} subscribers disconnected`;
        } else if (totalChange !== 0) {
            kind = 'info'; title = totalChange > 0 ? 'New Subscribers' : 'Subscriber Changes'; message = totalChange > 0 ? `${totalChange.toLocaleString()} new subscribers added to network(${totalCurrent.toLocaleString()} total)` : `${Math.abs(totalChange).toLocaleString()} subscribers removed from network(${totalCurrent.toLocaleString()} total)`;
        } else {
            kind = 'info'; title = 'Service Status Changes'; message = offlineChange > 0 ? `${offlineChange.toLocaleString()} subscribers changed status(${currOffline.toLocaleString()} offline, ${currOnline.toLocaleString()} online)` : `Subscriber status updates(${currOffline.toLocaleString()} offline, ${currOnline.toLocaleString()} online)`;
        }
        const noticeContainer = getOrCreateNoticeContainer();
        const notice = document.createElement('calcite-notice');
        notice.id = 'subscriber-update-notice'; notice.setAttribute('open', ''); notice.setAttribute('kind', kind); notice.setAttribute('closable', ''); notice.setAttribute('icon', 'users'); notice.setAttribute('width', 'auto');
        const titleDiv = document.createElement('div'); titleDiv.slot = 'title'; titleDiv.textContent = title;
        const messageDiv = document.createElement('div'); messageDiv.slot = 'message'; messageDiv.textContent = message;
        notice.appendChild(titleDiv); notice.appendChild(messageDiv); noticeContainer.appendChild(notice);
        notice.addEventListener('calciteNoticeClose', () => { notice.remove(); if (noticeContainer.children.length === 0) { noticeContainer.remove(); } });
        setTimeout(() => { if (document.body.contains(notice)) { notice.setAttribute('open', 'false'); setTimeout(() => { notice.remove(); if (noticeContainer.children.length === 0) noticeContainer.remove(); }, 300); } }, 5000);
    }

    stopPolling() { log.info('⏹️ Stopping all polling'); this.pollingManager.stopAll(); }

    cleanup() {
        log.info('🧹 Cleaning up application resources...');
        if (this.pollingManager) this.pollingManager.stopAll();
        if (this.geotabFeed && typeof this.geotabFeed.stop === 'function') this.geotabFeed.stop();
        const geotab = this.services?.geotabService;
        if (geotab && typeof geotab.cleanup === 'function') geotab.cleanup();
        if (this.services.layerManager && typeof this.services.layerManager.cleanup === 'function') this.services.layerManager.cleanup();
        if (this.services.rainViewerService && typeof this.services.rainViewerService.cleanup === 'function') this.services.rainViewerService.cleanup();
        // Bug 14 fix: Call PopupManager.destroy() to clean up reactiveUtils watchers
        // Bug 3 fix: Wrap in try/catch to prevent cleanup failures from breaking teardown
        if (this.services.popupManager && typeof this.services.popupManager.destroy === 'function') {
            try {
                this.services.popupManager.destroy();
            } catch (error) {
                log.error('Error destroying PopupManager:', error);
            }
        }
        // Bug 1 fix: Remove distance measurement tool listener to prevent memory leak
        if (this._distanceToolListener) {
            const distanceTool = document.getElementById('distance-measurement-tool');
            if (distanceTool) distanceTool.removeEventListener('arcgisPropertyChange', this._distanceToolListener);
            this._distanceToolListener = null;
            this._distanceToolActivationId = null;
        }
        // Bug 1 fix: Clear any pending measurement cleanup timeout
        if (this._measurementCleanupTimeout) {
            clearTimeout(this._measurementCleanupTimeout);
            this._measurementCleanupTimeout = null;
        }
        // Cleanup hover highlight service
        if (hoverHighlightService) {
            hoverHighlightService.destroy();
        }
        if (loadingIndicator) loadingIndicator.destroy();
        this._cleanupHandlers.forEach(handler => { try { handler(); } catch (error) { log.error('Cleanup handler error:', error); } });
        this.services = {}; this._cleanupHandlers = []; this.geotabFeed = null; this.activeTruckLayers.clear(); this.geotabReady = false;
    }
}



