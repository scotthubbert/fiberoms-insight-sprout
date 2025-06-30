// main.js - SOLID-compliant application entry point following CLAUDE.md principles

// Configure ArcGIS intl
import * as intl from '@arcgis/core/intl';
intl.setLocale('en');

// Import SOLID-compliant services (DIP - Dependency Injection)
import { MapController } from './services/MapController.js';
import { LayerManager } from './services/LayerManager.js';
import { PopupManager } from './services/PopupManager.js';
import { subscriberDataService } from './dataService.js';
import { layerConfigs, getLayerConfig, getAllLayerIds } from './config/layerConfigs.js';

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

// Import Calcite Components (verified against CLAUDE.md safe list)
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
import '@esri/calcite-components/dist/components/calcite-chip';
import '@esri/calcite-components/dist/components/calcite-autocomplete';
import { setAssetPath } from '@esri/calcite-components/dist/components';

// Set Calcite assets path to NPM bundled assets (CLAUDE.md compliance)
setAssetPath('/node_modules/@esri/calcite-components/dist/calcite/assets');

// Production logging utility
const isDevelopment = import.meta.env.DEV;
const log = {
  info: (...args) => isDevelopment && console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};

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
    log.info(`🔄 Polling requested for ${layerName} - disabled for Phase 1`);
    return;
  }

  stopPolling(layerName) {
    if (this.pollingTimers[layerName]) {
      clearInterval(this.pollingTimers[layerName]);
      delete this.pollingTimers[layerName];
      log.info(`⏹️ Stopped polling for ${layerName}`);
    }
  }

  async updateLayerData(layerName) {
    // Delegate to LayerManager
    return this.layerManager.updateLayerData(layerName);
  }

  cleanup() {
    log.info('🧹 Cleaning up polling timers...');
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
    this.searchAction = document.getElementById('search-action');
    this.toolsAction = document.getElementById('tools-action');
    this.layersContent = document.getElementById('layers-content');
    this.searchContent = document.getElementById('search-content');
    this.toolsContent = document.getElementById('tools-content');
    this.init();
  }

  async init() {
    await customElements.whenDefined('calcite-shell-panel');
    await customElements.whenDefined('calcite-action');
    await customElements.whenDefined('calcite-panel');
    this.setupActionBarNavigation();
  }

  setupActionBarNavigation() {
    this.layersAction?.addEventListener('click', () => this.handleActionClick('layers'));
    this.searchAction?.addEventListener('click', () => this.handleActionClick('search'));
    this.toolsAction?.addEventListener('click', () => this.handleActionClick('tools'));
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
      case 'search': return this.searchAction;
      case 'tools': return this.toolsAction;
      default: return null;
    }
  }

  showPanel(panelName) {
    // Hide all panels
    this.layersContent.hidden = true;
    this.searchContent.hidden = true;
    this.toolsContent.hidden = true;

    // Remove active state from all actions
    this.layersAction.active = false;
    this.searchAction.active = false;
    this.toolsAction.active = false;

    // Show selected panel and set active action
    switch (panelName) {
      case 'layers':
        this.layersContent.hidden = false;
        this.layersAction.active = true;
        break;
      case 'search':
        this.searchContent.hidden = false;
        this.searchAction.active = true;
        break;
      case 'tools':
        this.toolsContent.hidden = false;
        this.toolsAction.active = true;
        break;
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
  }

  handleTabSelection(tabValue) {
    this.closeCurrentPanel();

    const dialogId = `mobile-${tabValue}-sheet`;
    const dialog = document.getElementById(dialogId);

    if (dialog) {
      dialog.open = true;
      this.currentDialog = dialog;
      this.closeButton.classList.add('show');
    }
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
}

// Dashboard Manager - Single Responsibility Principle
class DashboardManager {
  constructor() {
    this.refreshButton = document.getElementById('refresh-dashboard');
    this.offlineMetric = document.getElementById('offline-count');
  }

  async init() {
    this.setupEventListeners();
    await this.updateDashboard();
  }

  setupEventListeners() {
    if (this.refreshButton) {
      this.refreshButton.addEventListener('click', () => {
        this.refreshDashboard();
      });
    }
  }

  async updateDashboard() {
    try {
      const summary = await subscriberDataService.getSubscribersSummary();
      this.updateOfflineCount(summary.offline || 0);
    } catch (error) {
      log.error('Failed to update dashboard:', error);
    }
  }

  updateOfflineCount(count) {
    if (this.offlineMetric) {
      this.offlineMetric.textContent = count;
    }
  }

  async refreshDashboard() {
    subscriberDataService.clearCache();
    await this.updateDashboard();
  }
}

// Header Search Manager - Single Responsibility Principle
class HeaderSearch {
  constructor() {
    this.searchInput = document.getElementById('header-search');
  }

  async init() {
    if (!this.searchInput) return;

    await customElements.whenDefined('calcite-autocomplete');
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.searchInput) {
      this.searchInput.addEventListener('calciteAutocompleteChange', (e) => {
        this.handleSearchInput(e.target.value);
      });
    }
  }

  handleSearchInput(searchTerm) {
    if (searchTerm.length >= 4) {
      log.info('🔍 Searching for:', searchTerm);
      // Search implementation will be added in future phases
    }
  }
}

