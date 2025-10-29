// main.js - SOLID-compliant application entry point following CLAUDE.md principles
// FiberOMS Insight PWA - Mobile-first fiber network management application
// Features: Search functionality, layer management, theme switching

// ============================================================================
// AUTHENTICATION-FIRST ARCHITECTURE
// Only essential auth services are imported here. All other imports are
// deferred until after successful authentication to prevent data loading
// and service initialization before the user is authenticated.
// ============================================================================

// Import ONLY authentication services (minimal imports)
import { authService } from './services/AuthService.js';
import { AuthContainer } from './ui/AuthContainer.js';
import { createLogger } from './utils/logger.js';

// Initialize logger for main module
const log = createLogger('Main');

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize authentication FIRST
  try {
    log.info('🔐 Checking authentication...');

    const isAuthenticated = await authService.initialize();

    if (isAuthenticated) {
      // User is authenticated - load and initialize the app
      log.info('✅ User authenticated, loading application...');
      authService.showApp();

      // Dynamically import and initialize the full application
      await initializeAuthenticatedApp();
    } else {
      // User not authenticated - show sign-in UI only
      log.info('ℹ️ User not authenticated, showing sign-in...');
      authService.hideApp();

      const authContainer = new AuthContainer();
      await authContainer.init();

      // Listen for authentication completion
      document.addEventListener('authenticationComplete', async () => {
        log.info('✅ Authentication complete, loading application...');

        // Dynamically import and initialize the full application
        await initializeAuthenticatedApp();
      }, { once: true });
    }
  } catch (error) {
    log.error('❌ Authentication initialization failed:', error);

    // Show error message
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
      authContainer.innerHTML = `
        <div class="auth-error-page">
          <calcite-notice kind="danger" open>
            <div slot="title">Authentication Error</div>
            <div slot="message">Failed to initialize authentication. Please refresh the page or contact support.</div>
          </calcite-notice>
          <calcite-button onclick="window.location.reload()">Reload Page</calcite-button>
        </div>
      `;
      authContainer.style.display = 'flex';
    }
  }
});

/**
 * Initialize the full application after authentication is confirmed
 * This function dynamically imports all heavy dependencies
 */
