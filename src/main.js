// ArcGIS themes are loaded via HTML link tags for proper switching

// Configure ArcGIS intl
import * as intl from '@arcgis/core/intl';
intl.setLocale('en');


// Import ArcGIS Map Components
import "@arcgis/map-components/dist/components/arcgis-search";
import '@arcgis/map-components/dist/components/arcgis-map';
import '@arcgis/map-components/dist/components/arcgis-zoom';
import '@arcgis/map-components/dist/components/arcgis-home';
import '@arcgis/map-components/dist/components/arcgis-locate';
import '@arcgis/map-components/dist/components/arcgis-basemap-toggle';
import '@arcgis/map-components/dist/components/arcgis-basemap-gallery';
import '@arcgis/map-components/dist/components/arcgis-expand';
import '@arcgis/map-components/dist/components/arcgis-track';
import '@arcgis/map-components/dist/components/arcgis-fullscreen';

// Import Calcite components
import '@esri/calcite-components/dist/components/calcite-button';
import { setAssetPath } from '@esri/calcite-components/dist/components';

// Set Calcite assets path to NPM bundled assets
setAssetPath('/node_modules/@esri/calcite-components/dist/calcite/assets');

// Basemap configuration for theme management
const BASEMAP_CONFIG = {
  light: {
    primary: 'streets-navigation-vector',
    alternate: 'satellite'
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
    
    // Apply theme to map view if available
    if (window.mapView) {
      this.applyThemeToView(window.mapView);
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

// Layer panel management
class LayerPanel {
  constructor() {
    this.panel = document.getElementById('layer-panel');
    this.header = document.querySelector('.layer-panel-header');
    this.toggleButton = document.getElementById('layer-panel-toggle');
    this.isOpen = false;
    this.init();
  }

  init() {
    // Toggle panel on header click (mobile) or button click
    this.header.addEventListener('click', () => this.toggle());

    // Handle swipe down to close on mobile
    this.setupSwipeGestures();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.panel.classList.toggle('open', this.isOpen);
  }

  setupSwipeGestures() {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    this.header.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    this.header.addEventListener('touchmove', (e) => {
      if (!isDragging) return;

      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      if (deltaY > 0 && this.isOpen) {
        e.preventDefault();
        const translateY = Math.min(deltaY, this.panel.offsetHeight);
        this.panel.style.transform = `translateY(${translateY}px)`;
      }
    }, { passive: false });

    this.header.addEventListener('touchend', () => {
      if (!isDragging) return;

      const deltaY = currentY - startY;
      if (deltaY > 50 && this.isOpen) {
        this.toggle();
      }

      this.panel.style.transform = '';
      isDragging = false;
    }, { passive: true });
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize components
  const themeManager = new ThemeManager();
  new LayerPanel();
  const mapApp = new MapApp();
  new PWAInstaller();

  // Make components available globally for debugging and theme management
  window.themeManager = themeManager;
  window.mapApp = mapApp;

  // Service worker is auto-registered by Vite PWA plugin
});

