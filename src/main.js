// Import ArcGIS core CSS for widgets
import '@arcgis/core/assets/esri/themes/light/main.css';

// Configure ArcGIS intl
import * as intl from '@arcgis/core/intl';
intl.setLocale('en');

// Import ArcGIS Map Components
import '@arcgis/map-components/dist/components/arcgis-map';
import '@arcgis/map-components/dist/components/arcgis-zoom';
import '@arcgis/map-components/dist/components/arcgis-home';
import '@arcgis/map-components/dist/components/arcgis-locate';

// Import Calcite components
import '@esri/calcite-components/dist/components/calcite-button';
import { setAssetPath } from '@esri/calcite-components/dist/components';

// Set Calcite assets path
setAssetPath('https://js.arcgis.com/calcite-components/3.2.1/assets');

// Theme management
class ThemeManager {
  constructor() {
    this.themeToggle = document.getElementById('theme-toggle');
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.init();
  }

  init() {
    // Apply saved theme
    this.applyTheme(this.currentTheme);
    
    // Setup theme toggle
    this.themeToggle.addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.updateToggleIcon(theme);
    
    // Update Calcite theme
    const calciteTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('calcite-mode-dark', calciteTheme === 'dark');
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
  }

  updateToggleIcon(theme) {
    const icon = theme === 'dark' ? 'brightness' : 'moon';
    this.themeToggle.setAttribute('icon-start', icon);
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
    });

    this.header.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      if (deltaY > 0 && this.isOpen) {
        e.preventDefault();
        const translateY = Math.min(deltaY, this.panel.offsetHeight);
        this.panel.style.transform = `translateY(${translateY}px)`;
      }
    });

    this.header.addEventListener('touchend', () => {
      if (!isDragging) return;
      
      const deltaY = currentY - startY;
      if (deltaY > 50 && this.isOpen) {
        this.toggle();
      }
      
      this.panel.style.transform = '';
      isDragging = false;
    });
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
      console.log('Map view ready:', event.detail);
      this.onMapReady(event.detail);
    });
  }

  onMapReady(view) {
    if (!view) return;
    
    // Map is ready
    console.log('Map initialized successfully');
    
    // Store view reference
    this.view = view;
    this.map = view.map;
    
    // Log the view properties to debug
    console.log('View properties:', {
      center: view.center,
      zoom: view.zoom,
      container: view.container
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

    // Check if app is installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('App is already installed');
    }
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
        console.log('Install prompt outcome:', outcome);
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
  new ThemeManager();
  new LayerPanel();
  new MapApp();
  new PWAInstaller();
  
  // Service worker is auto-registered by Vite PWA plugin
});

// Handle app visibility changes (important for mobile)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('App is in background');
  } else {
    console.log('App is in foreground');
  }
});