async function initializeAuthenticatedApp() {
  log.info('📦 Loading application modules...');
  // Load modules in parallel
  const [
    { errorService: ImportedErrorService },
    intlModule,
    esriConfigModule,
    { PWAInstaller },
    { initVersionCheck },
    { setupCalciteIconFallback },
    { setAssetPath },
    { Application },
    { initSentryIfEnabled, captureError: sentryCaptureError },
    _powerOutageStats  // Import but don't need the export
  ] = await Promise.all([
    // Core services
    import('./services/ErrorService.js'),
    import('@arcgis/core/intl'),
    import('@arcgis/core/config'),
    import('./core/PWAInstaller.js'),
    import('./utils/versionCheck.js'),
    import('./utils/calciteIconFallback.js'),
    import('@esri/calcite-components/dist/components'),
    import('./core/Application.js'),
    import('./services/SentryService.js'),
    import('./components/PowerOutageStats.js'),
    // CalciteUI core (mobile + shared)
    import('@esri/calcite-components/dist/components/calcite-shell'),
    import('@esri/calcite-components/dist/components/calcite-navigation'),
    import('@esri/calcite-components/dist/components/calcite-navigation-logo'),
    import('@esri/calcite-components/dist/components/calcite-button'),
    import('@esri/calcite-components/dist/components/calcite-icon'),
    import('@esri/calcite-components/dist/components/calcite-loader'),
    import('@esri/calcite-components/dist/components/calcite-chip'),
    import('@esri/calcite-components/dist/components/calcite-block'),
    import('@esri/calcite-components/dist/components/calcite-input'),
    import('@esri/calcite-components/dist/components/calcite-switch'),
    import('@esri/calcite-components/dist/components/calcite-notice'),
    import('@esri/calcite-components/dist/components/calcite-alert'),
    import('@esri/calcite-components/dist/components/calcite-list'),
    import('@esri/calcite-components/dist/components/calcite-list-item'),
    import('@esri/calcite-components/dist/components/calcite-autocomplete'),
    import('@esri/calcite-components/dist/components/calcite-autocomplete-item'),
    // Mobile tab bar components (needed early to prevent componentOnReady errors)
    import('@esri/calcite-components/dist/components/calcite-segmented-control'),
    import('@esri/calcite-components/dist/components/calcite-segmented-control-item'),
    // ArcGIS Map Components - core
    import('@arcgis/map-components/dist/components/arcgis-map')
  ]);

  // Defer dialog component - only used in modals that open on user action
  // Saves ~8-12KB from critical path, loads during idle time
  const loadDialogComponents = async () => {
    log.info('📦 Loading dialog components during idle time...');
    await import('@esri/calcite-components/dist/components/calcite-dialog');
    log.info('✅ Dialog components loaded and ready');
  };

  // Schedule dialog loading during idle time
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => loadDialogComponents(), { timeout: 2000 });
  } else {
    setTimeout(() => loadDialogComponents(), 1000);
  }

  // Ensure dialogs are loaded if user opens a dialog before idle task runs
  const ensureDialogLoaded = async () => {
    if (!customElements.get('calcite-dialog')) await loadDialogComponents();
  };
  const dialogOpenObserver = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes' && m.attributeName === 'open' && m.target.tagName === 'CALCITE-DIALOG') {
        ensureDialogLoaded();
        break;
      }
    }
  });
  dialogOpenObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['open'] });

  // Setup error handlers immediately
  setupErrorHandlers(log, ImportedErrorService);

  // Configure ArcGIS intl (namespace import)
  intlModule.setLocale('en');

  // Configure ArcGIS API key (default export)
  const arcgisApiKey = import.meta.env.VITE_ARCGIS_API_KEY;
  if (arcgisApiKey) {
    esriConfigModule.default.apiKey = arcgisApiKey;
  }

  // Set Calcite assets path
  const assetsPath = import.meta.env.PROD
    ? '/calcite/assets'
    : '/node_modules/@esri/calcite-components/dist/calcite/assets';
  log.info('🎨 Setting CalciteUI asset path:', assetsPath);
  setAssetPath(assetsPath);

  // Desktop-only Calcite set: load when desktop is detected
  let desktopCalciteLoaded = false;
  const loadDesktopCalcite = async () => {
    if (desktopCalciteLoaded) return;
    await Promise.all([
      import('@esri/calcite-components/dist/components/calcite-shell-panel'),
      import('@esri/calcite-components/dist/components/calcite-panel'),
      import('@esri/calcite-components/dist/components/calcite-block'),
      import('@esri/calcite-components/dist/components/calcite-action'),
      import('@esri/calcite-components/dist/components/calcite-action-bar'),
      import('@esri/calcite-components/dist/components/calcite-action-group'),
      import('@esri/calcite-components/dist/components/calcite-checkbox'),
      import('@esri/calcite-components/dist/components/calcite-label'),
      import('@esri/calcite-components/dist/components/calcite-card'),
      import('@esri/calcite-components/dist/components/calcite-select'),
      import('@esri/calcite-components/dist/components/calcite-option')
    ]);
    desktopCalciteLoaded = true;
  };

  const mqDesktop = window.matchMedia('(min-width: 900px) and (pointer: fine)');
  if (mqDesktop.matches) {
    await loadDesktopCalcite();
  } else {
    // Load on transition to desktop
    mqDesktop.addEventListener('change', (e) => { if (e.matches) loadDesktopCalcite(); });
  }

  log.info('✅ Core components loaded; desktop Calcite will load on demand');

  // Setup icon fallback handling
  setupCalciteIconFallback();

  // Initialize Sentry if enabled
  initSentryIfEnabled().then((enabled) => {
    if (enabled) {
      ImportedErrorService.subscribe((evt) => {
        if (evt.type === 'error' && evt.error) sentryCaptureError(evt.error, evt.context);
      });
    }
  });

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
  log.info('🚀 Initializing Application...');
  window.app = new Application();

  // Setup sign-out button
  setupSignOutButton();

  // Expose debug functions
  setupDebugFunctions(log);

  log.info('✅ Application fully initialized');
}

/**
 * Setup sign-out button handler
 */
