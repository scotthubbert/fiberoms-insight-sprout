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
import '@esri/calcite-components/dist/components/calcite-popover';
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
    this.searchInput = null;
    this.searchResults = [];
    this.debounceTimer = null;
    this.resultsPopover = null;
    this.resultsList = null;
    this.init();
  }

  async init() {
    console.log('🔍 Initializing Header Search with CalciteUI Input + Popover...');

    // Wait for calcite components to be defined
    await customElements.whenDefined('calcite-input');
    await customElements.whenDefined('calcite-popover');
    await customElements.whenDefined('calcite-list');

    this.searchInput = document.getElementById('header-search');
    this.resultsPopover = document.getElementById('search-results-popover');
    this.resultsList = document.getElementById('search-results-list');

    if (this.searchInput && this.resultsPopover && this.resultsList) {
      this.setupEventListeners();
      this.updatePlaceholderForScreenSize();

      // Listen for window resize to update placeholder
      window.addEventListener('resize', () => {
        this.updatePlaceholderForScreenSize();
      });
    }
  }

  setupEventListeners() {
    console.log('🔧 Setting up HeaderSearch event listeners');
    console.log('🔧 Search input element:', this.searchInput);

    // Search input change event
    this.searchInput.addEventListener('calciteInputInput', (e) => {
      this.handleSearchInput(e.target.value);
    });

    // Clear button event (built into calcite-input with clearable attribute)
    this.searchInput.addEventListener('calciteInputClear', () => {
      this.clearSearch();
    });

    // Keyboard shortcuts - try multiple event approaches
    this.searchInput.addEventListener('keydown', (e) => {
      console.log('🔍 Direct keydown on search input:', e.key);
      if (e.key === 'Enter') {
        e.preventDefault();
        console.log('🔍 Enter pressed - Search results:', this.searchResults.length);
        if (this.searchResults.length > 0) {
          console.log('🎯 Selecting first result:', this.searchResults[0].title);
          this.selectSearchResult(this.searchResults[0]);
        } else {
          console.log('⚠️ No search results available');
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.clearSearch();
      }
    });

    // Also try keypress event
    this.searchInput.addEventListener('keypress', (e) => {
      console.log('🔍 Direct keypress on search input:', e.key);
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.searchResults.length > 0) {
          this.selectSearchResult(this.searchResults[0]);
        }
      }
    });

    // Global keyboard listener as backup
    document.addEventListener('keydown', (e) => {
      if (document.activeElement === this.searchInput) {
        console.log('🔍 Global keydown with search focused:', e.key);
        if (e.key === 'Enter' && this.searchResults.length > 0) {
          e.preventDefault();
          console.log('🎯 Global Enter - selecting first result');
          this.selectSearchResult(this.searchResults[0]);
        }
      }
    });

    // Focus debugging
    this.searchInput.addEventListener('focus', () => {
      console.log('🔍 Search input focused');
    });

    this.searchInput.addEventListener('blur', () => {
      console.log('🔍 Search input blurred');
    });

    // Click on search results
    this.resultsList.addEventListener('click', (e) => {
      const listItem = e.target.closest('calcite-list-item');
      if (listItem) {
        const resultIndex = parseInt(listItem.getAttribute('data-result-index'));
        if (!isNaN(resultIndex) && this.searchResults[resultIndex]) {
          this.selectSearchResult(this.searchResults[resultIndex]);
        }
      }
    });

    // Keyboard navigation for search results
    this.resultsList.addEventListener('keydown', (e) => {
      console.log('🔍 Keydown on search results:', e.key);

      if (e.key === 'Enter') {
        e.preventDefault();
        console.log('🔍 Enter pressed on search results');

        // Find the currently focused list item
        const focusedItem = this.resultsList.querySelector('calcite-list-item:focus');
        if (focusedItem) {
          const resultIndex = parseInt(focusedItem.getAttribute('data-result-index'));
          if (!isNaN(resultIndex) && this.searchResults[resultIndex]) {
            console.log('🎯 Selecting focused result:', this.searchResults[resultIndex].title);
            this.selectSearchResult(this.searchResults[resultIndex]);
          }
        } else if (this.searchResults.length > 0) {
          // No specific item focused, select first result
          console.log('🎯 No focused item, selecting first result:', this.searchResults[0].title);
          this.selectSearchResult(this.searchResults[0]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        console.log('🔍 Escape pressed on search results');
        this.clearSearch();
        this.searchInput.focus(); // Return focus to search input
      }
    });

    // Also handle Enter key globally when search results are visible
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.resultsPopover && this.resultsPopover.expanded && this.searchResults.length > 0) {
        // Check if focus is anywhere within the search interface
        const activeElement = document.activeElement;
        const isSearchFocused = activeElement === this.searchInput ||
          this.resultsPopover.contains(activeElement) ||
          activeElement.closest('#search-results-popover');

        if (isSearchFocused) {
          e.preventDefault();
          console.log('🔍 Global Enter with search results visible');
          console.log('🎯 Active element:', activeElement?.tagName, activeElement?.id);

          // Select first result if no specific result is focused
          this.selectSearchResult(this.searchResults[0]);
        }
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.searchInput.contains(e.target) && !this.resultsPopover.contains(e.target)) {
        this.hideDropdown();
      }
    });
  }

  updatePlaceholderForScreenSize() {
    if (!this.searchInput) return;

    const isMobile = window.innerWidth <= 768;
    const isSmallMobile = window.innerWidth <= 480;

    if (isSmallMobile) {
      this.searchInput.setAttribute('placeholder', 'Search (min 4 chars)...');
    } else if (isMobile) {
      this.searchInput.setAttribute('placeholder', 'Search subscribers (min 4)...');
    } else {
      this.searchInput.setAttribute('placeholder', 'Search subscribers, accounts, addresses (min 4 chars)...');
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
      // Show loading state
      this.searchInput.loading = true;

      // Search through different data sources
      const results = await this.searchAllLayers(searchTerm);

      // Process and display results
      this.displaySearchResults(results, searchTerm);

    } catch (error) {
      console.error('Search error:', error);
      this.displaySearchError(searchTerm);
    } finally {
      // Remove loading state
      this.searchInput.loading = false;
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

  displaySearchResults(results, searchTerm) {
    log.info('📝 Displaying search results:', results.length, 'results for term:', searchTerm);
    this.searchResults = results;
    this.resultsList.innerHTML = '';

    if (results.length === 0) {
      this.displayNoResults(searchTerm);
      return;
    }

    // Populate list with results
    results.forEach((result, index) => {
      const listItem = document.createElement('calcite-list-item');
      listItem.setAttribute('data-result-index', index.toString());
      listItem.setAttribute('label', result.title);
      listItem.setAttribute('description', `${result.account} • ${result.subtitle}`);

      // Make list items focusable for keyboard navigation
      listItem.setAttribute('tabindex', '0');
      listItem.style.cursor = 'pointer';

      // Add status icon
      const statusIcon = document.createElement('calcite-icon');
      statusIcon.setAttribute('slot', 'content-start');
      statusIcon.setAttribute('icon', result.type.includes('offline') ? 'circle-disallowed' : 'check-circle');
      statusIcon.style.color = result.type.includes('offline') ? 'var(--calcite-color-status-danger)' : 'var(--calcite-color-status-success)';
      listItem.appendChild(statusIcon);

      this.resultsList.appendChild(listItem);
    });

    log.info('📝 Results list populated, calling showDropdown');
    log.info('📝 Results list HTML:', this.resultsList.innerHTML);
    log.info('📝 Results list children count:', this.resultsList.children.length);

    // Ensure search input maintains focus for popover to work properly
    if (this.searchInput) {
      this.searchInput.focus();
    }

    // Use a small delay to ensure DOM is rendered before showing dropdown
    setTimeout(() => {
      this.showDropdown();

      // Debug visibility after showing
      setTimeout(() => {
        log.info('🔍 Popover computed style:', window.getComputedStyle(this.resultsPopover).display);
        log.info('🔍 Popover visibility:', window.getComputedStyle(this.resultsPopover).visibility);
        log.info('🔍 Popover z-index:', window.getComputedStyle(this.resultsPopover).zIndex);
        log.info('🔍 Popover position:', this.resultsPopover.getBoundingClientRect());
      }, 100);
    }, 50);
  }

  displayNoResults(searchTerm) {
    const noResultsItem = document.createElement('calcite-list-item');
    noResultsItem.setAttribute('label', 'No results found');
    noResultsItem.setAttribute('description', `No subscribers found for "${searchTerm}"`);
    noResultsItem.style.opacity = '0.7';
    noResultsItem.style.pointerEvents = 'none';

    this.resultsList.appendChild(noResultsItem);
    this.showDropdown();
  }

  displaySearchError(searchTerm) {
    this.resultsList.innerHTML = '';

    const errorItem = document.createElement('calcite-list-item');
    errorItem.setAttribute('label', 'Search Error');
    errorItem.setAttribute('description', 'Unable to search at this time. Please try again.');
    errorItem.style.opacity = '0.7';
    errorItem.style.pointerEvents = 'none';

    const errorIcon = document.createElement('calcite-icon');
    errorIcon.setAttribute('slot', 'content-start');
    errorIcon.setAttribute('icon', 'exclamation-mark-triangle');
    errorIcon.style.color = 'var(--calcite-color-status-warning)';
    errorItem.appendChild(errorIcon);

    this.resultsList.appendChild(errorItem);
    this.showDropdown();
  }

  showPopupForResult(result) {
    try {
      if (!window.mapApp?.view || !result.graphic) {
        log.warn('⚠️ Missing view or graphic for popup');
        return;
      }

      const view = window.mapApp.view;
      log.info('🔍 Attempting to show popup for result:', result.title);
      log.info('🔍 View object:', !!view);
      log.info('🔍 View.popup exists:', !!view.popup);
      log.info('🔍 Graphic:', !!result.graphic);

      // Close any existing popup first (use correct ArcGIS Map Components API)
      if (view.popup) {
        view.popup.visible = false;
        // Clear existing features
        view.popup.features = [];
      }

      // Wait a moment for popup to close, then open new one
      setTimeout(() => {
        try {
          // Method 1: Direct popup property setting (most reliable for ArcGIS Map Components)
          if (view.popup) {
            view.popup.features = [result.graphic];
            view.popup.location = result.graphic.geometry;
            view.popup.visible = true;

            // Debug popup state
            setTimeout(() => {
              log.info('🔍 Popup debugging:');
              log.info('🔍 Popup visible property:', view.popup.visible);
              log.info('🔍 Popup features count:', view.popup.features?.length);
              log.info('🔍 Popup location:', view.popup.location);

              // Try to find popup in DOM
              const popupElement = document.querySelector('.esri-popup, .esri-popup--is-visible, arcgis-popup');
              log.info('🔍 Popup DOM element found:', !!popupElement);
              if (popupElement) {
                log.info('🔍 Popup element style:', window.getComputedStyle(popupElement).display);
                log.info('🔍 Popup element visibility:', window.getComputedStyle(popupElement).visibility);
                log.info('🔍 Popup element position:', popupElement.getBoundingClientRect());
              }
            }, 200);

            log.info('✅ Popup opened using direct property setting');
            return;
          }

          // Method 2: Try underlying MapView popup
          if (view.view && view.view.popup) {
            view.view.popup.open({
              features: [result.graphic],
              location: result.graphic.geometry
            });
            log.info('✅ Popup opened using underlying MapView');
            return;
          }

          // Method 3: Try setting popup properties on the view itself
          try {
            view.openPopup({
              features: [result.graphic],
              location: result.graphic.geometry
            });
            log.info('✅ Popup opened using view.openPopup');
            return;
          } catch (openPopupError) {
            log.info('⚠️ view.openPopup not available');
          }

          // Method 4: Force popup creation by clicking on the map location
          try {
            // Simulate a click at the graphic location to trigger popup
            view.hitTest(result.graphic.geometry).then((response) => {
              if (response.results.length > 0) {
                view.popup.open({
                  features: response.results.map(r => r.graphic),
                  location: result.graphic.geometry
                });
                log.info('✅ Popup opened using hitTest simulation');
              }
            });
            return;
          } catch (hitTestError) {
            log.info('⚠️ hitTest method failed');
          }

          log.warn('⚠️ No popup method available - all attempts failed');

        } catch (innerError) {
          log.error('⚠️ Error in delayed popup opening:', innerError.message);
        }
      }, 100);

    } catch (error) {
      log.error('⚠️ Could not open popup:', error.message);
      // Fallback: Just log the result info
      log.info('📍 Search result:', {
        title: result.title,
        subtitle: result.subtitle,
        account: result.account
      });
    }
  }

  selectSearchResult(result) {
    console.log('🎯 selectSearchResult called with:', result.title);
    console.log('🎯 Result has graphic:', !!result.graphic);
    console.log('🎯 MapApp view available:', !!window.mapApp?.view);

    // Clear search and hide dropdown
    this.clearSearch();

    // Zoom to result location and show popup
    if (result.graphic && window.mapApp?.view) {
      console.log('✅ Starting goTo for result');
      window.mapApp.view.goTo({
        target: result.graphic,
        zoom: 16
      }).then(() => {
        console.log('✅ goTo completed, showing popup');
        this.showPopupForResult(result);
      }).catch(error => {
        console.error('Error during zoom to search result:', error);
      });
    } else {
      console.log('❌ Cannot zoom - missing graphic or view');
    }
  }

  showDropdown() {
    if (this.resultsPopover) {
      log.info('🔽 Attempting to show dropdown');
      log.info('🔽 Popover element:', this.resultsPopover);
      log.info('🔽 Results count:', this.searchResults.length);

      // Try multiple approaches to ensure the popover opens
      this.resultsPopover.open = true;
      this.resultsPopover.expanded = true;

      // Force visibility with CSS as backup
      this.resultsPopover.style.display = 'block';
      this.resultsPopover.style.visibility = 'visible';
      this.resultsPopover.style.opacity = '1';
      this.resultsPopover.style.zIndex = '9999';
      this.resultsPopover.style.position = 'absolute';

      // Force a slight delay to ensure DOM is ready
      setTimeout(() => {
        if (this.resultsPopover) {
          this.resultsPopover.open = true;
          this.resultsPopover.expanded = true;

          // Double-check visibility
          this.resultsPopover.style.display = 'block';
          this.resultsPopover.style.visibility = 'visible';
          this.resultsPopover.style.opacity = '1';

          log.info('🔽 Popover state after timeout - open:', this.resultsPopover.open, 'expanded:', this.resultsPopover.expanded);
          log.info('🔽 Popover CSS display:', this.resultsPopover.style.display);
          log.info('🔽 Popover CSS visibility:', this.resultsPopover.style.visibility);
        }
      }, 10);
    } else {
      log.warn('⚠️ Results popover not found!');
    }
  }

  hideDropdown() {
    if (this.resultsPopover) {
      this.resultsPopover.open = false;
      this.resultsPopover.expanded = false;
    }
  }

  clearSearch() {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Clear input and results
    this.searchInput.value = '';
    this.resultsList.innerHTML = '';
    this.hideDropdown();
    this.searchResults = [];

    // Close any open popups
    try {
      if (window.mapApp?.view?.popup) {
        window.mapApp.view.popup.visible = false;
      }
    } catch (error) {
      console.error('Could not close popup:', error);
    }
  }

  // Public method to search from other components
  search(searchTerm) {
    if (this.searchInput) {
      this.searchInput.value = searchTerm;
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

