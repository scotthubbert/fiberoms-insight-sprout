// ArcGIS themes are loaded via HTML link tags for proper switching

// Configure ArcGIS intl
import * as intl from '@arcgis/core/intl';
intl.setLocale('en');

// Import data service
import { subscriberDataService } from './dataService.js';

// Import ArcGIS modules for Feature Layers
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import PopupTemplate from '@arcgis/core/PopupTemplate';

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

// Import Calcite components
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
import '@esri/calcite-components/dist/components/calcite-input-text';
import '@esri/calcite-components/dist/components/calcite-navigation';
import '@esri/calcite-components/dist/components/calcite-navigation-logo';
import '@esri/calcite-components/dist/components/calcite-sheet';
import '@esri/calcite-components/dist/components/calcite-fab';
import '@esri/calcite-components/dist/components/calcite-icon';
import '@esri/calcite-components/dist/components/calcite-segmented-control';
import '@esri/calcite-components/dist/components/calcite-segmented-control-item';
import '@esri/calcite-components/dist/components/calcite-list';
import '@esri/calcite-components/dist/components/calcite-list-item';
import '@esri/calcite-components/dist/components/calcite-switch';
import '@esri/calcite-components/dist/components/calcite-dialog';
import '@esri/calcite-components/dist/components/calcite-chip';
import '@esri/calcite-components/dist/components/calcite-autocomplete';
import '@esri/calcite-components/dist/components/calcite-autocomplete-item';
import { setAssetPath } from '@esri/calcite-components/dist/components';

// Set Calcite assets path to NPM bundled assets
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

// Theme management with system preference support
class ThemeManager {
  constructor() {
    // Check if user has manually set a theme preference
    this.userPreference = localStorage.getItem('theme');
    this.hasUserPreference = this.userPreference !== null;

    // Determine current theme: user preference or system preference
    this.currentTheme = this.hasUserPreference ? this.userPreference : this.getSystemPreference();

    this.init();
  }

  getSystemPreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  async init() {
    // Wait for calcite components to be defined
    await customElements.whenDefined('calcite-button');

    this.themeToggle = document.getElementById('theme-toggle');

    if (this.themeToggle) {
      // Apply current theme
      this.applyTheme(this.currentTheme);

      // Setup theme toggle
      this.themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });

      // Listen for system theme changes
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
          if (!this.hasUserPreference) {
            // Only auto-switch if user hasn't manually set a preference
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

    // Update Calcite theme
    document.body.classList.toggle('calcite-mode-dark', isDark);

    // Toggle ArcGIS theme stylesheets (official Esri pattern)
    const lightStylesheet = document.getElementById('esri-theme-light');
    const darkStylesheet = document.getElementById('esri-theme-dark');

    if (lightStylesheet && darkStylesheet) {
      lightStylesheet.disabled = isDark;
      darkStylesheet.disabled = !isDark;
    }

    // Update ArcGIS map components theme attributes
    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.setAttribute('theme', theme);

      // Update basemap to theme-appropriate one
      const themeBasemaps = BASEMAP_CONFIG[theme];
      mapElement.setAttribute('basemap', themeBasemaps.primary);

      // Update basemap toggle next basemap
      const basemapToggle = mapElement.querySelector('arcgis-basemap-toggle');
      if (basemapToggle) {
        basemapToggle.setAttribute('next-basemap', themeBasemaps.alternate);
      }


      // Update individual widgets
      const widgets = mapElement.querySelectorAll('arcgis-search, arcgis-zoom, arcgis-home, arcgis-locate, arcgis-basemap-toggle, arcgis-basemap-gallery, arcgis-expand, arcgis-track, arcgis-fullscreen');
      widgets.forEach(widget => {
        widget.setAttribute('theme', theme);
      });

      // Apply theme to underlying Esri widgets (search, popups, etc.)
      setTimeout(() => {
        const esriElements = document.querySelectorAll('.esri-widget, .esri-search, .esri-popup, .esri-ui, .esri-view-surface');
        esriElements.forEach(element => {
          if (isDark) {
            element.classList.add('calcite-mode-dark');
            element.classList.remove('calcite-mode-light');
          } else {
            element.classList.add('calcite-mode-light');
            element.classList.remove('calcite-mode-dark');
          }
        });
      }, 100);
    }

    // Apply theme to map view and widgets if available
    if (window.mapView) {
      this.applyThemeToView(window.mapView);
    }

    // Apply theme to map widgets if available
    if (window.mapApp) {
      window.mapApp.applyThemeToWidgets(theme);
    }


  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.currentTheme);

    // Save user preference and mark that user has made a manual choice
    localStorage.setItem('theme', this.currentTheme);
    this.userPreference = this.currentTheme;
    this.hasUserPreference = true;

  }

  updateToggleIcon(theme) {
    // Use Calcite icons: moon for switching to dark, brightness for switching to light
    const icon = theme === 'dark' ? 'brightness' : 'moon';
    const baseLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
    const statusLabel = this.hasUserPreference ? ' (manual)' : ' (following system)';
    const label = baseLabel + statusLabel;

    this.themeToggle.setAttribute('icon-start', icon);
    this.themeToggle.setAttribute('aria-label', baseLabel);
    this.themeToggle.setAttribute('title', label);
  }

  // Method to reset theme preference back to system tracking
  resetToSystemPreference() {
    localStorage.removeItem('theme');
    this.userPreference = null;
    this.hasUserPreference = false;
    this.currentTheme = this.getSystemPreference();
    this.applyTheme(this.currentTheme);
  }

  // Apply theme to map view (for popups and other view-level UI)
  applyThemeToView(view) {
    if (!view) return;

    const isDark = this.currentTheme === 'dark';

    // Apply theme to view container
    if (view.container) {
      if (isDark) {
        view.container.classList.add('calcite-mode-dark');
        view.container.classList.remove('calcite-mode-light');
      } else {
        view.container.classList.add('calcite-mode-light');
        view.container.classList.remove('calcite-mode-dark');
      }
    }

    // Apply theme to popup if it exists
    if (view.popup) {
      const popupContainer = view.popup.container;
      if (popupContainer) {
        if (isDark) {
          popupContainer.classList.add('calcite-mode-dark');
          popupContainer.classList.remove('calcite-mode-light');
        } else {
          popupContainer.classList.add('calcite-mode-light');
          popupContainer.classList.remove('calcite-mode-dark');
        }
      }
    }

  }
}

