// Application.js - Main application orchestrator

import { MapController } from '../services/MapController.js';
import { LayerManager } from '../services/LayerManager.js';
import { PopupManager } from '../services/PopupManager.js';
// RainViewerService will be lazy-loaded
import { subscriberDataService, pollingManager } from '../dataService.js';
import { getLayerConfig } from '../config/layerConfigs.js';
import { getCurrentServiceArea, getServiceAreaBounds, getSearchSettings } from '../config/searchConfig.js';
// geotabService will be lazy-loaded
import { CSVExportService } from '../utils/csvExport.js';
import * as clipboardUtils from '../utils/clipboardUtils.js';
import { loadingIndicator } from '../utils/loadingIndicator.js';
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
        // Lazy-load RainViewer only when used (deferred)
        // const { RainViewerService } = await import('../services/RainViewerService.js');
        // this.services.rainViewerService = new RainViewerService();

        this.pollingManager = pollingManager;

        this.activeTruckLayers = new Set();
        this.geotabFeed = null;
        this.geotabReady = false;

        window.themeManager = this.services.themeManager;
        window.clipboardUtils = clipboardUtils;

        await this.services.dashboard.init();
        await this.services.headerSearch.init();
        await this.services.mobileTabBar.init();

        await this.services.mapController.initialize();

        const rainViewerInitialized = true; // initialize on-demand later
        if (rainViewerInitialized) {
            log.info('✅ RainViewer service set to initialize on-demand');
        }

        // Idle scheduler reused across paths
        const scheduleIdle = (fn) => {
            if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2000 });
            else setTimeout(fn, 500);
        };

        // Cross-browser media query change listener (iOS Safari addListener)
        const addMqChange = (mq, handler) => {
            if (mq.addEventListener) mq.addEventListener('change', handler);
            else if (mq.addListener) mq.addListener(handler);
        };

        // Optional UI loading (widgets/components) executed at idle
        const loadOptionalUi = async () => {
            // Lazy inject core widgets on all devices
            const injectCoreWidgets = async () => {
                const mapEl = this.services?.mapController?.mapElement;
                if (!mapEl) return;

                // Search widget - load FIRST to ensure top position (lazy via idle, saves ~200KB from critical path)
                const loadSearchWidget = async () => {
                    try {
                        if (!customElements.get('arcgis-search')) {
                            await import('@arcgis/map-components/dist/components/arcgis-search');
                        }
                        if (!mapEl.querySelector('arcgis-search')) {
                            const s = document.createElement('arcgis-search');
                            s.setAttribute('position', 'top-left');
                            s.setAttribute('include-default-sources', 'true');
                            s.setAttribute('max-results', '8');
                            s.setAttribute('min-characters', '3');
                            s.setAttribute('search-all-enabled', 'false');
                            s.setAttribute('placeholder', 'Search addresses, places...');
                            // Insert as first child to ensure top position in widget stack
                            if (mapEl.firstChild) {
                                mapEl.insertBefore(s, mapEl.firstChild);
                            } else {
                                mapEl.appendChild(s);
                            }
                            try { this.configureSearchWidget(); } catch (_) { }
                        }
                    } catch (_) { }
                };
                
                // Load search widget FIRST during idle time
                await loadSearchWidget();

                // Home
                try {
                    if (!customElements.get('arcgis-home')) {
                        await import('@arcgis/map-components/dist/components/arcgis-home');
                    }
                    if (!mapEl.querySelector('arcgis-home')) {
                        const h = document.createElement('arcgis-home');
                        h.setAttribute('position', 'top-left');
                        mapEl.appendChild(h);
                        try { this.services?.mapController?.configureHomeButton(); } catch (_) { }
                    }
                } catch (_) { }

                // Locate
                try {
                    if (!customElements.get('arcgis-locate')) {
                        await import('@arcgis/map-components/dist/components/arcgis-locate');
                    }
                    if (!mapEl.querySelector('arcgis-locate')) {
                        const l = document.createElement('arcgis-locate');
                        l.setAttribute('position', 'top-left');
                        mapEl.appendChild(l);
                    }
                } catch (_) { }

                // Track
                try {
                    if (!customElements.get('arcgis-track')) {
                        await import('@arcgis/map-components/dist/components/arcgis-track');
                    }
                    if (!mapEl.querySelector('arcgis-track')) {
                        const t = document.createElement('arcgis-track');
                        t.setAttribute('position', 'top-left');
                        mapEl.appendChild(t);
                    }
                } catch (_) { }
            };
            await injectCoreWidgets();

            // Basemap Toggle: load with other widgets (not deferred to ensure thumbnails load)
            try {
                const mapEl = this.services?.mapController?.mapElement;
                if (mapEl) {
                    if (!customElements.get('arcgis-basemap-toggle')) {
                        try { await import('@arcgis/map-components/dist/components/arcgis-basemap-toggle'); } catch (_) { /* no-op */ }
                    }
                    if (!mapEl.querySelector('arcgis-basemap-toggle')) {
                        const toggleEl = document.createElement('arcgis-basemap-toggle');
                        toggleEl.setAttribute('position', 'bottom-right');
                        toggleEl.setAttribute('next-basemap', 'satellite');
                        mapEl.appendChild(toggleEl);
                    }
                }
            } catch (_) { /* no-op */ }

            // Desktop-only Basemap Gallery - lazy load during idle (saves ~150KB on mobile)
            const mq = window.matchMedia('(min-width: 900px) and (pointer: fine)');
            const ensureBasemapGallery = async () => {
                try {
                    const mapEl = this.services?.mapController?.mapElement;
                    if (!mapEl) return;
                    
                    // Only load on desktop, not mobile/tablet
                    if (mq.matches) {
                        if (!customElements.get('arcgis-basemap-gallery')) {
                            try { await import('@arcgis/map-components/dist/components/arcgis-basemap-gallery'); } catch (_) { /* no-op */ }
                        }
                        if (!customElements.get('arcgis-expand')) {
                            try { await import('@arcgis/map-components/dist/components/arcgis-expand'); } catch (_) { /* no-op */ }
                        }
                        const existingExpand = mapEl.querySelector('arcgis-expand[icon="basemap"]');
                        if (!existingExpand) {
                            const expandEl = document.createElement('arcgis-expand');
                            expandEl.setAttribute('position', 'top-left');
                            expandEl.setAttribute('icon', 'basemap');
                            expandEl.setAttribute('tooltip', 'Basemap Gallery');
                            const galleryEl = document.createElement('arcgis-basemap-gallery');
                            expandEl.appendChild(galleryEl);
                            mapEl.appendChild(expandEl);
                        }
                    } else {
                        // Remove gallery if switching to mobile
                        const existingExpand = mapEl.querySelector('arcgis-expand[icon="basemap"]');
                        if (existingExpand) existingExpand.parentNode?.removeChild(existingExpand);
                    }
                } catch (_) { /* no-op */ }
            };
            // Load on desktop during idle time (non-blocking)
            if (mq.matches) {
                scheduleIdle(ensureBasemapGallery);
            }
            addMqChange(mq, ensureBasemapGallery);

            // Preload measurement widget on desktop during idle (desktop-only, ~180KB)
            const preloadMeasurementWidget = async () => {
                const mapEl = this.services?.mapController?.mapElement;
                if (!mapEl || !mq.matches) return;
                
                try {
                    // Just preload the component, don't create the widget yet
                    if (!customElements.get('arcgis-measurement')) {
                        await import('@arcgis/map-components/dist/components/arcgis-measurement');
                    }
                } catch (_) { /* no-op */ }
            };
            
            // Preload on desktop during idle time
            if (mq.matches) {
                scheduleIdle(preloadMeasurementWidget);
            }

            // Desktop-only Fullscreen
            const fsMq = window.matchMedia('(min-width: 900px) and (pointer: fine)');
            const ensureFullscreen = async () => {
                try {
                    const mapEl = this.services?.mapController?.mapElement;
                    if (!mapEl) return;
                    if (fsMq.matches) {
                        if (!customElements.get('arcgis-fullscreen')) {
                            try { await import('@arcgis/map-components/dist/components/arcgis-fullscreen'); } catch (_) { /* no-op */ }
                        }
                        if (!mapEl.querySelector('arcgis-fullscreen')) {
                            const fsEl = document.createElement('arcgis-fullscreen');
                            fsEl.setAttribute('position', 'top-left');
                            mapEl.appendChild(fsEl);
                        }
                    } else {
                        const fsEl = mapEl.querySelector('arcgis-fullscreen');
                        if (fsEl) fsEl.parentNode?.removeChild(fsEl);
                    }
                } catch (_) { /* no-op */ }
            };
            await ensureFullscreen();
            addMqChange(fsMq, ensureFullscreen);
        };

        const scheduleCoreRetries = () => {
            const tryEnsure = () => {
                const mapEl = this.services?.mapController?.mapElement;
                if (!mapEl) return;
                const missing = !mapEl.querySelector('arcgis-search') || !mapEl.querySelector('arcgis-home') || !mapEl.querySelector('arcgis-locate');
                if (missing) scheduleIdle(loadOptionalUi);
            };
            setTimeout(tryEnsure, 1000);
            setTimeout(tryEnsure, 3000);
        };

        this.services.mapController.mapElement.addEventListener('arcgisViewReadyChange', async (event) => {
            if (event.target.ready) {
                try { await this.onMapReady(); }
                catch (error) { log.error(error); }

                // Defer optional component loading to idle time
                scheduleIdle(loadOptionalUi);
                scheduleCoreRetries();
            }
        });

        if (this.services.mapController.mapElement.ready) {
            await this.onMapReady();
            scheduleIdle(loadOptionalUi);
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

        this.configureSearchWidget();

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
    }

    configureSearchWidget() {
        const searchWidget = document.querySelector('arcgis-search');
        if (!searchWidget || !this.services.mapController.view) {
            console.warn('Search widget or map view not available for configuration');
            return;
        }

        const serviceArea = getCurrentServiceArea();
        const bounds = getServiceAreaBounds();
        const searchSettings = getSearchSettings();

        try {
            if (searchSettings.placeholder) {
                searchWidget.setAttribute('placeholder', searchSettings.placeholder);
            }
            const applyBoundsToSources = () => {
                if (searchWidget.widget && searchWidget.widget.allSources) {
                    searchWidget.widget.allSources.forEach(source => {
                        if (bounds) {
                            if (source.filter) {
                                source.filter.geometry = { type: 'extent', ...bounds };
                            } else {
                                source.filter = { geometry: { type: 'extent', ...bounds } };
                            }
                        } else {
                            if (source.filter && source.filter.geometry) delete source.filter.geometry;
                        }
                    });
                    const boundsInfo = bounds ? `${serviceArea.name} bounds for local results preference` : 'global search (no geographic constraints)';
                    console.info(`✅ Search widget configured with ${boundsInfo}`);
                }
            };
            searchWidget.addEventListener('arcgisReady', applyBoundsToSources);
            if (searchWidget.widget && searchWidget.widget.allSources) applyBoundsToSources();
        } catch (error) {
            log.error(`Failed to configure search widget with ${serviceArea.name} bounds:`, error);
        }
    }

    async initializeSubscriberLayers() {
        try {
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
            log.info('📊 Online subscribers configured for on-demand loading (saves ~2.7MB)');
            await this.initializePowerOutageLayers();
        } catch (error) {
            log.error('Failed to initialize subscriber layers:', error);
            loadingIndicator.showError('offline-subscribers', 'Offline Subscribers', 'Failed to load');
            loadingIndicator.showError('online-subscribers', 'Online Subscribers', 'Failed to load');
        }
    }

    async initializePowerOutageLayers() {
        try {
            loadingIndicator.showLoading('apco-outages', 'APCo Power Outages');
            loadingIndicator.showLoading('tombigbee-outages', 'Tombigbee Power Outages');
            const apcoConfig = getLayerConfig('apcoOutages');
            if (apcoConfig) {
                const result = await this.createLayerFromConfig(apcoConfig);
                if (result && result.success) {
                    if (result.layer) {
                        result.layer.visible = apcoConfig.visible;
                        this.services.mapController.addLayer(result.layer, apcoConfig.zOrder);
                        loadingIndicator.showNetwork('apco-outages', 'APCo Power Outages');
                    } else if (result.isEmpty) {
                        loadingIndicator.showEmpty('apco-outages', 'APCo Power Outages');
                    }
                } else {
                    loadingIndicator.showError('apco-outages', 'APCo Power Outages', 'Failed to load data');
                }
            }
            const tombigbeeConfig = getLayerConfig('tombigbeeOutages');
            if (tombigbeeConfig) {
                const result = await this.createLayerFromConfig(tombigbeeConfig);
                if (result && result.success) {
                    if (result.layer) {
                        result.layer.visible = tombigbeeConfig.visible;
                        this.services.mapController.addLayer(result.layer, tombigbeeConfig.zOrder);
                        loadingIndicator.showNetwork('tombigbee-outages', 'Tombigbee Power Outages');
                    } else if (result.isEmpty) {
                        loadingIndicator.showEmpty('tombigbee-outages', 'Tombigbee Power Outages');
                    }
                } else {
                    loadingIndicator.showError('tombigbee-outages', 'Tombigbee Power Outages', 'Failed to load data');
                }
            }
        } catch (error) {
            log.error('Failed to initialize power outage layers:', error);
            loadingIndicator.showError('apco-outages', 'APCo Power Outages', 'Failed to load');
            loadingIndicator.showError('tombigbee-outages', 'Tombigbee Power Outages', 'Failed to load');
        }
    }

    async initializeInfrastructureLayers() {
        try {
            const countyBoundariesConfig = getLayerConfig('countyBoundaries');
            if (countyBoundariesConfig) {
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
            }
            const nodeSitesConfig = getLayerConfig('nodeSites');
            if (nodeSitesConfig) {
                loadingIndicator.showLoading('node-sites', 'Node Sites');
                const result = await this.createLayerFromConfig(nodeSitesConfig);
                if (result && result.layer) {
                    result.layer.visible = nodeSitesConfig.visible;
                    this.services.mapController.addLayer(result.layer, nodeSitesConfig.zOrder);
                    if (result.fromCache) loadingIndicator.showCached('node-sites', 'Node Sites');
                    else loadingIndicator.showNetwork('node-sites', 'Node Sites');
                } else {
                    loadingIndicator.showError('node-sites', 'Node Sites', 'Failed to create layer');
                }
            }
            await this.initializeFiberPlantLayers();
            await this.initializeVehicleLayers();
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
                { key: 'mainLineOld', name: 'Main Line Old' },
                { key: 'mstTerminals', name: 'MST Terminals' },
                { key: 'mstFiber', name: 'MST Fiber' },
                { key: 'splitters', name: 'Splitters' },
                { key: 'closures', name: 'Closures' }
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
        } catch (error) {
            log.error('Failed to initialize fiber plant layers:', error);
        }
    }

    async initializeVehicleLayers() {
        try {
            log.info('🚛 Initializing vehicle tracking layers...');
            const vehicleLayers = [
                { key: 'fiberTrucks', name: 'Fiber Trucks' },
                { key: 'electricTrucks', name: 'Electric Trucks' }
            ];
            for (const layerInfo of vehicleLayers) {
                const layerConfig = getLayerConfig(layerInfo.key);
                if (layerConfig) {
                    try {
                        const result = await this.createLayerFromConfig(layerConfig);
                        if (result && result.layer) {
                            result.layer.visible = layerConfig.visible;
                            this.services.mapController.addLayer(result.layer, layerConfig.zOrder);
                            log.info(`✅ ${layerConfig.title} layer initialized`);
                        }
                    } catch (error) {
                        log.error(`Failed to initialize ${layerInfo.name}:`, error);
                    }
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
        document.addEventListener('powerOutageToggle', async (e) => {
            const { layerId, visible } = e.detail;
            if (layerId && this.services.layerManager) {
                await this.services.layerManager.toggleLayerVisibility(layerId, visible);
                log.info(`⚡ Power outage layer toggled: ${layerId} = ${visible}`);
            }
        });
        const switches = document.querySelectorAll('.layer-toggle-item calcite-switch');
        switches.forEach(switchElement => {
            switchElement.addEventListener('calciteSwitchChange', (e) => {
                this.handleLayerToggle(e.target, e.target.checked);
            });
        });
        const listItems = document.querySelectorAll('.layer-toggle-item');
        listItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const switchElement = item.querySelector('calcite-switch');
                if (switchElement && e.target !== switchElement) {
                    switchElement.checked = !switchElement.checked;
                    this.handleLayerToggle(switchElement, switchElement.checked);
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
        // Always set up buttons; widget will be created on-demand on desktop
        this.setupMeasurementButtons();
    }

    async ensureMeasurementReady() {
        const mq = window.matchMedia('(min-width: 900px) and (pointer: fine)');
        if (!mq.matches) return; // Skip entirely on mobile

        // Define component if needed
        if (!customElements.get('arcgis-measurement')) {
            try { await import('@arcgis/map-components/dist/components/arcgis-measurement'); }
            catch (_) { /* no-op */ }
        }

        // Create the element on-demand if not present
        let measurementWidget = document.getElementById('measurement-tool');
        if (!measurementWidget) {
            const mapEl = this.services?.mapController?.mapElement;
            if (!mapEl) return;
            measurementWidget = document.createElement('arcgis-measurement');
            measurementWidget.id = 'measurement-tool';
            mapEl.appendChild(measurementWidget);
        }

        // If already ready, return
        if (measurementWidget.widget) return;

        // Wait for underlying widget to be ready
        await new Promise((resolve) => {
            const readyHandler = () => { resolve(); };
            measurementWidget.addEventListener('arcgisReady', readyHandler, { once: true });
            setTimeout(() => { if (measurementWidget.widget) resolve(); }, 1500);
        });
    }

    setupMeasurementButtons() {
        const distanceBtn = document.getElementById('distance-measurement-btn');
        if (distanceBtn) {
            distanceBtn.removeEventListener('click', this.distanceBtnHandler);
            this.distanceBtnHandler = async () => {
                try {
                    await this.ensureMeasurementReady();
                    const measurementWidget = document.getElementById('measurement-tool');
                    if (!measurementWidget) return;
                    measurementWidget.activeTool = 'distance';
                    this.updateMeasurementButtons('distance');
                } catch (error) { log.error('Error activating distance measurement:', error); }
            };
            distanceBtn.addEventListener('click', this.distanceBtnHandler);
        }
        const areaBtn = document.getElementById('area-measurement-btn');
        if (areaBtn) {
            areaBtn.removeEventListener('click', this.areaBtnHandler);
            this.areaBtnHandler = async () => {
                try {
                    await this.ensureMeasurementReady();
                    const measurementWidget = document.getElementById('measurement-tool');
                    if (!measurementWidget) return;
                    measurementWidget.activeTool = 'area';
                    this.updateMeasurementButtons('area');
                } catch (error) { log.error('Error activating area measurement:', error); }
            };
            areaBtn.addEventListener('click', this.areaBtnHandler);
        }
        const clearBtn = document.getElementById('clear-measurement-btn');
        if (clearBtn) {
            clearBtn.removeEventListener('click', this.clearBtnHandler);
            this.clearBtnHandler = async () => {
                try {
                    await this.ensureMeasurementReady();
                    const measurementWidget = document.getElementById('measurement-tool');
                    if (!measurementWidget) return;
                    measurementWidget.clear();
                    measurementWidget.activeTool = null;
                    this.updateMeasurementButtons(null);
                } catch (error) { log.error('Error clearing measurements:', error); }
            };
            clearBtn.addEventListener('click', this.clearBtnHandler);
        }
    }

    updateMeasurementButtons(activeTool) {
        const distanceBtn = document.getElementById('distance-measurement-btn');
        const areaBtn = document.getElementById('area-measurement-btn');
        const clearBtn = document.getElementById('clear-measurement-btn');
        [distanceBtn, areaBtn, clearBtn].forEach(btn => { if (btn) { btn.appearance = 'solid'; btn.kind = 'neutral'; } });
        if (activeTool === 'distance' && distanceBtn) { distanceBtn.appearance = 'solid'; distanceBtn.kind = 'brand'; }
        else if (activeTool === 'area' && areaBtn) { areaBtn.appearance = 'solid'; areaBtn.kind = 'brand'; }
    }

    setupCSVExport() {
        const desktopExportBtn = document.getElementById('desktop-export-offline-csv-btn');
        if (desktopExportBtn) desktopExportBtn.addEventListener('click', async () => { await this.handleCSVExport(desktopExportBtn, 'offline'); });
        const desktopExportAllBtn = document.getElementById('desktop-export-all-csv-btn');
        if (desktopExportAllBtn) desktopExportAllBtn.addEventListener('click', async () => { await this.handleCSVExport(desktopExportAllBtn, 'all'); });
        const mobileExportBtn = document.getElementById('export-offline-csv-btn');
        if (mobileExportBtn) mobileExportBtn.addEventListener('click', async () => { await this.handleCSVExport(mobileExportBtn, 'offline'); });
        const ta5kReportsBtn = document.getElementById('export-ta5k-reports-btn');
        if (ta5kReportsBtn) ta5kReportsBtn.addEventListener('click', async () => { await this.handleCSVExport(ta5kReportsBtn, 'ta5k-reports'); });
    }

    async handleCSVExport(button, exportType = 'offline') {
        if (!button) return;
        const originalText = button.textContent;
        const originalIcon = button.getAttribute('icon-start');
        try {
            button.setAttribute('loading', 'true');
            button.textContent = 'Preparing Download...';
            button.setAttribute('icon-start', 'loading');
            button.disabled = true;
            if (exportType === 'all') await CSVExportService.exportAllSubscribers();
            else if (exportType === 'ta5k-reports') await CSVExportService.exportTA5KNodeReports();
            else await CSVExportService.exportOfflineSubscribers();
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
        if (onlineSwitch) onlineSwitch.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); });
        if (offlineSwitch) offlineSwitch.addEventListener('calciteSwitchChange', (e) => { this.handleLayerToggle(e.target, e.target.checked); });
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
            const lastUpdatedEl = document.getElementById('last-updated-display');
            if (onlineCountEl) onlineCountEl.textContent = summary.online?.toLocaleString() || '0';
            if (offlineCountEl) offlineCountEl.textContent = summary.offline?.toLocaleString() || '0';
            if (lastUpdatedEl) {
                const lastUpdated = summary.lastUpdated ? new Date(summary.lastUpdated).toLocaleString() : 'Never';
                lastUpdatedEl.textContent = `Last updated: ${lastUpdated}`;
            }
        } catch (error) {
            log.error('Failed to update subscriber statistics:', error);
            this.services.dashboard.updateOfflineCount(0);
            const onlineCountEl = document.getElementById('online-count-display');
            const offlineCountEl = document.getElementById('offline-count-display');
            const lastUpdatedEl = document.getElementById('last-updated-display');
            if (onlineCountEl) onlineCountEl.textContent = '--';
            if (offlineCountEl) offlineCountEl.textContent = '--';
            if (lastUpdatedEl) lastUpdatedEl.textContent = 'Last updated: Error loading data';
        }
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }

    showNotification(type, message, duration = 5000) {
        if (this.isMobileDevice()) { console.log(`📱 Mobile notification skipped: ${type} - ${message}`); return; }
        const notification = document.createElement('calcite-notice');
        notification.setAttribute('kind', type);
        notification.setAttribute('width', 'auto');
        notification.setAttribute('scale', 'm');
        notification.setAttribute('active', 'true');
        notification.style.position = 'fixed';
        notification.style.top = '80px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.style.maxWidth = '400px';
        const messageDiv = document.createElement('div');
        messageDiv.slot = 'message';
        messageDiv.textContent = message;
        notification.appendChild(messageDiv);
        document.body.appendChild(notification);
        setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, duration);
        notification.addEventListener('calciteNoticeClose', () => { if (notification.parentNode) notification.parentNode.removeChild(notification); });
    }

    async handleLayerToggle(element, checked) {
        if (!element || typeof checked !== 'boolean') { log.warn('Invalid layer toggle parameters'); return; }
        const layerId = this.getLayerIdFromElement(element);
        const VALID_LAYER_IDS = new Set(['offline-subscribers', 'online-subscribers', 'node-sites', 'rainviewer-radar', 'apco-outages', 'tombigbee-outages', 'fsa-boundaries', 'main-line-fiber', 'main-line-old', 'mst-terminals', 'mst-fiber', 'splitters', 'closures', 'electric-trucks', 'fiber-trucks']);
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
            }
            this.syncToggleStates(layerId, checked);
            const layerDisplayName = this.getLayerDisplayName(layerId);
            if (layerDisplayName) await this.manageTruckLayerState(layerDisplayName, checked);
        }
    }

    getLayerIdFromElement(element) {
        if (element.id === 'online-subscribers-switch') return 'online-subscribers';
        if (element.id === 'offline-subscribers-switch') return 'offline-subscribers';
        if (element.classList.contains('apco-toggle')) return 'apco-outages';
        if (element.classList.contains('tombigbee-toggle')) return 'tombigbee-outages';
        const listItem = element.closest('calcite-list-item');
        const label = element.closest('calcite-label');
        let labelText = '';
        if (listItem) labelText = listItem.getAttribute('label'); else if (label) labelText = label.textContent.trim();
        const mapping = {
            'Online Subscribers': 'online-subscribers', 'Offline Subscribers': 'offline-subscribers', 'Node Sites': 'node-sites', 'Weather Radar': 'rainviewer-radar', 'APCo Power Outages': 'apco-outages', 'Tombigbee Power Outages': 'tombigbee-outages', 'FSA Boundaries': 'fsa-boundaries', 'Main Line Fiber': 'main-line-fiber', 'Main Line Old': 'main-line-old', 'MST Terminals': 'mst-terminals', 'MST Fiber': 'mst-fiber', 'Splitters': 'splitters', 'Closures': 'closures', 'Electric Trucks': 'electric-trucks', 'Fiber Trucks': 'fiber-trucks'
        };
        return mapping[labelText] || null;
    }

    getLayerDisplayName(layerId) {
        const reverseMapping = { 'fiber-trucks': 'Fiber Trucks', 'electric-trucks': 'Electric Trucks' };
        return reverseMapping[layerId] || null;
    }

    syncToggleStates(layerId, checked) {
        const labelMapping = {
            'offline-subscribers': 'Offline Subscribers', 'online-subscribers': 'Online Subscribers', 'node-sites': 'Node Sites', 'rainviewer-radar': 'Weather Radar', 'apco-outages': 'APCo Power Outages', 'tombigbee-outages': 'Tombigbee Power Outages', 'fsa-boundaries': 'FSA Boundaries', 'main-line-fiber': 'Main Line Fiber', 'main-line-old': 'Main Line Old', 'mst-terminals': 'MST Terminals', 'mst-fiber': 'MST Fiber', 'splitters': 'Splitters', 'closures': 'Closures', 'electric-trucks': 'Electric Trucks', 'fiber-trucks': 'Fiber Trucks'
        };
        if (layerId === 'apco-outages') {
            const apcoSwitches = document.querySelectorAll('.apco-toggle, #toggle-apco-outages');
            apcoSwitches.forEach(s => { s.checked = checked; });
        } else if (layerId === 'tombigbee-outages') {
            const tombigbeeSwitches = document.querySelectorAll('.tombigbee-toggle, #toggle-tombigbee-outages');
            tombigbeeSwitches.forEach(s => { s.checked = checked; });
        }
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
            log.info(`🌧️ Mobile radar toggled: ${newVisibility}`);
        }
    }

    startSubscriberPolling() {
        // Detect mobile device - use longer intervals to save battery
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                         window.innerWidth <= 768;
        
        // Mobile: 5 minutes (users typically don't leave app running)
        // Desktop: 30 seconds (users monitor actively)
        const subscriberPollInterval = isMobile ? 300000 : 30000;
        
        log.info(`🔄 Starting subscriber data polling (${isMobile ? 'mobile' : 'desktop'}: ${subscriberPollInterval / 1000}s interval)`);
        let previousOfflineCount = null;
        let previousOnlineCount = null;
        const handleSubscriberUpdate = async (data) => {
            try {
                if (data.offline || data.online) {
                    if (!window._isManualRefresh && data.offline) loadingIndicator.showLoading('offline-subscribers-update', 'Offline Subscribers');
                    if (!window._isManualRefresh && data.online && this.onlineLayerLoaded) loadingIndicator.showLoading('online-subscribers-update', 'Online Subscribers');
                    const currentOfflineCount = data.offline?.count || 0;
                    const currentOnlineCount = data.online?.count || 0;
                    const offlineLayer = this.services.layerManager.getLayer('offline-subscribers');
                    const onlineLayer = this.services.layerManager.getLayer('online-subscribers');
                    if (offlineLayer && data.offline) {
                        await this.services.layerManager.updateLayerData('offline-subscribers', data.offline);
                        if (!window._isManualRefresh) loadingIndicator.showNetwork('offline-subscribers-update', 'Offline Subscribers');
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
                    loadingIndicator.showError('online-subscribers-update', 'Online Subscribers', 'Update failed');
                }
            }
        };
        this.pollingManager.startPolling('subscribers', handleSubscriberUpdate, subscriberPollInterval);
        const refreshButton = document.getElementById('refresh-data');
        if (refreshButton) {
            refreshButton.addEventListener('click', async () => {
                log.info('🔄 Manual data refresh triggered');
                refreshButton.setAttribute('loading', '');
                try {
                    window._isManualRefresh = true;
                    subscriberDataService.clearCache();
                    await this.pollingManager.performUpdate('subscribers');
                    if (window.app && window.app.updateSubscriberStatistics) await window.app.updateSubscriberStatistics();
                } finally {
                    refreshButton.removeAttribute('loading');
                    window._isManualRefresh = false;
                }
            });
        }
        this.setupCSVExport();
        this.setupSubscriberStatistics();
        const testSubscriberButton = document.getElementById('test-subscriber-update');
        if (testSubscriberButton && isDevelopment) {
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
        
        log.info(`⚡ Starting power outage data polling (${isMobile ? 'mobile' : 'desktop'}: ${outagePollInterval / 1000}s interval)`);
        const handlePowerOutageUpdate = async (data) => {
            try {
                if (data.apco && data.tombigbee) {
                    if (!window._isManualRefresh) {
                        loadingIndicator.showLoading('apco-outages-update', 'APCo Power Outages');
                        loadingIndicator.showLoading('tombigbee-outages-update', 'Tombigbee Power Outages');
                    }
                    const apcoLayer = this.services.layerManager.getLayer('apco-outages');
                    const tombigbeeLayer = this.services.layerManager.getLayer('tombigbee-outages');
                    if (apcoLayer && data.apco) {
                        const apcoGeoJSON = { type: 'FeatureCollection', features: data.apco.features || [] };
                        await this.services.layerManager.updateLayerData('apco-outages', apcoGeoJSON);
                    }
                    if (data.apco && !window._isManualRefresh) loadingIndicator.showNetwork('apco-outages-update', 'APCo Power Outages');
                    if (tombigbeeLayer && data.tombigbee) {
                        const tombigbeeGeoJSON = { type: 'FeatureCollection', features: data.tombigbee.features || [] };
                        await this.services.layerManager.updateLayerData('tombigbee-outages', tombigbeeGeoJSON);
                    }
                    if (data.tombigbee && !window._isManualRefresh) loadingIndicator.showNetwork('tombigbee-outages-update', 'Tombigbee Power Outages');
                    document.dispatchEvent(new CustomEvent('powerOutageDataUpdated', { detail: { apcoCount: data.apco?.count || 0, tombigbeeCount: data.tombigbee?.count || 0 } }));
                    const powerOutageStatsComponent = document.querySelector('power-outage-stats');
                    if (powerOutageStatsComponent) powerOutageStatsComponent.updateStats();
                }
            } catch (error) {
                log.error('Failed to handle power outage update:', error);
                try { (await import('../services/ErrorService.js')).errorService.report(error, { module: 'Application', action: 'handlePowerOutageUpdate' }); } catch { }
                if (!window._isManualRefresh) {
                    loadingIndicator.showError('apco-outages-update', 'APCo Power Outages', 'Update failed');
                    loadingIndicator.showError('tombigbee-outages-update', 'Tombigbee Power Outages', 'Update failed');
                }
            }
        };
        this.pollingManager.startPolling('power-outages', handlePowerOutageUpdate, outagePollInterval);
        const refreshPowerButton = document.getElementById('refresh-power-outages');
        if (refreshPowerButton) {
            refreshPowerButton.addEventListener('click', async () => {
                log.info('⚡ Manual power outage refresh triggered');
                refreshPowerButton.setAttribute('loading', '');
                try {
                    window._isManualRefresh = true;
                    subscriberDataService.refreshData('outages');
                    const powerStats = document.querySelector('power-outage-stats');
                    if (powerStats && typeof powerStats.updateStats === 'function') await powerStats.updateStats(true);
                    await this.pollingManager.performUpdate('power-outages');
                } finally {
                    refreshPowerButton.removeAttribute('loading');
                    window._isManualRefresh = false;
                }
            });
        }
        const testButton = document.getElementById('test-outage-update');
        if (testButton && isDevelopment) {
            testButton.style.display = 'block';
            testButton.addEventListener('click', () => {
                const powerOutageStats = document.querySelector('power-outage-stats');
                if (powerOutageStats) {
                    const prevApco = Math.floor(Math.random() * 10);
                    const currApco = prevApco + Math.floor(Math.random() * 5) - 2;
                    const prevTombigbee = Math.floor(Math.random() * 10);
                    const currTombigbee = prevTombigbee + Math.floor(Math.random() * 5) - 2;
                    powerOutageStats.showUpdateToast(prevApco, Math.max(0, currApco), prevTombigbee, Math.max(0, currTombigbee));
                }
            });
        }
    }

    async initializeGeotabService() {
        if (!this.geotabEnabled) return;
        try {
            log.info('🚛 Initializing GeotabService...');
            const module = await import('../services/GeotabService.js');
            this.services.geotabService = module.geotabService;
            await this.services.geotabService.initialize();
            this.geotabReady = true;
            log.info('✅ GeotabService ready');
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
            message = offlineChange === 1 ? `1 subscriber went offline (${currOffline.toLocaleString()} total offline)` : `${offlineChange.toLocaleString()} subscribers went offline (${currOffline.toLocaleString()} total offline)`;
            if (onlineChange < 0) message += `. ${Math.abs(onlineChange).toLocaleString()} fewer online subscribers`;
        } else if (offlineChange < 0 && onlineChange >= 0) {
            kind = 'success'; title = 'Subscribers Restored';
            const restored = Math.abs(offlineChange);
            message = restored === 1 ? `1 subscriber restored to service (${currOffline.toLocaleString()} still offline)` : `${restored.toLocaleString()} subscribers restored to service (${currOffline.toLocaleString()} still offline)`;
            if (onlineChange > 0) message += `. ${onlineChange.toLocaleString()} more online subscribers`;
        } else if (offlineChange > 0 && onlineChange > 0) {
            kind = 'info'; title = 'Network Activity'; message = `${offlineChange.toLocaleString()} subscribers went offline, ${onlineChange.toLocaleString()} new subscribers online`;
        } else if (offlineChange < 0 && onlineChange < 0) {
            kind = 'info'; title = 'Subscriber Changes'; const offlineRestored = Math.abs(offlineChange); const onlineReduced = Math.abs(onlineChange); message = `${offlineRestored.toLocaleString()} subscribers restored, ${onlineReduced.toLocaleString()} subscribers disconnected`;
        } else if (totalChange !== 0) {
            kind = 'info'; title = totalChange > 0 ? 'New Subscribers' : 'Subscriber Changes'; message = totalChange > 0 ? `${totalChange.toLocaleString()} new subscribers added to network (${totalCurrent.toLocaleString()} total)` : `${Math.abs(totalChange).toLocaleString()} subscribers removed from network (${totalCurrent.toLocaleString()} total)`;
        } else {
            kind = 'info'; title = 'Service Status Changes'; message = offlineChange > 0 ? `${offlineChange.toLocaleString()} subscribers changed status (${currOffline.toLocaleString()} offline, ${currOnline.toLocaleString()} online)` : `Subscriber status updates (${currOffline.toLocaleString()} offline, ${currOnline.toLocaleString()} online)`;
        }
        let noticeContainer = document.querySelector('#notice-container');
        if (!noticeContainer) { noticeContainer = document.createElement('div'); noticeContainer.id = 'notice-container'; noticeContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px;'; document.body.appendChild(noticeContainer); }
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
        if (loadingIndicator) loadingIndicator.destroy();
        this._cleanupHandlers.forEach(handler => { try { handler(); } catch (error) { log.error('Cleanup handler error:', error); } });
        this.services = {}; this._cleanupHandlers = []; this.geotabFeed = null; this.activeTruckLayers.clear(); this.geotabReady = false;
    }
}


