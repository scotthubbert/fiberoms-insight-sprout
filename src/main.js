// main.js - SOLID-compliant application entry point following CLAUDE.md principles
// FiberOMS Insight PWA - Mobile-first fiber network management application
// Features: Search functionality, recent searches, layer management, theme switching

// Configure ArcGIS intl
import * as intl from '@arcgis/core/intl';
intl.setLocale('en');

// Import SOLID-compliant services (DIP - Dependency Injection)
import { MapController } from './services/MapController.js';
import { LayerManager } from './services/LayerManager.js';
import { PopupManager } from './services/PopupManager.js';
import { RainViewerService } from './services/RainViewerService.js';
import { subscriberDataService, pollingManager } from './dataService.js';
import { layerConfigs, getLayerConfig, getAllLayerIds } from './config/layerConfigs.js';
import { geotabService } from './services/GeotabService.js';

// Import components
import './components/PowerOutageStats.js';
import { setupCalciteIconFallback } from './utils/calciteIconFallback.js';
import { initVersionCheck } from './utils/versionCheck.js';
import { loadingIndicator } from './utils/loadingIndicator.js';

// Import ArcGIS Map Components
import "@arcgis/map-components/dist/components/arcgis-search";
import '@arcgis/map-components/dist/components/arcgis-map';
import '@arcgis/map-components/dist/components/arcgis-zoom';
import '@arcgis/map-components/dist/components/arcgis-home';
import '@arcgis/map-components/dist/components/arcgis-basemap-toggle';
import '@arcgis/map-components/dist/components/arcgis-basemap-gallery';
import '@arcgis/map-components/dist/components/arcgis-expand';
import '@arcgis/map-components/dist/components/arcgis-track';
import '@arcgis/map-components/dist/components/arcgis-fullscreen';

// Import Calcite Components
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-shell';
import '@esri/calcite-components/dist/components/calcite-shell-panel';
import '@esri/calcite-components/dist/components/calcite-panel';
import '@esri/calcite-components/dist/components/calcite-action';
import '@esri/calcite-components/dist/components/calcite-action-bar';
import '@esri/calcite-components/dist/components/calcite-block';
import '@esri/calcite-components/dist/components/calcite-label';
import '@esri/calcite-components/dist/components/calcite-checkbox';
import '@esri/calcite-components/dist/components/calcite-input';
import '@esri/calcite-components/dist/components/calcite-navigation';
import '@esri/calcite-components/dist/components/calcite-navigation-logo';
import '@esri/calcite-components/dist/components/calcite-icon';
import '@esri/calcite-components/dist/components/calcite-segmented-control';
import '@esri/calcite-components/dist/components/calcite-segmented-control-item';
import '@esri/calcite-components/dist/components/calcite-list';
import '@esri/calcite-components/dist/components/calcite-list-item';
import '@esri/calcite-components/dist/components/calcite-switch';
import '@esri/calcite-components/dist/components/calcite-dialog';
import '@esri/calcite-components/dist/components/calcite-list';
import '@esri/calcite-components/dist/components/calcite-list-item';
import '@esri/calcite-components/dist/components/calcite-select';
import '@esri/calcite-components/dist/components/calcite-option';
import '@esri/calcite-components/dist/components/calcite-loader';
import '@esri/calcite-components/dist/components/calcite-chip';
import '@esri/calcite-components/dist/components/calcite-card';
import '@esri/calcite-components/dist/components/calcite-autocomplete';
import '@esri/calcite-components/dist/components/calcite-autocomplete-item';
import '@esri/calcite-components/dist/components/calcite-alert';
import '@esri/calcite-components/dist/components/calcite-notice';
import { setAssetPath } from '@esri/calcite-components/dist/components';

// Set Calcite assets path for both dev and production
// In development, Vite serves node_modules directly
// In production, Vite copies assets to dist folder
const isProduction = import.meta.env.PROD;
const assetsPath = isProduction
  ? window.location.origin + '/calcite/assets'
  : '/node_modules/@esri/calcite-components/dist/calcite/assets';

// Try local assets first, fallback to CDN if needed
setAssetPath(assetsPath);

// Setup icon fallback handling
setupCalciteIconFallback();

// Production logging utility
const isDevelopment = import.meta.env.DEV;
const log = {
  info: (...args) => isDevelopment && console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};

// Global error handler for cache errors to prevent app crashes
window.addEventListener('unhandledrejection', event => {
  if (event.reason && event.reason.message) {
    const errorMessage = event.reason.message;

    // Suppress non-critical errors that shouldn't break the app
    if (errorMessage.includes('Cache.put()') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('Failed to execute') ||
      errorMessage.includes('Unexpected token') ||
      errorMessage.includes('<!DOCTYPE') ||
      errorMessage.includes('is not valid JSON') ||
      errorMessage.includes('AbortError') ||
      errorMessage.includes('RainViewer') ||
      errorMessage.includes('timeout')) {
      console.warn('🔇 Suppressed non-critical error:', errorMessage);
      event.preventDefault(); // Prevent the error from bubbling up and crashing the app
    }
  }
});

// Additional error handler for SyntaxError JSON parsing issues
window.addEventListener('error', event => {
  if (event.error && event.error.name === 'SyntaxError' &&
    event.error.message.includes('Unexpected token')) {
    console.warn('🔇 Suppressed JSON parsing error (likely from external API):', event.error.message);
    event.preventDefault();
  }
});

// Comprehensive CalciteUI error handler
window.addEventListener('unhandledrejection', event => {
  const error = event.reason;

  // Handle CalciteUI component errors specifically
  if (error && error.stack) {
    const errorStack = error.stack.toString();

    // CalciteUI component rendering errors
    if (errorStack.includes('renderItemAriaLive') ||
      errorStack.includes('calcite-') ||
      errorStack.includes('PE.render') ||
      errorStack.includes('PE.update')) {
      console.warn('🔇 Suppressed CalciteUI component error (non-critical):', error.message);
      event.preventDefault();

      // Try to recover mobile UI if it was affected
      setTimeout(() => {
        const app = window.app;
        if (app && app.services && app.services.mobileTabBar) {
          console.log('🔄 Attempting mobile UI recovery after CalciteUI error');
          app.services.mobileTabBar.recoverMobileUI();
        }
      }, 500);

      return;
    }
  }
});

// Basemap configuration for theme management
const BASEMAP_CONFIG = {
  light: {
    primary: 'streets-navigation-vector',
    alternate: 'hybrid'
  },
  dark: {
    primary: 'streets-night-vector',
    alternate: 'hybrid'
  }
};

// Theme Manager - Single Responsibility Principle
class ThemeManager {
  constructor() {
    this.userPreference = localStorage.getItem('theme');
    this.hasUserPreference = this.userPreference !== null;
    this.currentTheme = this.hasUserPreference ? this.userPreference : this.getSystemPreference();
    this.init();
  }

  getSystemPreference() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  async init() {
    await customElements.whenDefined('calcite-button');
    this.themeToggle = document.getElementById('theme-toggle');

    if (this.themeToggle) {
      this.applyTheme(this.currentTheme);
      this.themeToggle.addEventListener('click', () => this.toggleTheme());

      // Listen for system theme changes
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
          if (!this.hasUserPreference) {
            const newTheme = e.matches ? 'dark' : 'light';
            this.currentTheme = newTheme;
            this.applyTheme(newTheme);
          }
        });
      }
    }
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.updateToggleIcon(theme);

    const isDark = theme === 'dark';
    document.body.classList.toggle('calcite-mode-dark', isDark);

    // Toggle ArcGIS theme stylesheets (official Esri pattern)
    const lightStylesheet = document.getElementById('esri-theme-light');
    const darkStylesheet = document.getElementById('esri-theme-dark');

    if (lightStylesheet && darkStylesheet) {
      lightStylesheet.disabled = isDark;
      darkStylesheet.disabled = !isDark;
    }

    // Update ArcGIS map components theme
    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.setAttribute('theme', theme);
      const themeBasemaps = BASEMAP_CONFIG[theme];
      mapElement.setAttribute('basemap', themeBasemaps.primary);

      const basemapToggle = mapElement.querySelector('arcgis-basemap-toggle');
      if (basemapToggle) {
        basemapToggle.setAttribute('next-basemap', themeBasemaps.alternate);
      }

      const widgets = mapElement.querySelectorAll('arcgis-search, arcgis-zoom, arcgis-home, arcgis-locate, arcgis-basemap-toggle, arcgis-basemap-gallery, arcgis-expand, arcgis-track, arcgis-fullscreen');
      widgets.forEach(widget => {
        widget.setAttribute('theme', theme);
      });

      // Apply theme to Esri widgets with delay
      setTimeout(() => {
        const esriElements = document.querySelectorAll('.esri-widget, .esri-search, .esri-popup, .esri-ui, .esri-view-surface');
        esriElements.forEach(element => {
          element.classList.toggle('calcite-mode-dark', isDark);
          element.classList.toggle('calcite-mode-light', !isDark);
        });
      }, 100);
    }

    if (window.mapView) {
      this.applyThemeToView(window.mapView);
    }

    // Update RainViewer layer for theme change
    if (window.app?.services?.rainViewerService) {
      window.app.services.rainViewerService.updateTheme();
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
    this.userPreference = this.currentTheme;
    this.hasUserPreference = true;
  }

  updateToggleIcon(theme) {
    const icon = theme === 'dark' ? 'brightness' : 'moon';
    const baseLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
    const statusLabel = this.hasUserPreference ? ' (manual)' : ' (following system)';

    this.themeToggle.setAttribute('icon-start', icon);
    this.themeToggle.setAttribute('aria-label', baseLabel);
    this.themeToggle.setAttribute('title', baseLabel + statusLabel);
  }

  applyThemeToView(view) {
    if (!view) return;

    const isDark = this.currentTheme === 'dark';

    if (view.container) {
      view.container.classList.toggle('calcite-mode-dark', isDark);
      view.container.classList.toggle('calcite-mode-light', !isDark);
    }

    if (view.popup?.container) {
      view.popup.container.classList.toggle('calcite-mode-dark', isDark);
      view.popup.container.classList.toggle('calcite-mode-light', !isDark);
    }
  }
}

// Polling Service - Single Responsibility Principle (disabled for Phase 1)
class PollingService {
  constructor(layerManager) {
    this.layerManager = layerManager;
    this.pollingTimers = {};
    this.pollingIntervals = {
      offlineSubscribers: 30000,  // 30 seconds for critical offline data
      onlineSubscribers: 300000,  // 5 minutes for online data
      vehicles: 10000,            // 10 seconds for real-time vehicle tracking
      outages: 60000              // 1 minute for outage data
    };

    window.addEventListener('beforeunload', () => this.cleanup());
  }

  startPolling(layerName) {
    // Polling disabled for Phase 1 - will implement in Phase 2
    return;
  }

  stopPolling(layerName) {
    if (this.pollingTimers[layerName]) {
      clearInterval(this.pollingTimers[layerName]);
      delete this.pollingTimers[layerName];
    }
  }

  async updateLayerData(layerName) {
    // Delegate to LayerManager
    return this.layerManager.updateLayerData(layerName);
  }

  cleanup() {
    Object.keys(this.pollingTimers).forEach(layerName => {
      this.stopPolling(layerName);
    });
  }
}

// Layer Panel Manager - Single Responsibility Principle
class LayerPanel {
  constructor() {
    this.shellPanel = document.getElementById('layers-panel');
    this.layersAction = document.getElementById('layers-action');
    this.ospAction = document.getElementById('osp-action');
    this.vehiclesAction = document.getElementById('vehicles-action');
    this.powerOutagesAction = document.getElementById('power-outages-action');
    this.searchAction = document.getElementById('search-action');
    this.networkParentAction = document.getElementById('network-parent-action');
    this.toolsAction = document.getElementById('tools-action');
    this.infoAction = document.getElementById('info-action');
    this.layersContent = document.getElementById('layers-content');
    this.ospContent = document.getElementById('osp-content');
    this.vehiclesContent = document.getElementById('vehicles-content');
    this.powerOutagesContent = document.getElementById('power-outages-content');
    this.searchContent = document.getElementById('search-content');
    this.networkParentContent = document.getElementById('network-parent-content');
    this.toolsContent = document.getElementById('tools-content');
    this.infoContent = document.getElementById('info-content');

    // Initialize loading flags
    this.isLoadingVehicleList = false;

    this.init();
  }

  async init() {
    await customElements.whenDefined('calcite-shell-panel');
    await customElements.whenDefined('calcite-action');
    await customElements.whenDefined('calcite-panel');
    this.setupActionBarNavigation();
    this.setupCacheManagement();
  }

  setupActionBarNavigation() {
    this.layersAction?.addEventListener('click', () => this.handleActionClick('layers'));
    this.ospAction?.addEventListener('click', () => this.handleActionClick('osp'));
    this.vehiclesAction?.addEventListener('click', () => this.handleActionClick('vehicles'));
    this.powerOutagesAction?.addEventListener('click', () => this.handleActionClick('power-outages'));
    this.searchAction?.addEventListener('click', () => this.handleActionClick('search'));
    this.networkParentAction?.addEventListener('click', () => this.handleActionClick('network-parent'));
    this.toolsAction?.addEventListener('click', () => this.handleActionClick('tools'));
    this.infoAction?.addEventListener('click', () => this.handleActionClick('info'));
  }

  handleActionClick(panelName) {
    const clickedAction = this.getActionByPanel(panelName);

    if (clickedAction?.active && !this.shellPanel?.collapsed) {
      this.shellPanel.collapsed = true;
      return;
    }

    if (this.shellPanel?.collapsed) {
      this.shellPanel.collapsed = false;
    }
    this.showPanel(panelName);
  }

  getActionByPanel(panelName) {
    switch (panelName) {
      case 'layers': return this.layersAction;
      case 'osp': return this.ospAction;
      case 'vehicles': return this.vehiclesAction;
      case 'power-outages': return this.powerOutagesAction;
      case 'search': return this.searchAction;
      case 'network-parent': return this.networkParentAction;
      case 'tools': return this.toolsAction;
      case 'info': return this.infoAction;
      default: return null;
    }
  }