// Layer panel management using Calcite Shell Panel
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
    // Wait for calcite components to be defined
    await customElements.whenDefined('calcite-shell-panel');
    await customElements.whenDefined('calcite-action');
    await customElements.whenDefined('calcite-panel');

    this.setupActionBarNavigation();
  }

  setupActionBarNavigation() {
    // CalciteUI actions use standard click events
    this.layersAction?.addEventListener('click', () => this.handleActionClick('layers'));
    this.searchAction?.addEventListener('click', () => this.handleActionClick('search'));
    this.toolsAction?.addEventListener('click', () => this.handleActionClick('tools'));
  }

  handleActionClick(panelName) {
    const clickedAction = this.getActionByPanel(panelName);

    // If clicking the same active action and panel is open, collapse it
    if (clickedAction?.active && !this.shellPanel?.collapsed) {
      this.shellPanel.collapsed = true;
      return;
    }

    // Otherwise, expand panel (if collapsed) and show the selected panel
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

// Map initialization 
class MapApp {
  constructor() {
    this.mapElement = document.getElementById('map');
    this.layers = {
      onlineSubscribers: null,
      offlineSubscribers: null
    };
    this.layerVisibility = {
      onlineSubscribers: false, // Off by default
      offlineSubscribers: true
    };

    // Layer z-order configuration (higher number = on top)
    // This makes it easy to manage layer stacking order
    this.layerZOrder = {
      // Base layers (bottom)
      onlineSubscribers: 0,

      // Infrastructure layers (middle)
      fsaBoundaries: 10,
      mainLineFiber: 20,
      dropFiber: 30,
      mstTerminals: 40,
      splitters: 50,

      // Critical/focus layers (top)
      offlineSubscribers: 100,
      powerOutages: 110,
      fiberOutages: 120,
      vehicles: 130,
      weatherRadar: 140
    };

    // Polling configuration
    this.pollingIntervals = {
      offlineSubscribers: 30000,  // 30 seconds for critical offline data
      onlineSubscribers: 300000,  // 5 minutes for online data
      vehicles: 10000,            // 10 seconds for real-time vehicle tracking
      outages: 60000              // 1 minute for outage data
    };

    this.pollingTimers = {};
    this.init();

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  // Cleanup method to stop all polling
  cleanup() {
    log.info('🧹 Cleaning up polling timers...');
    Object.keys(this.pollingTimers).forEach(layerName => {
      this.stopPolling(layerName);
    });
  }

  async init() {
    log.info('🗺️ MapApp init started...');

    // Wait for custom elements to be defined
    await customElements.whenDefined('arcgis-map');
    log.info('🗺️ arcgis-map custom element defined');

    // Listen for when the view is ready
    this.mapElement.addEventListener('arcgisViewReadyChange', (event) => {
      log.info('🗺️ arcgisViewReadyChange event received, target:', event.target);
      if (event.target.ready) {
        this.onMapReady(event.target);
      }
    });

    // Also check if ready property exists
    if (this.mapElement.ready) {
      log.info('🗺️ Map element already ready, initializing...');
      this.onMapReady(this.mapElement);
    } else {
      log.info('🗺️ Map element not ready yet, waiting for event...');
    }
  }

  onMapReady(mapElement) {
    log.info('🗺️ onMapReady called with mapElement:', mapElement);

    // Get the view from the map element
    const view = mapElement.view || mapElement;

    if (!view || !view.map) {
      log.warn('⚠️ View or map is not available');
      return;
    }

    // Store view reference
    this.view = view;
    this.map = view.map;

    // Store view reference globally for theme management
    window.mapView = view;

    // Configure view constraints for smoother zooming
    view.constraints = {
      snapToZoom: false  // Allow smooth zoom instead of snapping to discrete levels
    };

    // Apply current theme to the view
    if (window.themeManager) {
      window.themeManager.applyThemeToView(view);
    }

    // Map and view are ready for use
    log.info('✅ Map ready, initializing subscriber layers...');
    log.info('📍 Map center:', view.center);
    log.info('🔍 Map zoom:', view.zoom);

    // Initialize subscriber layers after map is ready
    this.initializeSubscriberLayers();

    // Set up popup action handlers
    this.setupPopupActions();
  }

  // Set up popup action handlers
  setupPopupActions() {

    // For ArcGIS Map Components, we need to handle popup actions differently
    // We'll use a delegated event listener on the document
    document.addEventListener('click', (e) => {
      // Check if clicked element is a calcite-action in a popup
      const calciteAction = e.target.closest('calcite-action');
      if (!calciteAction) return;

      // Make sure it's inside a popup
      const popup = calciteAction.closest('.esri-popup, arcgis-popup');
      if (!popup) return;

      // Check if it's our copy button by data-action-id
      const actionId = calciteAction.getAttribute('data-action-id');

      if (actionId === 'copy-info') {
        e.preventDefault();
        e.stopPropagation();
        // Use a small delay to ensure popup content is fully rendered
        setTimeout(() => {
          this.handleCopyAction(calciteAction);
        }, 100);
      }
    }, true); // Use capture phase to catch event before ArcGIS handles it

  }

  // Handle the copy action
  async handleCopyAction(buttonElement) {
    try {
      // Get the popup element - try multiple selectors
      let popup = document.querySelector('.esri-popup--is-visible');
      if (!popup) {
        popup = document.querySelector('.esri-popup[aria-hidden="false"]');
      }
      if (!popup) {
        popup = document.querySelector('.esri-popup');
      }

      if (!popup) {
        log.warn('No popup found');
        return;
      }

      // Extract all the information from the popup
      const copyData = this.extractPopupData(popup);

      if (copyData) {
        const success = await this.copyToClipboard(copyData);

        if (success) {
          // Change button to show success
          this.updateCopyButton(buttonElement, 'success');
        } else {
          // Change button to show error
          this.updateCopyButton(buttonElement, 'error');
        }
      }
    } catch (err) {
      console.error('Error handling copy action:', err);
      this.updateCopyButton(buttonElement, 'error');
    }
  }

  // Update the copy button to show feedback
  updateCopyButton(button, state) {
    if (!button) return;

    // Store original values
    const originalText = button.getAttribute('text') || 'Copy info';
    const originalIcon = button.getAttribute('icon');
    const originalAppearance = button.getAttribute('appearance') || 'solid';

    if (state === 'success') {
      // Update to success state with blue color (default ArcGIS style)
      button.setAttribute('text', 'Copied!');
      button.setAttribute('icon', 'check');
      button.setAttribute('appearance', 'solid');
      button.setAttribute('kind', 'brand'); // Use 'brand' for blue color instead of 'success' for green

    } else {
      // Update to error state
      button.setAttribute('text', 'Copy failed');
      button.setAttribute('icon', 'exclamation-mark-triangle');
      button.setAttribute('appearance', 'solid');
      button.setAttribute('kind', 'danger');
    }

    // Reset after 2 seconds
    setTimeout(() => {
      button.setAttribute('text', originalText);
      if (originalIcon) {
        button.setAttribute('icon', originalIcon);
      } else {
        button.removeAttribute('icon');
      }
      button.removeAttribute('kind');
      button.setAttribute('appearance', originalAppearance);
    }, 2000);
  }

  // Extract data from popup DOM
  extractPopupData(popup) {
    const data = [];

    // Try to get customer name from multiple sources
    let customerName = popup.querySelector('.esri-popup__header-title')?.textContent?.trim();
    if (!customerName) {
      // Try the main header text
      customerName = popup.querySelector('.esri-popup__header-container h1')?.textContent?.trim();
    }
    if (!customerName) {
      // Try the aria-label as fallback
      customerName = popup.getAttribute('aria-label');
    }

    if (customerName) {
      data.push(`Customer: ${customerName}`);
    }

    // Get status from custom element
    const statusEl = popup.querySelector('.popup-status-indicator');
    if (statusEl) {
      const status = statusEl.textContent?.trim();
      if (status) data.push(`Status: ${status}`);
    }

    // Look for the actual content inside the popup
    const contentArea = popup.querySelector('.esri-features__content-feature, .esri-popup__content');

    if (contentArea) {
      // Parse the full text content to extract fields
      const allText = contentArea.textContent || contentArea.innerText;

      if (allText) {
        // The text appears to be in format: LABELVALUELABELVALUEetc
        // Known field labels to look for
        const fieldLabels = [
          'Account',
          'Full Address',
          'Service Type',
          'Plan',
          'TA5K',
          'Remote ID',
          'ONT',
          'Electric Available',
          'Fiber Distance',
          'Light Level'
        ];

        let workingText = allText;

        // Remove the customer name and status from the beginning
        if (customerName) {
          workingText = workingText.replace(customerName, '');
        }
        workingText = workingText.replace(/^(OFFLINE|ONLINE)\s*/i, '');

        // Extract each field
        fieldLabels.forEach((label, index) => {
          const nextLabel = fieldLabels[index + 1];
          const labelIndex = workingText.indexOf(label);

          if (labelIndex !== -1) {
            let value;
            if (nextLabel) {
              const nextLabelIndex = workingText.indexOf(nextLabel, labelIndex + label.length);
              if (nextLabelIndex !== -1) {
                value = workingText.substring(labelIndex + label.length, nextLabelIndex).trim();
              } else {
                // This is not the last label but next label not found
                // Try to extract a reasonable amount of text
                value = workingText.substring(labelIndex + label.length, labelIndex + label.length + 100).trim();
              }
            } else {
              // Last label - take everything after it
              value = workingText.substring(labelIndex + label.length).trim();
              // Remove the status badge text if present
              value = value.replace(/Service (Offline|Online)Last Update:.*$/i, '').trim();
            }

            if (value && !data.some(item => item.startsWith(label + ':'))) {
              data.push(`${label}: ${value}`);
            }
          }
        });
      }
    }

    // Get status badge info (Last Update)
    const statusBadge = popup.querySelector('.popup-status-badge');
    if (statusBadge) {
      const lastUpdateText = statusBadge.textContent?.replace(/\s+/g, ' ').trim();
      if (lastUpdateText && !data.some(line => line.includes('Last Update'))) {
        data.push(''); // Add blank line
        data.push(lastUpdateText);
      }
    }

    // Get coordinates from the selected feature
    if (this.view && this.view.popup) {
      const feature = this.view.popup.selectedFeature || this.view.popup.features?.[0];
      if (feature && feature.geometry) {
        const lat = feature.geometry.latitude;
        const lng = feature.geometry.longitude;

        if (lat && lng) {
          data.push(''); // Add blank line
          data.push(`Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

          // Add Google Maps link for mobile devices
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          data.push(`Maps: ${mapsUrl}`);
        }
      }
    }

    return data.length > 0 ? data.join('\n') : null;
  }

  // Modern clipboard API with fallback
  async copyToClipboard(text) {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.log('Modern clipboard API failed, using fallback');
    }

    // Fallback method
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      document.body.removeChild(textArea);
      return false;
    }
  }





  // Initialize subscriber layers and load data
  async initializeSubscriberLayers() {
    try {
      console.log('🏗️ Initializing subscriber layers...');

      // Set up layer toggle handlers first
      this.setupLayerToggleHandlers();

      // Load the data and create layers
      await this.loadSubscriberData();

      // Start polling for offline subscribers (always visible by default)
      this.startPolling('offlineSubscribers');

      console.log('✅ Subscriber layers initialized and ready');

    } catch (error) {
      console.error('❌ Failed to initialize subscriber layers:', error);
    }
  }

  // Start polling for a specific layer
  startPolling(layerName) {
    // Don't start if already polling
    if (this.pollingTimers[layerName]) return;

    const interval = this.pollingIntervals[layerName];
    if (!interval) return;

    console.log(`🔄 Starting polling for ${layerName} every ${interval / 1000} seconds`);

    this.pollingTimers[layerName] = setInterval(async () => {
      if (this.layerVisibility[layerName]) {
        console.log(`🔄 Polling update for ${layerName}`);
        await this.updateLayerData(layerName);
      }
    }, interval);
  }

  // Stop polling for a specific layer
  stopPolling(layerName) {
    if (this.pollingTimers[layerName]) {
      clearInterval(this.pollingTimers[layerName]);
      delete this.pollingTimers[layerName];
      console.log(`⏹️ Stopped polling for ${layerName}`);
    }
  }

  // Update layer data without recreating the entire layer
  async updateLayerData(layerName) {
    try {
      if (layerName === 'offlineSubscribers') {
        await this.updateOfflineSubscribers();
      } else if (layerName === 'onlineSubscribers') {
        await this.updateOnlineSubscribers();
      }
    } catch (error) {
      console.error(`❌ Failed to update ${layerName}:`, error);
    }
  }

  // Helper method to add layer with proper z-ordering
  addLayerWithOrder(layer, layerKey) {
    if (!layer || !this.map) return;

    // Get the z-order for this layer
    const zOrder = this.layerZOrder[layerKey];

    if (zOrder !== undefined) {
      // Find the correct position to insert the layer
      const layers = this.map.layers.toArray();
      let insertIndex = 0;

      // Find where to insert based on z-order
      for (let i = 0; i < layers.length; i++) {
        const existingLayerKey = Object.keys(this.layers).find(key => this.layers[key] === layers[i]);
        const existingZOrder = existingLayerKey ? this.layerZOrder[existingLayerKey] : -1;

        if (existingZOrder < zOrder) {
          insertIndex = i + 1;
        } else {
          break;
        }
      }

      this.map.add(layer, insertIndex);
      console.log(`📍 Added ${layerKey} layer at index ${insertIndex} (z-order: ${zOrder})`);
    } else {
      // No z-order defined, add to top
      this.map.add(layer);
      console.log(`📍 Added ${layerKey} layer to top (no z-order defined)`);
    }
  }

  // Create offline subscribers feature layer
  async createOfflineSubscribersLayer() {
    // Use GeoJSONLayer instead of FeatureLayer for better client-side feature handling
    const layer = new GeoJSONLayer({
      id: 'offline-subscribers',
      title: 'Offline Subscribers',
      copyright: 'FiberOMS',
      source: {
        type: 'FeatureCollection',
        features: []
      }, // Start with empty feature collection
      renderer: this.createOfflineRenderer(),
      popupTemplate: this.createSubscriberPopupTemplate('offline'),
      visible: this.layerVisibility.offlineSubscribers,
      minScale: 0,
      maxScale: 0,
      featureReduction: {
        type: 'cluster',
        clusterRadius: '80px',
        clusterMinSize: '28px',
        clusterMaxSize: '80px',
        clusterMaxScale: 50000,
        symbol: {
          type: 'simple-marker',
          style: 'circle',
          color: [255, 0, 0, 0.9],
          outline: {
            color: [255, 255, 255, 1],
            width: 3
          }
        },
        popupTemplate: {
          title: 'Cluster of {cluster_count} offline devices',
          content: 'Zoom in to see individual offline subscribers.',
          fieldInfos: [{
            fieldName: 'cluster_count',
            format: {
              digitSeparator: true
            }
          }]
        },
        labelingInfo: [{
          deconflictionStrategy: 'none',
          labelExpressionInfo: {
            expression: 'Text($feature.cluster_count, "#,###")'
          },
          symbol: {
            type: 'text',
            color: 'white',
            font: {
              weight: 'bold',
              family: 'Noto Sans',
              size: '12px'
            }
          },
          labelPlacement: 'center-center'
        }]
      }
    });

    return layer;
  }

  // Create online subscribers feature layer
  async createOnlineSubscribersLayer() {
    const layer = new GeoJSONLayer({
      id: 'online-subscribers',
      title: 'Online Subscribers',
      copyright: 'FiberOMS',
      source: {
        type: 'FeatureCollection',
        features: []
      }, // Start with empty feature collection
      renderer: this.createOnlineRenderer(),
      popupTemplate: this.createSubscriberPopupTemplate('online'),
      visible: this.layerVisibility.onlineSubscribers,
      minScale: 0,
      maxScale: 0
    });

    return layer;
  }

  // Create renderer for offline subscribers (red circles)
  createOfflineRenderer() {
    return {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [220, 38, 38, 0.8], // Red with transparency
        size: 8,
        outline: {
          color: [220, 38, 38, 1], // Solid red outline
          width: 1
        }
      }
    };
  }

  // Create renderer for online subscribers (green circles)
  createOnlineRenderer() {
    return {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [34, 197, 94, 0.8], // Green with transparency
        size: 6,
        outline: {
          color: [34, 197, 94, 1], // Solid green outline
          width: 1
        }
      }
    };
  }

  // Create popup template for subscribers
  createSubscriberPopupTemplate(status) {
    return new PopupTemplate({
      title: '{customer_name}',
      actions: [
        {
          title: "Copy info",
          id: "copy-info",
          className: "esri-icon-duplicate"
        }
      ],
      content: [
        {
          type: 'custom',
          creator: (event) => {
            const graphic = event.graphic;
            const div = document.createElement('div');

            // Status indicator
            const statusIndicator = document.createElement('div');
            statusIndicator.className = `popup-status-indicator ${status}`;

            const statusDot = document.createElement('div');
            statusDot.className = `popup-status-dot ${status}`;

            const statusText = document.createElement('span');
            statusText.textContent = graphic.attributes.status || status.toUpperCase();

            statusIndicator.appendChild(statusDot);
            statusIndicator.appendChild(statusText);
            div.appendChild(statusIndicator);

            return div;
          }
        },
        {
          type: 'fields',
          fieldInfos: [
            { fieldName: 'customer_number', label: 'Account' },
            {
              fieldName: 'full_address', label: 'Full Address', format: {
                digitSeparator: false
              }
            },
            { fieldName: 'service_type', label: 'Service Type' },
            { fieldName: 'plan', label: 'Plan' },
            { fieldName: 'ta5k', label: 'TA5K' },
            { fieldName: 'remote_id', label: 'Remote ID' },
            { fieldName: 'ont', label: 'ONT' },
            { fieldName: 'electric_available', label: 'Electric Available' },
            { fieldName: 'fiber_distance', label: 'Fiber Distance' },
            { fieldName: 'light_level', label: 'Light Level' }
          ]
        },
        {
          type: 'custom',
          creator: (event) => {
            const div = document.createElement('div');
            const statusBadge = document.createElement('div');
            statusBadge.className = `popup-status-badge ${status}`;

            const statusTitle = document.createElement('strong');
            statusTitle.textContent = status === 'offline' ? 'Service Offline' : 'Service Online';

            const lastUpdate = document.createElement('div');
            const updateTime = event.graphic.attributes.last_update;
            if (updateTime) {
              // Format the date if it's a valid date string
              try {
                const date = new Date(updateTime);
                const formatted = date.toLocaleString('en-US', {
                  dateStyle: 'short',
                  timeStyle: 'medium'
                });
                lastUpdate.textContent = `Last Update: ${formatted}`;
              } catch {
                lastUpdate.textContent = `Last Update: ${updateTime}`;
              }
            } else {
              lastUpdate.textContent = 'Last Update: N/A';
            }

            statusBadge.appendChild(statusTitle);
            statusBadge.appendChild(lastUpdate);
            div.appendChild(statusBadge);

            return div;
          }
        }
      ]
    });
  }

  // Load data into subscriber layers
  async loadSubscriberData() {
    try {
      console.log('🗺️ Loading subscriber data into map layers...');

      // Check if layers are ready
      console.log('Layer status:')
      console.log('- Offline layer:', this.layers.offlineSubscribers ? 'Ready ✅' : 'Not ready ❌')
      console.log('- Online layer:', this.layers.onlineSubscribers ? 'Ready ✅' : 'Not ready ❌')

      // Load offline subscribers
      console.log('📊 Fetching offline subscriber data...')
      const offlineData = await subscriberDataService.getOfflineSubscribers();
      console.log('📋 Offline data received:', {
        count: offlineData.count,
        features: offlineData.features?.length || 0,
        hasError: !!offlineData.error
      })

      if (offlineData.features && this.map) {
        console.log(`🔴 Loading ${offlineData.features.length} offline subscribers to map`);

        try {
          // Remove existing layer
          if (this.layers.offlineSubscribers) {
            this.map.remove(this.layers.offlineSubscribers);
          }

          // Create new layer with data
          const featureCollection = {
            type: 'FeatureCollection',
            features: offlineData.features
          };

          // Convert GeoJSON features to ArcGIS Graphics
          const graphics = offlineData.features.map((feature, index) => {
            const point = new Point({
              longitude: feature.geometry.coordinates[0],
              latitude: feature.geometry.coordinates[1],
              spatialReference: { wkid: 4326 }
            });

            // Create full address if it doesn't exist
            const attrs = {
              ObjectID: index + 1,
              ...feature.properties
            };

            // Construct full_address if not present
            if (!attrs.full_address) {
              const parts = [
                attrs.address,
                attrs.city,
                attrs.county,
                attrs.state,
                attrs.zip
              ].filter(Boolean);
              attrs.full_address = parts.join(', ');
            }

            return new Graphic({
              geometry: point,
              attributes: attrs
            });
          });

          // Create new FeatureLayer with the graphics
          this.layers.offlineSubscribers = new FeatureLayer({
            id: 'offline-subscribers',
            title: 'Offline Subscribers',
            copyright: 'FiberOMS',
            source: graphics,
            objectIdField: 'ObjectID',
            geometryType: 'point',
            spatialReference: { wkid: 4326 },
            fields: [
              {
                name: 'ObjectID',
                alias: 'ObjectID',
                type: 'oid'
              },
              {
                name: 'customer_number',
                alias: 'Customer Number',
                type: 'string'
              },
              {
                name: 'customer_name',
                alias: 'Customer Name',
                type: 'string'
              },
              {
                name: 'address',
                alias: 'Address',
                type: 'string'
              },
              {
                name: 'city',
                alias: 'City',
                type: 'string'
              },
              {
                name: 'state',
                alias: 'State',
                type: 'string'
              },
              {
                name: 'zip',
                alias: 'ZIP',
                type: 'string'
              },
              {
                name: 'county',
                alias: 'County',
                type: 'string'
              },
              {
                name: 'phone_number',
                alias: 'Phone Number',
                type: 'string'
              },
              {
                name: 'status',
                alias: 'Status',
                type: 'string'
              },
              {
                name: 'full_address',
                alias: 'Full Address',
                type: 'string'
              },
              {
                name: 'service_type',
                alias: 'Service Type',
                type: 'string'
              },
              {
                name: 'plan',
                alias: 'Plan',
                type: 'string'
              },
              {
                name: 'ta5k',
                alias: 'TA5K',
                type: 'string'
              },
              {
                name: 'remote_id',
                alias: 'Remote ID',
                type: 'string'
              },
              {
                name: 'ont',
                alias: 'ONT',
                type: 'string'
              },
              {
                name: 'electric_available',
                alias: 'Electric Available',
                type: 'string'
              },
              {
                name: 'fiber_distance',
                alias: 'Fiber Distance',
                type: 'string'
              },
              {
                name: 'light_level',
                alias: 'Light Level',
                type: 'string'
              },
              {
                name: 'last_update',
                alias: 'Last Update',
                type: 'string'
              }
            ],
            renderer: this.createOfflineRenderer(),
            popupTemplate: this.createSubscriberPopupTemplate('offline'),
            visible: this.layerVisibility.offlineSubscribers,
            minScale: 0,
            maxScale: 0,
            featureReduction: {
              type: 'cluster',
              clusterRadius: '80px',
              clusterMinSize: '28px',
              clusterMaxSize: '80px',
              clusterMaxScale: 50000,
              symbol: {
                type: 'simple-marker',
                style: 'circle',
                color: [255, 0, 0, 0.9],
                outline: {
                  color: [255, 255, 255, 1],
                  width: 3
                }
              },
              popupTemplate: {
                title: 'Cluster of {cluster_count} offline devices',
                content: 'Zoom in to see individual offline subscribers.',
                fieldInfos: [{
                  fieldName: 'cluster_count',
                  format: {
                    digitSeparator: true
                  }
                }]
              },
              labelingInfo: [{
                deconflictionStrategy: 'none',
                labelExpressionInfo: {
                  expression: 'Text($feature.cluster_count, "#,###")'
                },
                symbol: {
                  type: 'text',
                  color: 'white',
                  font: {
                    weight: 'bold',
                    family: 'Noto Sans',
                    size: '12px'
                  }
                },
                labelPlacement: 'center-center'
              }]
            }
          });

          // Add to map using z-order system
          this.addLayerWithOrder(this.layers.offlineSubscribers, 'offlineSubscribers');

          console.log('🔴 New offline FeatureLayer created and added to map');
          console.log('🔴 Offline layer details:', {
            id: this.layers.offlineSubscribers.id,
            visible: this.layers.offlineSubscribers.visible,
            graphicsCount: graphics.length,
            firstFeature: offlineData.features[0]
          });

          // Update dashboard with offline count
          if (window.dashboardManager) {
            window.dashboardManager.updateMetric('offline', graphics.length);
          }
        } catch (error) {
          console.error('❌ Error loading offline subscribers:', error);
        }

      } else {
        console.warn('⚠️ Cannot load offline subscribers:', {
          hasFeatures: !!offlineData.features,
          hasLayer: !!this.layers.offlineSubscribers,
          layerReady: this.layers.offlineSubscribers?.loadStatus
        })
      }

      // Skip loading online subscribers initially (will be lazy loaded when toggled on)
      console.log('⏭️ Skipping online subscribers - will be loaded on demand');
      return;

      // The code below is kept but won't execute initially
      console.log('📊 Fetching online subscriber data...')
      const onlineData = await subscriberDataService.getOnlineSubscribers();
      console.log('📋 Online data received:', {
        count: onlineData.count,
        features: onlineData.features?.length || 0,
        hasError: !!onlineData.error
      })

      if (onlineData.features && this.map) {
        console.log(`🟢 Loading ${onlineData.features.length} online subscribers to map`);

        try {
          // Remove existing layer
          if (this.layers.onlineSubscribers) {
            this.map.remove(this.layers.onlineSubscribers);
          }

          // Create new layer with data
          const featureCollection = {
            type: 'FeatureCollection',
            features: onlineData.features
          };

          // Convert GeoJSON features to ArcGIS Graphics
          const graphics = onlineData.features.map((feature, index) => {
            const point = new Point({
              longitude: feature.geometry.coordinates[0],
              latitude: feature.geometry.coordinates[1],
              spatialReference: { wkid: 4326 }
            });

            // Create full address if it doesn't exist
            const attrs = {
              ObjectID: index + 1,
              ...feature.properties
            };

            // Construct full_address if not present
            if (!attrs.full_address) {
              const parts = [
                attrs.address,
                attrs.city,
                attrs.county,
                attrs.state,
                attrs.zip
              ].filter(Boolean);
              attrs.full_address = parts.join(', ');
            }

            return new Graphic({
              geometry: point,
              attributes: attrs
            });
          });

          // Create new FeatureLayer with the graphics
          this.layers.onlineSubscribers = new FeatureLayer({
            id: 'online-subscribers',
            title: 'Online Subscribers',
            copyright: 'FiberOMS',
            source: graphics,
            objectIdField: 'ObjectID',
            geometryType: 'point',
            spatialReference: { wkid: 4326 },
            fields: [
              {
                name: 'ObjectID',
                alias: 'ObjectID',
                type: 'oid'
              },
              {
                name: 'customer_number',
                alias: 'Customer Number',
                type: 'string'
              },
              {
                name: 'customer_name',
                alias: 'Customer Name',
                type: 'string'
              },
              {
                name: 'address',
                alias: 'Address',
                type: 'string'
              },
              {
                name: 'city',
                alias: 'City',
                type: 'string'
              },
              {
                name: 'state',
                alias: 'State',
                type: 'string'
              },
              {
                name: 'zip',
                alias: 'ZIP',
                type: 'string'
              },
              {
                name: 'county',
                alias: 'County',
                type: 'string'
              },
              {
                name: 'phone_number',
                alias: 'Phone Number',
                type: 'string'
              },
              {
                name: 'status',
                alias: 'Status',
                type: 'string'
              },
              {
                name: 'full_address',
                alias: 'Full Address',
                type: 'string'
              },
              {
                name: 'service_type',
                alias: 'Service Type',
                type: 'string'
              },
              {
                name: 'plan',
                alias: 'Plan',
                type: 'string'
              },
              {
                name: 'ta5k',
                alias: 'TA5K',
                type: 'string'
              },
              {
                name: 'remote_id',
                alias: 'Remote ID',
                type: 'string'
              },
              {
                name: 'ont',
                alias: 'ONT',
                type: 'string'
              },
              {
                name: 'electric_available',
                alias: 'Electric Available',
                type: 'string'
              },
              {
                name: 'fiber_distance',
                alias: 'Fiber Distance',
                type: 'string'
              },
              {
                name: 'light_level',
                alias: 'Light Level',
                type: 'string'
              },
              {
                name: 'last_update',
                alias: 'Last Update',
                type: 'string'
              }
            ],
            renderer: this.createOnlineRenderer(),
            popupTemplate: this.createSubscriberPopupTemplate('online'),
            visible: this.layerVisibility.onlineSubscribers,
            minScale: 0,
            maxScale: 0
          });

          // Add to map
          this.map.add(this.layers.onlineSubscribers);

          console.log('🟢 New online FeatureLayer created and added to map');
          console.log('🟢 Online layer details:', {
            id: this.layers.onlineSubscribers.id,
            visible: this.layers.onlineSubscribers.visible,
            graphicsCount: graphics.length
          });
        } catch (error) {
          console.error('❌ Error loading online subscribers:', error);
        }
      } else {
        console.warn('⚠️ Cannot load online subscribers:', {
          hasFeatures: !!onlineData.features,
          hasLayer: !!this.layers.onlineSubscribers,
          layerReady: this.layers.onlineSubscribers?.loadStatus
        })
      }

      console.log('✅ Subscriber data loading complete');

    } catch (error) {
      console.error('❌ Failed to load subscriber data:', error);
    }
  }

  // Update offline subscribers data efficiently
  async updateOfflineSubscribers() {
    if (!this.layers.offlineSubscribers) return;

    console.log('🔄 Updating offline subscribers...');
    const offlineData = await subscriberDataService.getOfflineSubscribers();

    if (offlineData.features) {
      try {
        // Convert to graphics
        const newGraphics = offlineData.features.map((feature, index) => {
          const point = new Point({
            longitude: feature.geometry.coordinates[0],
            latitude: feature.geometry.coordinates[1],
            spatialReference: { wkid: 4326 }
          });

          // Create full address if it doesn't exist
          const attrs = {
            ObjectID: index + 1,
            ...feature.properties
          };

          // Construct full_address if not present
          if (!attrs.full_address) {
            const parts = [
              attrs.address,
              attrs.city,
              attrs.county,
              attrs.state,
              attrs.zip
            ].filter(Boolean);
            attrs.full_address = parts.join(', ');
          }

          return new Graphic({
            geometry: point,
            attributes: attrs
          });
        });

        // Use applyEdits for smooth updates
        const layer = this.layers.offlineSubscribers;
        const oldGraphics = await layer.queryFeatures();

        await layer.applyEdits({
          deleteFeatures: oldGraphics.features,
          addFeatures: newGraphics
        });

        console.log(`🔄 Updated offline layer: ${newGraphics.length} features`);

        // Update dashboard with new count
        if (window.dashboardManager) {
          window.dashboardManager.updateMetric('offline', newGraphics.length);
        }

      } catch (error) {
        console.error('❌ Error updating offline subscribers:', error);
      }
    }
  }

  // Update online subscribers data efficiently
  async updateOnlineSubscribers() {
    if (!this.layers.onlineSubscribers) return;

    console.log('🔄 Updating online subscribers...');
    const onlineData = await subscriberDataService.getOnlineSubscribers();

    if (onlineData.features) {
      try {
        // Convert to graphics
        const newGraphics = onlineData.features.map((feature, index) => {
          const point = new Point({
            longitude: feature.geometry.coordinates[0],
            latitude: feature.geometry.coordinates[1],
            spatialReference: { wkid: 4326 }
          });

          // Create full address if it doesn't exist
          const attrs = {
            ObjectID: index + 1,
            ...feature.properties
          };

          // Construct full_address if not present
          if (!attrs.full_address) {
            const parts = [
              attrs.address,
              attrs.city,
              attrs.county,
              attrs.state,
              attrs.zip
            ].filter(Boolean);
            attrs.full_address = parts.join(', ');
          }

          return new Graphic({
            geometry: point,
            attributes: attrs
          });
        });

        // Use applyEdits for smooth updates
        const layer = this.layers.onlineSubscribers;
        const oldGraphics = await layer.queryFeatures();

        await layer.applyEdits({
          deleteFeatures: oldGraphics.features,
          addFeatures: newGraphics
        });

        console.log(`🔄 Updated online layer: ${newGraphics.length} features`);
      } catch (error) {
        console.error('❌ Error updating online subscribers:', error);
      }
    }
  }

  // Load online subscribers (lazy loaded when first toggled on)
  async loadOnlineSubscribers() {
    // Check if already loaded
    if (this.layers.onlineSubscribers) {
      console.log('🟢 Online subscribers already loaded');
      return;
    }

    console.log('📊 Fetching online subscriber data...')
    const onlineData = await subscriberDataService.getOnlineSubscribers();
    console.log('📋 Online data received:', {
      count: onlineData.count,
      features: onlineData.features?.length || 0,
      hasError: !!onlineData.error
    })

    if (onlineData.features && this.map) {
      console.log(`🟢 Loading ${onlineData.features.length} online subscribers to map`);

      try {
        // Convert GeoJSON features to ArcGIS Graphics
        const graphics = onlineData.features.map((feature, index) => {
          const point = new Point({
            longitude: feature.geometry.coordinates[0],
            latitude: feature.geometry.coordinates[1],
            spatialReference: { wkid: 4326 }
          });

          // Create full address if it doesn't exist
          const attrs = {
            ObjectID: index + 1,
            ...feature.properties
          };

          // Construct full_address if not present
          if (!attrs.full_address) {
            const parts = [
              attrs.address,
              attrs.city,
              attrs.county,
              attrs.state,
              attrs.zip
            ].filter(Boolean);
            attrs.full_address = parts.join(', ');
          }

          return new Graphic({
            geometry: point,
            attributes: attrs
          });
        });

        // Create new FeatureLayer with the graphics
        this.layers.onlineSubscribers = new FeatureLayer({
          id: 'online-subscribers',
          title: 'Online Subscribers',
          copyright: 'FiberOMS',
          source: graphics,
          objectIdField: 'ObjectID',
          geometryType: 'point',
          spatialReference: { wkid: 4326 },
          fields: [
            {
              name: 'ObjectID',
              alias: 'ObjectID',
              type: 'oid'
            },
            {
              name: 'customer_number',
              alias: 'Customer Number',
              type: 'string'
            },
            {
              name: 'customer_name',
              alias: 'Customer Name',
              type: 'string'
            },
            {
              name: 'address',
              alias: 'Address',
              type: 'string'
            },
            {
              name: 'city',
              alias: 'City',
              type: 'string'
            },
            {
              name: 'state',
              alias: 'State',
              type: 'string'
            },
            {
              name: 'zip',
              alias: 'ZIP',
              type: 'string'
            },
            {
              name: 'county',
              alias: 'County',
              type: 'string'
            },
            {
              name: 'phone_number',
              alias: 'Phone Number',
              type: 'string'
            },
            {
              name: 'status',
              alias: 'Status',
              type: 'string'
            },
            {
              name: 'full_address',
              alias: 'Full Address',
              type: 'string'
            },
            {
              name: 'service_type',
              alias: 'Service Type',
              type: 'string'
            },
            {
              name: 'plan',
              alias: 'Plan',
              type: 'string'
            },
            {
              name: 'ta5k',
              alias: 'TA5K',
              type: 'string'
            },
            {
              name: 'remote_id',
              alias: 'Remote ID',
              type: 'string'
            },
            {
              name: 'ont',
              alias: 'ONT',
              type: 'string'
            },
            {
              name: 'electric_available',
              alias: 'Electric Available',
              type: 'string'
            },
            {
              name: 'fiber_distance',
              alias: 'Fiber Distance',
              type: 'string'
            },
            {
              name: 'light_level',
              alias: 'Light Level',
              type: 'string'
            },
            {
              name: 'last_update',
              alias: 'Last Update',
              type: 'string'
            }
          ],
          renderer: this.createOnlineRenderer(),
          popupTemplate: this.createSubscriberPopupTemplate('online'),
          visible: this.layerVisibility.onlineSubscribers,
          minScale: 0,
          maxScale: 0
        });

        // Add to map using z-order system (will be below offline)
        this.addLayerWithOrder(this.layers.onlineSubscribers, 'onlineSubscribers');

        console.log('🟢 New online FeatureLayer created and added to map');
        console.log('🟢 Online layer details:', {
          id: this.layers.onlineSubscribers.id,
          visible: this.layers.onlineSubscribers.visible,
          graphicsCount: graphics.length
        });
      } catch (error) {
        console.error('❌ Error loading online subscribers:', error);
      }
    } else {
      console.warn('⚠️ Cannot load online subscribers:', {
        hasFeatures: !!onlineData.features,
        hasLayer: !!this.layers.onlineSubscribers,
        layerReady: this.layers.onlineSubscribers?.loadStatus
      })
    }
  }

  // Setup layer toggle handlers for checkboxes and switches
  setupLayerToggleHandlers() {
    // Desktop layer toggles (checkboxes)
    const onlineCheckbox = document.querySelector('#layers-content calcite-block:first-child calcite-label:first-child calcite-checkbox');
    const offlineCheckbox = document.querySelector('#layers-content calcite-block:first-child calcite-label:nth-child(2) calcite-checkbox');

    if (onlineCheckbox) {
      // Set initial state
      onlineCheckbox.checked = this.layerVisibility.onlineSubscribers;

      onlineCheckbox.addEventListener('calciteCheckboxChange', (event) => {
        this.toggleLayer('onlineSubscribers', event.target.checked);
      });
    }

    if (offlineCheckbox) {
      // Set initial state
      offlineCheckbox.checked = this.layerVisibility.offlineSubscribers;

      offlineCheckbox.addEventListener('calciteCheckboxChange', (event) => {
        this.toggleLayer('offlineSubscribers', event.target.checked);
      });
    }

    // Mobile layer toggles (switches)
    const onlineSwitch = document.querySelector('#mobile-subscribers-sheet calcite-list-item:first-child calcite-switch');
    const offlineSwitch = document.querySelector('#mobile-subscribers-sheet calcite-list-item:nth-child(2) calcite-switch');

    if (onlineSwitch) {
      // Set initial state
      onlineSwitch.checked = this.layerVisibility.onlineSubscribers;

      onlineSwitch.addEventListener('calciteSwitchChange', (event) => {
        this.toggleLayer('onlineSubscribers', event.target.checked);
      });
    }

    if (offlineSwitch) {
      // Set initial state
      offlineSwitch.checked = this.layerVisibility.offlineSubscribers;

      offlineSwitch.addEventListener('calciteSwitchChange', (event) => {
        this.toggleLayer('offlineSubscribers', event.target.checked);
      });
    }

    console.log('Layer toggle handlers set up');
  }

  // Toggle layer visibility
  async toggleLayer(layerName, visible) {
    this.layerVisibility[layerName] = visible;

    // Lazy load online subscribers if toggling on for the first time
    if (layerName === 'onlineSubscribers' && visible && !this.layers.onlineSubscribers) {
      console.log('🟢 Loading online subscribers for the first time...');
      await this.loadOnlineSubscribers();
    }

    if (this.layers[layerName]) {
      this.layers[layerName].visible = visible;
      console.log(`${layerName} layer ${visible ? 'shown' : 'hidden'}`);
    }

    // Manage polling based on visibility
    if (visible && this.pollingIntervals[layerName]) {
      this.startPolling(layerName);
    } else {
      this.stopPolling(layerName);
    }

    // Sync the toggle states between mobile and desktop
    this.syncToggleStates(layerName, visible);
  }

  // Sync toggle states between mobile and desktop UI
  syncToggleStates(layerName, checked) {
    if (layerName === 'onlineSubscribers') {
      // Sync online toggles
      const desktopCheckbox = document.querySelector('#layers-content calcite-block:first-child calcite-label:first-child calcite-checkbox');
      const mobileSwitch = document.querySelector('#mobile-subscribers-sheet calcite-list-item:first-child calcite-switch');

      if (desktopCheckbox && desktopCheckbox.checked !== checked) {
        desktopCheckbox.checked = checked;
      }
      if (mobileSwitch && mobileSwitch.checked !== checked) {
        mobileSwitch.checked = checked;
      }
    } else if (layerName === 'offlineSubscribers') {
      // Sync offline toggles
      const desktopCheckbox = document.querySelector('#layers-content calcite-block:first-child calcite-label:nth-child(2) calcite-checkbox');
      const mobileSwitch = document.querySelector('#mobile-subscribers-sheet calcite-list-item:nth-child(2) calcite-switch');

      if (desktopCheckbox && desktopCheckbox.checked !== checked) {
        desktopCheckbox.checked = checked;
      }
      if (mobileSwitch && mobileSwitch.checked !== checked) {
        mobileSwitch.checked = checked;
      }
    }
  }

  // Method to apply theme to map components
  applyThemeToWidgets(theme) {
    // Update ArcGIS map components theme attributes
    const widgets = this.mapElement.querySelectorAll('arcgis-search, arcgis-track, arcgis-home, arcgis-locate, arcgis-basemap-toggle, arcgis-basemap-gallery, arcgis-expand, arcgis-fullscreen');
    widgets.forEach(widget => {
      widget.setAttribute('theme', theme);
    });
  }
}

// PWA installation
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.init();
  }

  init() {
    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt();
    });

  }

  showInstallPrompt() {
    // Create install prompt UI
    const prompt = document.createElement('div');
    prompt.className = 'install-prompt';
    prompt.innerHTML = `
      <span>Install FiberOMS for offline access</span>
      <calcite-button appearance="solid" color="inverse" scale="s">
        Install
      </calcite-button>
    `;

    document.body.appendChild(prompt);

    // Handle install button click
    prompt.querySelector('calcite-button').addEventListener('click', async () => {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        this.deferredPrompt = null;
      }
      prompt.remove();
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (prompt.parentElement) {
        prompt.remove();
      }
    }, 10000);
  }
}

// Mobile tab bar and sheet management using CalciteUI native events
class MobileTabBar {
  constructor() {
    this.segmentedControl = document.getElementById('mobile-tab-bar');

    this.sheets = {
      search: document.getElementById('mobile-search-sheet'),
      subscribers: document.getElementById('mobile-subscribers-sheet'),
      osp: document.getElementById('mobile-osp-sheet'),
      vehicles: document.getElementById('mobile-vehicles-sheet'),
      other: document.getElementById('mobile-other-sheet')
    };

    this.currentSheet = null;
    this.initialized = false;
    this.subscriberData = {
      online: { count: 0, loading: false },
      offline: { count: 0, loading: false }
    };

    // Delay initialization to ensure DOM is ready
    setTimeout(() => this.init(), 100);
  }

  async init() {
    // Wait for calcite components to be defined
    await customElements.whenDefined('calcite-segmented-control');
    await customElements.whenDefined('calcite-segmented-control-item');
    await customElements.whenDefined('calcite-dialog');

    // Initialize modals as closed
    Object.values(this.sheets).forEach(modal => {
      if (modal) {
        modal.open = false;
      }
    });

    // Setup segmented control change event
    if (this.segmentedControl) {
      // Listen for the calciteSegmentedControlChange event
      this.segmentedControl.addEventListener('calciteSegmentedControlChange', (event) => {
        const selectedValue = event.target.value;
        console.log('Tab selected:', selectedValue);
        this.handleTabChange(selectedValue);
      });

      // Also add click handlers to individual items as fallback
      const items = this.segmentedControl.querySelectorAll('calcite-segmented-control-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          const value = item.getAttribute('value');
          console.log('Item clicked:', value);
          // If this tab is already selected and modal is closed, reopen it
          if (item.checked && (!this.currentSheet || !this.currentSheet.open)) {
            this.handleTabChange(value);
          }
        });
      });
    }

    // Setup modal close events
    Object.values(this.sheets).forEach(modal => {
      if (modal) {
        modal.addEventListener('calciteDialogClose', () => {
          this.currentSheet = null;
          // Don't reset tab selection here - let user interaction control it
        });
      }
    });

    // Setup close button click handlers
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllSheets();
        // Don't reset tab selection - keep it selected
      });
    });

    // Setup layer toggle list items - click anywhere to toggle switch
    document.querySelectorAll('.layer-toggle-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't toggle if clicking directly on the switch
        if (e.target.tagName !== 'CALCITE-SWITCH') {
          const switchElement = item.querySelector('calcite-switch');
          if (switchElement) {
            switchElement.checked = !switchElement.checked;
          }
        }
      });
    });

    // Setup refresh button click handler
    const refreshButton = document.getElementById('refresh-subscriber-data');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        this.refreshSubscriberData();
      });
    }

    this.initialized = true;

    // Load subscriber data for UI counts (map will load its own data)
    this.loadSubscriberData();

    // Set up refresh interval (every 5 minutes)
    setInterval(() => {
      this.loadSubscriberData();
    }, 5 * 60 * 1000);
  }

  async loadSubscriberData() {
    // Load offline subscribers data
    try {
      this.subscriberData.offline.loading = true;
      this.updateOfflineSubscriberUI();

      const offlineData = await subscriberDataService.getOfflineSubscribers();
      this.subscriberData.offline = {
        count: offlineData.count,
        loading: false,
        data: offlineData.data,
        lastUpdated: offlineData.lastUpdated,
        error: offlineData.error
      };

      this.updateOfflineSubscriberUI();
    } catch (error) {
      console.error('Failed to load offline subscribers:', error);
      this.subscriberData.offline.loading = false;
      this.subscriberData.offline.error = error.message;
      this.updateOfflineSubscriberUI();
    }

    // Load online subscribers data only if the layer is visible
    // This prevents unnecessary API calls when the layer is off
    if (window.mapApp && window.mapApp.layerVisibility.onlineSubscribers) {
      try {
        this.subscriberData.online.loading = true;
        this.updateOnlineSubscriberUI();

        const onlineData = await subscriberDataService.getOnlineSubscribers();
        this.subscriberData.online = {
          count: onlineData.count,
          loading: false,
          data: onlineData.data,
          lastUpdated: onlineData.lastUpdated,
          error: onlineData.error
        };

        this.updateOnlineSubscriberUI();
      } catch (error) {
        console.error('Failed to load online subscribers:', error);
        this.subscriberData.online.loading = false;
        this.subscriberData.online.error = error.message;
        this.updateOnlineSubscriberUI();
      }
    } else {
      // Just update UI to show layer is off
      this.subscriberData.online.loading = false;
      this.updateOnlineSubscriberUI();
    }

    // Note: Map layers load their own data when initialized
  }

  updateOfflineSubscriberUI() {
    // Update mobile modal list item
    const mobileOfflineItem = document.querySelector('#mobile-subscribers-sheet calcite-list-item:nth-child(2)');
    if (mobileOfflineItem) {
      const { loading, error } = this.subscriberData.offline;
      let description = 'Show disconnected subscribers';

      if (loading) {
        description = 'Loading...';
      } else if (error) {
        description = 'Error loading data';
        mobileOfflineItem.classList.add('error');
      } else {
        mobileOfflineItem.classList.remove('error');
      }

      mobileOfflineItem.setAttribute('description', description);
    }

    // Desktop panel - no count display needed
  }

  updateOnlineSubscriberUI() {
    // Update mobile modal list item
    const mobileOnlineItem = document.querySelector('#mobile-subscribers-sheet calcite-list-item:first-child');
    if (mobileOnlineItem) {
      const { loading, error } = this.subscriberData.online;
      let description = 'Show active subscribers';

      if (loading) {
        description = 'Loading...';
      } else if (error) {
        description = 'Error loading data';
        mobileOnlineItem.classList.add('error');
      } else {
        mobileOnlineItem.classList.remove('error');
      }

      mobileOnlineItem.setAttribute('description', description);
    }

    // Desktop panel - no count display needed
  }

  // Add refresh functionality
  async refreshSubscriberData() {
    const refreshButton = document.getElementById('refresh-subscriber-data');

    try {
      // Show loading state
      if (refreshButton) {
        refreshButton.setAttribute('loading', '');
        refreshButton.setAttribute('disabled', '');
      }

      console.log('Refreshing subscriber data...');
      await subscriberDataService.refreshData('all');
      await this.loadSubscriberData();

      // Also refresh map layers if available
      if (window.mapApp && window.mapApp.layers.offlineSubscribers) {
        await window.mapApp.loadSubscriberData();
      }

      console.log('Subscriber data refreshed successfully');

    } catch (error) {
      console.error('Failed to refresh subscriber data:', error);
    } finally {
      // Remove loading state
      if (refreshButton) {
        refreshButton.removeAttribute('loading');
        refreshButton.removeAttribute('disabled');
      }
    }
  }

  handleTabChange(tabValue) {
    console.log('Tab changed to:', tabValue);

    // Close all modals first
    this.closeAllSheets();

    // Open the selected modal (even if it's the same one that was just open)
    if (this.sheets[tabValue]) {
      this.currentSheet = this.sheets[tabValue];
      // Use CalciteUI's native open property
      this.currentSheet.open = true;

      // Focus search input when opening search modal
      if (tabValue === 'search') {
        setTimeout(() => {
          const searchInput = document.getElementById('mobile-search-input');
          if (searchInput) {
            searchInput.setFocus();
          }
        }, 100);
      }
    }
  }

  closeAllSheets() {
    Object.values(this.sheets).forEach(modal => {
      if (modal) {
        modal.open = false;
      }
    });
    this.currentSheet = null;
  }

  resetToMapTab() {
    // Clear selection when closing modals
    if (this.segmentedControl) {
      // Uncheck all items
      const items = this.segmentedControl.querySelectorAll('calcite-segmented-control-item');
      items.forEach(item => item.checked = false);
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize components
  const themeManager = new ThemeManager();
  new LayerPanel();
  const mapApp = new MapApp();
  const mobileTabBar = new MobileTabBar();
  const dashboardManager = new DashboardManager();
  const headerSearch = new HeaderSearch();
  new PWAInstaller();

  // Make components available globally for theme management
  window.themeManager = themeManager;
  window.mapApp = mapApp;
  window.mobileTabBar = mobileTabBar;
  window.dashboardManager = dashboardManager;
  window.headerSearch = headerSearch;
  window.subscriberDataService = subscriberDataService;

  // Development-only debugging helpers
  if (isDevelopment) {
    window.testConnection = () => subscriberDataService.testConnection();
    window.debugLayers = () => {
      log.info('🔍 Layer Debug Info:')
      log.info('Map app:', !!window.mapApp)
      log.info('Offline layer:', !!window.mapApp?.layers?.offlineSubscribers)
      log.info('Online layer:', !!window.mapApp?.layers?.onlineSubscribers)
      if (window.mapApp?.layers?.offlineSubscribers) {
        log.info('Offline layer visible:', window.mapApp.layers.offlineSubscribers.visible)
        log.info('Offline layer source length:', window.mapApp.layers.offlineSubscribers.source?.length || 0)
      }
      if (window.mapApp?.layers?.onlineSubscribers) {
        log.info('Online layer visible:', window.mapApp.layers.onlineSubscribers.visible)
        log.info('Online layer source length:', window.mapApp.layers.onlineSubscribers.source?.length || 0)
      }
    };
  }

  // Service worker is auto-registered by Vite PWA plugin
});

// Header Search Class
class HeaderSearch {
  constructor() {
    this.autocomplete = null;
    this.searchResults = [];
    this.debounceTimer = null;
    this.locationIndicatorGraphic = null;
    this.locationIndicatorGraphics = [];
    this.indicatorTimeout = null;
    this.pulseInterval = null;
    this.init();
  }

  async init() {
    console.log('🔍 Initializing Header Search with Calcite Autocomplete...');

    // Wait for calcite components to be defined
    await customElements.whenDefined('calcite-autocomplete');
    await customElements.whenDefined('calcite-autocomplete-item');
    console.log('✅ Calcite autocomplete components defined');

    this.autocomplete = document.getElementById('header-search');
    console.log('🔍 Autocomplete element found:', !!this.autocomplete);
    console.log('🔍 Autocomplete element type:', this.autocomplete?.tagName);

    if (this.autocomplete) {
      console.log('🔍 Setting up autocomplete...');
      this.setupEventListeners();
      this.updatePlaceholderForScreenSize();

      // Listen for window resize to update placeholder
      window.addEventListener('resize', () => {
        this.updatePlaceholderForScreenSize();
      });

      console.log('✅ Header search initialization complete');
    } else {
      console.error('❌ Autocomplete element not found!');
    }
  }

  setupEventListeners() {
    console.log('🔧 Setting up HeaderSearch event listeners');

    // Search input event - fires as user types
    this.autocomplete.addEventListener('calciteAutocompleteTextInput', (e) => {
      const inputValue = e.target.inputValue || e.target.value;
      console.log('🔍 Search input:', inputValue);
      this.handleSearchInput(inputValue);
    });

    // Selection event - fires when user selects an item
    this.autocomplete.addEventListener('calciteAutocompleteChange', (e) => {
      console.log('🔍 calciteAutocompleteChange fired');
      console.log('🔍 Selected value:', e.target.value);
      console.log('🔍 Selected item:', e.target.selectedItem);

      // Find the selected result from our stored results
      const selectedValue = e.target.value;
      if (selectedValue && this.searchResults.length > 0) {
        // Find the matching result by title
        const selectedResult = this.searchResults.find(result => result.title === selectedValue);
        if (selectedResult) {
          console.log('🎯 Flying to selected result:', selectedResult.title);
          this.selectSearchResult(selectedResult);
        } else {
          console.warn('⚠️ Could not find matching result for:', selectedValue);
        }
      }
    });

    // Handle Enter key to select first result
    this.autocomplete.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.searchResults.length > 0) {
        e.preventDefault();
        console.log('🎯 Enter pressed - selecting first result:', this.searchResults[0].title);
        this.selectSearchResult(this.searchResults[0]);
      }
    });

    // Optional: Debug specific events if needed
    // ['calciteAutocompleteOpen', 'calciteAutocompleteClose'].forEach(eventName => {
    //   this.autocomplete.addEventListener(eventName, (e) => {
    //     console.log(`🔍 Event fired: ${eventName}`);
    //   });
    // });
  }

  updatePlaceholderForScreenSize() {
    if (!this.autocomplete) return;

    const isMobile = window.innerWidth <= 768;
    const isSmallMobile = window.innerWidth <= 480;

    if (isSmallMobile) {
      this.autocomplete.setAttribute('placeholder', 'Search (min 4 chars)...');
    } else if (isMobile) {
      this.autocomplete.setAttribute('placeholder', 'Search subscribers (min 4)...');
    } else {
      this.autocomplete.setAttribute('placeholder', 'Search subscribers, accounts, addresses (min 4 chars)...');
    }
  }



  handleSearchInput(searchTerm) {
    // Clear previous debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce search for 300ms (more responsive than 500ms)
    this.debounceTimer = setTimeout(() => {
      if (searchTerm.length >= 4) {
        this.performSearch(searchTerm);
      } else if (searchTerm.length === 0) {
        this.clearSearch();
      } else if (searchTerm.length < 4 && searchTerm.length > 0) {
        // Close dropdown for searches less than 4 characters
        this.hideDropdown();
      }
    }, 300);
  }

  async performSearch(searchTerm) {
    if (!searchTerm || searchTerm.length < 4) return;

    try {
      // Search through different data sources
      const results = await this.searchAllLayers(searchTerm);

      // Process and display results
      this.populateAutocomplete(results);

    } catch (error) {
      console.error('Search error:', error);
      this.clearAutocomplete();
    }
  }

  async searchAllLayers(searchTerm) {
    const results = [];
    const searchTermLower = searchTerm.trim().toLowerCase();

    console.log(`🔍 Starting comprehensive search for: "${searchTerm}"`);
    let totalSearched = 0;

    // Check what layers are available
    console.log('🔍 Available layers:');
    console.log('  - Offline subscribers:', !!window.mapApp?.layers?.offlineSubscribers);
    console.log('  - Online subscribers:', !!window.mapApp?.layers?.onlineSubscribers);
    if (window.mapApp?.layers?.offlineSubscribers) {
      console.log('  - Offline source length:', window.mapApp.layers.offlineSubscribers.source?.length);
    }
    if (window.mapApp?.layers?.onlineSubscribers) {
      console.log('  - Online source length:', window.mapApp.layers.onlineSubscribers.source?.length);
    }

    // Search offline subscribers
    if (window.mapApp?.layers?.offlineSubscribers) {
      const offlineResults = await this.searchSubscribers(searchTermLower, 'offline');
      results.push(...offlineResults);
      totalSearched += window.mapApp.layers.offlineSubscribers.source?.length || 0;
    } else {
      console.log('⚠️ Offline subscribers layer not available');
    }

    // Search online subscribers - ensure they're loaded for search even if layer is hidden
    if (window.mapApp?.layers?.onlineSubscribers && window.mapApp.layers.onlineSubscribers.source?.length > 0) {
      console.log('🔍 Online subscribers layer found, searching...');
      const onlineResults = await this.searchSubscribers(searchTermLower, 'online');
      results.push(...onlineResults);
      totalSearched += window.mapApp.layers.onlineSubscribers.source?.length || 0;
    } else {
      console.log('⚠️ Online subscribers layer not loaded - attempting to load for search...');
      // Load online subscribers data specifically for search
      try {
        await window.mapApp?.loadOnlineSubscribers();
        if (window.mapApp?.layers?.onlineSubscribers) {
          console.log('🔍 Online subscribers loaded, now searching...');
          const onlineResults = await this.searchSubscribers(searchTermLower, 'online');
          results.push(...onlineResults);
          totalSearched += window.mapApp.layers.onlineSubscribers.source?.length || 0;
        }
      } catch (error) {
        console.log('❌ Failed to load online subscribers for search:', error.message);
      }
    }

    console.log(`🔍 Search Summary:`);
    console.log(`  - Total subscribers searched: ${totalSearched}`);
    console.log(`  - Total matches found: ${results.length}`);
    console.log(`  - Returning top ${Math.min(results.length, 10)} results`);

    // Log details of all found results
    results.forEach((result, index) => {
      console.log(`  Result ${index + 1}: ${result.title} (${result.type}) - Account: ${result.account}`);
    });

    return results.slice(0, 10); // Limit to 10 results
  }

  async searchSubscribers(searchTerm, type) {
    const results = [];
    const layer = window.mapApp.layers[`${type}Subscribers`];

    console.log(`🔍 Searching ${type} subscribers...`);
    console.log(`📊 Layer available:`, !!layer);
    console.log(`📊 Layer source length:`, layer?.source?.length || 0);

    if (!layer || !layer.source) {
      console.log(`⚠️ No ${type} subscriber layer or source available`);
      return results;
    }

    // Search through subscriber graphics
    console.log(`🔍 Searching through ${layer.source.length} ${type} subscribers...`);

    // Search in these fields (prioritized by importance)
    const searchFields = [
      'customer_name',     // Primary: Customer name
      'customer_number',   // Primary: Account number  
      'address',          // Primary: Service address
      'service_address',  // Secondary: Alternative address
      'phone',           // Secondary: Phone number
      'email'            // Secondary: Email address
    ];

    console.log(`🔍 Searching in fields: ${searchFields.join(', ')}`);

    let checkedCount = 0;
    layer.source.forEach((graphic, index) => {
      checkedCount++;
      const attributes = graphic.attributes;

      let matchedField = null;
      let matchedValue = null;

      const found = searchFields.some(field => {
        const value = attributes[field];
        if (value) {
          const valueStr = value.toString().toLowerCase();
          if (valueStr.includes(searchTerm)) {
            matchedField = field;
            matchedValue = value;
            return true;
          }
        }
        return false;
      });

      if (found) {
        console.log(`✅ Match #${results.length + 1} found in ${matchedField}: "${matchedValue}"`);

        // Create full address like in popup template
        let fullAddress = attributes.full_address;
        if (!fullAddress) {
          const addressParts = [
            attributes.address || attributes.service_address,
            attributes.city,
            attributes.county,
            attributes.state,
            attributes.zip
          ].filter(Boolean);
          fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'No address';
        }

        const result = {
          type: `${type}_subscriber`,
          graphic: graphic,
          title: attributes.customer_name || `${type.charAt(0).toUpperCase() + type.slice(1)} Subscriber`,
          subtitle: fullAddress,
          account: attributes.customer_number || 'No account',
          layer: layer,
          matchedField: matchedField,
          matchedValue: matchedValue
        };

        console.log('📍 Adding search result:', {
          name: result.title,
          account: result.account,
          address: result.subtitle,
          matchedIn: matchedField
        });
        results.push(result);
      }
    });

    console.log(`🔍 Checked ${checkedCount} ${type} subscribers, found ${results.length} matches`);

    console.log(`🔍 Found ${results.length} ${type} subscriber results`);
    return results;
  }

  populateAutocomplete(results) {
    log.info('📝 Populating autocomplete with:', results.length, 'results');
    this.searchResults = results;

    // Clear existing items
    this.autocomplete.innerHTML = '';

    // Add new items
    results.forEach(result => {
      const item = document.createElement('calcite-autocomplete-item');
      item.setAttribute('label', result.title);
      item.setAttribute('description', `${result.account} • ${result.subtitle}`);
      item.setAttribute('value', result.title);

      // Store full result data for selection
      item.searchResult = result;

      // Add icon based on status
      item.setAttribute('icon-start', result.type.includes('offline') ? 'circle-disallowed' : 'check-circle');

      this.autocomplete.appendChild(item);
    });
  }

  clearAutocomplete() {
    this.autocomplete.innerHTML = '';
    this.searchResults = [];
  }

  showPopupForResult(result) {
    try {
      if (!window.mapApp?.view || !result.graphic) {
        console.warn('⚠️ Missing view or graphic for popup');
        return;
      }

      const view = window.mapApp.view;
      console.log('🔍 Showing popup for:', result.title);

      // Use native ArcGIS popup approach (like your other project)
      this.showNativePopup(result, view);

    } catch (error) {
      console.error('❌ Could not open popup:', error.message);
      console.log('📍 Search result info:', {
        title: result.title,
        subtitle: result.subtitle,
        account: result.account
      });
    }
  }

  showNativePopup(result, view) {
    try {
      console.log('🔍 Using native ArcGIS popup approach');

      // Create point geometry from the result graphic
      const pointGeometry = {
        type: "point",
        longitude: result.graphic.geometry.longitude,
        latitude: result.graphic.geometry.latitude
      };

      // Map search result to comprehensive attributes (like your other project)
      const attributes = {
        ObjectID: result.graphic.attributes.ObjectID || 0,
        customer_name: result.title,
        customer_number: result.account,
        full_address: result.subtitle,
        status: result.type.includes('offline') ? 'offline' : 'online',
        ...result.graphic.attributes // Include all original attributes
      };

      // Use the existing popup template from the graphic or create one
      let popupTemplate = result.graphic.popupTemplate;
      if (!popupTemplate) {
        // Find the popup template from the layer
        popupTemplate = result.layer?.popupTemplate;
      }
      if (!popupTemplate) {
        // Create fallback template
        popupTemplate = this.createFallbackPopupTemplate();
      }

      // Create graphic for popup
      const popupGraphic = {
        geometry: pointGeometry,
        attributes: attributes,
        popupTemplate: popupTemplate
      };

      console.log('🔍 Opening popup with graphic:', popupGraphic);

      // Use native ArcGIS openPopup method
      view.openPopup({
        features: [popupGraphic],
        location: pointGeometry
      });

      console.log('✅ Native popup opened');

    } catch (error) {
      console.error('❌ Native popup failed:', error.message);
      // Try the map element view as fallback
      this.showPopupDirectly(result, view);
    }
  }

  createFallbackPopupTemplate() {
    return {
      title: "{customer_name}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "customer_number", label: "Account" },
            { fieldName: "status", label: "Status" },
            { fieldName: "full_address", label: "Address" },
            { fieldName: "service_type", label: "Service Type" },
            { fieldName: "plan", label: "Plan" },
            { fieldName: "ta5k", label: "TA5K" },
            { fieldName: "remote_id", label: "Remote ID" },
            { fieldName: "ont", label: "ONT" },
            { fieldName: "electric_available", label: "Electric Available" },
            { fieldName: "fiber_distance", label: "Fiber Distance" },
            { fieldName: "light_level", label: "Light Level" },
            { fieldName: "last_update", label: "Last Update" }
          ]
        }
      ]
    };
  }

  showPopupDirectly(result, view) {
    console.log('🔍 Trying direct popup approach');

    // Check if we can access the mapView through other properties
    const mapElement = document.getElementById('map');
    console.log('🔍 Map element:', mapElement);
    console.log('🔍 Map element view:', mapElement?.view);

    if (mapElement && mapElement.view) {
      console.log('🔍 Using mapElement.view for popup');
      const mapView = mapElement.view;

      try {
        // Try setting popup properties directly
        console.log('🔍 MapView popup object:', mapView.popup);
        console.log('🔍 MapView popup properties:', Object.getOwnPropertyNames(mapView.popup || {}));

        if (mapView.popup) {
          // Set popup properties directly
          mapView.popup.features = [result.graphic];
          mapView.popup.location = result.graphic.geometry;
          mapView.popup.visible = true;
          console.log('✅ Popup opened via direct property setting');
        } else {
          console.log('❌ No popup object on mapView');
        }
      } catch (error) {
        console.log('❌ Direct popup approach failed:', error.message);
      }
    } else {
      console.log('❌ No mapElement.view available');
    }

    // Always log the info as fallback
    console.log('📍 Result info:', {
      title: result.title,
      account: result.account,
      address: result.subtitle
    });
  }

  selectSearchResult(result) {
    console.log('🎯 selectSearchResult called with:', result.title);
    console.log('🎯 Result has graphic:', !!result.graphic);
    console.log('🎯 Result graphic geometry:', result.graphic?.geometry);
    console.log('🎯 MapApp view available:', !!window.mapApp?.view);
    console.log('🎯 Full result object:', result);

    // Clear search and hide dropdown
    this.clearSearch();

    // Zoom to result location and show popup
    if (result.graphic && window.mapApp?.view) {
      console.log('✅ Starting goTo for result');
      console.log('✅ Target geometry:', result.graphic.geometry);
      window.mapApp.view.goTo({
        target: result.graphic,
        zoom: 16
      }).then(() => {
        console.log('✅ goTo completed, showing popup in 500ms');
        // Small delay to ensure map animation is complete
        setTimeout(() => {
          // Show radar pulse indicator first
          this.showSearchLocationIndicator(result);
          // Then show popup
          this.showPopupForResult(result);
        }, 500);
      }).catch(error => {
        console.error('❌ Error during zoom to search result:', error);
      });
    } else {
      console.log('❌ Cannot zoom - missing graphic or view');
      if (!result.graphic) console.log('❌ Missing graphic');
      if (!window.mapApp?.view) console.log('❌ Missing view');
    }
  }

  clearSearch() {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Clear autocomplete and results
    if (this.autocomplete) {
      this.autocomplete.value = '';
      this.autocomplete.inputValue = '';
    }
    this.clearAutocomplete();

    // Clear location indicator
    this.clearLocationIndicator();

    // Close any open popups
    try {
      if (window.mapApp?.view?.popup) {
        window.mapApp.view.popup.visible = false;
      }
    } catch (error) {
      console.error('Could not close popup:', error);
    }
  }

  showSearchLocationIndicator(result) {
    try {
      const view = window.mapApp?.view;
      if (!view || !result.graphic) return;

      console.log('🎯 Showing search location indicator for:', result.title);

      // Clear any existing indicator
      this.clearLocationIndicator();

      // Determine status and color scheme
      const status = result.status || result.graphic?.attributes?.status || 'unknown';
      const isOffline = status.toLowerCase() === 'offline';

      // Color schemes based on status
      const colors = isOffline ? {
        ring: [220, 38, 38, 255],    // Red for offline
        center: [220, 38, 38, 255],  // Red center
        name: 'offline'
      } : {
        ring: [34, 197, 94, 255],    // Green for online
        center: [34, 197, 94, 255],  // Green center  
        name: 'online'
      };

      console.log(`🎯 Using ${colors.name} color scheme for status: ${status}`);

      // Create animated CIM symbol with status-based colors
      const animatedSymbol = {
        type: "cim",
        data: {
          type: "CIMSymbolReference",
          symbol: {
            type: "CIMPointSymbol",
            symbolLayers: [
              // Pulsing outer ring
              {
                type: "CIMVectorMarker",
                enable: true,
                size: 30,
                frame: {
                  xmin: -2,
                  ymin: -2,
                  xmax: 2,
                  ymax: 2
                },
                markerGraphics: [{
                  type: "CIMMarkerGraphic",
                  geometry: {
                    type: "CIMPolygon",
                    rings: [[
                      [2, 0], [1.9, 0.6], [1.6, 1.2], [1.2, 1.6], [0.6, 1.9], [0, 2],
                      [-0.6, 1.9], [-1.2, 1.6], [-1.6, 1.2], [-1.9, 0.6], [-2, 0],
                      [-1.9, -0.6], [-1.6, -1.2], [-1.2, -1.6], [-0.6, -1.9], [0, -2],
                      [0.6, -1.9], [1.2, -1.6], [1.6, -1.2], [1.9, -0.6], [2, 0]
                    ]]
                  },
                  symbol: {
                    type: "CIMPolygonSymbol",
                    symbolLayers: [{
                      type: "CIMSolidStroke",
                      enable: true,
                      color: colors.ring,
                      width: 2
                    }]
                  }
                }],
                primitiveName: "pulse_ring"
              },
              // Static center dot
              {
                type: "CIMVectorMarker",
                enable: true,
                size: 8,
                frame: {
                  xmin: -1,
                  ymin: -1,
                  xmax: 1,
                  ymax: 1
                },
                markerGraphics: [{
                  type: "CIMMarkerGraphic",
                  geometry: {
                    type: "CIMPolygon",
                    rings: [[
                      [1, 0], [0.9, 0.4], [0.7, 0.7], [0.4, 0.9], [0, 1],
                      [-0.4, 0.9], [-0.7, 0.7], [-0.9, 0.4], [-1, 0],
                      [-0.9, -0.4], [-0.7, -0.7], [-0.4, -0.9], [0, -1],
                      [0.4, -0.9], [0.7, -0.7], [0.9, -0.4], [1, 0]
                    ]]
                  },
                  symbol: {
                    type: "CIMPolygonSymbol",
                    symbolLayers: [{
                      type: "CIMSolidFill",
                      enable: true,
                      color: colors.center
                    }]
                  }
                }]
              }
            ],
            // Add pulsing animation
            animations: [
              {
                type: "CIMSymbolAnimationScale",
                primitiveName: "pulse_ring",
                scaleFactor: 2.5,
                animatedSymbolProperties: {
                  type: "CIMAnimatedSymbolProperties",
                  playAnimation: true,
                  randomizeStartTime: false,
                  repeatType: "Loop",
                  repeatDelay: 0,
                  duration: 2.0,
                  easing: "Linear"
                }
              },
              {
                type: "CIMSymbolAnimationTransparency",
                primitiveName: "pulse_ring",
                toTransparency: 100,
                animatedSymbolProperties: {
                  type: "CIMAnimatedSymbolProperties",
                  playAnimation: true,
                  randomizeStartTime: false,
                  repeatType: "Loop",
                  repeatDelay: 0,
                  duration: 2.0,
                  easing: "Linear"
                }
              }
            ]
          }
        }
      };

      // Create the location indicator graphic
      this.locationIndicatorGraphic = new Graphic({
        geometry: result.graphic.geometry,
        symbol: animatedSymbol
      });

      view.graphics.add(this.locationIndicatorGraphic);

      // Auto-remove after 8 seconds
      this.indicatorTimeout = setTimeout(() => {
        this.clearLocationIndicator();
      }, 8000);

      console.log('✅ Animated search location indicator displayed');

    } catch (error) {
      console.error('❌ Error showing location indicator:', error);
    }
  }

  clearLocationIndicator() {
    const view = window.mapApp?.view;
    if (!view) return;

    // Clear the animated location indicator graphic
    if (this.locationIndicatorGraphic) {
      view.graphics.remove(this.locationIndicatorGraphic);
      this.locationIndicatorGraphic = null;
      console.log('🧹 Animated location indicator cleared');
    }

    // Clear auto-removal timeout
    if (this.indicatorTimeout) {
      clearTimeout(this.indicatorTimeout);
      this.indicatorTimeout = null;
    }
  }

  // Public method to search from other components
  search(searchTerm) {
    if (this.autocomplete) {
      this.autocomplete.value = searchTerm;
      this.autocomplete.inputValue = searchTerm;
      this.performSearch(searchTerm);
    }
  }
}

