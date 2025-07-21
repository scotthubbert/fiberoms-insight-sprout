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
import { CSVExportService } from './utils/csvExport.js';
import * as clipboardUtils from './utils/clipboardUtils.js';

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
import '@arcgis/map-components/dist/components/arcgis-measurement';

// Import ALL CalciteUI components we need (comprehensive approach)
import '@esri/calcite-components/dist/components/calcite-shell';
import '@esri/calcite-components/dist/components/calcite-shell-panel';
import '@esri/calcite-components/dist/components/calcite-panel';
import '@esri/calcite-components/dist/components/calcite-block';
import '@esri/calcite-components/dist/components/calcite-action';
import '@esri/calcite-components/dist/components/calcite-action-bar';
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-icon';
import '@esri/calcite-components/dist/components/calcite-label';
import '@esri/calcite-components/dist/components/calcite-checkbox';
import '@esri/calcite-components/dist/components/calcite-list';
import '@esri/calcite-components/dist/components/calcite-list-item';
import '@esri/calcite-components/dist/components/calcite-navigation';
import '@esri/calcite-components/dist/components/calcite-navigation-logo';
import '@esri/calcite-components/dist/components/calcite-segmented-control';
import '@esri/calcite-components/dist/components/calcite-segmented-control-item';
import '@esri/calcite-components/dist/components/calcite-loader';
import '@esri/calcite-components/dist/components/calcite-chip';
import '@esri/calcite-components/dist/components/calcite-modal';
import '@esri/calcite-components/dist/components/calcite-dialog';
import '@esri/calcite-components/dist/components/calcite-sheet';
import '@esri/calcite-components/dist/components/calcite-scrim';
import '@esri/calcite-components/dist/components/calcite-input';
import '@esri/calcite-components/dist/components/calcite-switch';
import '@esri/calcite-components/dist/components/calcite-autocomplete';
import '@esri/calcite-components/dist/components/calcite-autocomplete-item';
import '@esri/calcite-components/dist/components/calcite-alert';
import '@esri/calcite-components/dist/components/calcite-notice';
import '@esri/calcite-components/dist/components/calcite-select';
import '@esri/calcite-components/dist/components/calcite-option';
import '@esri/calcite-components/dist/components/calcite-card';
// Import popup components that might be missing
import '@esri/calcite-components/dist/components/calcite-popover';
import '@esri/calcite-components/dist/components/calcite-tooltip';
import '@esri/calcite-components/dist/components/calcite-dropdown';
import '@esri/calcite-components/dist/components/calcite-dropdown-group';
import '@esri/calcite-components/dist/components/calcite-dropdown-item';
import { setAssetPath } from '@esri/calcite-components/dist/components';

// Set Calcite assets path - simplified approach
const assetsPath = import.meta.env.PROD
  ? '/calcite/assets'
  : '/node_modules/@esri/calcite-components/dist/calcite/assets';

console.log('🎨 Setting CalciteUI asset path:', assetsPath);
setAssetPath(assetsPath);