  showPanel(panelName) {
    // Hide all panels using both hidden attribute AND display style for reliability
    this.layersContent.hidden = true;
    this.layersContent.style.display = 'none';
    this.ospContent.hidden = true;
    this.ospContent.style.display = 'none';
    this.vehiclesContent.hidden = true;
    this.vehiclesContent.style.display = 'none';
    this.powerOutagesContent.hidden = true;
    this.powerOutagesContent.style.display = 'none';
    this.searchContent.hidden = true;
    this.searchContent.style.display = 'none';
    this.networkParentContent.hidden = true;
    this.networkParentContent.style.display = 'none';
    this.toolsContent.hidden = true;
    this.toolsContent.style.display = 'none';
    this.infoContent.hidden = true;
    this.infoContent.style.display = 'none';

    // Remove active state from all actions
    this.layersAction.active = false;
    this.ospAction.active = false;
    this.vehiclesAction.active = false;
    this.powerOutagesAction.active = false;
    this.searchAction.active = false;
    this.networkParentAction.active = false;
    this.toolsAction.active = false;
    this.infoAction.active = false;

    // Show selected panel and set active action
    switch (panelName) {
      case 'layers':
        this.layersContent.hidden = false;
        this.layersContent.style.display = 'block';
        this.layersAction.active = true;
        break;
      case 'osp':
        this.ospContent.hidden = false;
        this.ospContent.style.display = 'block';
        this.ospAction.active = true;
        break;
      case 'vehicles':
        this.vehiclesContent.hidden = false;
        this.vehiclesContent.style.display = 'block';
        this.vehiclesAction.active = true;
        this.updateVehicleStatus();
        break;
      case 'power-outages':
        this.powerOutagesContent.hidden = false;
        this.powerOutagesContent.style.display = 'block';
        this.powerOutagesAction.active = true;
        break;
      case 'search':
        this.searchContent.hidden = false;
        this.searchContent.style.display = 'block';
        this.searchAction.active = true;
        break;
      case 'network-parent':
        this.networkParentContent.hidden = false;
        this.networkParentContent.style.display = 'block';
        this.networkParentAction.active = true;
        break;
      case 'tools':
        this.toolsContent.hidden = false;
        this.toolsContent.style.display = 'block';
        this.toolsAction.active = true;
        this.updateCacheStatus();
        break;
      case 'info':
        this.infoContent.hidden = false;
        this.infoContent.style.display = 'block';
        this.infoAction.active = true;
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
      const { geotabService } = await import('./services/GeotabService.js');
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
      console.error('Failed to update GeotabService status:', error);
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
        // Also refresh the vehicle list if it's open
        const vehicleListBlock = document.getElementById('vehicle-list-block');
        if (vehicleListBlock && vehicleListBlock.open) {
          await this.loadVehicleList();
        }
      });
    }

    // Set up vehicle list event listeners
    this.setupVehicleListEventListeners();
  }

  async refreshVehicles() {
    try {
      const { geotabService } = await import('./services/GeotabService.js');

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
      this.showVehicleNotification('Vehicle locations refreshed successfully', 'success');

    } catch (error) {
      console.error('Failed to refresh vehicles:', error);
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

  async loadVehicleList() {
    console.log('🚛 ========== loadVehicleList called at', new Date().toLocaleTimeString(), '==========');

    // Prevent multiple concurrent calls
    if (this.isLoadingVehicleList) {
      console.log('🚛 Vehicle list already loading, skipping...');
      return;
    }

    this.isLoadingVehicleList = true;
    console.log('🚛 Starting vehicle list load process...');

    // Add production debugging
    console.log('🚛 Environment check:', {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
      hasApp: !!window.app,
      hasLayerManager: !!window.app?.layerManager,
      hasGeotabService: !!window.geotabService
    });

    const vehicleListBlock = document.getElementById('vehicle-list-block');
    const loadingDiv = document.getElementById('vehicle-list-loading');
    const emptyDiv = document.getElementById('vehicle-list-empty');
    const vehicleList = document.getElementById('vehicle-list');
    const vehicleCount = document.getElementById('vehicle-count');
    const lastUpdated = document.getElementById('vehicle-last-updated');
    const footer = document.getElementById('vehicle-list-footer');

    // Show loading state briefly
    if (loadingDiv) loadingDiv.hidden = false;
    if (emptyDiv) emptyDiv.hidden = true;
    if (vehicleList) vehicleList.hidden = true;
    if (footer) footer.hidden = true;

    try {
      console.log('🚛 Trying to get vehicle data from existing layers...');

      // Debug layer access
      console.log('🚛 Debug: window.app exists:', !!window.app);
      console.log('🚛 Debug: window.app.layerManager exists:', !!window.app?.layerManager);

      if (window.app?.layerManager) {
        // List all available layers
        console.log('🚛 Debug: Available layers:', Object.keys(window.app.layerManager.layers || {}));
      }

      // First, try to get data from existing vehicle layers (much faster!)
      const allVehicles = [];

      // Get data from fiber trucks layer
      const fiberLayer = window.app?.layerManager?.getLayer('fiber-trucks');
      console.log('🚛 Debug: fiberLayer found:', !!fiberLayer);
      if (fiberLayer) {
        console.log('🚛 Debug: fiberLayer.source exists:', !!fiberLayer.source);
        console.log('🚛 Debug: fiberLayer.source.items exists:', !!fiberLayer.source?.items);
        console.log('🚛 Debug: fiberLayer.source.items.length:', fiberLayer.source?.items?.length);
        console.log('🚛 Debug: fiberLayer structure:', {
          type: typeof fiberLayer,
          keys: Object.keys(fiberLayer),
          source: fiberLayer.source ? Object.keys(fiberLayer.source) : 'no source'
        });
      }

      if (fiberLayer && fiberLayer.source && fiberLayer.source.items.length > 0) {
        console.log('🚛 Found fiber trucks layer with', fiberLayer.source.items.length, 'trucks');
        fiberLayer.source.items.forEach(graphic => {
          const attrs = graphic.attributes;
          allVehicles.push({
            id: attrs.id,
            name: attrs.name,
            latitude: graphic.geometry.latitude,
            longitude: graphic.geometry.longitude,
            installer: attrs.installer,
            speed: attrs.speed,
            is_driving: attrs.is_driving,
            last_updated: attrs.last_updated,
            communication_status: attrs.communication_status,
            type: 'Fiber',
            typeIcon: 'car'
          });
        });
      } else {
        console.log('🚛 No fiber trucks layer data found');
      }

      // Get data from electric trucks layer
      const electricLayer = window.app?.layerManager?.getLayer('electric-trucks');
      console.log('🚛 Debug: electricLayer found:', !!electricLayer);
      if (electricLayer) {
        console.log('🚛 Debug: electricLayer.source exists:', !!electricLayer.source);
        console.log('🚛 Debug: electricLayer.source.items exists:', !!electricLayer.source?.items);
        console.log('🚛 Debug: electricLayer.source.items.length:', electricLayer.source?.items?.length);
      }

      if (electricLayer && electricLayer.source && electricLayer.source.items.length > 0) {
        console.log('🚛 Found electric trucks layer with', electricLayer.source.items.length, 'trucks');
        electricLayer.source.items.forEach(graphic => {
          const attrs = graphic.attributes;
          allVehicles.push({
            id: attrs.id,
            name: attrs.name,
            latitude: graphic.geometry.latitude,
            longitude: graphic.geometry.longitude,
            installer: attrs.installer,
            speed: attrs.speed,
            is_driving: attrs.is_driving,
            last_updated: attrs.last_updated,
            communication_status: attrs.communication_status,
            type: 'Electric',
            typeIcon: 'flash'
          });
        });
      } else {
        console.log('🚛 No electric trucks layer data found');
      }

      console.log('🚛 Total vehicles from layers:', allVehicles.length);

      // If we got data from layers, use it!
      if (allVehicles.length > 0) {
        console.log('✅ Using vehicle data from existing layers');
        this.displayVehicleList(allVehicles);
        return;
      }

      // Try alternative access: get cached data directly from GeotabService
      console.log('🚛 Trying to access cached data from GeotabService...');

      const geotabModule = await import('./services/GeotabService.js');
      const cachedData = geotabModule.geotabService.lastTruckData;
      console.log('🚛 GeotabService cached data:', cachedData);

      if (cachedData && (cachedData.fiber?.length > 0 || cachedData.electric?.length > 0)) {
        console.log('✅ Using cached data from GeotabService');

        // Process cached data
        if (cachedData.fiber?.length > 0) {
          cachedData.fiber.forEach(truck => {
            allVehicles.push({
              ...truck,
              type: 'Fiber',
              typeIcon: 'car',
              installer: truck.installer || truck.name?.split(' ')?.slice(-1)[0] || 'Unknown'
            });
          });
        }

        if (cachedData.electric?.length > 0) {
          cachedData.electric.forEach(truck => {
            allVehicles.push({
              ...truck,
              type: 'Electric',
              typeIcon: 'flash',
              installer: truck.installer || truck.name?.split(' ')?.slice(-1)[0] || 'Unknown'
            });
          });
        }

        console.log('🚛 Total vehicles from cached data:', allVehicles.length);
        this.displayVehicleList(allVehicles);
        return;
      }

      // Fallback: try to get fresh data from GeotabService (but this might hit rate limits)
      console.log('🚛 No cached data found, trying GeotabService as fallback...');

      const truckData = await geotabModule.geotabService.getTruckData();
      console.log('🚛 Fallback: Vehicle data received:', truckData);

      // Process GeotabService data
      if (truckData.fiber?.length > 0) {
        truckData.fiber.forEach(truck => {
          allVehicles.push({
            ...truck,
            type: 'Fiber',
            typeIcon: 'car',
            installer: truck.name?.split(' ')?.slice(-1)[0] || 'Unknown'
          });
        });
      }

      if (truckData.electric?.length > 0) {
        truckData.electric.forEach(truck => {
          allVehicles.push({
            ...truck,
            type: 'Electric',
            typeIcon: 'flash',
            installer: truck.name?.split(' ')?.slice(-1)[0] || 'Unknown'
          });
        });
      }

      console.log('🚛 Total vehicles from GeotabService fallback:', allVehicles.length);
      this.displayVehicleList(allVehicles);

    } catch (error) {
      console.error('🚛 Error loading vehicle list:', error);

      // Hide loading and show empty state with error
      if (loadingDiv) loadingDiv.hidden = true;
      if (emptyDiv) {
        emptyDiv.hidden = false;
        const emptyTitle = emptyDiv.querySelector('h4');
        const emptyText = emptyDiv.querySelector('p');
        if (emptyTitle) emptyTitle.textContent = 'Error Loading Vehicles';
        if (emptyText) emptyText.textContent = `Failed to load vehicle data: ${error.message}`;
      }
      if (vehicleList) vehicleList.hidden = true;
      if (footer) footer.hidden = true;
    } finally {
      this.isLoadingVehicleList = false;
    }
  }

  displayVehicleList(allVehicles) {
    console.log('🚛 displayVehicleList called with', allVehicles.length, 'vehicles');

    const vehicleListBlock = document.getElementById('vehicle-list-block');
    const loadingDiv = document.getElementById('vehicle-list-loading');
    const emptyDiv = document.getElementById('vehicle-list-empty');
    const vehicleList = document.getElementById('vehicle-list');
    const vehicleCount = document.getElementById('vehicle-count');
    const lastUpdated = document.getElementById('vehicle-last-updated');
    const footer = document.getElementById('vehicle-list-footer');

    console.log('🚛 DOM elements found:', {
      vehicleListBlock: !!vehicleListBlock,
      loadingDiv: !!loadingDiv,
      emptyDiv: !!emptyDiv,
      vehicleList: !!vehicleList,
      vehicleCount: !!vehicleCount,
      lastUpdated: !!lastUpdated,
      footer: !!footer
    });

    // Store for filtering
    this.currentVehicleData = allVehicles;

    // Always hide loading when we have data or empty result
    if (loadingDiv) {
      loadingDiv.hidden = true;
      loadingDiv.style.display = 'none'; // Force hide
      console.log('🚛 Loading div hidden');
    }

    if (allVehicles.length === 0) {
      console.log('🚛 No vehicles found, showing empty state');
      if (emptyDiv) emptyDiv.hidden = false;
      if (vehicleList) vehicleList.hidden = true;
      if (footer) footer.hidden = true;
    } else {
      console.log('🚛 Showing vehicle list with vehicles:', allVehicles.length);
      if (emptyDiv) emptyDiv.hidden = true;
      if (vehicleList) {
        vehicleList.hidden = false;
        vehicleList.style.display = 'block'; // Force show
      }
      if (footer) {
        footer.hidden = false;
        footer.style.display = 'flex'; // Force show
      }

      // Populate vehicle list
      this.populateVehicleList(allVehicles);

      // Update footer
      if (vehicleCount) vehicleCount.textContent = `${allVehicles.length} vehicles`;
      if (lastUpdated) {
        const now = new Date();
        lastUpdated.textContent = `Last updated: ${now.toLocaleTimeString()}`;
      }

      // Auto-expand the block if there are vehicles
      if (vehicleListBlock) {
        vehicleListBlock.open = true;
      }
    }
  }

  // DEBUG: Force test the vehicle list with real cached data
  async testVehicleList() {
    console.log('🚛 DEBUG: Testing vehicle list with real cached data...');

    try {
      const geotabModule = await import('./services/GeotabService.js');
      const cachedData = geotabModule.geotabService.lastTruckData;
      console.log('🚛 DEBUG: Raw cached data:', cachedData);

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

        console.log('🚛 DEBUG: Processed vehicles for display:', testVehicles.length);
        this.displayVehicleList(testVehicles);
      } else {
        console.log('🚛 DEBUG: No cached data available, using simple mock data');
        const mockVehicles = [
          {
            id: 'test-1',
            name: 'Test Vehicle 1',
            latitude: 32.3617,
            longitude: -86.2792,
            installer: 'TestUser',
            speed: 0,
            is_driving: false,
            last_updated: new Date().toISOString(),
            communication_status: 'online',
            type: 'Fiber',
            typeIcon: 'car'
          }
        ];
        this.displayVehicleList(mockVehicles);
      }
    } catch (error) {
      console.error('🚛 DEBUG: Error in testVehicleList:', error);
    }
  }

  populateVehicleList(vehicles) {
    console.log('🚛 populateVehicleList called with vehicles:', vehicles.length);
    const vehicleList = document.getElementById('vehicle-list');
    if (!vehicleList) {
      console.error('🚛 Vehicle list element not found!');
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

        const listItem = document.createElement('calcite-list-item');

        // Format vehicle name with proper validation
        const vehicleName = (vehicle.name && typeof vehicle.name === 'string')
          ? vehicle.name.trim()
          : `${vehicle.type || 'Unknown'} Truck`;

        const installer = (vehicle.installer && typeof vehicle.installer === 'string')
          ? vehicle.installer.trim()
          : 'Unknown';

        const status = this.getVehicleStatus(vehicle) || 'Unknown';

        // Ensure all attributes are non-empty strings to prevent CalciteUI errors
        const safeLabel = vehicleName || 'Vehicle';
        const safeDescription = `${installer} • ${status}`;

        listItem.setAttribute('label', safeLabel);
        listItem.setAttribute('description', safeDescription);

        // Add vehicle type icon with validation
        const typeIcon = document.createElement('calcite-icon');
        typeIcon.slot = 'content-start';
        const iconName = (vehicle.typeIcon && typeof vehicle.typeIcon === 'string')
          ? vehicle.typeIcon
          : 'car'; // Default icon
        typeIcon.setAttribute('icon', iconName);
        typeIcon.className = 'vehicle-type-icon';

        // Only append if icon is valid
        if (iconName) {
          listItem.appendChild(typeIcon);
        }

        // Add status indicator
        const statusIcon = document.createElement('calcite-icon');
        statusIcon.slot = 'content-end';
        statusIcon.setAttribute('scale', 's');
        statusIcon.className = `vehicle-status-${String(status).toLowerCase().replace(/[^a-z]/g, '')}`;

        let statusIconName = 'circle';
        if (status === 'Online') {
          statusIconName = 'circle-filled';
        } else if (status === 'Idle') {
          statusIconName = 'circle-filled';
        }

        statusIcon.setAttribute('icon', statusIconName);
        listItem.appendChild(statusIcon);

        // Add click handler to zoom to vehicle
        listItem.addEventListener('click', () => {
          this.zoomToVehicle(vehicle);
        });

        vehicleList.appendChild(listItem);

      } catch (error) {
        console.error('🚛 Error creating list item for vehicle', index, ':', error);
        console.error('🚛 Vehicle data:', vehicle);
      }
    });

    console.log('🚛 populateVehicleList completed, total items added:', vehicles.length);
  }

  getVehicleStatus(vehicle) {
    try {
      if (!vehicle || typeof vehicle !== 'object') {
        return 'Unknown';
      }

      if (!vehicle.communication_status || vehicle.communication_status === 'offline') {
        return 'Offline';
      }

      if (vehicle.is_driving || (vehicle.speed && vehicle.speed > 5)) {
        return 'Online';
      }

      return 'Idle';
    } catch (error) {
      console.error('🚛 Error determining vehicle status:', error);
      return 'Unknown';
    }
  }

  zoomToVehicle(vehicle) {
    if (!vehicle.latitude || !vehicle.longitude) {
      this.showVehicleNotification('Location not available for this vehicle', 'warning');
      return;
    }

    // Get the map view
    const mapView = window.mapView;
    if (!mapView) {
      this.showVehicleNotification('Map not available', 'danger');
      return;
    }

    // Create point and zoom to it
    import('@arcgis/core/geometry/Point').then(({ default: Point }) => {
      const point = new Point({
        longitude: vehicle.longitude,
        latitude: vehicle.latitude,
        spatialReference: { wkid: 4326 }
      });

      // Zoom to the vehicle location
      mapView.goTo({
        target: point,
        zoom: 16
      }).then(() => {
        // Show success notification
        const vehicleName = vehicle.name || `${vehicle.type} Truck`;
        this.showVehicleNotification(`Zoomed to ${vehicleName}`, 'success');
      }).catch(error => {
        console.error('Failed to zoom to vehicle:', error);
        this.showVehicleNotification('Failed to zoom to vehicle location', 'danger');
      });
    });
  }

  setupVehicleListEventListeners() {
    // Prevent duplicate event listeners
    if (this.vehicleListListenersSetup) return;
    this.vehicleListListenersSetup = true;

    console.log('🚛 Setting up vehicle list event listeners...');

    // Search functionality
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

    // Load vehicle list when block is expanded
    const vehicleListBlock = document.getElementById('vehicle-list-block');
    if (vehicleListBlock) {
      vehicleListBlock.addEventListener('calciteBlockToggle', (e) => {
        console.log('🚛 Vehicle list block toggled!');
        console.log('🚛 Toggle event detail:', e.detail);
        console.log('🚛 Block is open:', e.detail?.open);

        // Check the actual element state instead of relying on event detail
        const isOpen = vehicleListBlock.hasAttribute('open') || vehicleListBlock.open === true;
        console.log('🚛 Block actual state (open):', isOpen);
        console.log('🚛 Block attributes:', {
          hasOpenAttribute: vehicleListBlock.hasAttribute('open'),
          openProperty: vehicleListBlock.open,
          expanded: vehicleListBlock.expanded,
          collapsed: vehicleListBlock.collapsed
        });

        if (isOpen) {
          console.log('🚛 Block opened - calling loadVehicleList()');
          this.loadVehicleList();
        } else {
          console.log('🚛 Block closed');
        }
      });
      console.log('🚛 Vehicle list block listener added');
    } else {
      console.log('🚛 Vehicle list block not found');
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

    // Update count
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

    console.log('🚛 UI elements found:', {
      loadingDiv: !!loadingDiv,
      emptyDiv: !!emptyDiv,
      tableContainer: !!tableContainer,
      truckCountSpan: !!truckCountSpan,
      lastUpdatedSpan: !!lastUpdatedSpan
    });

    // Show loading state
    console.log('🚛 Setting loading state, elements found:', {
      loadingDiv: !!loadingDiv,
      emptyDiv: !!emptyDiv,
      tableContainer: !!tableContainer
    });
    console.log('🚛 Element IDs being searched:', {
      loadingId: 'truck-table-loading',
      emptyId: 'truck-table-empty',
      containerClass: '.truck-table-container'
    });

    // Debug: Check what's actually in the modal DOM
    const modal = document.getElementById('truck-table-modal');
    if (modal) {
      const allDivs = modal.querySelectorAll('div');
      console.log('🚛 All divs in modal:', Array.from(allDivs).map(div => ({
        id: div.id,
        className: div.className,
        hidden: div.hidden,
        style: div.style.cssText
      })));
    }

    if (loadingDiv) {
      loadingDiv.hidden = false;
      console.log('🚛 Showing loading - loadingDiv.hidden:', loadingDiv.hidden);
    } else {
      console.error('🚛 Loading div not found!');
    }

    if (emptyDiv) {
      emptyDiv.hidden = true;
      console.log('🚛 Hiding empty state initially - emptyDiv.hidden:', emptyDiv.hidden);
    } else {
      console.error('🚛 Empty div not found!');
    }

    if (tableContainer) {
      tableContainer.style.display = 'none';
      console.log('🚛 Hiding table container initially - display:', tableContainer.style.display);
    } else {
      console.error('🚛 Table container not found!');
    }

    try {
      console.log('🚛 Importing GeotabService');
      const { geotabService } = await import('./services/GeotabService.js');
      console.log('🚛 Getting truck data');
      const truckData = await geotabService.getTruckData();
      console.log('🚛 Truck data received:', truckData);

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

      // Store for filtering/sorting
      this.currentTruckData = allTrucks;
      console.log('🚛 Total trucks combined:', allTrucks.length);

      // Hide loading
      console.log('🚛 Before hiding loading - loadingDiv.hidden:', loadingDiv?.hidden);
      if (loadingDiv) {
        loadingDiv.hidden = true;
        console.log('🚛 After hiding loading - loadingDiv.hidden:', loadingDiv.hidden);
      }

      console.log('🚛 About to check truck count. allTrucks.length:', allTrucks.length);
      console.log('🚛 allTrucks sample:', allTrucks.slice(0, 2));

      if (allTrucks.length === 0) {
        console.log('🚛 No trucks found, showing empty state');
        // Show empty state
        if (emptyDiv) {
          emptyDiv.hidden = false;
          console.log('🚛 Showing empty state - emptyDiv.hidden:', emptyDiv.hidden);
        }
        if (tableContainer) {
          tableContainer.style.display = 'none';
          console.log('🚛 Hiding table container');
        }
      } else {
        console.log('🚛 Showing table with trucks:', allTrucks.length);
        // Show table
        if (emptyDiv) {
          emptyDiv.hidden = true;
          console.log('🚛 Hiding empty state - emptyDiv.hidden:', emptyDiv.hidden);
        }
        if (tableContainer) {
          tableContainer.style.display = 'block';
          console.log('🚛 Showing table container - display:', tableContainer.style.display);

          // Debug table container
          console.log('🚛 Table container styles after display block:', {
            display: window.getComputedStyle(tableContainer).display,
            height: window.getComputedStyle(tableContainer).height,
            maxHeight: window.getComputedStyle(tableContainer).maxHeight,
            overflow: window.getComputedStyle(tableContainer).overflow,
            overflowY: window.getComputedStyle(tableContainer).overflowY,
            scrollHeight: tableContainer.scrollHeight,
            clientHeight: tableContainer.clientHeight
          });
        }

        // Populate table
        console.log('🚛 Calling populateTruckTable');
        this.populateTruckTable(allTrucks);
      }

      // Update footer
      if (truckCountSpan) {
        truckCountSpan.textContent = `${allTrucks.length} truck${allTrucks.length !== 1 ? 's' : ''}`;
      }
      if (lastUpdatedSpan) {
        lastUpdatedSpan.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
      }

    } catch (error) {
      console.error('Failed to load truck data:', error);

      // Hide loading and show empty state with error
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

  populateTruckTable(trucks) {
    console.log('🚛 populateTruckTable called with trucks:', trucks.length);
    const tbody = document.getElementById('truck-table-body');
    console.log('🚛 Table body found:', !!tbody);
    if (!tbody) {
      console.error('🚛 Table body not found!');
      return;
    }

    tbody.innerHTML = ''; // Clear existing rows
    console.log('🚛 Creating rows for trucks');

    trucks.forEach((truck, index) => {
      console.log(`🚛 Creating row ${index + 1} for truck:`, truck.name || truck.id);
      const row = document.createElement('tr');

      // Zoom column
      const zoomCell = document.createElement('td');
      zoomCell.innerHTML = `
        <calcite-icon 
          icon="zoom-to-object" 
          scale="m" 
          class="truck-zoom-btn"
          title="Zoom to ${truck.name || truck.id}"
          data-truck-id="${truck.id}"
          data-truck-lat="${truck.latitude}"
          data-truck-lng="${truck.longitude}">
        </calcite-icon>
      `;

      // Add click handler for zoom
      const zoomIcon = zoomCell.querySelector('.truck-zoom-btn');
      if (zoomIcon) {
        zoomIcon.addEventListener('click', () => {
          this.zoomToTruck(truck);
        });
      }

      // Truck name column
      const nameCell = document.createElement('td');
      nameCell.innerHTML = `
        <div class="truck-name-cell">
          <calcite-icon icon="${truck.typeIcon}" scale="s" class="truck-type-icon"></calcite-icon>
          <span>${this.formatTruckName(truck)}</span>
        </div>
      `;

      // Installer column
      const installerCell = document.createElement('td');
      installerCell.textContent = truck.installer || truck.driver || 'Unknown';

      // Status column
      const statusCell = document.createElement('td');
      const status = this.getTruckStatus(truck);
      statusCell.innerHTML = `<span class="truck-status-${status.toLowerCase()}">${status}</span>`;

      // Location column
      const locationCell = document.createElement('td');
      locationCell.textContent = this.formatTruckLocation(truck);

      // Add cells to row
      row.appendChild(zoomCell);
      row.appendChild(nameCell);
      row.appendChild(installerCell);
      row.appendChild(statusCell);
      row.appendChild(locationCell);

      tbody.appendChild(row);
    });

    console.log('🚛 populateTruckTable completed, total rows added:', trucks.length);

    // Additional debugging
    console.log('🚛 Table body children count:', tbody.children.length);
    console.log('🚛 Table body innerHTML length:', tbody.innerHTML.length);
    console.log('🚛 First few table rows:', Array.from(tbody.children).slice(0, 3).map(row => row.innerHTML.substring(0, 100)));

    // Check if there are any CSS issues with table rows
    setTimeout(() => {
      const allRows = tbody.querySelectorAll('tr');
      console.log('🚛 Total TR elements found:', allRows.length);
      console.log('🚛 Visible rows check:', Array.from(allRows).slice(0, 5).map(row => ({
        display: window.getComputedStyle(row).display,
        height: window.getComputedStyle(row).height,
        visibility: window.getComputedStyle(row).visibility
      })));
    }, 100);
  }

  formatTruckName(truck) {
    if (truck.name) {
      return truck.name;
    }

    // Create a name from truck data
    const type = truck.type === 'fiber' ? 'Fiber' : 'Electric';
    const installer = truck.installer || truck.driver || '';
    const shortInstaller = installer.split(' ')[0]; // First name only

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
    if (truck.address) {
      return truck.address;
    }

    // Format coordinates if no address
    if (truck.latitude && truck.longitude) {
      return `${truck.latitude.toFixed(4)}, ${truck.longitude.toFixed(4)}`;
    }

    return 'Location unknown';
  }

  zoomToTruck(truck) {
    if (!truck.latitude || !truck.longitude) {
      this.showVehicleNotification('Location not available for this vehicle', 'warning');
      return;
    }

    // Get the map view
    const mapView = window.mapView;
    if (!mapView) {
      this.showVehicleNotification('Map not available', 'danger');
      return;
    }

    // Create point and zoom to it
    import('@arcgis/core/geometry/Point').then(({ default: Point }) => {
      const point = new Point({
        longitude: truck.longitude,
        latitude: truck.latitude,
        spatialReference: { wkid: 4326 }
      });

      // Zoom to the truck location
      mapView.goTo({
        target: point,
        zoom: 16
      }).then(() => {
        // Close the modal after zooming
        const modal = document.getElementById('truck-table-modal');
        if (modal) {
          modal.open = false;
        }

        // Show success notification
        const truckName = this.formatTruckName(truck);
        this.showVehicleNotification(`Zoomed to ${truckName}`, 'success');
      }).catch(error => {
        console.error('Failed to zoom to truck:', error);
        this.showVehicleNotification('Failed to zoom to vehicle location', 'danger');
      });
    });
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

    // Update count
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
    const noticeContainer = document.querySelector('#notice-container') || document.body;
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

    // Auto-remove after 3 seconds
    setTimeout(() => notice.remove(), 3000);
  }

  updateBuildInfo() {
    // Import build info dynamically to avoid circular dependencies
    import('./utils/buildInfo.js').then(({ getFormattedBuildInfo }) => {
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

    // Set up resource links
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
      const { cacheService } = await import('./services/CacheService.js');
      const stats = await cacheService.getCacheStats();

      const cacheDetailsDiv = document.getElementById('cache-details');
      const cacheSizeText = document.getElementById('cache-size-text');

      if (stats.length === 0) {
        cacheSizeText.textContent = 'Empty';
        cacheDetailsDiv.innerHTML = '<p style="color: var(--calcite-color-text-3); font-size: 13px;">No cached data</p>';
        return;
      }

      // Calculate total size
      const totalFeatures = stats.reduce((sum, stat) => sum + stat.size, 0);
      cacheSizeText.textContent = `${totalFeatures} features`;

      // Build details HTML
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
      console.error('Failed to get cache status:', error);
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
      'nodeSites': 'Node Sites'
    };
    return names[dataType] || dataType;
  }

  async clearCache() {
    try {
      const { cacheService } = await import('./services/CacheService.js');
      await cacheService.clearAllCache();
      await this.updateCacheStatus();

      // Show success notification
      const noticeContainer = document.querySelector('#notice-container') || document.body;
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

      // Auto-remove after 3 seconds
      setTimeout(() => notice.remove(), 3000);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}

// Mobile Tab Bar Manager - Single Responsibility Principle
class MobileTabBar {
  constructor() {
    this.tabBar = document.getElementById('mobile-tab-bar');
    this.closeButton = document.getElementById('mobile-close-button');
    this.currentDialog = null;
  }

  async init() {
    await customElements.whenDefined('calcite-segmented-control');
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.tabBar) {
      this.tabBar.addEventListener('calciteSegmentedControlChange', (e) => {
        this.handleTabSelection(e.target.selectedItem.value);
      });
    }

    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => {
        this.closeCurrentPanel();
      });
    }

    this.setupCloseButtons();
    this.setupMobileSearchDialogListeners();
    this.setupMobileCacheManagement();
  }

  setupMobileSearchDialogListeners() {
    const mobileSearchDialog = document.getElementById('mobile-search-sheet');
    if (mobileSearchDialog) {
      mobileSearchDialog.addEventListener('calciteDialogOpen', () => {
        // Refresh recent searches when dialog opens
        if (window.app?.services?.headerSearch) {
          window.app.services.headerSearch.updateRecentSearchesUI();
        }
      });

    }
  }

  setupMobileCacheManagement() {
    const refreshBtn = document.getElementById('mobile-refresh-cache-btn');
    const clearBtn = document.getElementById('mobile-clear-cache-btn');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.updateMobileCacheStatus());
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all cached OSP data? This will require re-downloading all data on next use.')) {
          await this.clearMobileCache();
        }
      });
    }
  }

  async handleTabSelection(tabValue) {
    this.closeCurrentPanel();

    const dialogId = `mobile-${tabValue}-sheet`;
    const dialog = document.getElementById(dialogId);

    if (dialog) {
      // Ensure CalciteUI components are properly initialized before opening
      try {
        // Wait for critical CalciteUI components with timeout
        await Promise.race([
          Promise.all([
            customElements.whenDefined('calcite-dialog'),
            customElements.whenDefined('calcite-switch'),
            customElements.whenDefined('calcite-list-item'),
            customElements.whenDefined('calcite-list'),
            customElements.whenDefined('calcite-block')
          ]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('CalciteUI timeout')), 2000))
        ]);

        dialog.open = true;
        this.currentDialog = dialog;
        this.closeButton.classList.add('show');

        // Initialize functionality for specific tabs
        if (tabValue === 'other') {
          this.initializeMobileOtherTab();
        } else if (tabValue === 'subscribers') {
          await this.initializeMobileSubscribersTab();
        }
      } catch (error) {
        console.warn('⚠️ CalciteUI components not ready, but proceeding with dialog open:', error);
        // Still try to open the dialog - force it open regardless of component state
        dialog.open = true;
        this.currentDialog = dialog;
        this.closeButton.classList.add('show');

        // Force subscriber initialization even if CalciteUI failed
        if (tabValue === 'subscribers') {
          await this.forceInitializeMobileSubscribersTab();
        }
      }
    }
  }

  async initializeMobileSubscribersTab() {
    try {
      // Ensure subscriber switches are properly initialized
      const subscriberDialog = document.getElementById('mobile-subscribers-sheet');
      if (subscriberDialog) {
        // Wait a bit for components to fully render
        await new Promise(resolve => setTimeout(resolve, 150));

        const switches = subscriberDialog.querySelectorAll('calcite-switch');
        const listItems = subscriberDialog.querySelectorAll('calcite-list-item');

        // Ensure all elements are visible and functional
        switches.forEach(switchEl => {
          switchEl.style.display = 'block';
          switchEl.style.visibility = 'visible';
          switchEl.style.opacity = '1';
        });

        listItems.forEach(item => {
          item.style.display = 'block';
          item.style.visibility = 'visible';
          item.style.opacity = '1';
        });

        console.log('✅ Mobile subscriber tab initialized successfully');
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize mobile subscribers tab:', error);
      await this.forceInitializeMobileSubscribersTab();
    }
  }

  async forceInitializeMobileSubscribersTab() {
    // Fallback initialization that works even if CalciteUI components fail
    const subscriberDialog = document.getElementById('mobile-subscribers-sheet');
    if (subscriberDialog) {
      // Force all content to be visible with inline styles
      const content = subscriberDialog.querySelector('[slot="content"]');
      if (content) {
        content.style.display = 'block';
        content.style.visibility = 'visible';
        content.style.opacity = '1';
        content.style.padding = '16px';

        // Force all child elements to be visible
        const allElements = content.querySelectorAll('*');
        allElements.forEach(el => {
          el.style.display = el.style.display || 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
        });

        // Special handling for list items
        const listItems = content.querySelectorAll('calcite-list-item');
        listItems.forEach(item => {
          item.style.minHeight = '56px';
          item.style.padding = '12px';
          item.style.borderBottom = '1px solid #e0e0e0';
          item.style.display = 'flex';
          item.style.alignItems = 'center';
        });

        // Special handling for switches
        const switches = content.querySelectorAll('calcite-switch');
        switches.forEach(switchEl => {
          switchEl.style.display = 'inline-block';
          switchEl.style.minWidth = '44px';
          switchEl.style.minHeight = '24px';
        });

        console.log('🔧 Force-initialized mobile subscriber dialog');
      }
    }
  }

  initializeMobileOtherTab() {
    // Update cache status and build info when other tab is opened
    this.updateMobileCacheStatus();
    this.updateMobileBuildInfo();
    this.setupMobileResourceLinks();
  }

  async updateMobileCacheStatus() {
    try {
      const { cacheService } = await import('./services/CacheService.js');
      const stats = await cacheService.getCacheStats();

      const cacheDetailsDiv = document.getElementById('mobile-cache-details');
      const cacheSizeText = document.getElementById('mobile-cache-size-text');

      if (stats.length === 0) {
        cacheSizeText.textContent = 'Empty';
        cacheDetailsDiv.innerHTML = '<p style="color: var(--calcite-color-text-3); font-size: 13px;">No cached data</p>';
        return;
      }

      // Calculate total size
      const totalFeatures = stats.reduce((sum, stat) => sum + stat.size, 0);
      cacheSizeText.textContent = `${totalFeatures} features`;

      // Build details HTML
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
      console.error('Failed to get mobile cache status:', error);
    }
  }

  async clearMobileCache() {
    try {
      const { cacheService } = await import('./services/CacheService.js');
      await cacheService.clearAllCache();
      await this.updateMobileCacheStatus();

      // Show success notification
      const noticeContainer = document.querySelector('#notice-container') || document.body;
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

      // Auto-remove after 3 seconds
      setTimeout(() => notice.remove(), 3000);
    } catch (error) {
      console.error('Failed to clear mobile cache:', error);
    }
  }

  updateMobileBuildInfo() {
    // Import build info dynamically to avoid circular dependencies
    import('./utils/buildInfo.js').then(({ getFormattedBuildInfo }) => {
      const info = getFormattedBuildInfo();

      const buildVersionElement = document.getElementById('mobile-build-version-text');
      const buildDateElement = document.getElementById('mobile-build-date-text');
      const environmentElement = document.getElementById('mobile-environment-text');

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
  }

  setupMobileResourceLinks() {
    const docsLink = document.getElementById('mobile-docs-link');
    const issueLink = document.getElementById('mobile-issue-link');

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

  formatDataType(dataType) {
    const mapping = {
      'fsa': 'FSA Boundaries',
      'mainFiber': 'Main Line Fiber',
      'mainOld': 'Main Line Old',
      'mstFiber': 'MST Fiber',
      'mstTerminals': 'MST Terminals',
      'closures': 'Closures',
      'splitters': 'Splitters',
      'nodeSites': 'Node Sites'
    };

    return mapping[dataType] || dataType;
  }

  closeCurrentPanel() {
    if (this.currentDialog) {
      this.currentDialog.open = false;
      this.currentDialog = null;
    }
    this.closeButton.classList.remove('show');

    if (this.tabBar) {
      this.tabBar.selectedItem = null;
    }
  }

  setupCloseButtons() {
    const closeButtons = document.querySelectorAll('.dialog-close-btn');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.closeCurrentPanel();
      });
    });
  }

  recoverMobileUI() {
    // Recovery method to restore mobile UI functionality after CalciteUI errors
    try {
      console.log('🔧 Recovering mobile UI after component failures...');

      // Ensure all mobile dialogs are properly configured
      const dialogs = document.querySelectorAll('.mobile-only calcite-dialog');
      dialogs.forEach(dialog => {
        if (dialog) {
          dialog.style.display = 'block';
          dialog.style.visibility = 'visible';

          // Ensure content is visible
          const content = dialog.querySelector('[slot="content"]');
          if (content) {
            content.style.display = 'block';
            content.style.visibility = 'visible';
            content.style.opacity = '1';
          }
        }
      });

      // Special recovery for subscriber dialog
      const subscriberDialog = document.getElementById('mobile-subscribers-sheet');
      if (subscriberDialog) {
        this.forceInitializeMobileSubscribersTab();
      }

      // Ensure tab bar is functional
      const tabBar = document.getElementById('mobile-tab-bar');
      if (tabBar) {
        tabBar.style.display = 'block';
        tabBar.style.visibility = 'visible';
        tabBar.style.opacity = '1';
      }

      console.log('✅ Mobile UI recovery completed');
    } catch (error) {
      console.warn('⚠️ Mobile UI recovery failed:', error);
    }
  }
}

