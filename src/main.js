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

// Import components
import './components/PowerOutageStats.js';
import { setupCalciteIconFallback } from './utils/calciteIconFallback.js';
import { initVersionCheck } from './utils/versionCheck.js';

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
import '@esri/calcite-components/dist/components/calcite-chip';
import '@esri/calcite-components/dist/components/calcite-card';
import '@esri/calcite-components/dist/components/calcite-autocomplete';
import '@esri/calcite-components/dist/components/calcite-autocomplete-item';
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
    this.powerOutagesAction = document.getElementById('power-outages-action');
    this.searchAction = document.getElementById('search-action');
    this.networkParentAction = document.getElementById('network-parent-action');
    this.toolsAction = document.getElementById('tools-action');
    this.layersContent = document.getElementById('layers-content');
    this.ospContent = document.getElementById('osp-content');
    this.powerOutagesContent = document.getElementById('power-outages-content');
    this.searchContent = document.getElementById('search-content');
    this.networkParentContent = document.getElementById('network-parent-content');
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
    this.ospAction?.addEventListener('click', () => this.handleActionClick('osp'));
    this.powerOutagesAction?.addEventListener('click', () => this.handleActionClick('power-outages'));
    this.searchAction?.addEventListener('click', () => this.handleActionClick('search'));
    this.networkParentAction?.addEventListener('click', () => this.handleActionClick('network-parent'));
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
      case 'osp': return this.ospAction;
      case 'power-outages': return this.powerOutagesAction;
      case 'search': return this.searchAction;
      case 'network-parent': return this.networkParentAction;
      case 'tools': return this.toolsAction;
      default: return null;
    }
  }

  showPanel(panelName) {
    // Hide all panels using both hidden attribute AND display style for reliability
    this.layersContent.hidden = true;
    this.layersContent.style.display = 'none';
    this.ospContent.hidden = true;
    this.ospContent.style.display = 'none';
    this.powerOutagesContent.hidden = true;
    this.powerOutagesContent.style.display = 'none';
    this.searchContent.hidden = true;
    this.searchContent.style.display = 'none';
    this.networkParentContent.hidden = true;
    this.networkParentContent.style.display = 'none';
    this.toolsContent.hidden = true;
    this.toolsContent.style.display = 'none';

    // Remove active state from all actions
    this.layersAction.active = false;
    this.ospAction.active = false;
    this.powerOutagesAction.active = false;
    this.searchAction.active = false;
    this.networkParentAction.active = false;
    this.toolsAction.active = false;

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
    this.setupMobileSearchDialogListeners();
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
      // Clear cache to ensure fresh data
      subscriberDataService.clearCache();

      await this.updateDashboard();
      // Simulate brief loading for user feedback
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      log.error('Error refreshing dashboard:', error);
    } finally {
      // Remove loading state
      if (this.refreshButton) {
        this.refreshButton.removeAttribute('loading');
      }
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
class Application {
  constructor() {
    this.services = {};
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
    // Initialize subscriber layers first
    await this.initializeSubscriberLayers();

    // Initialize infrastructure layers
    await this.initializeInfrastructureLayers();

    // Initialize radar layer
    await this.initializeRadarLayer();

    // Update dashboard after layers are loaded
    await this.services.dashboard.updateDashboard();

    // Set up layer toggle handlers
    this.setupLayerToggleHandlers();

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
  }

  async initializeSubscriberLayers() {
    try {
      // Create offline subscribers layer (visible by default - Phase 1 focus)
      const offlineConfig = getLayerConfig('offlineSubscribers');
      if (offlineConfig) {
        const offlineLayer = await this.createLayerFromConfig(offlineConfig);
        if (offlineLayer) {
          this.services.mapController.addLayer(offlineLayer, offlineConfig.zOrder);
        }
      }

      // Create online subscribers layer (hidden by default)
      const onlineConfig = getLayerConfig('onlineSubscribers');
      if (onlineConfig) {
        const onlineLayer = await this.createLayerFromConfig(onlineConfig);
        if (onlineLayer) {
          onlineLayer.visible = false; // Hidden by default per Phase 1 requirements
          this.services.mapController.addLayer(onlineLayer, onlineConfig.zOrder);
        }
      }

      // Create power outage layers
      await this.initializePowerOutageLayers();

    } catch (error) {
      log.error('Failed to initialize subscriber layers:', error);
    }
  }

  async initializePowerOutageLayers() {
    try {
      // Create APCo power outages layer
      const apcoConfig = getLayerConfig('apcoOutages');
      if (apcoConfig) {
        const apcoLayer = await this.createLayerFromConfig(apcoConfig);
        if (apcoLayer) {
          apcoLayer.visible = apcoConfig.visible; // Use config default (true)
          this.services.mapController.addLayer(apcoLayer, apcoConfig.zOrder);

          // Force layer refresh after a brief delay to ensure proper rendering
          setTimeout(() => {
            if (apcoLayer.visible && typeof apcoLayer.refresh === 'function') {
              apcoLayer.refresh();
              log.info('🔄 APCo layer refreshed for initial rendering');
            }
          }, 1000);

          log.info('✅ APCo power outages layer initialized');
        }
      }

      // Create Tombigbee power outages layer
      const tombigbeeConfig = getLayerConfig('tombigbeeOutages');
      if (tombigbeeConfig) {
        const tombigbeeLayer = await this.createLayerFromConfig(tombigbeeConfig);
        if (tombigbeeLayer) {
          tombigbeeLayer.visible = tombigbeeConfig.visible; // Use config default (true)
          this.services.mapController.addLayer(tombigbeeLayer, tombigbeeConfig.zOrder);

          // Force layer refresh after a brief delay to ensure proper rendering
          setTimeout(() => {
            if (tombigbeeLayer.visible && typeof tombigbeeLayer.refresh === 'function') {
              tombigbeeLayer.refresh();
              log.info('🔄 Tombigbee layer refreshed for initial rendering');
            }
          }, 1000);

          log.info('✅ Tombigbee power outages layer initialized');
        }
      }

    } catch (error) {
      log.error('Failed to initialize power outage layers:', error);
      // Continue without power outage layers if they fail to load
    }
  }

  async initializeInfrastructureLayers() {
    try {
      // Create Node Sites layer
      const nodeSitesConfig = getLayerConfig('nodeSites');
      if (nodeSitesConfig) {
        const nodeSitesLayer = await this.createLayerFromConfig(nodeSitesConfig);
        if (nodeSitesLayer) {
          nodeSitesLayer.visible = nodeSitesConfig.visible; // Use config default (false)
          this.services.mapController.addLayer(nodeSitesLayer, nodeSitesConfig.zOrder);
          log.info('✅ Node Sites layer initialized');
        }
      }

      // Initialize fiber plant layers
      await this.initializeFiberPlantLayers();

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
        'fsaBoundaries',
        'mainLineFiber',
        'mainLineOld',
        'mstTerminals',
        'mstFiber',
        'splitters',
        'closures'
      ];

      for (const layerKey of fiberPlantLayers) {
        const layerConfig = getLayerConfig(layerKey);
        if (layerConfig) {
          const layer = await this.createLayerFromConfig(layerConfig);
          if (layer) {
            layer.visible = layerConfig.visible; // Use config default (false)
            this.services.mapController.addLayer(layer, layerConfig.zOrder);
            log.info(`✅ ${layerConfig.title} layer initialized`);
          }
        }
      }

      log.info('🔌 Fiber plant layers initialization complete');
    } catch (error) {
      log.error('Failed to initialize fiber plant layers:', error);
      // Continue without fiber plant layers if they fail to load
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

  async createLayerFromConfig(config) {
    try {
      const data = await config.dataServiceMethod();
      
      if (!data) {
        log.warn(`No data returned for layer: ${config.id}`);
        return null;
      }
      
      // For power outages and subscribers, data comes wrapped with features property
      const dataSource = data.features ? { features: data.features } : data;

      return await this.services.layerManager.createLayer({
        ...config,
        dataSource: dataSource
      });
    } catch (error) {
      log.error(`Failed to create layer ${config.id}:`, error);
      return null;
    }
  }

  setupLayerToggleHandlers() {
    // Desktop layer toggles (checkboxes) - layers, osp, network-parent, and tools panels
    const checkboxes = document.querySelectorAll('#layers-content calcite-checkbox, #osp-content calcite-checkbox, #network-parent-content calcite-checkbox, #tools-content calcite-checkbox');
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
      'Closures': 'closures'
    };

    return mapping[labelText] || null;
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
      'closures': 'Closures'
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

    // Sync desktop checkboxes (layers, osp, network-parent, and tools panels)
    const desktopCheckboxes = document.querySelectorAll('#layers-content calcite-checkbox, #osp-content calcite-checkbox, #network-parent-content calcite-checkbox, #tools-content calcite-checkbox');
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
  startSubscriberPolling() {
    log.info('🔄 Starting subscriber data polling');
    
    // Store previous counts for comparison
    let previousOfflineCount = null;
    let previousOnlineCount = null;
    
    // Polling callback for subscriber updates
    const handleSubscriberUpdate = async (data) => {
      try {
        if (data.offline && data.online) {
          // Get current counts
          const currentOfflineCount = data.offline.count || 0;
          const currentOnlineCount = data.online.count || 0;
          
          // Handle both offline and online updates
          const offlineLayer = this.services.layerManager.getLayer('offline-subscribers');
          const onlineLayer = this.services.layerManager.getLayer('online-subscribers');
          
          if (offlineLayer && data.offline) {
            await this.services.layerManager.updateLayerData('offline-subscribers', data.offline);
            log.info(`📊 Updated offline subscribers: ${data.offline.count} records`);
          }
          
          if (onlineLayer && data.online) {
            await this.services.layerManager.updateLayerData('online-subscribers', data.online);
            log.info(`📊 Updated online subscribers: ${data.online.count} records`);
          }
          
          // Update dashboard counts
          await this.services.dashboard.updateDashboard();
          
          // Show toast if counts have changed (and not first load)
          if (previousOfflineCount !== null && previousOnlineCount !== null) {
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
          // Clear cache and perform immediate update
          subscriberDataService.clearCache();
          await this.pollingManager.performUpdate('subscribers');
        } finally {
          refreshButton.removeAttribute('loading');
        }
      });
    }
    
    // Test button for subscriber updates in development
    const testSubscriberButton = document.getElementById('test-subscriber-update');
    if (testSubscriberButton && isDevelopment) {
      // Show test button in development
      testSubscriberButton.style.display = 'block';
      
      testSubscriberButton.addEventListener('click', () => {
        log.info('🧪 Testing subscriber update toast');
        
        // Simulate subscriber count changes
        const prevOffline = Math.floor(Math.random() * 300) + 200; // 200-500
        const currOffline = prevOffline + Math.floor(Math.random() * 20) - 10; // -10 to +10 change
        const prevOnline = Math.floor(Math.random() * 20000) + 20000; // 20000-40000
        const currOnline = prevOnline - (currOffline - prevOffline); // Inverse relationship
        
        this.showSubscriberUpdateToast(
          prevOffline, 
          Math.max(0, currOffline), 
          prevOnline, 
          Math.max(0, currOnline)
        );
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
          // Handle both APCo and Tombigbee updates
          const apcoLayer = this.services.layerManager.getLayer('apco-outages');
          const tombigbeeLayer = this.services.layerManager.getLayer('tombigbee-outages');
          
          if (apcoLayer && data.apco) {
            await this.services.layerManager.updateLayerData('apco-outages', data.apco);
            log.info(`⚡ Updated APCo outages: ${data.apco.count} outages`);
          }
          
          if (tombigbeeLayer && data.tombigbee) {
            await this.services.layerManager.updateLayerData('tombigbee-outages', data.tombigbee);
            log.info(`⚡ Updated Tombigbee outages: ${data.tombigbee.count} outages`);
          }
          
          // Update power outage stats component if it exists
          const powerStats = document.querySelector('power-outage-stats');
          if (powerStats && typeof powerStats.updateStats === 'function') {
            powerStats.updateStats();
          }
        }
      } catch (error) {
        log.error('Failed to handle power outage update:', error);
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
          // Clear cache for power outage data
          subscriberDataService.refreshData('outages');
          await this.pollingManager.performUpdate('power-outages');
        } finally {
          refreshPowerButton.removeAttribute('loading');
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

  // Show toast notification for subscriber updates
  showSubscriberUpdateToast(prevOffline, currOffline, prevOnline, currOnline) {
    // Remove any existing subscriber toast
    const existingToast = document.querySelector('#subscriber-update-toast');
    if (existingToast) {
      existingToast.remove();
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
    
    // Determine toast type based on changes
    let kind = 'info';
    if (offlineChange > 0) {
      kind = 'warning'; // More offline is concerning
    } else if (offlineChange < 0) {
      kind = 'success'; // Less offline is good
    }
    
    // Create toast
    const toast = document.createElement('calcite-toast');
    toast.id = 'subscriber-update-toast';
    toast.setAttribute('open', '');
    toast.setAttribute('kind', kind);
    toast.setAttribute('placement', 'top');
    toast.setAttribute('duration', 'medium');
    
    toast.innerHTML = `
      <div slot="title">Subscriber Update</div>
      <div slot="message">${message}</div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.remove();
      }
    }, 5000);
  }
  
  // Stop polling (for cleanup)
  stopPolling() {
    log.info('⏹️ Stopping all polling');
    this.pollingManager.stopAll();
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
          registration.update();
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
});