// Application Orchestrator - Dependency Injection Pattern (DIP)
class Application {
  constructor() {
    this.services = {};
    this.init();
  }

  async init() {
    log.info('🚀 Starting FiberOMS Insight PWA...');

    // Create services with dependency injection (DIP - Dependency Inversion Principle)
    this.services.themeManager = new ThemeManager();
    this.services.layerManager = new LayerManager(subscriberDataService);
    this.services.mapController = new MapController(this.services.layerManager, this.services.themeManager);
    this.services.pollingService = new PollingService(this.services.layerManager);
    this.services.popupManager = new PopupManager();
    this.services.layerPanel = new LayerPanel();
    this.services.mobileTabBar = new MobileTabBar();
    this.services.dashboard = new DashboardManager();
    this.services.headerSearch = new HeaderSearch();

    // Store theme manager globally for component access
    window.themeManager = this.services.themeManager;

    // Initialize map controller
    await this.services.mapController.initialize();

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

    log.info('✅ Application initialized successfully');
  }

  async onMapReady() {
    log.info('🗺️ Map ready, initializing layers and features...');

    // Initialize subscriber layers first
    await this.initializeSubscriberLayers();

    // Set up layer toggle handlers
    this.setupLayerToggleHandlers();

    // Initialize popup action handlers after layers are ready
    if (this.services.mapController.view) {
      this.services.popupManager.initialize(this.services.mapController.view);
    }

    // Polling disabled for Phase 1
    // this.services.pollingService.startPolling('offlineSubscribers');

    log.info('🎯 Phase 1 features initialized successfully');
  }

  async initializeSubscriberLayers() {
    try {
      // Create offline subscribers layer (visible by default - Phase 1 focus)
      const offlineConfig = getLayerConfig('offlineSubscribers');
      if (offlineConfig) {
        const offlineLayer = await this.createLayerFromConfig(offlineConfig);
        if (offlineLayer) {
          this.services.mapController.addLayer(offlineLayer, offlineConfig.zOrder);
          log.info('✅ Offline subscribers layer created and added to map');
        }
      }

      // Create online subscribers layer (hidden by default)
      const onlineConfig = getLayerConfig('onlineSubscribers');
      if (onlineConfig) {
        const onlineLayer = await this.createLayerFromConfig(onlineConfig);
        if (onlineLayer) {
          onlineLayer.visible = false; // Hidden by default per Phase 1 requirements
          this.services.mapController.addLayer(onlineLayer, onlineConfig.zOrder);
          log.info('✅ Online subscribers layer created (hidden by default)');
        }
      }

    } catch (error) {
      log.error('❌ Failed to initialize subscriber layers:', error);
    }
  }

  async createLayerFromConfig(config) {
    try {
      const data = await config.dataServiceMethod();
      if (!data?.features?.length) {
        log.warn(`⚠️ No data available for layer: ${config.id}`);
        return null;
      }

      return await this.services.layerManager.createLayer({
        ...config,
        dataSource: data
      });
    } catch (error) {
      log.error(`❌ Failed to create layer ${config.id}:`, error);
      return null;
    }
  }

  setupLayerToggleHandlers() {
    // Desktop layer toggles (checkboxes)
    const checkboxes = document.querySelectorAll('#layers-content calcite-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('calciteCheckboxChange', (e) => {
        this.handleLayerToggle(e.target, e.target.checked);
      });
    });

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
  }

  async handleLayerToggle(element, checked) {
    // Map UI labels to layer IDs
    const layerId = this.getLayerIdFromElement(element);

    if (layerId) {
      await this.services.layerManager.toggleLayerVisibility(layerId, checked);
      this.syncToggleStates(layerId, checked);

      // Start/stop polling based on visibility (disabled for Phase 1)
      // if (checked && (layerId === 'offline-subscribers' || layerId === 'online-subscribers')) {
      //   const configKey = layerId.replace('-', '');
      //   this.services.pollingService.startPolling(configKey);
      // } else if (!checked) {
      //   const configKey = layerId.replace('-', '');
      //   this.services.pollingService.stopPolling(configKey);
      // }
    }
  }

  getLayerIdFromElement(element) {
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
      'Offline Subscribers': 'offline-subscribers'
    };

    return mapping[labelText] || null;
  }

  syncToggleStates(layerId, checked) {
    // Sync between desktop and mobile UI elements
    const labelMapping = {
      'offline-subscribers': 'Offline Subscribers',
      'online-subscribers': 'Online Subscribers'
    };

    const labelText = labelMapping[layerId];
    if (!labelText) return;

    // Sync desktop checkboxes
    const desktopCheckboxes = document.querySelectorAll('#layers-content calcite-checkbox');
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
}

// PWA Installer - Simple implementation for Phase 1
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
  }

  init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      log.info('📱 PWA install prompt available');
    });

    window.addEventListener('appinstalled', () => {
      log.info('📱 PWA installed successfully');
    });
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize PWA installer
  const pwaInstaller = new PWAInstaller();
  pwaInstaller.init();

  // Start the main application
  window.app = new Application();

  log.info('🎯 FiberOMS Insight PWA - Phase 1 Complete');
  log.info('📱 Mobile-first design with CalciteUI components');
  log.info('🗺️ Map with offline subscriber visualization');
  log.info('🎨 Theme switching with system preference support');
  log.info('⚡ Real-time data polling ready for Phase 2');
});