// Dashboard Manager - Single Responsibility Principle
class DashboardManager {
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
      // Import data service dynamically to avoid circular imports
      const { subscriberDataService } = await import('./dataService.js');

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

      await this.updateDashboard();

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

// Header Search Manager - Single Responsibility Principle
// Manages search functionality across desktop and mobile interfaces
// Includes recent searches functionality with localStorage persistence
class HeaderSearch {
  constructor() {
    this.searchInput = document.getElementById('header-search');
    this.mobileSearchInput = document.getElementById('mobile-search-input');
    this.desktopSearchInput = document.getElementById('desktop-search');
    this.searchTimeout = null;
    this.mobileSearchTimeout = null;
    this.desktopSearchTimeout = null;
    this.currentResults = [];
    this.currentIndicatorGraphics = null;
    // Recent searches functionality
    this.recentSearches = [];
    this.maxRecentSearches = 5;
  }

  // Recent searches management
  loadRecentSearches() {
    try {
      const stored = localStorage.getItem('fiberoms-recent-searches');
      this.recentSearches = stored ? JSON.parse(stored) : [];
    } catch (error) {
      log.warn('Failed to load recent searches:', error);
      this.recentSearches = [];
    }
  }

  saveRecentSearches() {
    try {
      localStorage.setItem('fiberoms-recent-searches', JSON.stringify(this.recentSearches));
    } catch (error) {
      log.warn('Failed to save recent searches:', error);
    }
  }