// Simplified CalciteUI initialization - all assets are now copied
console.log('✅ CalciteUI components loaded with bulk import and complete asset copying');

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
  if (error && error.message) {
    const errorMessage = error.message.toString();

    // CalciteUI component rendering errors
    if (errorMessage.includes('Cannot read properties of undefined (reading \'replace\')') ||
      errorMessage.includes('renderItemAriaLive') ||
      errorMessage.includes('calcite-') && errorMessage.includes('undefined') ||
      errorMessage.includes('PE.render') ||
      errorMessage.includes('PE.update') ||
      error.stack?.includes('calcite-')) {
      console.warn('🔇 Suppressed CalciteUI component error (non-critical):', errorMessage.substring(0, 100));
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

// Additional error handler for CalciteUI 'replace' errors specifically
window.addEventListener('error', event => {
  if (event.error && event.error.message) {
    const errorMessage = event.error.message;

    // Suppress specific CalciteUI errors that break functionality
    if (errorMessage.includes('Cannot read properties of undefined (reading \'replace\')') ||
      errorMessage.includes('TypeError: Cannot read properties of undefined') && errorMessage.includes('replace')) {
      console.warn('🔇 Suppressed CalciteUI replace error (non-critical):', errorMessage.substring(0, 100));
      event.preventDefault();
      return false;
    }
  }
});

// Basemap configuration for theme management
const BASEMAP_CONFIG = {
  light: {
    primary: 'navigation-3d',
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
    this.shellPanel = document.getElementById('shell-panel-start');
    this.panel = document.getElementById('panel-content');

    // Get all actions
    this.actions = this.shellPanel?.querySelectorAll('calcite-action');

    // Content sections
    this.layersContent = document.getElementById('layers-content');
    this.ospContent = document.getElementById('osp-content');
    this.vehiclesContent = document.getElementById('vehicles-content');
    this.powerOutagesContent = document.getElementById('power-outages-content');
    this.searchContent = document.getElementById('search-content');
    this.networkParentContent = document.getElementById('network-parent-content');
    this.toolsContent = document.getElementById('tools-content');
    this.infoContent = document.getElementById('info-content');

    // Initialize state
    this.currentVehicleData = [];

    this.init();
  }

  async init() {
    await customElements.whenDefined('calcite-shell-panel');
    await customElements.whenDefined('calcite-action');
    await customElements.whenDefined('calcite-panel');

    this.setupActionBarNavigation();
    this.setupCacheManagement();
    this.setupPrtgIframe();

    // Show layers content by default
    this.showContent('layers');
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
          'power-outages-action': 'power-outages',
          'search-action': 'search',
          'network-parent-action': 'network-parent',
          'tools-action': 'tools',
          'info-action': 'info'
        };

        const contentName = contentMap[actionId];

        if (contentName) {
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
    if (this.powerOutagesContent) this.powerOutagesContent.hidden = true;
    if (this.searchContent) this.searchContent.hidden = true;
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
      case 'power-outages':
        if (this.powerOutagesContent) {
          this.powerOutagesContent.hidden = false;
          this.powerOutagesContent.style.display = '';
        }
        break;
      case 'search':
        if (this.searchContent) {
          this.searchContent.hidden = false;
          this.searchContent.style.display = '';
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

  async loadSimpleVehicleList() {
    log.info('🚛 Loading simple vehicle list...');
    const vehiclesList = document.getElementById('vehicle-list');
    if (!vehiclesList) {
      console.error('🚛 vehicle-list element not found');
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
          console.error('🚛 Error processing vehicle:', vehicleError, vehicle);
        }
      });

      log.info('🚛 Vehicle list populated successfully');

    } catch (error) {
      console.error('🚛 Error loading vehicle list:', error);
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
        const geotabModule = await import('./services/GeotabService.js');
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
      console.error('Error getting vehicle data:', error);
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
      console.error('🚛 Vehicle list block element not found!');
      return;
    }

    // Store for filtering
    this.currentVehicleData = allVehicles;

    if (allVehicles.length === 0) {
      console.log('🚛 No vehicles found, hiding vehicle list');
      if (simpleVehicleListBlock) simpleVehicleListBlock.hidden = true;
    } else {
      console.log('🚛 Showing vehicle list with vehicles:', allVehicles.length);

      // Show the vehicle list container
      if (simpleVehicleListBlock) {
        simpleVehicleListBlock.hidden = false;
        simpleVehicleListBlock.style.display = '';
      }

      // Enhanced visibility restoration for production
      if (vehicleList) {
        this.forceVehicleListVisibility(vehicleList);
        console.log('🚛 Vehicle list visibility forced');
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
          console.log(`🚛 Added vehicle ${index + 1}: ${vehicleName}`);
        } catch (vehicleError) {
          console.error('🚛 Error processing vehicle:', vehicleError, vehicle);
        }
      });

      console.log('🚛 Vehicle list populated successfully');
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

      console.log('🚛 Vehicle list height check:', {
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

    console.log('🚛 Forcing CalciteUI components to render properly...');

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

      console.log('🚛 After forced rendering:', {
        height: rect.height,
        width: rect.width,
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        childCount: vehicleList.children.length
      });

      // If still not visible, apply nuclear option
      if (rect.height === 0 || computedStyle.visibility === 'hidden') {
        console.log('🚛 Applying nuclear CalciteUI visibility fix...');
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
      const geotabModule = await import('./services/GeotabService.js');
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
      console.error('🚛 DEBUG: Error in testVehicleList:', error);
    }
  }

  async populateVehicleList(vehicles) {
    console.log('🚛 populateVehicleList called with vehicles:', vehicles?.length || 0);
    const vehicleList = document.getElementById('vehicle-list');
    if (!vehicleList) {
      console.error('🚛 Vehicle list element not found!');
      return;
    }

    // Wait for CalciteUI list component to be ready
    if (customElements.get('calcite-list')) {
      await customElements.whenDefined('calcite-list');
    }

    // Debug visibility
    console.log('🚛 Vehicle list visibility before:', {
      hidden: vehicleList.hidden,
      display: window.getComputedStyle(vehicleList).display,
      visibility: window.getComputedStyle(vehicleList).visibility,
      opacity: window.getComputedStyle(vehicleList).opacity,
      height: window.getComputedStyle(vehicleList).height
    });

    // Validate vehicles array
    if (!Array.isArray(vehicles)) {
      console.error('🚛 Invalid vehicles data - not an array:', typeof vehicles);
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
          console.error('🚛 CalciteUI components not yet defined');
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

        // Safe status class name generation - ensure replace is called on a valid string
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
          console.error('🚛 Error appending list item:', error);
        }

      } catch (error) {
        // Log error details but continue processing other vehicles
        console.error('🚛 Error creating list item for vehicle', index, ':', error);
        console.error('🚛 Vehicle data:', vehicle);

        // If CalciteUI error, try to provide more context
        if (error.message && error.message.includes('replace')) {
          console.error('🚛 CalciteUI string processing error - likely an undefined value passed to component');
        }
      }
    });

    console.log('🚛 populateVehicleList completed, total items added:', vehicles.length);

    // Force CalciteUI list to be visible after populating
    // This is a workaround for CalciteUI visibility issue in production
    // The issue is that CalciteUI sometimes doesn't properly handle visibility
    // when the list is initially hidden and then populated
    requestAnimationFrame(() => {
      if (vehicleList && vehicleList.children.length > 0) {
        // Reset all visibility-related styles
        vehicleList.style.removeProperty('visibility');
        vehicleList.style.removeProperty('display');
        vehicleList.style.removeProperty('opacity');

        // Force CalciteUI to recalculate layout
        vehicleList.offsetHeight; // Trigger reflow

        // Ensure the list container is also visible
        const listContainer = vehicleList.closest('#vehicle-list-content > div');
        if (listContainer) {
          listContainer.style.removeProperty('visibility');
          listContainer.style.removeProperty('display');
        }
      }
    });

    // Debug visibility after
    console.log('🚛 Vehicle list visibility after:', {
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

      // Ensure communication_status is a valid string
      const commStatus = vehicle.communication_status;
      if (!commStatus || typeof commStatus !== 'string' || commStatus.toLowerCase() === 'offline') {
        return 'Offline';
      }

      // Check driving status with proper validation
      const isDriving = vehicle.is_driving === true || vehicle.is_driving === 'true';
      const speed = typeof vehicle.speed === 'number' ? vehicle.speed : 0;

      if (isDriving || speed > 5) {
        return 'Online';
      }

      return 'Idle';
    } catch (error) {
      console.error('🚛 Error determining vehicle status:', error);
      return 'Unknown';
    }
  }

  async zoomToVehicle(vehicle) {
    try {
      const { geotabService } = await import('./services/GeotabService.js');
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

        mapView.goTo({
          target: point,
          zoom: 16
        }).then(() => {
          const vehicleName = currentVehicle.name || `${currentVehicle.type} Truck`;
          const dataAge = dataSource === 'api' ? 'current location' : 'last known location';
          this.showVehicleNotification(`Zoomed to ${vehicleName} (${dataAge})`, 'success');
        }).catch(error => {
          console.error('Failed to zoom to vehicle:', error);
          this.showVehicleNotification('Failed to zoom to vehicle location', 'danger');
        });
      });

    } catch (error) {
      console.error('Error in zoomToVehicle:', error);
      this.showVehicleNotification('Failed to get vehicle location', 'danger');
    }
  }

  setupVehicleListEventListeners() {
    // Prevent duplicate event listeners
    if (this.vehicleListListenersSetup) return;
    this.vehicleListListenersSetup = true;

    console.log('🚛 Setting up vehicle list event listeners...');

    // Add listener for vehicle list block expansion
    const vehicleListBlock = document.getElementById('vehicle-list-block');
    if (vehicleListBlock) {
      // Listen for both the standard event and attribute changes
      vehicleListBlock.addEventListener('calciteBlockToggle', async (e) => {
        console.log('🚛 Vehicle list block toggled, expanded:', e.target.expanded);
        if (e.target.expanded) {
          await this.loadVehicleList();
        }
      });

      // Also observe attribute changes as a fallback
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

    // Add refresh button listener
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

  async zoomToTruck(truck) {
    try {
      const { geotabService } = await import('./services/GeotabService.js');
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

        mapView.goTo({
          target: point,
          zoom: 16
        }).then(() => {
          const modal = document.getElementById('truck-table-modal');
          if (modal) {
            modal.open = false;
          }

          const truckName = this.formatTruckName(currentTruck);
          const dataAge = dataSource === 'api' ? 'current location' : 'last known location';
          this.showVehicleNotification(`Zoomed to ${truckName} (${dataAge})`, 'success');
        }).catch(error => {
          console.error('Failed to zoom to truck:', error);
          this.showVehicleNotification('Failed to zoom to vehicle location', 'danger');
        });
      });

    } catch (error) {
      console.error('Error in zoomToTruck:', error);
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

  setupPrtgIframe() {
    const openPrtgBtn = document.getElementById('open-prtg');
    const reloadPrtgBtn = document.getElementById('reload-prtg');
    const prtgIframe = document.getElementById('prtg-iframe');
    const prtgWarning = document.getElementById('prtg-warning');

    const prtgUrl = 'https://139.60.151.250/public/mapshow.htm?id=11824&mapid=1314418B-78B5-4F47-94B1-C2E2DA6EC55A';

    if (openPrtgBtn) {
      openPrtgBtn.addEventListener('click', () => {
        window.open(prtgUrl, '_blank');
      });
    }

    if (reloadPrtgBtn) {
      reloadPrtgBtn.addEventListener('click', () => {
        if (prtgIframe && prtgWarning) {
          prtgIframe.src = prtgUrl;
          prtgIframe.style.display = 'block';
          prtgWarning.style.display = 'none';
        }
      });
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

      // Use consolidated update method to prevent duplicate fetches
      if (window.app && window.app.updateSubscriberStatistics) {
        await window.app.updateSubscriberStatistics();
      }

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

    // Make clipboard utils available globally for popup templates
    window.clipboardUtils = clipboardUtils;

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

    // Update dashboard and statistics after layers are loaded (consolidated)
    await this.updateSubscriberStatistics();

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

    // Set flag to indicate initial loading is complete
    this.initialLoadComplete = true;

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

      // Subscriber statistics will be updated in onMapReady() to prevent duplicate calls

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

    // Initialize measurement widget
    this.initializeMeasurementWidget();
  }

  initializeMeasurementWidget() {
    const measurementWidget = document.getElementById('measurement-tool');
    if (measurementWidget) {
      // Set up event listeners for the measurement widget
      measurementWidget.addEventListener('arcgisReady', () => {
        this.setupMeasurementButtons();
      });

      // Fallback: Set up buttons after a delay even if arcgisReady doesn't fire
      setTimeout(() => {
        this.setupMeasurementButtons();
      }, 3000);
    }
  }

  setupMeasurementButtons() {
    const measurementWidget = document.getElementById('measurement-tool');
    if (!measurementWidget) {
      log.error('Measurement widget not found');
      return;
    }

    // Distance measurement button
    const distanceBtn = document.getElementById('distance-measurement-btn');
    if (distanceBtn) {
      // Remove existing listeners to prevent duplicates
      distanceBtn.removeEventListener('click', this.distanceBtnHandler);

      this.distanceBtnHandler = () => {
        try {
          measurementWidget.activeTool = 'distance';
          this.updateMeasurementButtons('distance');
        } catch (error) {
          log.error('Error activating distance measurement:', error);
        }
      };

      distanceBtn.addEventListener('click', this.distanceBtnHandler);
    }

    // Area measurement button
    const areaBtn = document.getElementById('area-measurement-btn');
    if (areaBtn) {
      // Remove existing listeners to prevent duplicates
      areaBtn.removeEventListener('click', this.areaBtnHandler);

      this.areaBtnHandler = () => {
        try {
          measurementWidget.activeTool = 'area';
          this.updateMeasurementButtons('area');
        } catch (error) {
          log.error('Error activating area measurement:', error);
        }
      };

      areaBtn.addEventListener('click', this.areaBtnHandler);
    }

    // Clear measurements button
    const clearBtn = document.getElementById('clear-measurement-btn');
    if (clearBtn) {
      // Remove existing listeners to prevent duplicates
      clearBtn.removeEventListener('click', this.clearBtnHandler);

      this.clearBtnHandler = () => {
        try {
          measurementWidget.clear();
          measurementWidget.activeTool = null;
          this.updateMeasurementButtons(null);
        } catch (error) {
          log.error('Error clearing measurements:', error);
        }
      };

      clearBtn.addEventListener('click', this.clearBtnHandler);
    }
  }

  updateMeasurementButtons(activeTool) {
    const distanceBtn = document.getElementById('distance-measurement-btn');
    const areaBtn = document.getElementById('area-measurement-btn');
    const clearBtn = document.getElementById('clear-measurement-btn');

    // Reset all buttons
    [distanceBtn, areaBtn, clearBtn].forEach(btn => {
      if (btn) {
        btn.appearance = 'solid';
        btn.kind = 'neutral';
      }
    });

    // Highlight active button
    if (activeTool === 'distance' && distanceBtn) {
      distanceBtn.appearance = 'solid';
      distanceBtn.kind = 'brand';
    } else if (activeTool === 'area' && areaBtn) {
      areaBtn.appearance = 'solid';
      areaBtn.kind = 'brand';
    }
  }

  /**
   * Setup CSV export functionality for offline subscribers
   */
  setupCSVExport() {
    const desktopExportBtn = document.getElementById('desktop-export-offline-csv-btn');
    if (desktopExportBtn) {
      desktopExportBtn.addEventListener('click', async () => {
        await this.handleCSVExport(desktopExportBtn, 'offline');
      });
    }

    const desktopExportAllBtn = document.getElementById('desktop-export-all-csv-btn');
    if (desktopExportAllBtn) {
      desktopExportAllBtn.addEventListener('click', async () => {
        await this.handleCSVExport(desktopExportAllBtn, 'all');
      });
    }

    const mobileExportBtn = document.getElementById('export-offline-csv-btn');
    if (mobileExportBtn) {
      mobileExportBtn.addEventListener('click', async () => {
        await this.handleCSVExport(mobileExportBtn, 'offline');
      });
    }
  }

  /**
   * Handle CSV export with proper UI feedback
   * @param {HTMLElement} button - The button that triggered the export
   * @param {string} exportType - 'offline' or 'all'
   */
  async handleCSVExport(button, exportType = 'offline') {
    if (!button) return;

    const originalText = button.textContent;
    const originalIcon = button.getAttribute('icon-start');

    try {
      button.setAttribute('loading', 'true');
      button.textContent = 'Preparing Download...';
      button.setAttribute('icon-start', 'loading');
      button.disabled = true;

      if (exportType === 'all') {
        await CSVExportService.exportAllSubscribers();
      } else {
        await CSVExportService.exportOfflineSubscribers();
      }

      button.removeAttribute('loading');
      button.setAttribute('icon-start', 'check');
      button.textContent = 'Download Complete!';
      button.setAttribute('kind', 'success');
      button.disabled = false;

      this.showNotification('success', 'CSV downloaded successfully', 3000);

      setTimeout(() => {
        this.resetCSVButton(button, originalText, originalIcon);
      }, 3000);

    } catch (error) {
      console.error('CSV download failed:', error);

      button.removeAttribute('loading');
      button.setAttribute('icon-start', 'exclamation-mark-triangle');
      button.textContent = 'Download Failed';
      button.setAttribute('kind', 'danger');
      button.disabled = false;

      this.showNotification('error', `CSV download failed: ${error.message}`, 5000);

      setTimeout(() => {
        this.resetCSVButton(button, originalText, originalIcon);
      }, 5000);
    }
  }

  /**
   * Reset CSV button to original state
   * @param {HTMLElement} button - The button to reset
   * @param {string} originalText - Original button text
   * @param {string} originalIcon - Original button icon
   */
  resetCSVButton(button, originalText, originalIcon) {
    if (!button) return;

    button.removeAttribute('loading');
    button.removeAttribute('kind');
    button.setAttribute('icon-start', originalIcon || 'download');
    button.textContent = originalText || 'Export Offline CSV';
    button.disabled = false;
  }

  /**
   * Setup subscriber statistics UI elements
   */
  setupSubscriberStatistics() {
    this.setupLayerSwitches();
    this.updateSubscriberStatistics();

    // Update statistics when data changes
    document.addEventListener('subscriberDataUpdate', () => {
      this.updateSubscriberStatistics();
    });
  }

  /**
   * Setup layer control switches
   */
  setupLayerSwitches() {
    // Setup subscriber switches
    const onlineSwitch = document.getElementById('online-subscribers-switch');
    const offlineSwitch = document.getElementById('offline-subscribers-switch');

    if (onlineSwitch) {
      onlineSwitch.addEventListener('calciteSwitchChange', (e) => {
        this.handleLayerToggle(e.target, e.target.checked);
      });
    }

    if (offlineSwitch) {
      offlineSwitch.addEventListener('calciteSwitchChange', (e) => {
        this.handleLayerToggle(e.target, e.target.checked);
      });
    }

    // Setup layer switches for all sections
    this.setupLayerSwitchesForAllSections();

    // Setup clickable list items
    this.setupClickableListItems();
  }

  /**
   * Setup layer switches for all sections (OSP, Vehicles, Tools)
   */
  setupLayerSwitchesForAllSections() {
    // Setup OSP switches
    const ospSwitches = document.querySelectorAll('#osp-content calcite-switch');
    ospSwitches.forEach(switchElement => {
      switchElement.addEventListener('calciteSwitchChange', (e) => {
        this.handleLayerToggle(e.target, e.target.checked);
      });
    });

    // Setup vehicle switches
    const vehicleSwitches = document.querySelectorAll('#vehicles-content calcite-switch');
    vehicleSwitches.forEach(switchElement => {
      switchElement.addEventListener('calciteSwitchChange', (e) => {
        this.handleLayerToggle(e.target, e.target.checked);
      });
    });

    // Setup weather/tools switches
    const toolsSwitches = document.querySelectorAll('#tools-content calcite-switch');
    toolsSwitches.forEach(switchElement => {
      switchElement.addEventListener('calciteSwitchChange', (e) => {
        this.handleLayerToggle(e.target, e.target.checked);
      });
    });

    // Setup node sites switches
    const nodeSitesSwitches = document.querySelectorAll('#network-parent-content calcite-switch');
    nodeSitesSwitches.forEach(switchElement => {
      switchElement.addEventListener('calciteSwitchChange', (e) => {
        this.handleLayerToggle(e.target, e.target.checked);
      });
    });
  }

  /**
   * Make list items clickable to toggle their switches
   */
  setupClickableListItems() {
    const listItems = document.querySelectorAll('calcite-list-item');
    listItems.forEach(listItem => {
      const switchElement = listItem.querySelector('calcite-switch');
      if (switchElement) {
        listItem.style.cursor = 'pointer';
        listItem.addEventListener('click', (e) => {
          // Don't trigger if the switch itself was clicked or any of its internal elements
          if (!e.target.closest('calcite-switch')) {
            e.preventDefault();
            e.stopPropagation();

            // Toggle the switch
            switchElement.checked = !switchElement.checked;

            // Trigger the layer toggle directly
            this.handleLayerToggle(switchElement, switchElement.checked);
          }
        });
      }
    });
  }

  /**
 * Update subscriber statistics display
 */
  async updateSubscriberStatistics() {
    try {
      // Fetch subscriber summary once and use for both dashboard and statistics
      const summary = await subscriberDataService.getSubscribersSummary();

      // Update dashboard counts
      this.services.dashboard.updateOfflineCount(summary.offline || 0);
      this.services.dashboard.updateLastUpdatedTime();

      // Update count displays using correct property names
      const onlineCountEl = document.getElementById('online-count-display');
      const offlineCountEl = document.getElementById('offline-count-display');
      const lastUpdatedEl = document.getElementById('last-updated-display');

      if (onlineCountEl) {
        onlineCountEl.textContent = summary.online?.toLocaleString() || '0';
      }

      if (offlineCountEl) {
        offlineCountEl.textContent = summary.offline?.toLocaleString() || '0';
      }

      if (lastUpdatedEl) {
        const lastUpdated = summary.lastUpdated ?
          new Date(summary.lastUpdated).toLocaleString() :
          'Never';
        lastUpdatedEl.textContent = `Last updated: ${lastUpdated}`;
      }

    } catch (error) {
      console.error('Failed to update subscriber statistics:', error);

      // Show fallback values for both dashboard and statistics
      this.services.dashboard.updateOfflineCount(0);

      const onlineCountEl = document.getElementById('online-count-display');
      const offlineCountEl = document.getElementById('offline-count-display');
      const lastUpdatedEl = document.getElementById('last-updated-display');

      if (onlineCountEl) onlineCountEl.textContent = '--';
      if (offlineCountEl) offlineCountEl.textContent = '--';
      if (lastUpdatedEl) lastUpdatedEl.textContent = 'Last updated: Error loading data';
    }
  }

  /**
   * Show notification to user
   * @param {string} type - Notification type ('success', 'error', 'warning', 'info')
   * @param {string} message - Notification message
   * @param {number} duration - How long to show the notification in milliseconds
   */
  showNotification(type, message, duration = 5000) {
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

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);

    notification.addEventListener('calciteNoticeClose', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
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
    // Check for specific switch IDs first
    if (element.id === 'online-subscribers-switch') {
      return 'online-subscribers';
    }
    if (element.id === 'offline-subscribers-switch') {
      return 'offline-subscribers';
    }

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
          // Show loading indicators for realtime data updates (never cached)
          if (!window._isManualRefresh && data.offline) {
            loadingIndicator.showLoading('offline-subscribers-update', 'Offline Subscribers');
          }
          if (!window._isManualRefresh && data.online && this.onlineLayerLoaded) {
            loadingIndicator.showLoading('online-subscribers-update', 'Online Subscribers');
          }

          // Get current counts
          const currentOfflineCount = data.offline?.count || 0;
          const currentOnlineCount = data.online?.count || 0;

          // Handle both offline and online updates
          const offlineLayer = this.services.layerManager.getLayer('offline-subscribers');
          const onlineLayer = this.services.layerManager.getLayer('online-subscribers');

          if (offlineLayer && data.offline) {
            await this.services.layerManager.updateLayerData('offline-subscribers', data.offline);
            log.info(`📊 Updated offline subscribers: ${data.offline.count} records (realtime)`);
            if (!window._isManualRefresh) {
              loadingIndicator.showNetwork('offline-subscribers-update', 'Offline Subscribers');
            }
          }

          // Only update online layer if it's actually loaded
          if (onlineLayer && data.online && this.onlineLayerLoaded) {
            await this.services.layerManager.updateLayerData('online-subscribers', data.online);
            log.info(`📊 Updated online subscribers: ${data.online.count} records (realtime)`);
            if (!window._isManualRefresh) {
              loadingIndicator.showNetwork('online-subscribers-update', 'Online Subscribers');
            }
          }

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

          // Update dashboard and subscriber statistics (consolidated to prevent duplicate fetches)
          await this.updateSubscriberStatistics();
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

          // Update statistics display
          if (window.app && window.app.updateSubscriberStatistics) {
            await window.app.updateSubscriberStatistics();
          }
        } finally {
          refreshButton.removeAttribute('loading');
          // Clear manual refresh flag
          window._isManualRefresh = false;
        }
      });
    }

    this.setupCSVExport();
    this.setupSubscriberStatistics();

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

          // Notify PowerOutageStats component about data updates
          document.dispatchEvent(new CustomEvent('powerOutageDataUpdated', {
            detail: {
              apcoCount: data.apco?.count || 0,
              tombigbeeCount: data.tombigbee?.count || 0
            }
          }));

          // Update power outage statistics component
          const powerOutageStatsComponent = document.querySelector('power-outage-stats');
          if (powerOutageStatsComponent) {
            powerOutageStatsComponent.updateStats();
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
    toast.setAttribute('placement', 'top');

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
document.addEventListener('DOMContentLoaded', async () => {
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






  // Check GeotabService configuration specifically for production
  window.checkGeotabConfig = function () {
    try {
      console.log('🚛 Checking GeotabService configuration...');

      // Check environment variables
      const config = {
        enabled: import.meta.env.VITE_GEOTAB_ENABLED,
        hasUsername: !!import.meta.env.VITE_GEOTAB_USERNAME,
        hasPassword: !!import.meta.env.VITE_GEOTAB_PASSWORD,
        hasDatabase: !!import.meta.env.VITE_GEOTAB_DATABASE,
        usernameLength: import.meta.env.VITE_GEOTAB_USERNAME?.length || 0,
        passwordLength: import.meta.env.VITE_GEOTAB_PASSWORD?.length || 0,
        databaseLength: import.meta.env.VITE_GEOTAB_DATABASE?.length || 0
      };

      console.log('GeotabService Config:', config);

      // Import and check service
      import('./services/GeotabService.js').then(module => {
        const service = module.geotabService;
        console.log('GeotabService Status:', service.getStatus());
        console.log('GeotabService lastTruckData:', service.lastTruckData);
        console.log('GeotabService authenticated:', service.isAuthenticated);
      }).catch(error => {
        console.error('GeotabService import error:', error);
      });

      return 'GeotabService check completed - see console for details';
    } catch (error) {
      console.error('❌ Error checking GeotabService config:', error);
      return `Error: ${error.message}`;
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
        layerManager: !!window.app?.services?.layerManager,
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
      if (window.app?.services?.layerManager) {
        const layers = ['fiber-trucks', 'electric-trucks'];
        layers.forEach(layerId => {
          const layer = window.app.services.layerManager.getLayer(layerId);
          console.log(`${layerId} layer:`, {
            exists: !!layer,
            hasSource: !!layer?.source,
            itemCount: layer?.source?.items?.length || 0,
            visible: layer?.visible,
            type: layer?.type
          });
        });

        // Also check all layers
        const allLayers = window.app.services.layerManager.getAllLayers();
        console.log('All layers in LayerManager:', allLayers.map(l => ({
          id: l.id,
          title: l.title,
          type: l.type,
          visible: l.visible
        })));
      } else {
        console.log('LayerManager not available');
      }

      // Check GeotabService
      if (window.geotabService) {
        console.log('GeotabService status:', {
          isConnected: window.geotabService.isConnected,
          lastUpdate: window.geotabService.lastUpdate,
          vehicleCount: window.geotabService.vehicles?.length || 0
        });
      } else {
        console.log('GeotabService not available');
      }

      console.log('🚛 === Debug Complete ===');
      return 'Debug info logged to console';
    } catch (error) {
      console.error('🚛 Debug function error:', error);
      return `Debug error: ${error.message}`;
    }
  };

  // Enhanced debug function for vehicle list issues
  window.debugVehicleListProduction = async function () {
    console.log('🚛 === PRODUCTION VEHICLE LIST DEBUG ===');

    // 1. Environment and build info
    const env = {
      isDev: import.meta.env.DEV,
      isProd: import.meta.env.PROD,
      mode: import.meta.env.MODE,
      origin: window.location.origin,
      pathname: window.location.pathname,
      userAgent: navigator.userAgent.substring(0, 100)
    };
    console.log('Environment:', env);

    // 2. Check CalciteUI asset path
    console.log('CalciteUI asset path:', {
      isProduction: import.meta.env.PROD,
      expectedPath: import.meta.env.PROD ? window.location.origin + '/calcite/assets' : '/node_modules/@esri/calcite-components/dist/calcite/assets'
    });

    // 3. Test CalciteUI component definitions
    const calciteComponents = [
      'calcite-list',
      'calcite-list-item',
      'calcite-icon',
      'calcite-block',
      'calcite-dialog',
      'calcite-switch'
    ];

    console.log('CalciteUI Component Status:');
    for (const component of calciteComponents) {
      const defined = customElements.get(component);
      console.log(`  ${component}: ${defined ? 'DEFINED ✅' : 'NOT DEFINED ❌'}`);
    }

    // 4. Test asset loading
    try {
      // Test loading a common CalciteUI icon
      const testIcon = document.createElement('calcite-icon');
      testIcon.setAttribute('icon', 'circle');
      testIcon.style.position = 'absolute';
      testIcon.style.top = '-9999px';
      document.body.appendChild(testIcon);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const iconLoaded = testIcon.shadowRoot && testIcon.shadowRoot.querySelector('svg');
      console.log('CalciteUI Icon Test:', iconLoaded ? 'LOADED ✅' : 'FAILED ❌');

      testIcon.remove();
    } catch (error) {
      console.log('CalciteUI Icon Test: ERROR ❌', error.message);
    }

    // 5. Check DOM elements
    const elements = ['vehicle-list', 'vehicle-list-loading', 'vehicle-list-empty', 'vehicle-list-block'];
    console.log('DOM Elements:');
    elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const styles = window.getComputedStyle(el);
        console.log(`  ${id}:`, {
          exists: true,
          hidden: el.hidden,
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          height: styles.height,
          children: el.children.length,
          hasContent: el.innerHTML.length > 0
        });
      } else {
        console.log(`  ${id}: NOT FOUND ❌`);
      }
    });

    // 6. Check application state
    const appState = {
      app: !!window.app,
      layerManager: !!window.app?.services?.layerManager,
      layerPanel: !!window.app?.services?.layerPanel,
      geotabService: !!window.geotabService,
      isLoadingVehicleList: window.app?.services?.layerPanel?.isLoadingVehicleList
    };
    console.log('Application State:', appState);

    // 7. Check vehicle data
    if (window.app?.services?.layerManager) {
      const layers = ['fiber-trucks', 'electric-trucks'];
      console.log('Vehicle Layers:');
      layers.forEach(layerId => {
        const layer = window.app.services.layerManager.getLayer(layerId);
        console.log(`  ${layerId}:`, {
          exists: !!layer,
          hasSource: !!layer?.source,
          itemCount: layer?.source?.items?.length || 0,
          visible: layer?.visible,
          type: layer?.type
        });
      });
    }

    // 8. Check GeotabService
    try {
      const geotabModule = await import('./services/GeotabService.js');
      const geotabService = geotabModule.geotabService;
      const status = geotabService.getStatus();
      console.log('GeotabService:', {
        status: status,
        lastTruckData: geotabService.lastTruckData,
        authenticated: geotabService.isAuthenticated
      });
    } catch (error) {
      console.log('GeotabService: ERROR ❌', error.message);
    }

    // 9. Test vehicle list loading
    console.log('Testing vehicle list loading...');
    if (window.app?.services?.layerPanel) {
      try {
        await window.app.services.layerPanel.loadVehicleList();
        console.log('Vehicle list loading test: COMPLETED ✅');
      } catch (error) {
        console.log('Vehicle list loading test: ERROR ❌', error.message);
      }
    }

    // 10. Force vehicle list visibility
    console.log('Force showing vehicle list...');
    const vehicleList = document.getElementById('vehicle-list');
    const vehicleListBlock = document.getElementById('vehicle-list-block');

    if (vehicleList && vehicleListBlock) {
      // Force expand the block
      vehicleListBlock.expanded = true;
      vehicleListBlock.setAttribute('expanded', '');

      // Force show the list
      vehicleList.hidden = false;
      vehicleList.style.display = 'block';
      vehicleList.style.visibility = 'visible';
      vehicleList.style.opacity = '1';

      // Note: No test content creation for production builds

      console.log('Force visibility applied to vehicle list');
    }

    console.log('🚛 === DEBUG COMPLETE ===');
    return 'Production debug completed - check console for detailed results';
  };

  // Function to test CalciteUI component creation in isolation
  window.testCalciteUIComponents = async function () {
    console.log('🧪 Testing CalciteUI Component Creation...');

    try {
      // Wait for components to be defined
      await customElements.whenDefined('calcite-list');
      await customElements.whenDefined('calcite-list-item');
      await customElements.whenDefined('calcite-icon');

      // Create test container
      const testContainer = document.createElement('div');
      testContainer.id = 'calcite-test-container';
      testContainer.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; background: white; padding: 20px; border: 1px solid #ccc; max-width: 300px;';

      // Create test list
      const testList = document.createElement('calcite-list');
      testList.setAttribute('selection-mode', 'none');

      // Note: Test items removed to prevent mock data in production

      testContainer.appendChild(testList);
      document.body.appendChild(testContainer);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        testContainer.remove();
      }, 5000);

      console.log('✅ CalciteUI test components created successfully');
      return 'CalciteUI components working - test UI added to top-right corner';

    } catch (error) {
      console.error('❌ CalciteUI component test failed:', error);
      return `CalciteUI component test failed: ${error.message}`;
    }
  };

  // Function to diagnose CalciteUI asset loading issues
  window.diagnoseCalciteUIAssets = async function () {
    console.log('🔍 Diagnosing CalciteUI Asset Issues...');

    // Test asset paths
    const isProduction = import.meta.env.PROD;
    const expectedAssetPath = isProduction ? window.location.origin + '/calcite/assets' : '/node_modules/@esri/calcite-components/dist/calcite/assets';

    console.log('Asset path configuration:', {
      isProduction,
      expectedAssetPath,
      origin: window.location.origin
    });

    // Test specific asset files
    const testAssets = [
      'icon/circle16.json',
      'icon/circle24.json',
      'icon/circle32.json',
      't9n/en.json'
    ];

    const assetResults = {};
    for (const asset of testAssets) {
      const assetUrl = `${expectedAssetPath}/${asset}`;
      try {
        const response = await fetch(assetUrl);
        assetResults[asset] = {
          status: response.status,
          ok: response.ok,
          url: assetUrl
        };
        console.log(`Asset ${asset}: ${response.ok ? '✅ OK' : '❌ FAILED'} (${response.status})`);
      } catch (error) {
        assetResults[asset] = {
          status: 'ERROR',
          ok: false,
          url: assetUrl,
          error: error.message
        };
        console.log(`Asset ${asset}: ❌ ERROR - ${error.message}`);
      }
    }

    // Check if CalciteUI components are properly defined
    const components = ['calcite-list', 'calcite-list-item', 'calcite-icon'];
    const componentStatus = {};

    for (const component of components) {
      const defined = customElements.get(component);
      componentStatus[component] = !!defined;
      console.log(`Component ${component}: ${defined ? '✅ DEFINED' : '❌ NOT DEFINED'}`);
    }

    // Generate troubleshooting report
    const hasAssetFailures = Object.values(assetResults).some(result => !result.ok);
    const hasComponentFailures = Object.values(componentStatus).some(status => !status);

    console.log('📊 DIAGNOSIS SUMMARY:');
    console.log(`Asset Loading: ${hasAssetFailures ? '❌ ISSUES FOUND' : '✅ OK'}`);
    console.log(`Component Definitions: ${hasComponentFailures ? '❌ ISSUES FOUND' : '✅ OK'}`);

    if (hasAssetFailures) {
      console.log('💡 SUGGESTED FIXES:');
      console.log('1. Check network connectivity');
      console.log('2. Verify Vite build copied assets to /calcite/assets/');
      console.log('3. Check service worker cache');
      console.log('4. Try hard refresh (Ctrl+Shift+R)');
      console.log('5. Clear browser cache and storage');
    }

    return {
      assetResults,
      componentStatus,
      hasAssetFailures,
      hasComponentFailures,
      recommendations: hasAssetFailures ? [
        'Check network connectivity',
        'Verify Vite build copied assets to /calcite/assets/',
        'Check service worker cache',
        'Try hard refresh (Ctrl+Shift+R)',
        'Clear browser cache and storage'
      ] : ['No issues found']
    };
  };

  // Function to force-fix vehicle list visibility (last resort)
  window.forceFixVehicleList = function () {
    console.log('🔧 Force-fixing vehicle list visibility and height...');

    const vehicleList = document.getElementById('vehicle-list');
    const vehicleListBlock = document.getElementById('vehicle-list-block');
    const vehicleListContent = document.getElementById('vehicle-list-content');

    if (!vehicleList || !vehicleListBlock) {
      console.error('❌ Vehicle list elements not found');
      return 'Vehicle list elements not found';
    }

    // Check current state
    const currentStyle = window.getComputedStyle(vehicleList);
    console.log('🔧 Current vehicle list state:', {
      height: currentStyle.height,
      display: currentStyle.display,
      visibility: currentStyle.visibility,
      childCount: vehicleList.children.length
    });

    // Force expand block
    vehicleListBlock.expanded = true;
    vehicleListBlock.setAttribute('expanded', '');
    vehicleListBlock.style.setProperty('--calcite-block-content-display', 'block', 'important');

    // Force show list
    vehicleList.hidden = false;
    vehicleList.removeAttribute('hidden');
    vehicleList.style.setProperty('display', 'block', 'important');
    vehicleList.style.setProperty('visibility', 'visible', 'important');
    vehicleList.style.setProperty('opacity', '1', 'important');
    vehicleList.style.setProperty('height', 'auto', 'important');
    vehicleList.style.setProperty('min-height', 'min-content', 'important');
    vehicleList.style.setProperty('max-height', 'none', 'important');

    // Force show content container
    if (vehicleListContent) {
      vehicleListContent.style.setProperty('display', 'block', 'important');
      vehicleListContent.style.setProperty('visibility', 'visible', 'important');
      vehicleListContent.style.setProperty('opacity', '1', 'important');
    }

    // Note: Test content removed to prevent mock data in production

    // Force height calculation if needed
    setTimeout(() => {
      const finalStyle = window.getComputedStyle(vehicleList);
      const finalHeight = parseFloat(finalStyle.height);

      console.log('🔧 After force fix:', {
        height: finalStyle.height,
        display: finalStyle.display,
        visibility: finalStyle.visibility,
        childCount: vehicleList.children.length
      });

      // If height is still 0, calculate manual height
      if (finalHeight === 0 && vehicleList.children.length > 0) {
        const itemCount = vehicleList.children.length;
        const calculatedHeight = itemCount * 56; // 56px per CalciteUI list item
        vehicleList.style.setProperty('height', `${calculatedHeight}px`, 'important');
        vehicleList.style.setProperty('min-height', `${calculatedHeight}px`, 'important');

        console.log(`🔧 Applied manual height: ${calculatedHeight}px for ${itemCount} items`);

        // Force each child to be visible
        Array.from(vehicleList.children).forEach(child => {
          if (child.tagName === 'CALCITE-LIST-ITEM') {
            child.style.setProperty('display', 'flex', 'important');
            child.style.setProperty('min-height', '56px', 'important');
            child.style.setProperty('height', 'auto', 'important');
          }
        });
      }
    }, 200);

    console.log('✅ Vehicle list visibility and height force-fixed');
    return 'Vehicle list visibility and height force-fixed - check the vehicles panel';
  };
});