function setupSignOutButton() {
  const signOutButton = document.getElementById('sign-out-button');
  if (signOutButton) {
    signOutButton.addEventListener('click', async () => {
      try {
        log.info('🚪 User initiated sign-out');
        await authService.signOut();
      } catch (error) {
        log.error('❌ Sign-out failed:', error);
      }
    });
    log.info('✅ Sign-out button configured');
  }
}

/**
 * Setup global error handlers
 */
function setupErrorHandlers(log, ErrorService) {
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
        log.warn('🔇 Suppressed non-critical error:', errorMessage);
        ErrorService.report(event.reason, { origin: 'unhandledrejection' });
        event.preventDefault();
      }
    }
  });

  // Additional error handler for SyntaxError JSON parsing issues
  window.addEventListener('error', event => {
    if (event.error && event.error.name === 'SyntaxError' &&
      event.error.message.includes('Unexpected token')) {
      log.warn('🔇 Suppressed JSON parsing error (likely from external API):', event.error.message);
      ErrorService.report(event.error, { origin: 'window.error' });
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
        errorMessage.includes('componentOnReady is not a function') ||
        errorMessage.includes('calcite-') && errorMessage.includes('undefined') ||
        errorMessage.includes('PE.render') ||
        errorMessage.includes('PE.update') ||
        error.stack?.includes('calcite-')) {
        log.warn('🔇 Suppressed CalciteUI component error (non-critical):', errorMessage.substring(0, 100));
        ErrorService.report(error, { origin: 'calcite-unhandledrejection' });
        event.preventDefault();

        // Try to recover mobile UI if it was affected
        setTimeout(() => {
          const app = window.app;
          if (app && app.services && app.services.mobileTabBar) {
            log.info('🔄 Attempting mobile UI recovery after CalciteUI error');
            app.services.mobileTabBar.recoverMobileUI();
          }
        }, 500);

        return;
      }
    }
  });

  // Additional error handler for CalciteUI errors specifically
  window.addEventListener('error', event => {
    if (event.error && event.error.message) {
      const errorMessage = event.error.message;

      // Suppress specific CalciteUI errors that break functionality
      if (errorMessage.includes('Cannot read properties of undefined (reading \'replace\')') ||
        errorMessage.includes('componentOnReady is not a function') ||
        errorMessage.includes('TypeError: Cannot read properties of undefined') && errorMessage.includes('replace')) {
        log.warn('🔇 Suppressed CalciteUI error (non-critical):', errorMessage.substring(0, 100));
        ErrorService.report(event.error, { origin: 'calcite-window.error' });
        event.preventDefault();
        return false;
      }
    }
  });
}

/**
 * Setup debug functions for development
 */
function setupDebugFunctions(log) {
  // Check GeotabService configuration specifically for production
  window.checkGeotabConfig = async function () {
    try {
      log.info('🚛 Checking GeotabService configuration...');

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

      log.info('GeotabService Config:', config);

      // Import and check service
      import('./services/GeotabService.js').then(module => {
        const service = module.geotabService;
        log.info('GeotabService Status:', service.getStatus());
        log.info('GeotabService lastTruckData:', service.lastTruckData);
        log.info('GeotabService authenticated:', service.isAuthenticated);
      }).catch(error => {
        log.error('GeotabService import error:', error);
      });

    } catch (error) {
      log.error('🚛 GeotabService check failed:', error);
    }
  };

  // Simple production debug function
  window.debugVehicles = () => {
    try {
      log.info('🚛 === Vehicle Debug Info ===');
      log.info('Environment:', {
        isDev: import.meta.env.DEV,
        mode: import.meta.env.MODE
      });
      log.info('Global objects:', {
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
          log.info(`${id}:`, {
            exists: true,
            hidden: el.hidden,
            display: getComputedStyle(el).display,
            children: el.children.length
          });
        } else {
          log.info(`${id}: NOT FOUND`);
        }
      });

      return 'Vehicle debug info logged to console';
    } catch (error) {
      log.error('❌ Error in debugVehicles:', error);
      return `Error: ${error.message}`;
    }
  };
}

// Handle cleanup on page unload
window.addEventListener('unload', () => {
  if (window.app && typeof window.app.cleanup === 'function') {
    window.app.cleanup();
  }
});