  addToRecentSearches(result) {
    if (!result || !result.customer_name) return;

    // Create a recent search entry
    const recentEntry = {
      id: result.id,
      customer_name: result.customer_name,
      customer_number: result.customer_number,
      address: result.address,
      city: result.city,
      state: result.state,
      zip: result.zip,
      latitude: result.latitude,
      longitude: result.longitude,
      status: result.status,
      timestamp: Date.now()
    };

    // Remove existing entry with same ID if it exists
    this.recentSearches = this.recentSearches.filter(item => item.id !== result.id);

    // Add to beginning of array
    this.recentSearches.unshift(recentEntry);

    // Keep only the most recent searches
    if (this.recentSearches.length > this.maxRecentSearches) {
      this.recentSearches = this.recentSearches.slice(0, this.maxRecentSearches);
    }

    this.saveRecentSearches();
    this.updateRecentSearchesUI();
  }

  updateRecentSearchesUI() {
    const recentSearchesList = document.querySelector('#mobile-search-sheet .recent-searches-list');
    if (!recentSearchesList) return;

    // Clear existing items
    recentSearchesList.innerHTML = '';

    if (this.recentSearches.length === 0) {
      // Show empty state
      const emptyItem = document.createElement('calcite-list-item');
      emptyItem.setAttribute('label', 'No recent searches');
      emptyItem.setAttribute('description', 'Your recent searches will appear here');
      emptyItem.innerHTML = '<calcite-icon slot="content-start" icon="information"></calcite-icon>';
      recentSearchesList.appendChild(emptyItem);
      return;
    }

    // Add recent search items
    this.recentSearches.forEach(recentItem => {
      const listItem = document.createElement('calcite-list-item');
      listItem.setAttribute('label', recentItem.customer_name || 'Unnamed Customer');
      listItem.setAttribute('description', this.formatEnhancedDescription(recentItem));

      const statusColor = recentItem.status === 'Online' ? 'success' : 'danger';
      listItem.innerHTML = `
        <calcite-icon slot="content-start" icon="clock" style="color: var(--calcite-color-text-3);"></calcite-icon>
        <calcite-icon slot="content-end" icon="person" style="color: var(--calcite-color-status-${statusColor}); margin-right: 8px;"></calcite-icon>
        <calcite-action slot="actions-end" icon="arrowRight"></calcite-action>
      `;

      // Store result data and add click handler
      listItem._resultData = recentItem;
      listItem.addEventListener('click', () => {
        this.handleRecentSearchSelection(recentItem);
      });

      recentSearchesList.appendChild(listItem);
    });
  }

  handleRecentSearchSelection(result) {
    // Clear the mobile search input
    if (this.mobileSearchInput) {
      this.mobileSearchInput.value = '';
    }

    // Clear mobile search results
    this.clearMobileSearchResults();

    // Close the mobile search dialog
    const mobileDialog = document.getElementById('mobile-search-sheet');
    if (mobileDialog) {
      mobileDialog.open = false;
    }

    // Close any open mobile panels
    if (window.app?.services?.mobileTabBar) {
      window.app.services.mobileTabBar.closeCurrentPanel();
    }

    // Navigate to result
    this.navigateToResult(result);
  }

  clearRecentSearches() {
    this.recentSearches = [];
    localStorage.removeItem('fiberoms-recent-searches');
    this.updateRecentSearchesUI();
  }

  async init() {
    if (!this.searchInput && !this.mobileSearchInput && !this.desktopSearchInput) return;

    await customElements.whenDefined('calcite-autocomplete');
    await customElements.whenDefined('calcite-autocomplete-item');
    await customElements.whenDefined('calcite-input');

    // Load recent searches
    this.loadRecentSearches();
    this.updateRecentSearchesUI();

    this.setupEventListeners();
  }


  setupEventListeners() {
    // Header search (autocomplete)
    if (this.searchInput) {
      // Use input event which reliably fires and contains inputValue
      this.searchInput.addEventListener('input', (e) => {
        // Try both inputValue and value properties
        const searchValue = e.target.inputValue || e.target.value;
        if (searchValue) {
          this.handleSearchInput(searchValue, 'header');
        }
      });

      // Enter key to select first result
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleEnterKeySelection(this.searchInput);
        }
      });