// Dashboard Manager Class
class DashboardManager {
  constructor() {
    this.metrics = {
      offline: 0
    };
    this.refreshInterval = null;
    this.init();
  }

  async init() {
    console.log('📊 Initializing Dashboard Manager...');

    // Set up event listeners
    this.setupEventListeners();

    // Initial data load
    await this.updateDashboard();

    // Start auto-refresh every 30 seconds
    this.startAutoRefresh();
  }

  setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshDashboard());
    }

    // Settings button
    const settingsBtn = document.getElementById('dashboard-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettings());
    }

    // Make offline metric chip clickable for more details
    const offlineChip = document.querySelector('.offline-metric');
    if (offlineChip) {
      offlineChip.addEventListener('click', (e) => {
        if (!offlineChip.classList.contains('loading')) {
          this.showOfflineDetails();
        }
      });
    }
  }

  async updateDashboard() {
    console.log('📊 Updating dashboard metrics...');

    try {
      // Update offline subscribers count
      await this.updateOfflineCount();

    } catch (error) {
      console.error('❌ Error updating dashboard:', error);
    }
  }

  async updateOfflineCount() {
    try {
      const offlineData = await subscriberDataService.getOfflineSubscribers();
      const count = offlineData.count || 0;

      this.metrics.offline = count;
      this.updateMetricDisplay('offline-count', count);

      // Add alert state if count is high
      const offlineMetric = document.querySelector('.offline-metric');
      if (count > 50) {
        offlineMetric.classList.add('alert');
      } else {
        offlineMetric.classList.remove('alert');
      }

    } catch (error) {
      console.error('❌ Error updating offline count:', error);
      this.updateMetricDisplay('offline-count', '--');
    }
  }



  updateMetricDisplay(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      // Add loading state briefly
      const metricItem = element.closest('.metric-item');
      if (metricItem) {
        metricItem.classList.add('loading');

        setTimeout(() => {
          element.textContent = value;
          metricItem.classList.remove('loading');
        }, 200);
      } else {
        element.textContent = value;
      }
    }
  }

  async refreshDashboard() {
    console.log('🔄 Manual dashboard refresh...');

    // Show loading state on refresh button
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.setAttribute('loading', '');
      refreshBtn.setAttribute('disabled', '');
    }

    try {
      await this.updateDashboard();
    } finally {
      // Remove loading state
      if (refreshBtn) {
        refreshBtn.removeAttribute('loading');
        refreshBtn.removeAttribute('disabled');
      }
    }
  }

  startAutoRefresh() {
    // Refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.updateDashboard();
    }, 30000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }



  showOfflineDetails() {
    // Zoom to offline subscribers on map
    if (window.mapApp && window.mapApp.layers.offlineSubscribers) {
      window.mapApp.view.goTo(window.mapApp.layers.offlineSubscribers.fullExtent);
    }

    // Show mobile subscribers sheet on mobile
    if (window.innerWidth <= 768 && window.mobileTabBar) {
      window.mobileTabBar.handleTabChange('subscribers');
    }
  }



  showSettings() {
    // Placeholder - show dashboard settings
    console.log('⚙️ Show dashboard settings');
  }

  // Public method to update specific metrics from other components
  updateMetric(metricType, value) {
    if (metricType === 'offline') {
      this.metrics.offline = value;
      this.updateMetricDisplay('offline-count', value);

      // Add alert state if count is high
      const offlineMetric = document.querySelector('.offline-metric');
      if (offlineMetric) {
        if (value > 50) {
          offlineMetric.classList.add('alert');
        } else {
          offlineMetric.classList.remove('alert');
        }
      }
    }
  }
}


