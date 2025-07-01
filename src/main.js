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
setAssetPath(assetsPath);

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
    const timeString = this.lastUpdated.toLocaleTimeString();
    log.info(`📅 Last updated: ${timeString}`);
  }

  async updateDashboard() {
    log.info('📊 Updating dashboard metrics...');

    try {
      // Import data service dynamically to avoid circular imports
      const { subscriberDataService } = await import('./dataService.js');

      // Get subscriber summary with offline count
      const summary = await subscriberDataService.getSubscribersSummary();

      // Update the offline count display
      this.updateOfflineCount(summary.offline || 0);

      log.info(`📊 Dashboard updated: ${summary.offline} offline subscribers`);

    } catch (error) {
      log.error('❌ Failed to update dashboard:', error);
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

      log.info(`📊 Updated offline count: ${count}`);
    }
  }

  async refreshDashboard() {
    log.info('🔄 Refreshing dashboard...');

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

      log.info('✅ Dashboard refreshed successfully');
    } catch (error) {
      log.error('❌ Error refreshing dashboard:', error);
    } finally {
      // Remove loading state
      if (this.refreshButton) {
        this.refreshButton.removeAttribute('loading');
      }
    }
  }
}

// Header Search Manager - Single Responsibility Principle
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
        <calcite-action slot="actions-end" icon="arrow-right"></calcite-action>
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
      log.error(`${source} search failed:`, error);
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
      item.setAttribute('value', result.id);

      // Use text-label for the customer name only
      item.setAttribute('text-label', this.formatSearchResultLabel(result));

      // Use description for all the details
      item.setAttribute('description', this.formatEnhancedDescription(result));

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
    return result.customer_name || 'Unnamed Customer';
  }

  formatSearchResultDescription(result) {
    const parts = [];
    if (result.customer_number) parts.push(`#${result.customer_number}`);
    if (result.address) parts.push(result.address);
    if (result.city) parts.push(result.city);
    return parts.join(' • ');
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
    const parts = [];

    if (result.customer_name) {
      parts.push(result.customer_name);
    }

    if (result.customer_number) {
      parts.push(result.customer_number);
    }

    const address = this.formatFullAddress(result);
    if (address !== 'No address available') {
      parts.push(address);
    }

    return parts.join(' • ');
  }

  handleSearchSelection(selectedItem) {
    const resultData = selectedItem._resultData;

    if (resultData) {
      log.info('🎯 Selected search result:', resultData);

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

    log.info('📍 Positioned at:', result.customer_name);

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
      log.error('Error finding layer feature:', error);
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
      log.error('Customer number query failed:', error);
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
    item.setAttribute('value', '');
    item.setAttribute('text-label', 'No results found');
    item.setAttribute('description', `No subscribers found for "${searchTerm}"`);
    item.innerHTML = `<calcite-icon slot="icon" icon="information"></calcite-icon>`;
    item.disabled = true;
    targetInput.appendChild(item);
  }

  showSearchError(targetInput) {
    const item = document.createElement('calcite-autocomplete-item');
    item.setAttribute('value', '');
    item.setAttribute('text-label', 'Search Error');
    item.setAttribute('description', 'Unable to perform search. Please try again.');
    item.innerHTML = `<calcite-icon slot="icon" icon="exclamation-mark-triangle"></calcite-icon>`;
    item.disabled = true;
    targetInput.appendChild(item);
  }

  setSearchLoading(loading, targetInput) {
    if (loading) {
      const item = document.createElement('calcite-autocomplete-item');
      item.setAttribute('value', '');
      item.setAttribute('text-label', 'Searching...');
      item.setAttribute('description', 'Please wait while we search for subscribers');
      item.innerHTML = `<calcite-icon slot="icon" icon="loading"></calcite-icon>`;
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

    // If search field is completely cleared, clear everything
    if (!searchTerm || searchTerm.trim() === '') {
      this.clearEverything('mobile');
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
    const resultsContainer = document.querySelector('#mobile-search-sheet .recent-searches-list') ||
      this.createMobileResultsContainer();

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
        <calcite-action slot="actions-end" icon="arrow-right"></calcite-action>
      `;

      // Store result data and add click handler
      listItem._resultData = result;
      listItem.addEventListener('click', () => {
        this.handleMobileSearchSelection(result);
      });

      resultsContainer.appendChild(listItem);
    });
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
    const resultsContainer = document.querySelector('#mobile-search-sheet .recent-searches-list');
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
        log.error('Mobile Enter key search failed:', error);
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

      // Find the right place to insert it
      const content = searchSheet.querySelector('[slot="content"]');
      if (content) {
        // Insert after the search input block
        const searchBlock = content.querySelector('calcite-block');
        if (searchBlock && searchBlock.nextSibling) {
          content.insertBefore(resultsBlock, searchBlock.nextSibling);
        } else {
          content.appendChild(resultsBlock);
        }
      }
    }

    // Create or get the list
    let resultsList = resultsBlock.querySelector('calcite-list');
    if (!resultsList) {
      resultsList = document.createElement('calcite-list');
      resultsList.className = 'recent-searches-list';
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
    const resultsContainer = document.querySelector('#mobile-search-sheet .recent-searches-list');
    if (resultsContainer) {
      resultsContainer.innerHTML = '';
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

    // Initialize all services
    await this.services.dashboard.init();
    await this.services.headerSearch.init();
    await this.services.mobileTabBar.init();

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

    // Store app instance globally for cross-component access
    window.app = this;

    log.info('✅ Application initialized successfully');
  }

  async onMapReady() {
    log.info('🗺️ Map ready, initializing layers and features...');

    // Initialize subscriber layers first
    await this.initializeSubscriberLayers();

    // Update dashboard after layers are loaded
    await this.services.dashboard.updateDashboard();

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


