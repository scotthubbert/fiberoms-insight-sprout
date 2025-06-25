// ArcGIS themes are loaded via HTML link tags for proper switching

// Configure ArcGIS intl
import * as intl from '@arcgis/core/intl';
intl.setLocale('en');


// Import ArcGIS Map Components
import "@arcgis/map-components/dist/components/arcgis-search";
import '@arcgis/map-components/dist/components/arcgis-map';
import '@arcgis/map-components/dist/components/arcgis-zoom';
import '@arcgis/map-components/dist/components/arcgis-home';
// import '@arcgis/map-components/dist/components/arcgis-locate';
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
import '@esri/calcite-components/dist/components/calcite-modal';
import '@esri/calcite-components/dist/components/calcite-chip';
import { setAssetPath } from '@esri/calcite-components/dist/components';

// Set Calcite assets path to NPM bundled assets
setAssetPath('/node_modules/@esri/calcite-components/dist/calcite/assets');

// Basemap configuration for theme management
const BASEMAP_CONFIG = {
  light: {
    primary: 'streets-navigation-vector',
    alternate: 'hybrid'
  },
  dark: {
    primary: 'dark-gray-vector',
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
    this.init();
  }

  async init() {
    // Wait for custom elements to be defined
    await customElements.whenDefined('arcgis-map');

    // Listen for when the view is ready
    this.mapElement.addEventListener('arcgisViewReadyChange', (event) => {
      this.onMapReady(event.detail);
    });
  }

  onMapReady(view) {
    if (!view) return;

    // Store view reference
    this.view = view;
    this.map = view.map;

    // Store view reference globally for theme management
    window.mapView = view;

    // Apply current theme to the view
    if (window.themeManager) {
      window.themeManager.applyThemeToView(view);
    }

    // Map and view are ready for use
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

    // Delay initialization to ensure DOM is ready
    setTimeout(() => this.init(), 100);
  }

  async init() {
    // Wait for calcite components to be defined
    await customElements.whenDefined('calcite-segmented-control');
    await customElements.whenDefined('calcite-segmented-control-item');
    await customElements.whenDefined('calcite-modal');

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
        modal.addEventListener('calciteModalClose', () => {
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

    this.initialized = true;
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
  new MobileTabBar();
  const mapApp = new MapApp();
  new PWAInstaller();

  // Make components available globally for debugging and theme management
  window.themeManager = themeManager;
  window.mapApp = mapApp;

  // Service worker is auto-registered by Vite PWA plugin
});