// Add this debug function before the LayerPanel class
async function debugCalciteUIComponents() {
  console.log('🔍 === CalciteUI Component Debug ===');

  // Check environment
  console.log('🌍 Environment:', {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    mode: import.meta.env.MODE
  });

  // Check if CalciteUI is loaded
  console.log('📦 CalciteUI Package Check:', {
    hasCalciteComponents: !!window.CalciteComponents,
    customElementsRegistry: !!window.customElements,
    customElementsCount: window.customElements ? Object.keys(window.customElements).length : 0
  });

  // List of components we need
  const requiredComponents = [
    'calcite-list',
    'calcite-list-item',
    'calcite-icon',
    'calcite-button',
    'calcite-shell',
    'calcite-panel',
    'calcite-block'
  ];

  console.log('🧩 Component Registration Status:');
  const componentStatus = {};

  for (const component of requiredComponents) {
    const isDefined = customElements.get(component);
    componentStatus[component] = {
      isDefined: !!isDefined,
      constructor: isDefined ? isDefined.name : 'undefined'
    };

    if (isDefined) {
      console.log(`✅ ${component}: registered (${isDefined.name})`);
    } else {
      console.log(`❌ ${component}: NOT registered`);
    }
  }

  // Try to create test components
  console.log('🧪 Component Creation Test:');
  try {
    const testList = document.createElement('calcite-list');
    const testItem = document.createElement('calcite-list-item');
    const testIcon = document.createElement('calcite-icon');

    console.log('✅ Component creation successful:', {
      list: testList.tagName,
      listItem: testItem.tagName,
      icon: testIcon.tagName
    });

    // Test setting properties
    testItem.label = 'Test Label';
    testItem.description = 'Test Description';
    testIcon.icon = 'information';

    console.log('✅ Property setting successful');

  } catch (error) {
    console.error('❌ Component creation failed:', error);
  }

  // Check for any CalciteUI errors in console
  const originalError = console.error;
  const calciteErrors = [];
  console.error = function (...args) {
    if (args.some(arg => String(arg).toLowerCase().includes('calcite'))) {
      calciteErrors.push(args);
    }
    originalError.apply(console, args);
  };

  // Wait a moment to capture any errors
  setTimeout(() => {
    console.error = originalError;
    if (calciteErrors.length > 0) {
      console.log('🚨 CalciteUI Errors Found:', calciteErrors);
    } else {
      console.log('✅ No CalciteUI errors detected');
    }
  }, 1000);

  return componentStatus;
};