      // Escape to clear everything (use keyup to fire after calcite processing)
      this.searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
          this.clearEverything('header');
        }
      });

      // Selection event for when user picks a result
      this.searchInput.addEventListener('calciteAutocompleteChange', (e) => {
        if (e.target.selectedItem) {
          this.handleSearchSelection(e.target.selectedItem);
        } else {
          // Try to find the selected item by value
          if (e.target.value) {
            const selectedElement = e.target.querySelector(`calcite-autocomplete-item[value="${e.target.value}"]`);
            if (selectedElement && selectedElement._resultData) {
              this.handleSearchSelection(selectedElement);
            }
          }
        }
      });
    }

    // Desktop search (autocomplete)
    if (this.desktopSearchInput) {
      // Use input event for desktop search too
      this.desktopSearchInput.addEventListener('input', (e) => {
        if (e.target.inputValue) {
          this.handleSearchInput(e.target.inputValue, 'desktop');
        }
      });

      // Enter key to select first result
      this.desktopSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleEnterKeySelection(this.desktopSearchInput);
        }
      });

      // Escape to clear everything (use keyup to fire after calcite processing)
      this.desktopSearchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
          this.clearEverything('desktop');
        }
      });

      this.desktopSearchInput.addEventListener('calciteAutocompleteChange', (e) => {
        if (e.target.selectedItem) {
          this.handleSearchSelection(e.target.selectedItem);
        }
      });
    }

    // Mobile search (regular input)
    if (this.mobileSearchInput) {
      this.mobileSearchInput.addEventListener('input', (e) => {
        this.handleMobileSearchInput(e.target.value);
      });

      this.mobileSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleMobileEnterKey(e.target.value);
        }
      });

      this.mobileSearchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
          this.clearEverything('mobile');
        }
      });
    }

  }

  handleSearchInput(searchTerm, source = 'header') {
    const timeoutKey = source === 'desktop' ? 'desktopSearchTimeout' : 'searchTimeout';

    // Clear previous timeout
    if (this[timeoutKey]) {
      clearTimeout(this[timeoutKey]);
    }

    // If search field is completely cleared, clear everything
    if (!searchTerm || searchTerm.trim() === '') {
      this.clearEverything(source);
      return;
    }

    // Clear results if search term is too short (but not empty)
    if (searchTerm.length < 4) {
      this.clearSearchResults(source);
      return;
    }

    // Debounce search to avoid too many API calls
    this[timeoutKey] = setTimeout(() => {
      this.performSearch(searchTerm, source);
    }, 300);
  }

  async performSearch(searchTerm, source = 'header') {
    try {
      const targetInput = source === 'desktop' ? this.desktopSearchInput : this.searchInput;

      // Show loading state
      this.setSearchLoading(true, targetInput);

      // Perform the search
      const searchResult = await subscriberDataService.searchSubscribers(searchTerm, 8);

      // Update search results for autocomplete inputs
      this.updateSearchResults(searchResult, targetInput);

    } catch (error) {
      log.error('Search failed:', error);
      this.showSearchError(source === 'desktop' ? this.desktopSearchInput : this.searchInput);
    } finally {
      this.setSearchLoading(false, source === 'desktop' ? this.desktopSearchInput : this.searchInput);
    }
  }

  updateSearchResults(searchResult, targetInput) {
    // Clear existing DOM items FIRST, but don't clear internal state
    this.clearSearchResults(null, targetInput, false);

    // Now set the new results
    this.currentResults = searchResult.results;

    if (this.currentResults.length === 0) {
      this.showNoResults(searchResult.searchTerm, targetInput);
      return;
    }

    // Add search result items
    this.currentResults.forEach((result, index) => {
      const item = document.createElement('calcite-autocomplete-item');
      item.setAttribute('value', String(result.id || index));

      // Use text-label for the customer name only
      const label = this.formatSearchResultLabel(result);
      item.setAttribute('text-label', label || 'Unknown');

      // Use description for all the details
      const description = this.formatEnhancedDescription(result);
      item.setAttribute('description', description || '');

      // Add data attribute for status-based styling
      item.setAttribute('data-status', result.status || 'unknown');

      // Add status indicator icon using CalciteUI colors
      const statusColor = result.status === 'Online' ? 'success' : 'danger';
      item.innerHTML = `
        <calcite-icon slot="icon" icon="person" style="color: var(--calcite-color-status-${statusColor});"></calcite-icon>
      `;

      // Store full result data
      item._resultData = result;

      targetInput.appendChild(item);
    });
  }

  formatSearchResultLabel(result) {
    // Ensure we always return a valid string
    if (!result) return 'Unknown';
    return String(result.customer_name || 'Unnamed Customer');
  }

  formatSearchResultDescription(result) {
    if (!result) return '';
    const parts = [];
    if (result.customer_number) parts.push(`#${result.customer_number}`);
    if (result.address) parts.push(result.address);
    if (result.city) parts.push(result.city);
    return parts.join(' • ') || 'No details available';
  }

  formatFullAddress(result) {
    const parts = [];
    if (result.address) parts.push(result.address);
    if (result.city) parts.push(result.city);
    if (result.state) parts.push(result.state);
    if (result.zip) parts.push(result.zip);

    return parts.length > 0 ? parts.join(', ') : 'No address available';
  }

  formatEnhancedDescription(result) {
    if (!result) return 'No details available';

    const parts = [];

    if (result.customer_name) {
      parts.push(String(result.customer_name));
    }

    if (result.customer_number) {
      parts.push(String(result.customer_number));
    }

    const address = this.formatFullAddress(result);
    if (address && address !== 'No address available') {
      parts.push(String(address));
    }

    return parts.join(' • ') || 'No details available';
  }

  handleSearchSelection(selectedItem) {
    const resultData = selectedItem._resultData;

    if (resultData) {
      // Add to recent searches
      this.addToRecentSearches(resultData);

      this.navigateToResult(resultData);

      // Clear search input values
      if (this.searchInput) {
        this.searchInput.value = '';
        this.clearSearchResults('header');
      }
      if (this.desktopSearchInput) {
        this.desktopSearchInput.value = '';
        this.clearSearchResults('desktop');
      }
    }
  }

  handleEnterKeySelection(targetInput) {
    // Find the first search result item
    const firstItem = targetInput.querySelector('calcite-autocomplete-item:not([disabled])');

    if (firstItem && firstItem._resultData) {
      this.handleSearchSelection(firstItem);
    } else {
      // If no results available, check if we have current results in memory
      if (this.currentResults && this.currentResults.length > 0) {
        const firstResult = this.currentResults[0];

        // Create a mock selected item with the result data
        const mockSelectedItem = {
          _resultData: firstResult
        };

        this.handleSearchSelection(mockSelectedItem);
      }
    }
  }

  navigateToResult(result) {
    if (!result.latitude || !result.longitude) {
      log.warn('Missing coordinates for navigation');
      return;
    }

    if (!window.mapView) {
      // Try to get view from application services
      const mapView = window.app?.services?.mapController?.view;

      if (!mapView) {
        log.error('No mapView available');
        return;
      }

      // Use the fallback view
      window.mapView = mapView;
    }

    // Clear any existing location indicators first
    this.clearLocationIndicator();

    const point = {
      type: "point",
      longitude: parseFloat(result.longitude),
      latitude: parseFloat(result.latitude)
    };

    // Set view instantly without animation
    window.mapView.center = [parseFloat(result.longitude), parseFloat(result.latitude)];
    window.mapView.zoom = Math.max(window.mapView.zoom, 16); // Ensure minimum zoom level 16

    // Show location indicator (ring) at the point
    this.showLocationIndicator(point, result);

    // Show popup immediately
    this.showLayerPopup(result, point);
  }

  showLocationIndicator(point, result) {
    if (!window.mapView) return;

    // Clean up any existing indicators
    this.clearLocationIndicator();

    // Create ring indicator with layer-consistent styling
    this.createRingIndicator(point, result);
  }

  createRingIndicator(point, result) {
    if (!window.mapView) return;

    import('@arcgis/core/Graphic').then(({ default: Graphic }) => {
      import('@arcgis/core/symbols/SimpleMarkerSymbol').then(({ default: SimpleMarkerSymbol }) => {
        const indicatorGraphics = [];

        // Determine subscriber type and layer visibility
        const isOnline = result.status === 'Online';
        const layerId = isOnline ? 'online-subscribers' : 'offline-subscribers';
        const layer = window.mapView.map.layers.find(l => l.id === layerId);
        const isLayerVisible = layer ? layer.visible : false;

        // Get layer-consistent colors and sizes
        let centerColor, centerSize, outlineWidth;
        if (isOnline) {
          centerColor = [34, 197, 94, 1]; // Green from online config
          centerSize = 6;
          outlineWidth = 1;
        } else {
          centerColor = [220, 38, 38, 1]; // Red from offline config  
          centerSize = 8;
          outlineWidth = 2;
        }

        // Create center dot using layer colors
        const centerDot = new Graphic({
          geometry: point,
          symbol: new SimpleMarkerSymbol({
            style: 'circle',
            color: centerColor,
            size: centerSize,
            outline: {
              color: [255, 255, 255, 1], // White outline for visibility
              width: outlineWidth
            }
          })
        });

        // If layer is not visible, create a temporary point that matches layer style
        let temporaryPoint = null;
        if (!isLayerVisible) {
          temporaryPoint = new Graphic({
            geometry: point,
            symbol: new SimpleMarkerSymbol({
              style: 'circle',
              color: isOnline ? [34, 197, 94, 0.8] : [220, 38, 38, 0.8], // Layer colors with alpha
              size: isOnline ? 6 : 8,
              outline: {
                color: centerColor,
                width: isOnline ? 1 : 2
              }
            })
          });
        }

        // Create unfilled ring around the point
        const ring = new Graphic({
          geometry: point,
          symbol: new SimpleMarkerSymbol({
            style: 'circle',
            color: [0, 0, 0, 0], // Transparent fill (unfilled)
            size: 45,
            outline: {
              color: [0, 150, 255, 1], // Blue ring
              width: 3
            }
          })
        });

        // Add graphics to map
        indicatorGraphics.push(ring);

        // Add temporary point if layer is not visible
        if (temporaryPoint) {
          indicatorGraphics.push(temporaryPoint);
        }

        indicatorGraphics.push(centerDot);

        indicatorGraphics.forEach(graphic => {
          window.mapView.graphics.add(graphic);
        });

        // Store reference for cleanup
        this.currentIndicatorGraphics = indicatorGraphics;

        // Auto cleanup after 10 seconds
        setTimeout(() => {
          this.clearLocationIndicator();
        }, 10000);
      });
    });
  }

  clearLocationIndicator() {
    if (this.currentIndicatorGraphics && window.mapView) {
      this.currentIndicatorGraphics.forEach(graphic => {
        window.mapView.graphics.remove(graphic);
      });
      this.currentIndicatorGraphics = null;
    }
  }

  async showLayerPopup(result, point) {
    if (!window.mapView) return;

    try {
      // Determine which layer this result belongs to based on status
      const layerId = result.status === 'Online' ? 'online-subscribers' : 'offline-subscribers';

      // Find the layer in the map
      const layer = window.mapView.map.layers.find(l => l.id === layerId);
      if (!layer) {
        log.warn('Layer not found:', layerId);
        this.fallbackPopup(result, point);
        return;
      }

      // Query the layer for features at this location
      const query = layer.createQuery();
      query.geometry = point;
      query.spatialRelationship = 'intersects';
      query.distance = 10; // 10 meter tolerance
      query.units = 'meters';
      query.returnGeometry = true;
      query.outFields = ['*'];

      const queryResult = await layer.queryFeatures(query);

      if (queryResult.features.length > 0) {
        // Use the first matching feature
        const feature = queryResult.features[0];

        // Open popup with the actual layer feature
        window.mapView.openPopup({
          features: [feature],
          location: point
        });
      } else {
        // Try querying by customer number if available
        if (result.customer_number) {
          await this.queryByCustomerNumber(layer, result, point);
        } else {
          this.fallbackPopup(result, point);
        }
      }

    } catch (error) {
      log.error('Layer feature error:', error);
      this.fallbackPopup(result, point);
    }
  }

  async queryByCustomerNumber(layer, result, point) {
    try {
      const query = layer.createQuery();
      query.where = `customer_number = '${result.customer_number}' OR customer_number = ${result.customer_number}`;
      query.returnGeometry = true;
      query.outFields = ['*'];

      const queryResult = await layer.queryFeatures(query);

      if (queryResult.features.length > 0) {
        const feature = queryResult.features[0];

        window.mapView.openPopup({
          features: [feature],
          location: feature.geometry || point
        });
      } else {
        this.fallbackPopup(result, point);
      }
    } catch (error) {
      log.error('Customer query failed:', error);
      this.fallbackPopup(result, point);
    }
  }

  fallbackPopup(result, point) {
    // Simple fallback popup
    window.mapView.openPopup({
      title: `Search Result: ${result.customer_name}`,
      content: `
        <div class="search-result-popup">
          <p><strong>Customer:</strong> ${result.customer_name || 'Unknown'}</p>
          <p><strong>Account:</strong> ${result.customer_number || 'N/A'}</p>
          <p><strong>Address:</strong> ${result.address || 'No address'}</p>
          <p><strong>City:</strong> ${result.city || 'N/A'}</p>
          <p><strong>Status:</strong> <span class="status-${result.status}">${result.status || 'Unknown'}</span></p>
          <p><strong>County:</strong> ${result.county || 'N/A'}</p>
          <p><em>Note: Using search result data (layer feature not found)</em></p>
        </div>
      `,
      location: point
    });
  }

  clearSearchResults(source = null, targetInput = null, clearState = true) {
    if (targetInput) {
      // Clear specific input
      const items = targetInput.querySelectorAll('calcite-autocomplete-item');
      items.forEach(item => item.remove());
    } else if (source === 'desktop' && this.desktopSearchInput) {
      // Clear desktop search
      const items = this.desktopSearchInput.querySelectorAll('calcite-autocomplete-item');
      items.forEach(item => item.remove());
    } else if (source === 'header' && this.searchInput) {
      // Clear header search
      const items = this.searchInput.querySelectorAll('calcite-autocomplete-item');
      items.forEach(item => item.remove());
    } else {
      // Clear all autocomplete inputs
      [this.searchInput, this.desktopSearchInput].forEach(input => {
        if (input) {
          const items = input.querySelectorAll('calcite-autocomplete-item');
          items.forEach(item => item.remove());
        }
      });
    }

    // Only clear internal state if requested
    if (clearState) {
      this.currentResults = [];
    }
  }

  showNoResults(searchTerm, targetInput) {
    const item = document.createElement('calcite-autocomplete-item');
    item.setAttribute('value', 'no-results');
    item.setAttribute('text-label', 'No results found');
    item.setAttribute('description', `No subscribers found for "${searchTerm || ''}"` || 'No subscribers found');
    item.innerHTML = `<calcite-icon slot="icon" icon="information"></calcite-icon>`;
    item.disabled = true;
    targetInput.appendChild(item);
  }

  showSearchError(targetInput) {
    const item = document.createElement('calcite-autocomplete-item');
    item.setAttribute('value', 'error');
    item.setAttribute('text-label', 'Search Error');
    item.setAttribute('description', 'Unable to perform search. Please try again.');
    item.innerHTML = `<calcite-icon slot="icon" icon="exclamation-mark-triangle"></calcite-icon>`;
    item.disabled = true;
    targetInput.appendChild(item);
  }

  setSearchLoading(loading, targetInput) {
    if (loading) {
      const item = document.createElement('calcite-autocomplete-item');
      item.setAttribute('value', 'loading');
      item.setAttribute('text-label', 'Searching...');
      item.setAttribute('description', 'Please wait while we search for subscribers');
      item.innerHTML = `<calcite-icon slot="icon" icon="spinner"></calcite-icon>`;
      item.disabled = true;
      item.id = 'search-loading-item';
      targetInput.appendChild(item);
    } else {
      const loadingItem = targetInput.querySelector('#search-loading-item');
      if (loadingItem) {
        loadingItem.remove();
      }
    }
  }

  handleMobileSearchInput(searchTerm) {
    // Clear previous timeout
    if (this.mobileSearchTimeout) {
      clearTimeout(this.mobileSearchTimeout);
    }

    // If search field is completely cleared, clear search results only (keep recent searches)
    if (!searchTerm || searchTerm.trim() === '') {
      this.clearMobileSearchResults();
      return;
    }

    // Clear results if search term is too short (but not empty)
    if (searchTerm.length < 4) {
      this.clearMobileSearchResults();
      return;
    }

    // Debounce search to avoid too many API calls
    this.mobileSearchTimeout = setTimeout(() => {
      this.performMobileSearch(searchTerm);
    }, 300);
  }

  async performMobileSearch(searchTerm) {
    try {
      // Perform the search
      const searchResult = await subscriberDataService.searchSubscribers(searchTerm, 8);

      // Update mobile search results
      this.updateMobileSearchResults(searchResult);

    } catch (error) {
      log.error('Mobile search failed:', error);
    }
  }

  updateMobileSearchResults(searchResult) {
    const resultsContainer = this.createMobileResultsContainer();
    if (!resultsContainer) return;

    // Clear existing results
    resultsContainer.innerHTML = '';

    if (searchResult.results.length === 0) {
      this.showMobileNoResults(resultsContainer, searchResult.searchTerm);
      return;
    }

    // Add search result items
    searchResult.results.forEach(result => {
      const listItem = document.createElement('calcite-list-item');
      listItem.setAttribute('label', result.customer_name || 'Unnamed Customer');

      // Create rich description for mobile list items too
      const statusColor = result.status === 'Online' ? 'success' : 'danger';

      listItem.setAttribute('description', this.formatEnhancedDescription(result));

      listItem.innerHTML = `
        <calcite-icon slot="content-start" icon="person" style="color: var(--calcite-color-status-${statusColor});"></calcite-icon>
        <calcite-action slot="actions-end" icon="arrowRight"></calcite-action>
      `;

      // Store result data and add click handler
      listItem._resultData = result;
      listItem.addEventListener('click', () => {
        this.handleMobileSearchSelection(result);
      });

      resultsContainer.appendChild(listItem);
    });

    // Show the search results block
    const resultsBlock = resultsContainer.closest('calcite-block');
    if (resultsBlock) {
      resultsBlock.hidden = false;
    }
  }

  handleMobileSearchSelection(result) {
    // Add to recent searches
    this.addToRecentSearches(result);

    // Clear the mobile search input
    if (this.mobileSearchInput) {
      this.mobileSearchInput.value = '';
    }

    // Clear mobile search results
    this.clearMobileSearchResults();

    // Close the mobile search dialog
    const mobileDialog = document.getElementById('mobile-search-sheet');
    if (mobileDialog) {
      mobileDialog.open = false;
    }

    // Close any open mobile panels
    if (window.app?.services?.mobileTabBar) {
      window.app.services.mobileTabBar.closeCurrentPanel();
    }

    // Navigate to result
    this.navigateToResult(result);
  }

  async handleMobileEnterKey(searchTerm) {
    // Check if we have results from previous search
    const resultsContainer = document.querySelector('#mobile-search-sheet .mobile-search-results-list');
    const firstResultItem = resultsContainer?.querySelector('calcite-list-item');

    if (firstResultItem && firstResultItem._resultData) {
      // Select the first available result
      this.handleMobileSearchSelection(firstResultItem._resultData);
      return;
    }

    // If no existing results, perform search and select first result
    if (searchTerm && searchTerm.length >= 4) {
      try {
        const searchResult = await subscriberDataService.searchSubscribers(searchTerm, 8);

        if (searchResult.results && searchResult.results.length > 0) {
          // Directly navigate to first result and add to recent searches
          const firstResult = searchResult.results[0];
          this.addToRecentSearches(firstResult);

          // Clear the mobile search input
          if (this.mobileSearchInput) {
            this.mobileSearchInput.value = '';
          }

          // Clear mobile search results
          this.clearMobileSearchResults();

          // Close the mobile search dialog
          const mobileDialog = document.getElementById('mobile-search-sheet');
          if (mobileDialog) {
            mobileDialog.open = false;
          }

          // Close any open mobile panels
          if (window.app?.services?.mobileTabBar) {
            window.app.services.mobileTabBar.closeCurrentPanel();
          }

          // Navigate to result
          this.navigateToResult(firstResult);
        } else {
          // Perform normal search to show "no results"
          this.performMobileSearch(searchTerm);
        }
      } catch (error) {
        log.error('Mobile search failed:', error);
        // Fallback to normal search
        this.performMobileSearch(searchTerm);
      }
    } else {
      // Search term too short, just perform normal search
      this.performMobileSearch(searchTerm);
    }
  }

  createMobileResultsContainer() {
    const searchSheet = document.getElementById('mobile-search-sheet');
    if (!searchSheet) return null;

    // Find or create results block
    let resultsBlock = searchSheet.querySelector('.mobile-search-results');
    if (!resultsBlock) {
      resultsBlock = document.createElement('calcite-block');
      resultsBlock.className = 'mobile-search-results';
      resultsBlock.setAttribute('heading', 'Search Results');
      resultsBlock.setAttribute('expanded', '');
      resultsBlock.hidden = true; // Hidden by default

      // Find the right place to insert it (after the Quick Search block, before Recent Searches)
      const content = searchSheet.querySelector('[slot="content"]');
      if (content) {
        const recentSearchesBlock = content.querySelector('calcite-block[heading="Recent Searches"]');
        if (recentSearchesBlock) {
          content.insertBefore(resultsBlock, recentSearchesBlock);
        } else {
          // Fallback: append to content
          content.appendChild(resultsBlock);
        }
      }
    }

    // Create or get the list (with a different class name to avoid conflicts)
    let resultsList = resultsBlock.querySelector('calcite-list');
    if (!resultsList) {
      resultsList = document.createElement('calcite-list');
      resultsList.className = 'mobile-search-results-list';
      resultsList.setAttribute('selection-mode', 'none');
      resultsBlock.appendChild(resultsList);
    }

    return resultsList;
  }

  showMobileNoResults(container, searchTerm) {
    const listItem = document.createElement('calcite-list-item');
    listItem.setAttribute('label', 'No results found');
    listItem.setAttribute('description', `No subscribers found for "${searchTerm}"`);
    listItem.innerHTML = `<calcite-icon slot="content-start" icon="information"></calcite-icon>`;
    container.appendChild(listItem);
  }

  clearMobileSearchResults() {
    // Clear search results (not recent searches)
    const resultsContainer = document.querySelector('#mobile-search-sheet .mobile-search-results-list');
    if (resultsContainer) {
      resultsContainer.innerHTML = '';
    }

    // Hide the search results block
    const resultsBlock = document.querySelector('#mobile-search-sheet .mobile-search-results');
    if (resultsBlock) {
      resultsBlock.hidden = true;
    }
  }

  clearEverything(source = null) {
    // Close popup if open
    if (window.mapView && window.mapView.popup) {
      window.mapView.popup.close();
    }

    // Clear location indicator (ring and temporary points)
    this.clearLocationIndicator();

    // Clear search results
    if (source === 'mobile') {
      this.clearMobileSearchResults();
      // Clear mobile search input
      if (this.mobileSearchInput) {
        this.mobileSearchInput.value = '';
      }
    } else {
      this.clearSearchResults(source);
      // Clear appropriate search input with enhanced clearing
      if (source === 'desktop' && this.desktopSearchInput) {
        this.desktopSearchInput.value = '';
        this.desktopSearchInput.inputValue = '';
        // Force calcite to update its internal state
        this.desktopSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (source === 'header' && this.searchInput) {
        this.searchInput.value = '';
        this.searchInput.inputValue = '';
        // Force calcite to update its internal state
        this.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Clear timeouts
    const timeoutKey = source === 'desktop' ? 'desktopSearchTimeout' :
      source === 'mobile' ? 'mobileSearchTimeout' : 'searchTimeout';
    if (this[timeoutKey]) {
      clearTimeout(this[timeoutKey]);
      this[timeoutKey] = null;
    }

    // Clear internal state
    this.currentResults = [];
  }

  // Cleanup method for proper resource management
  cleanup() {
    // Clear all timeouts
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    if (this.mobileSearchTimeout) {
      clearTimeout(this.mobileSearchTimeout);
      this.mobileSearchTimeout = null;
    }
    if (this.desktopSearchTimeout) {
      clearTimeout(this.desktopSearchTimeout);
      this.desktopSearchTimeout = null;
    }

    // Clear location indicators
    this.clearLocationIndicator();

    // Clear search results
    this.clearSearchResults();
    this.clearMobileSearchResults();

    // Clear recent searches array (but keep localStorage for persistence)
    this.recentSearches = [];
  }
}

// Application Orchestrator - Dependency Injection Pattern (DIP)
/**
 * Main Application class for FiberOMS Insight PWA
 * Follows SOLID principles and manages application lifecycle
 */
class Application {
  constructor() {
    this.services = {};
    this.onlineLayerLoaded = false; // Track if online layer has been loaded
    this._onlineLayerLoading = false; // Prevent concurrent loads
    this._onlineLayerLoadingPromise = null;
    this._cleanupHandlers = [];

    // Handle cleanup on page unload
    window.addEventListener('beforeunload', () => this.cleanup());

    this.init();
  }

  async init() {
    // Create services with dependency injection (DIP - Dependency Inversion Principle)
    this.services.themeManager = new ThemeManager();
    this.services.layerManager = new LayerManager(subscriberDataService);
    this.services.mapController = new MapController(this.services.layerManager, this.services.themeManager);
    this.services.popupManager = new PopupManager();
    this.services.layerPanel = new LayerPanel();
    this.services.mobileTabBar = new MobileTabBar();
    this.services.dashboard = new DashboardManager();
    this.services.headerSearch = new HeaderSearch();
    this.services.rainViewerService = new RainViewerService();

    // Store polling manager reference
    this.pollingManager = pollingManager;

    // Initialize truck tracking state
    this.activeTruckLayers = new Set();
    this.geotabFeed = null;
    this.geotabReady = false;

    // Store theme manager globally for component access
    window.themeManager = this.services.themeManager;

    // Initialize all services
    await this.services.dashboard.init();
    await this.services.headerSearch.init();
    await this.services.mobileTabBar.init();

    // Initialize map controller
    await this.services.mapController.initialize();

    // Initialize RainViewer service
    const rainViewerInitialized = await this.services.rainViewerService.initialize();
    if (rainViewerInitialized) {
      log.info('✅ RainViewer service initialized');
    }

    // Set up map ready handler
    this.services.mapController.mapElement.addEventListener('arcgisViewReadyChange', async (event) => {
      if (event.target.ready) {
        await this.onMapReady();
      }
    });

    // Check if map is already ready
    if (this.services.mapController.mapElement.ready) {
      await this.onMapReady();
    }

    // Store app instance globally for cross-component access
    window.app = this;
  }

  async onMapReady() {
    // Clear any previous loading state
    loadingIndicator.clearConsolidated();

    // Show initial map loading indicator
    loadingIndicator.showLoading('map-init', 'Map');

    // Initialize subscriber layers first
    await this.initializeSubscriberLayers();

    // Initialize infrastructure layers
    await this.initializeInfrastructureLayers();

    // Initialize radar layer
    await this.initializeRadarLayer();

    // Update dashboard after layers are loaded
    await this.services.dashboard.updateDashboard();

    // Map initialization complete
    loadingIndicator.showNetwork('map-init', 'Map');

    // Set up layer toggle handlers after a small delay to ensure UI is fully initialized
    // This prevents any initial checkbox state changes from triggering layer loads
    setTimeout(() => {
      this.setupLayerToggleHandlers();
    }, 500);

    // Initialize popup action handlers after layers are ready
    if (this.services.mapController.view) {
      this.services.popupManager.initialize(this.services.mapController.view);
    }

    // Final refresh to ensure all layers render properly after initialization
    setTimeout(() => {
      if (this.services.mapController.view) {
        // Force a complete view refresh to ensure all layers are properly rendered
        // Only GeoJSONLayer has a refresh method, not GraphicsLayer or WebTileLayer
        this.services.mapController.view.map.layers.forEach(layer => {
          if (layer.visible && typeof layer.refresh === 'function') {
            try {
              layer.refresh();
            } catch (error) {
              log.warn(`Failed to refresh layer ${layer.id}:`, error);
            }
          }
        });
        log.info('🎯 Final map refresh completed for all visible layers');
      }
    }, 1500);

    // Start polling for subscriber data updates
    this.startSubscriberPolling();

    // Start polling for power outage updates (1 minute interval)
    this.startPowerOutagePolling();

    // Initialize GeotabService but don't start polling yet (only when truck layers are enabled)
    this.initializeGeotabService();
  }

  async initializeSubscriberLayers() {
    try {
      // Show loading indicator for offline subscriber data only
      loadingIndicator.showLoading('offline-subscribers', 'Offline Subscribers');

      // Create offline subscribers layer (visible by default - Phase 1 focus)
      const offlineConfig = getLayerConfig('offlineSubscribers');
      if (offlineConfig) {
        const result = await this.createLayerFromConfig(offlineConfig);
        if (result && result.layer) {
          this.services.mapController.addLayer(result.layer, offlineConfig.zOrder);
          // Subscriber data is always real-time from network
          loadingIndicator.showNetwork('offline-subscribers', 'Offline Subscribers');
        } else {
          // Layer creation failed
          loadingIndicator.showError('offline-subscribers', 'Offline Subscribers', 'Failed to create layer');
        }
      }

      // Online subscribers will be loaded on-demand when toggled on
      // This saves ~2.7MB on initial load
      log.info('📊 Online subscribers configured for on-demand loading (saves ~2.7MB)');

      // Create power outage layers
      await this.initializePowerOutageLayers();

    } catch (error) {
      log.error('Failed to initialize subscriber layers:', error);
      loadingIndicator.showError('offline-subscribers', 'Offline Subscribers', 'Failed to load');
      loadingIndicator.showError('online-subscribers', 'Online Subscribers', 'Failed to load');
    }
  }

  async initializePowerOutageLayers() {
    try {
      // Show loading indicators for power outages
      loadingIndicator.showLoading('apco-outages', 'APCo Power Outages');
      loadingIndicator.showLoading('tombigbee-outages', 'Tombigbee Power Outages');

      // Create APCo power outages layer
      const apcoConfig = getLayerConfig('apcoOutages');
      if (apcoConfig) {
        const result = await this.createLayerFromConfig(apcoConfig);
        if (result && result.success) {
          if (result.layer) {
            // Layer created successfully with data
            result.layer.visible = apcoConfig.visible; // Use config default (true)
            this.services.mapController.addLayer(result.layer, apcoConfig.zOrder);
            loadingIndicator.showNetwork('apco-outages', 'APCo Power Outages');
            log.info('✅ APCo power outages layer initialized');
          } else if (result.isEmpty) {
            // Successful completion with no data - no layer created
            loadingIndicator.showEmpty('apco-outages', 'APCo Power Outages');
            log.info('📭 APCo power outages initialized (no outages available)');
          }
        } else {
          // Actual failure (network error, etc.)
          loadingIndicator.showError('apco-outages', 'APCo Power Outages', 'Failed to load data');
        }
      }

      // Create Tombigbee power outages layer
      const tombigbeeConfig = getLayerConfig('tombigbeeOutages');
      if (tombigbeeConfig) {
        const result = await this.createLayerFromConfig(tombigbeeConfig);
        if (result && result.success) {
          if (result.layer) {
            // Layer created successfully with data
            result.layer.visible = tombigbeeConfig.visible; // Use config default (true)
            this.services.mapController.addLayer(result.layer, tombigbeeConfig.zOrder);
            loadingIndicator.showNetwork('tombigbee-outages', 'Tombigbee Power Outages');
            log.info('✅ Tombigbee power outages layer initialized');
          } else if (result.isEmpty) {
            // Successful completion with no data - no layer created
            loadingIndicator.showEmpty('tombigbee-outages', 'Tombigbee Power Outages');
            log.info('📭 Tombigbee power outages initialized (no outages available)');
          }
        } else {
          // Actual failure (network error, etc.)
          loadingIndicator.showError('tombigbee-outages', 'Tombigbee Power Outages', 'Failed to load data');
        }
      }

    } catch (error) {
      log.error('Failed to initialize power outage layers:', error);
      loadingIndicator.showError('apco-outages', 'APCo Power Outages', 'Failed to load');
      loadingIndicator.showError('tombigbee-outages', 'Tombigbee Power Outages', 'Failed to load');
      // Continue without power outage layers if they fail to load
    }
  }

  async initializeInfrastructureLayers() {
    try {
      // Create Node Sites layer
      const nodeSitesConfig = getLayerConfig('nodeSites');
      if (nodeSitesConfig) {
        loadingIndicator.showLoading('node-sites', 'Node Sites');
        const result = await this.createLayerFromConfig(nodeSitesConfig);
        if (result && result.layer) {
          result.layer.visible = nodeSitesConfig.visible; // Use config default (false)
          this.services.mapController.addLayer(result.layer, nodeSitesConfig.zOrder);

          // Show loading status based on cache
          if (result.fromCache) {
            loadingIndicator.showCached('node-sites', 'Node Sites');
          } else {
            loadingIndicator.showNetwork('node-sites', 'Node Sites');
          }

          if (result.isEmpty) {
            log.info('✅ Node Sites layer initialized (no data)');
          } else {
            log.info('✅ Node Sites layer initialized');
          }
        } else {
          // Layer creation failed
          loadingIndicator.showError('node-sites', 'Node Sites', 'Failed to create layer');
        }
      }

      // Initialize fiber plant layers
      await this.initializeFiberPlantLayers();

      // Initialize vehicle tracking layers
      await this.initializeVehicleLayers();

    } catch (error) {
      log.error('Failed to initialize infrastructure layers:', error);
      // Continue without infrastructure layers if they fail to load
    }
  }

  async initializeFiberPlantLayers() {
    try {
      log.info('🔌 Initializing fiber plant layers...');

      // List of fiber plant layer configs to initialize
      const fiberPlantLayers = [
        { key: 'fsaBoundaries', name: 'FSA Boundaries' },
        { key: 'mainLineFiber', name: 'Main Line Fiber' },
        { key: 'mainLineOld', name: 'Main Line Old' },
        { key: 'mstTerminals', name: 'MST Terminals' },
        { key: 'mstFiber', name: 'MST Fiber' },
        { key: 'splitters', name: 'Splitters' },
        { key: 'closures', name: 'Closures' }
      ];

      // Show loading indicators for all OSP layers
      for (const layerInfo of fiberPlantLayers) {
        loadingIndicator.showLoading(`osp-${layerInfo.key}`, layerInfo.name);
      }

      for (const layerInfo of fiberPlantLayers) {
        const layerConfig = getLayerConfig(layerInfo.key);
        if (layerConfig) {
          try {
            const result = await this.createLayerFromConfig(layerConfig);
            if (result && result.layer) {
              result.layer.visible = layerConfig.visible; // Use config default (false)
              this.services.mapController.addLayer(result.layer, layerConfig.zOrder);

              // Use the actual cache status from the data fetch
              if (result.fromCache) {
                loadingIndicator.showCached(`osp-${layerInfo.key}`, layerInfo.name);
              } else {
                loadingIndicator.showNetwork(`osp-${layerInfo.key}`, layerInfo.name);
              }

              if (result.isEmpty) {
                log.info(`✅ ${layerConfig.title} layer initialized (no data)`);
              } else {
                log.info(`✅ ${layerConfig.title} layer initialized`);
              }
            } else {
              // Layer creation failed
              loadingIndicator.showError(`osp-${layerInfo.key}`, layerInfo.name, 'Failed to create layer');
            }
          } catch (error) {
            log.error(`Failed to initialize ${layerInfo.name}:`, error);
            loadingIndicator.showError(`osp-${layerInfo.key}`, layerInfo.name, 'Failed to load');
          }
        }
      }

      log.info('🔌 Fiber plant layers initialization complete');
    } catch (error) {
      log.error('Failed to initialize fiber plant layers:', error);
      // Continue without fiber plant layers if they fail to load
    }
  }

  async initializeVehicleLayers() {
    try {
      log.info('🚛 Initializing vehicle tracking layers...');

      // List of vehicle layer configs to initialize
      const vehicleLayers = [
        { key: 'fiberTrucks', name: 'Fiber Trucks' },
        { key: 'electricTrucks', name: 'Electric Trucks' }
      ];

      // No loading indicators for vehicle layers - they update silently in background

      for (const layerInfo of vehicleLayers) {
        const layerConfig = getLayerConfig(layerInfo.key);
        if (layerConfig) {
          try {
            const result = await this.createLayerFromConfig(layerConfig);
            if (result && result.layer) {
              result.layer.visible = layerConfig.visible; // Use config default (false)
              this.services.mapController.addLayer(result.layer, layerConfig.zOrder);

              // Vehicle layers update silently - no connection status indicators

              log.info(`✅ ${layerConfig.title} layer initialized`);
            }
          } catch (error) {
            log.error(`Failed to initialize ${layerInfo.name}:`, error);
            // Vehicle layers fail silently - no error indicators in UI
          }
        }
      }

      log.info('🚛 Vehicle tracking layers initialization complete');
    } catch (error) {
      log.error('Failed to initialize vehicle tracking layers:', error);
      // Continue without vehicle layers if they fail to load
    }
  }

  async initializeRadarLayer() {
    try {
      // Create radar layer if RainViewer service is available
      if (this.services.rainViewerService) {
        const radarLayer = this.services.rainViewerService.createRadarLayer();
        if (radarLayer) {
          // Create layer configuration for LayerManager
          const radarConfig = {
            id: 'rainviewer-radar',
            title: 'Weather Radar',
            layerType: 'WebTileLayer',
            layerInstance: radarLayer,
            visible: false,
            zOrder: -10,  // Place at bottom (below all basemap layers)
            onVisibilityChange: (visible) => {
              this.services.rainViewerService.toggleVisibility(visible);
            },
            onCleanup: () => {
              this.services.rainViewerService.cleanup();
            }
          };

          // Add to LayerManager
          const managedLayer = await this.services.layerManager.createLayer(radarConfig);
          if (managedLayer) {
            // Add to map with high z-order
            this.services.mapController.addLayer(managedLayer, radarConfig.zOrder);
            log.info('✅ RainViewer radar layer created and added to map');
          }
        }
      }
    } catch (error) {
      log.error('❌ Failed to initialize radar layer:', error);
    }
  }

  /**
   * Creates a map layer from configuration using the specified data service method
   * @param {Object} config - Layer configuration object
   * @param {string} config.id - Unique layer identifier
   * @param {Function} config.dataServiceMethod - Method to fetch layer data
   * @returns {Promise<Object|null>} Layer creation result with status flags or null on error
   */
  async createLayerFromConfig(config) {
    try {
      const data = await config.dataServiceMethod();
      // Handle empty data as successful completion, not failure

      if (!data || (data.features && data.features.length === 0)) {
        log.info(`📭 No data available for layer: ${config.id} (empty dataset - no layer created)`);

        // Don't create a layer for empty datasets - return success with no layer
        return {
          layer: null,
          fromCache: data?.fromCache || false,
          isEmpty: true,
          success: true // Flag to indicate this was successful (not a failure)
        };
      }

      // For power outages and subscribers, data comes wrapped with features property
      const dataSource = data.features ? { features: data.features } : data;
      const layer = await this.services.layerManager.createLayer({
        ...config,
        dataSource: dataSource
      });

      // Return both layer and cache status
      return {
        layer: layer,
        fromCache: data.fromCache || false,
        isEmpty: false,
        success: true
      };
    } catch (error) {
      log.error(`Failed to create layer ${config.id}:`, error);
      return null;
    }
  }

  /**
   * Loads online subscribers layer on demand to save bandwidth
   * @returns {Promise<boolean>} True if layer loaded successfully
   * @throws {Error} If layer configuration is missing
   */
  async loadOnlineSubscribersLayer() {
    // Check if already loaded via LayerManager
    if (this.services.layerManager.getLayer('online-subscribers')) {
      log.info('📊 Online subscribers layer already loaded');
      return true;
    }

    // Prevent concurrent loads
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

  /**
   * Internal method to perform the actual layer loading
   * @private
   * @returns {Promise<boolean>} Success status
   */
  async _performOnlineLayerLoad() {
    try {
      loadingIndicator.showLoading('online-subscribers', 'Online Subscribers');

      const onlineConfig = getLayerConfig('onlineSubscribers');
      if (!onlineConfig) {
        throw new Error('Online subscribers layer configuration not found');
      }

      const result = await this.createLayerFromConfig(onlineConfig);
      if (result && result.layer) {
        result.layer.visible = true; // Make visible since user toggled it on
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
    // Desktop layer toggles (checkboxes) - layers, osp, vehicles, network-parent, and tools panels
    const checkboxes = document.querySelectorAll('#layers-content calcite-checkbox, #osp-content calcite-checkbox, #vehicles-content calcite-checkbox, #network-parent-content calcite-checkbox, #tools-content calcite-checkbox');

    // Log initial checkbox states for debugging
    checkboxes.forEach(checkbox => {
      const label = checkbox.closest('calcite-label');
      if (label && label.textContent.trim() === 'Online Subscribers') {
        log.info(`📊 Online Subscribers checkbox initial state: ${checkbox.checked}`);
      }
    });

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('calciteCheckboxChange', (e) => {
        this.handleLayerToggle(e.target, e.target.checked);
      });
    });

    // Power outage toggles are now handled inside the PowerOutageStats component
    // Listen for custom events from the power outage component
    document.addEventListener('powerOutageToggle', async (e) => {
      const { layerId, visible } = e.detail;
      if (layerId && this.services.layerManager) {
        await this.services.layerManager.toggleLayerVisibility(layerId, visible);
        log.info(`⚡ Power outage layer toggled: ${layerId} = ${visible}`);
      }
    })

    // Mobile layer toggles (switches)
    const switches = document.querySelectorAll('.layer-toggle-item calcite-switch');
    switches.forEach(switchElement => {
      switchElement.addEventListener('calciteSwitchChange', (e) => {
        this.handleLayerToggle(e.target, e.target.checked);
      });
    });

    // Mobile list item tap to toggle (touch-friendly)
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

    // Mobile radar toggle button
    const mobileRadarToggle = document.getElementById('mobile-radar-toggle');
    if (mobileRadarToggle) {
      mobileRadarToggle.addEventListener('click', () => {
        this.toggleMobileRadar();
      });
    }
  }

  async handleLayerToggle(element, checked) {
    // Validate inputs
    if (!element || typeof checked !== 'boolean') {
      log.warn('Invalid layer toggle parameters');
      return;
    }

    // Map UI labels to layer IDs
    const layerId = this.getLayerIdFromElement(element);

    // Validate layer ID
    const VALID_LAYER_IDS = new Set([
      'offline-subscribers', 'online-subscribers', 'node-sites',
      'rainviewer-radar', 'apco-outages', 'tombigbee-outages',
      'fsa-boundaries', 'main-line-fiber', 'main-line-old',
      'mst-terminals', 'mst-fiber', 'splitters', 'closures',
      'fiber-trucks', 'electric-trucks'
    ]);

    if (!layerId || !VALID_LAYER_IDS.has(layerId)) {
      log.warn(`Invalid or unsupported layer ID: ${layerId}`);
      return;
    }

    if (layerId) {
      // Special handling for online-subscribers layer - load on demand
      if (layerId === 'online-subscribers' && checked && !this.onlineLayerLoaded) {
        const loaded = await this.loadOnlineSubscribersLayer();
        if (!loaded) {
          // If loading failed, uncheck the toggle
          element.checked = false;
          return;
        }
      } else {
        // Normal layer toggle
        await this.services.layerManager.toggleLayerVisibility(layerId, checked);
      }

      this.syncToggleStates(layerId, checked);

      // Handle truck layer state management
      const layerDisplayName = this.getLayerDisplayName(layerId);
      if (layerDisplayName) {
        await this.manageTruckLayerState(layerDisplayName, checked);
      }
    }
  }

  getLayerIdFromElement(element) {
    // Check for power outage switches with specific classes
    if (element.classList.contains('apco-toggle')) {
      return 'apco-outages';
    }
    if (element.classList.contains('tombigbee-toggle')) {
      return 'tombigbee-outages';
    }

    const listItem = element.closest('calcite-list-item');
    const label = element.closest('calcite-label');

    let labelText = '';
    if (listItem) {
      labelText = listItem.getAttribute('label');
    } else if (label) {
      labelText = label.textContent.trim();
    }

    // Map UI labels to layer IDs
    const mapping = {
      'Online Subscribers': 'online-subscribers',
      'Offline Subscribers': 'offline-subscribers',
      'Node Sites': 'node-sites',
      'Weather Radar': 'rainviewer-radar',
      'APCo Power Outages': 'apco-outages',
      'Tombigbee Power Outages': 'tombigbee-outages',
      // Fiber Plant layers
      'FSA Boundaries': 'fsa-boundaries',
      'Main Line Fiber': 'main-line-fiber',
      'Main Line Old': 'main-line-old',
      'MST Terminals': 'mst-terminals',
      'MST Fiber': 'mst-fiber',
      'Splitters': 'splitters',
      'Closures': 'closures',
      // Vehicle tracking layers
      'Electric Trucks': 'electric-trucks',
      'Fiber Trucks': 'fiber-trucks'
    };

    return mapping[labelText] || null;
  }

  getLayerDisplayName(layerId) {
    // Map layer IDs back to display names for truck layer management
    const reverseMapping = {
      'fiber-trucks': 'Fiber Trucks',
      'electric-trucks': 'Electric Trucks'
    };

    return reverseMapping[layerId] || null;
  }

  syncToggleStates(layerId, checked) {
    // Sync between desktop and mobile UI elements
    const labelMapping = {
      'offline-subscribers': 'Offline Subscribers',
      'online-subscribers': 'Online Subscribers',
      'node-sites': 'Node Sites',
      'rainviewer-radar': 'Weather Radar',
      'apco-outages': 'APCo Power Outages',
      'tombigbee-outages': 'Tombigbee Power Outages',
      // Fiber Plant layers
      'fsa-boundaries': 'FSA Boundaries',
      'main-line-fiber': 'Main Line Fiber',
      'main-line-old': 'Main Line Old',
      'mst-terminals': 'MST Terminals',
      'mst-fiber': 'MST Fiber',
      'splitters': 'Splitters',
      'closures': 'Closures',
      // Vehicle tracking layers
      'electric-trucks': 'Electric Trucks',
      'fiber-trucks': 'Fiber Trucks'
    };

    // Sync power outage switches based on layer ID and classes
    if (layerId === 'apco-outages') {
      const apcoSwitches = document.querySelectorAll('.apco-toggle, #toggle-apco-outages');
      apcoSwitches.forEach(switchElement => {
        switchElement.checked = checked;
      });
    } else if (layerId === 'tombigbee-outages') {
      const tombigbeeSwitches = document.querySelectorAll('.tombigbee-toggle, #toggle-tombigbee-outages');
      tombigbeeSwitches.forEach(switchElement => {
        switchElement.checked = checked;
      });
    }

    const labelText = labelMapping[layerId];
    if (!labelText) return;

    // Sync desktop checkboxes (layers, osp, vehicles, network-parent, and tools panels)
    const desktopCheckboxes = document.querySelectorAll('#layers-content calcite-checkbox, #osp-content calcite-checkbox, #vehicles-content calcite-checkbox, #network-parent-content calcite-checkbox, #tools-content calcite-checkbox');
    desktopCheckboxes.forEach(checkbox => {
      const label = checkbox.closest('calcite-label');
      if (label && label.textContent.trim() === labelText) {
        checkbox.checked = checked;
      }
    });

    // Sync mobile switches
    const mobileSwitches = document.querySelectorAll('.layer-toggle-item calcite-switch');
    mobileSwitches.forEach(switchElement => {
      const listItem = switchElement.closest('calcite-list-item');
      if (listItem && listItem.getAttribute('label') === labelText) {
        switchElement.checked = checked;
      }
    });
  }

  toggleMobileRadar() {
    // Find the radar layer and toggle its visibility
    const radarLayer = this.services.layerManager.getLayer('rainviewer-radar');
    if (radarLayer) {
      const newVisibility = !radarLayer.visible;

      // Toggle the layer
      this.services.layerManager.toggleLayerVisibility('rainviewer-radar', newVisibility);

      // Sync toggle states across all UI elements
      this.syncToggleStates('rainviewer-radar', newVisibility);

      // Update mobile button appearance
      const mobileButton = document.getElementById('mobile-radar-toggle');
      if (mobileButton) {
        mobileButton.appearance = newVisibility ? 'solid' : 'outline';
        mobileButton.setAttribute('appearance', newVisibility ? 'solid' : 'outline');
      }

      // Close current mobile panel after action
      if (this.services.mobileTabBar) {
        this.services.mobileTabBar.closeCurrentPanel();
      }

      log.info(`🌧️ Mobile radar toggled: ${newVisibility}`);
    }
  }

  // Start polling for subscriber data updates
  /**
   * Starts polling for subscriber data updates
   * Implements intelligent polling that only fetches data for loaded layers
   */
  startSubscriberPolling() {
    log.info('🔄 Starting subscriber data polling');

    // Store previous counts for comparison
    let previousOfflineCount = null;
    let previousOnlineCount = null;

    // Polling callback for subscriber updates
    const handleSubscriberUpdate = async (data) => {
      try {
        if (data.offline || data.online) {
          // Show loading indicators for updates
          if (!window._isManualRefresh) {
            loadingIndicator.showLoading('offline-subscribers-update', 'Offline Subscribers');
            // Only show online loading indicator if layer is actually loaded
            if (this.onlineLayerLoaded) {
              loadingIndicator.showLoading('online-subscribers-update', 'Online Subscribers');
            }
          }

          // Get current counts
          const currentOfflineCount = data.offline?.count || 0;
          const currentOnlineCount = data.online?.count || 0;

          // Handle both offline and online updates
          const offlineLayer = this.services.layerManager.getLayer('offline-subscribers');
          const onlineLayer = this.services.layerManager.getLayer('online-subscribers');

          if (offlineLayer && data.offline) {
            await this.services.layerManager.updateLayerData('offline-subscribers', data.offline);
            log.info(`📊 Updated offline subscribers: ${data.offline.count} records`);
            if (!window._isManualRefresh) {
              loadingIndicator.showNetwork('offline-subscribers-update', 'Offline Subscribers');
            }
          }

          // Only update online layer if it's actually loaded
          if (onlineLayer && data.online && this.onlineLayerLoaded) {
            await this.services.layerManager.updateLayerData('online-subscribers', data.online);
            log.info(`📊 Updated online subscribers: ${data.online.count} records`);
            if (!window._isManualRefresh) {
              loadingIndicator.showNetwork('online-subscribers-update', 'Online Subscribers');
            }
          }

          // Update dashboard counts
          await this.services.dashboard.updateDashboard();

          // Show toast if counts have changed (and not first load or manual refresh)
          if (previousOfflineCount !== null && previousOnlineCount !== null && !window._isManualRefresh) {
            const offlineChange = currentOfflineCount - previousOfflineCount;
            const onlineChange = currentOnlineCount - previousOnlineCount;

            if (offlineChange !== 0 || onlineChange !== 0) {
              this.showSubscriberUpdateToast(previousOfflineCount, currentOfflineCount, previousOnlineCount, currentOnlineCount);
            }
          }

          // Update stored counts
          previousOfflineCount = currentOfflineCount;
          previousOnlineCount = currentOnlineCount;
        }
      } catch (error) {
        log.error('Failed to handle subscriber update:', error);
        if (!window._isManualRefresh) {
          loadingIndicator.showError('offline-subscribers-update', 'Offline Subscribers', 'Update failed');
          loadingIndicator.showError('online-subscribers-update', 'Online Subscribers', 'Update failed');
        }
      }
    };

    // Start polling for all subscribers (offline and online)
    // Default interval is 5 minutes (300000ms)
    this.pollingManager.startPolling('subscribers', handleSubscriberUpdate);

    // Also set up manual refresh button if it exists
    const refreshButton = document.getElementById('refresh-data');
    if (refreshButton) {
      refreshButton.addEventListener('click', async () => {
        log.info('🔄 Manual data refresh triggered');
        refreshButton.setAttribute('loading', '');

        try {
          // Set global flag to skip notifications during manual refresh
          window._isManualRefresh = true;

          // Clear cache and perform immediate update
          subscriberDataService.clearCache();
          await this.pollingManager.performUpdate('subscribers');
        } finally {
          refreshButton.removeAttribute('loading');
          // Clear manual refresh flag
          window._isManualRefresh = false;
        }
      });
    }

    // Test button for subscriber updates in development
    const testSubscriberButton = document.getElementById('test-subscriber-update');
    if (testSubscriberButton && isDevelopment) {
      // Show test button in development
      testSubscriberButton.style.display = 'block';

      testSubscriberButton.addEventListener('click', () => {
        console.log('🧪 Testing subscriber update toast');

        // Simulate subscriber count changes
        const prevOffline = Math.floor(Math.random() * 300) + 200; // 200-500
        const currOffline = prevOffline + Math.floor(Math.random() * 20) - 10; // -10 to +10 change
        const prevOnline = Math.floor(Math.random() * 20000) + 20000; // 20000-40000
        const currOnline = prevOnline - (currOffline - prevOffline); // Inverse relationship

        console.log('Test values:', { prevOffline, currOffline, prevOnline, currOnline });

        // Call the method on the app instance
        if (window.app) {
          console.log('Calling showSubscriberUpdateToast on app instance');
          window.app.showSubscriberUpdateToast(
            prevOffline,
            Math.max(0, currOffline),
            prevOnline,
            Math.max(0, currOnline)
          );
        } else {
          console.error('window.app not available');
        }
      });
    }
  }

  // Start polling for power outage updates
  startPowerOutagePolling() {
    log.info('⚡ Starting power outage data polling (1 minute interval)');

    // Polling callback for power outage updates
    const handlePowerOutageUpdate = async (data) => {
      try {
        if (data.apco && data.tombigbee) {
          // Show loading indicators for updates
          if (!window._isManualRefresh) {
            loadingIndicator.showLoading('apco-outages-update', 'APCo Power Outages');
            loadingIndicator.showLoading('tombigbee-outages-update', 'Tombigbee Power Outages');
          }

          // Handle both APCo and Tombigbee updates
          const apcoLayer = this.services.layerManager.getLayer('apco-outages');
          const tombigbeeLayer = this.services.layerManager.getLayer('tombigbee-outages');

          // Update APCo outages
          if (apcoLayer && data.apco) {
            // Pass GeoJSON format to updateLayerData (handle empty features)
            const apcoGeoJSON = {
              type: 'FeatureCollection',
              features: data.apco.features || []
            };
            await this.services.layerManager.updateLayerData('apco-outages', apcoGeoJSON);
            log.info(`⚡ Updated APCo outages: ${data.apco.count || 0} outages`);
          }
          // Always clear APCo loading indicator if data was received
          if (data.apco && !window._isManualRefresh) {
            loadingIndicator.showNetwork('apco-outages-update', 'APCo Power Outages');
          }

          // Update Tombigbee outages  
          if (tombigbeeLayer && data.tombigbee) {
            // Pass GeoJSON format to updateLayerData (handle empty features)
            const tombigbeeGeoJSON = {
              type: 'FeatureCollection',
              features: data.tombigbee.features || []
            };
            await this.services.layerManager.updateLayerData('tombigbee-outages', tombigbeeGeoJSON);
            log.info(`⚡ Updated Tombigbee outages: ${data.tombigbee.count || 0} outages`);
          }
          // Always clear Tombigbee loading indicator if data was received
          if (data.tombigbee && !window._isManualRefresh) {
            loadingIndicator.showNetwork('tombigbee-outages-update', 'Tombigbee Power Outages');
          }

          // Update power outage stats component if it exists
          const powerStats = document.querySelector('power-outage-stats');
          if (powerStats && typeof powerStats.updateStats === 'function') {
            // Skip notifications if it's a manual refresh
            powerStats.updateStats(window._isManualRefresh === true);
          }
        }
      } catch (error) {
        log.error('Failed to handle power outage update:', error);
        if (!window._isManualRefresh) {
          loadingIndicator.showError('apco-outages-update', 'APCo Power Outages', 'Update failed');
          loadingIndicator.showError('tombigbee-outages-update', 'Tombigbee Power Outages', 'Update failed');
        }
      }
    };

    // Start polling for power outages with 1 minute interval (60000ms)
    this.pollingManager.startPolling('power-outages', handlePowerOutageUpdate, 60000);

    // Also set up manual refresh button for power outages if it exists
    const refreshPowerButton = document.getElementById('refresh-power-outages');
    if (refreshPowerButton) {
      refreshPowerButton.addEventListener('click', async () => {
        log.info('⚡ Manual power outage refresh triggered');
        refreshPowerButton.setAttribute('loading', '');

        try {
          // Set global flag to skip notifications during manual refresh
          window._isManualRefresh = true;

          // Clear cache for power outage data
          subscriberDataService.refreshData('outages');

          // Update power outage stats without notification
          const powerStats = document.querySelector('power-outage-stats');
          if (powerStats && typeof powerStats.updateStats === 'function') {
            await powerStats.updateStats(true); // Skip notification
          }

          await this.pollingManager.performUpdate('power-outages');
        } finally {
          refreshPowerButton.removeAttribute('loading');
          // Clear manual refresh flag
          window._isManualRefresh = false;
        }
      });
    }

    // Test button for development mode
    const testButton = document.getElementById('test-outage-update');
    if (testButton && isDevelopment) {
      // Show test button in development
      testButton.style.display = 'block';

      testButton.addEventListener('click', () => {
        log.info('🧪 Testing outage update toast');

        // Get the PowerOutageStats component
        const powerOutageStats = document.querySelector('power-outage-stats');
        if (powerOutageStats) {
          // Simulate an update with random changes
          const prevApco = Math.floor(Math.random() * 10);
          const currApco = prevApco + Math.floor(Math.random() * 5) - 2; // -2 to +2 change
          const prevTombigbee = Math.floor(Math.random() * 10);
          const currTombigbee = prevTombigbee + Math.floor(Math.random() * 5) - 2; // -2 to +2 change

          powerOutageStats.showUpdateToast(prevApco, Math.max(0, currApco), prevTombigbee, Math.max(0, currTombigbee));
        }
      });
    }
  }

  // Initialize GeotabService (but don't start polling yet)
  async initializeGeotabService() {
    try {
      log.info('🚛 Initializing GeotabService...');
      await geotabService.initialize();
      this.geotabReady = true;
      log.info('✅ GeotabService ready');
    } catch (error) {
      log.error('❌ Failed to initialize GeotabService:', error);
      this.geotabReady = false;
    }
  }

  // Smart truck layer state management
  async manageTruckLayerState(layerName, isEnabled) {
    const isTruckLayer = ['Electric Trucks', 'Fiber Trucks'].includes(layerName);
    if (!isTruckLayer) {
      return;
    }

    // Update active truck layers set
    if (isEnabled) {
      this.activeTruckLayers.add(layerName);

      // Start feed if this is the first truck layer
      if (this.activeTruckLayers.size === 1) {
        await this.startGeotabFeed();
      }
    } else {
      this.activeTruckLayers.delete(layerName);

      // Stop feed if no truck layers are active
      if (this.activeTruckLayers.size === 0) {
        this.stopGeotabFeed();
      }
    }
  }

  // Start GeotabFeed only when needed
  async startGeotabFeed() {
    if (!this.geotabReady || this.geotabFeed) {
      return; // Either not ready or already running
    }

    try {
      log.info('🚛 Starting GeotabFeed for active truck layers');

      // Set up real-time data feed for truck updates
      this.geotabFeed = await geotabService.setupRealtimeDataFeed((feedData) => {
        this.handleGeotabFeedUpdate(feedData);
      });

      log.info('✅ GeotabFeed started');
    } catch (error) {
      log.error('❌ Failed to start GeotabFeed:', error);
    }
  }

  // Stop GeotabFeed when no truck layers are active
  stopGeotabFeed() {
    if (this.geotabFeed && typeof this.geotabFeed.stop === 'function') {
      this.geotabFeed.stop();
      this.geotabFeed = null;
      log.info('🛑 GeotabFeed stopped');
    }
  }

  // Handle feed updates by refreshing visible truck layers
  handleGeotabFeedUpdate(feedData) {
    try {
      // Count total updates
      let totalUpdates = 0;
      feedData.forEach(feed => {
        if (feed.data && feed.type === 'truck_data') {
          const fiberTrucks = feed.data.fiber || [];
          const electricTrucks = feed.data.electric || [];
          totalUpdates += fiberTrucks.length + electricTrucks.length;
        }
      });

      if (totalUpdates > 0) {
        // Refresh visible truck layers using smooth updates
        const fiberLayer = this.services.layerManager.getLayer('fiber-trucks');
        const electricLayer = this.services.layerManager.getLayer('electric-trucks');

        feedData.forEach(feed => {
          if (feed.data && feed.type === 'truck_data') {
            // Update fiber trucks if layer is visible
            if (fiberLayer && fiberLayer.visible && feed.data.fiber) {
              this.services.layerManager.smoothTruckUpdate('fiber-trucks', feed.data.fiber);
            }

            // Update electric trucks if layer is visible
            if (electricLayer && electricLayer.visible && feed.data.electric) {
              this.services.layerManager.smoothTruckUpdate('electric-trucks', feed.data.electric);
            }
          }
        });
      }
    } catch (error) {
      log.error('🚛 Failed to handle GeotabFeed update:', error);
    }
  }

  // Show toast notification for subscriber updates
  showSubscriberUpdateToast(prevOffline, currOffline, prevOnline, currOnline) {
    console.log('showSubscriberUpdateToast called with:', { prevOffline, currOffline, prevOnline, currOnline });

    // Remove any existing subscriber notice
    const existingNotice = document.querySelector('#subscriber-update-notice');
    if (existingNotice) {
      existingNotice.remove();
    }

    // Calculate changes
    const offlineChange = currOffline - prevOffline;
    const onlineChange = currOnline - prevOnline;
    const totalPrevious = prevOffline + prevOnline;
    const totalCurrent = currOffline + currOnline;
    const totalChange = totalCurrent - totalPrevious;

    let message = '';
    const changes = [];

    // Build message based on changes
    if (offlineChange !== 0) {
      const changeText = offlineChange > 0 ? `+${offlineChange}` : `${offlineChange}`;
      changes.push(`Offline: ${changeText}`);
    }

    if (onlineChange !== 0) {
      const changeText = onlineChange > 0 ? `+${onlineChange}` : `${onlineChange}`;
      changes.push(`Online: ${changeText}`);
    }

    if (totalChange !== 0) {
      const totalText = totalChange > 0 ? `+${totalChange}` : `${totalChange}`;
      changes.push(`Total: ${totalText}`);
    }

    message = changes.join(', ');

    // Determine notice type based on changes
    let kind = 'info';
    if (offlineChange > 0) {
      kind = 'warning'; // More offline is concerning
    } else if (offlineChange < 0) {
      kind = 'success'; // Less offline is good
    }

    console.log('Creating notice with message:', message, 'kind:', kind);

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
    notice.id = 'subscriber-update-notice';
    notice.setAttribute('open', '');
    notice.setAttribute('kind', kind);
    notice.setAttribute('closable', '');
    notice.setAttribute('icon', 'users');
    notice.setAttribute('width', 'auto');

    const titleDiv = document.createElement('div');
    titleDiv.slot = 'title';
    titleDiv.textContent = 'Subscriber Update';

    const messageDiv = document.createElement('div');
    messageDiv.slot = 'message';
    messageDiv.textContent = message;

    notice.appendChild(titleDiv);
    notice.appendChild(messageDiv);

    noticeContainer.appendChild(notice);
    console.log('Notice appended to container:', notice);

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
        console.log('Removing notice after 5 seconds');
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

  // Stop polling (for cleanup)
  stopPolling() {
    log.info('⏹️ Stopping all polling');
    this.pollingManager.stopAll();
  }

  /**
   * Cleanup method to prevent memory leaks
   * Called on page unload or application destruction
   */
  cleanup() {
    log.info('🧹 Cleaning up application resources...');

    // Stop all polling
    if (this.pollingManager) {
      this.pollingManager.stopAll();
    }

    // Stop truck data feed
    if (this.geotabFeed && typeof this.geotabFeed.stop === 'function') {
      this.geotabFeed.stop();
    }

    // Clean up GeotabService
    if (geotabService && typeof geotabService.cleanup === 'function') {
      geotabService.cleanup();
    }

    // Clean up services
    if (this.services.layerManager && typeof this.services.layerManager.cleanup === 'function') {
      this.services.layerManager.cleanup();
    }

    if (this.services.rainViewerService && typeof this.services.rainViewerService.cleanup === 'function') {
      this.services.rainViewerService.cleanup();
    }

    // Clear loading indicators
    if (loadingIndicator) {
      loadingIndicator.destroy();
    }

    // Execute any registered cleanup handlers
    this._cleanupHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        log.error('Cleanup handler error:', error);
      }
    });

    // Clear references
    this.services = {};
    this._cleanupHandlers = [];
    this.geotabFeed = null;
    this.activeTruckLayers.clear();
    this.geotabReady = false;
  }
}

// PWA Installer - Enhanced implementation with update handling
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.updateAvailable = false;
    this.registration = null;
  }

  init() {
    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
    });

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
    });

    // Register service worker and handle updates
    this.registerServiceWorker();
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      try {
        // Add error handler for service worker errors
        navigator.serviceWorker.addEventListener('error', (event) => {
          console.warn('Service worker error:', event);
        });

        // Add handler for cache errors from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'CACHE_ERROR') {
            console.warn('Service worker cache error:', event.data.error);
            // Don't throw - just log the error
          }
        });

        const registration = await navigator.serviceWorker.register('/sw.js');
        this.registration = registration;

        // Check for updates every time the page loads
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is available
                this.handleUpdateAvailable();
              }
            });
          }
        });

        // Check for updates periodically
        setInterval(() => {
          registration.update().catch(err => {
            console.warn('Service worker update check failed:', err);
          });
        }, 60000); // Check every minute

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  handleUpdateAvailable() {
    this.updateAvailable = true;
    this.showUpdateNotification();
  }

  showUpdateNotification() {
    // Check if toast already exists
    if (document.querySelector('#update-toast')) {
      return;
    }

    // Create a toast notification for updates
    const toast = document.createElement('calcite-toast');
    toast.id = 'update-toast';
    toast.setAttribute('open', '');
    toast.setAttribute('kind', 'info');
    toast.setAttribute('placement', 'bottom');

    // Create button programmatically to handle click properly
    const refreshButton = document.createElement('calcite-button');
    refreshButton.slot = 'action';
    refreshButton.appearance = 'outline';
    refreshButton.textContent = 'Refresh Now';
    refreshButton.onclick = () => {
      // Remove toast immediately
      toast.remove();
      // Then reload
      window.location.reload(true);
    };

    toast.innerHTML = `
      <div slot="title">Update Available</div>
      <div slot="message">A new version of the app is available. Refresh to get the latest features.</div>
    `;
    toast.appendChild(refreshButton);

    document.body.appendChild(toast);

    // Auto-remove toast after 10 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.remove();
      }
    }, 10000);
  }

  // Method to force update
  async forceUpdate() {
    if (this.registration && this.registration.waiting) {
      // Tell the waiting service worker to skip waiting
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  // Method to clear all caches
  async clearAllCaches() {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize PWA installer
  const pwaInstaller = new PWAInstaller();
  pwaInstaller.init();

  // Initialize version checking for cache busting
  initVersionCheck();

  // Add developer cache clear shortcut (Ctrl+Shift+R or Cmd+Shift+R)
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
      e.preventDefault();

      // Clear service worker caches
      await pwaInstaller.clearAllCaches();

      // Clear application cache
      if (window.app && window.app.dataService) {
        window.app.dataService.clearCache();
      }

      // Clear browser storage
      localStorage.clear();
      sessionStorage.clear();

      // Force reload without cache
      window.location.reload(true);
    }
  });


  // Start the main application
  window.app = new Application();

  // Expose debug function globally for testing
  window.testVehicleList = () => {
    console.log('🚛 Global testVehicleList called');
    if (window.app && window.app.services && window.app.services.layerPanel) {
      window.app.services.layerPanel.testVehicleList();
    } else {
      console.log('🚛 Layer panel not available. Available services:',
        window.app?.services ? Object.keys(window.app.services) : 'none');
    }
  };

  // Simple production debug function
  window.debugVehicles = () => {
    try {
      console.log('🚛 === Vehicle Debug Info ===');
      console.log('Environment:', {
        isDev: import.meta.env.DEV,
        mode: import.meta.env.MODE
      });
      console.log('Global objects:', {
        app: !!window.app,
        layerManager: !!window.app?.layerManager,
        geotabService: !!window.geotabService,
        layerPanel: !!window.app?.services?.layerPanel
      });

      // Check DOM elements
      const elements = ['vehicle-list', 'vehicle-list-loading', 'vehicle-list-empty'];
      elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          console.log(`${id}:`, {
            exists: true,
            hidden: el.hidden,
            display: getComputedStyle(el).display,
            children: el.children.length
          });
        } else {
          console.log(`${id}: NOT FOUND`);
        }
      });

      // Try to get vehicle data
      if (window.app?.layerManager) {
        const layers = ['fiber-trucks', 'electric-trucks'];
        layers.forEach(layerId => {
          const layer = window.app.layerManager.getLayer(layerId);
          console.log(`${layerId} layer:`, {
            exists: !!layer,
            hasSource: !!layer?.source,
            itemCount: layer?.source?.items?.length || 0
          });
        });
      }

      console.log('🚛 === Debug Complete ===');
      return 'Debug info logged to console';
    } catch (error) {
      console.error('🚛 Debug function error:', error);
      return `Debug error: ${error.message}`;
    }
  };
});


