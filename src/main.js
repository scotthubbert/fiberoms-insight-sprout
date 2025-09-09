// main.js - SOLID-compliant application entry point following CLAUDE.md principles
// FiberOMS Insight PWA - Mobile-first fiber network management application
// Features: Search functionality, layer management, theme switching

// Configure ArcGIS intl
import * as intl from '@arcgis/core/intl';
intl.setLocale('en');

// Configure ArcGIS API key
import esriConfig from '@arcgis/core/config';
const arcgisApiKey = import.meta.env.VITE_ARCGIS_API_KEY;
if (arcgisApiKey) {
  esriConfig.apiKey = arcgisApiKey;
}

// Import SOLID-compliant services (DIP - Dependency Injection)
import { MapController } from './services/MapController.js';
import { LayerManager } from './services/LayerManager.js';
import { PopupManager } from './services/PopupManager.js';
import { RainViewerService } from './services/RainViewerService.js';
import { subscriberDataService, pollingManager } from './dataService.js';
import { layerConfigs, getLayerConfig, getAllLayerIds } from './config/layerConfigs.js';
import { getCurrentServiceArea, getServiceAreaBounds, getSearchSettings } from './config/searchConfig.js';
import { geotabService } from './services/GeotabService.js';
import { CSVExportService } from './utils/csvExport.js';
import * as clipboardUtils from './utils/clipboardUtils.js';
import { ThemeManager as ImportedThemeManager } from './ui/ThemeManager.js';
import { PollingService } from './services/PollingService.js';

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
// Defer measurement widget load until first use

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
import { PWAInstaller as ImportedPWAInstaller } from './core/PWAInstaller.js';
import { HeaderSearch as ImportedHeaderSearch } from './ui/HeaderSearch.js';
import { DashboardManager as ImportedDashboardManager } from './ui/DashboardManager.js';
import { MobileTabBar as ImportedMobileTabBar } from './ui/MobileTabBar.js';
import { Application as ImportedApplication } from './core/Application.js';
import { LayerPanel as ImportedLayerPanel } from './ui/LayerPanel.js';
import { errorService as ImportedErrorService } from './services/ErrorService.js';
import { initSentryIfEnabled, captureError as sentryCaptureError } from './services/SentryService.js';

// Production logging utility
const isDevelopment = import.meta.env.DEV;
const log = {
  info: (...args) => isDevelopment && console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};

// Set Calcite assets path - simplified approach
const assetsPath = import.meta.env.PROD
  ? '/calcite/assets'
  : '/node_modules/@esri/calcite-components/dist/calcite/assets';

log.info('🎨 Setting CalciteUI asset path:', assetsPath);
setAssetPath(assetsPath);

// Initialize Sentry if enabled
initSentryIfEnabled().then((enabled) => {
  if (enabled) {
    ImportedErrorService.subscribe((evt) => {
      if (evt.type === 'error' && evt.error) sentryCaptureError(evt.error, evt.context);
    });
  }
});

// Simplified CalciteUI initialization - all assets are now copied
log.info('✅ CalciteUI components loaded with bulk import and complete asset copying');

// Setup icon fallback handling
setupCalciteIconFallback();

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
      ImportedErrorService.report(event.reason, { origin: 'unhandledrejection' });
      event.preventDefault(); // Prevent the error from bubbling up and crashing the app
    }
  }
});

// Additional error handler for SyntaxError JSON parsing issues
window.addEventListener('error', event => {
  if (event.error && event.error.name === 'SyntaxError' &&
    event.error.message.includes('Unexpected token')) {
    console.warn('🔇 Suppressed JSON parsing error (likely from external API):', event.error.message);
    ImportedErrorService.report(event.error, { origin: 'window.error' });
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
      ImportedErrorService.report(error, { origin: 'calcite-unhandledrejection' });
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
      ImportedErrorService.report(event.error, { origin: 'calcite-window.error' });
      event.preventDefault();
      return false;
    }
  }
});

// ThemeManager moved to ./ui/ThemeManager.js

// Polling Service - Single Responsibility Principle (disabled for Phase 1)
// PollingService moved to ./services/PollingService.js

// Layer Panel Manager - Single Responsibility Principle
// LayerPanel moved to ./ui/LayerPanel.js

// setupPrtgIframe migrated with LayerPanel
// MobileTabBar moved to ./ui/MobileTabBar.js

// DashboardManager moved to ./ui/DashboardManager.js

// HeaderSearch moved to ./ui/HeaderSearch.js

// Application moved to ./core/Application.js

// PWAInstaller moved to ./core/PWAInstaller.js

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize PWA installer
  const pwaInstaller = new ImportedPWAInstaller();
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
  window.app = new ImportedApplication();

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

    } catch (error) {
      console.error('🚛 GeotabService check failed:', error);
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

      return 'Vehicle debug info logged to console';
    } catch (error) {
      console.error('❌ Error in debugVehicles:', error);
      return `Error: ${error.message}`;
    }
  };
});

// Handle cleanup on page unload
window.addEventListener('unload', () => {
  if (window.app && typeof window.app.cleanup === 'function') {
    window.app.cleanup();
  }
});
