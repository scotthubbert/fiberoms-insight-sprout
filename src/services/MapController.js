// MapController.js - Single Responsibility: Map initialization only
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import Extent from '@arcgis/core/geometry/Extent';
import { getServiceAreaBounds, getServiceAreaBoundsBase, getCurrentServiceArea } from '../config/searchConfig.js';
import { createLogger } from '../utils/logger.js';

// Initialize logger for this module
const log = createLogger('MapController');

export class MapController {
    constructor(layerManager, themeManager) {
        this.layerManager = layerManager;  // DIP: Depend on abstractions
        this.themeManager = themeManager;
        this.mapElement = document.getElementById('map');
        this.view = null;
        this.map = null;
    }

    async initialize() {
        // Pre-calculate bounds before waiting for map to be ready
        this.prepareServiceAreaBounds();

        await this.waitForMapReady();
        this.setupInitialConfiguration();
        this.configureView();
        this.applyTheme();

        // Fallback: ensure bounds are applied even if timing issues occur
        setTimeout(() => {
            if (this.view && this.view.extent && this.view.extent.width > 180) {
                log.warn('MapController: Applying bounds fallback - detected world view');
                this.applyServiceAreaBounds();
            }
            // Also retry home button configuration in case it wasn't ready initially
            this.configureHomeButton();
        }, 3000);
    }

    // Complete initial configuration including basemap fallback
    setupInitialConfiguration() {
        if (!this.view || !this.map) return;

        // Determine current theme for basemap strategy
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

        // Set up basemap fallback strategy
        this.setupBasemapFallback(isDarkMode);
    }

    // Pre-calculate service area bounds and center (called before map initialization)
    prepareServiceAreaBounds() {
        const bufferedBounds = getServiceAreaBounds();        // for constraints
        const baseBounds = getServiceAreaBoundsBase();         // for initial/home
        const serviceArea = getCurrentServiceArea();

        // Store both extents when available
        this.calculatedExtent = bufferedBounds ? new Extent(bufferedBounds) : null;
        this.calculatedExtentBase = baseBounds ? new Extent(baseBounds) : null;

        if (baseBounds) {
            // Calculate center from base (unbuffered) extent for initial zoom
            const centerLng = (baseBounds.xmin + baseBounds.xmax) / 2;
            const centerLat = (baseBounds.ymin + baseBounds.ymax) / 2;
            this.calculatedCenter = [centerLng, centerLat];
        } else {
            // Use configured center for global deployments
            this.calculatedCenter = [serviceArea.center.longitude, serviceArea.center.latitude];
        }
    }

    // Apply service area bounds after map is fully ready
    applyServiceAreaBounds() {
        if (!this.view) {
            log.warn('MapController: View not available for bounds application');
            return;
        }

        // Prepare bounds if not already done
        if (this.calculatedExtent === undefined) {
            this.prepareServiceAreaBounds();
        }

        // Prefer snapped zoom on mobile for performance and UX
        const isMobile = (typeof window !== 'undefined') && (
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
            (navigator.maxTouchPoints > 0) ||
            (window.innerWidth <= 768)
        );

        // Hint the web component as well (best-effort)
        try { if (isMobile && this.mapElement) this.mapElement.setAttribute('snap-to-zoom', 'true'); } catch (_) { }

        const serviceArea = getCurrentServiceArea();

        if (this.calculatedExtent) {
            // Apply geographic bounds for regional deployments
            this.view.constraints = {
                snapToZoom: !!isMobile,  // Snap on mobile, smooth on desktop
                geometry: this.calculatedExtent  // Constrain navigation to service area
            };

            // Set initial extent with immediate positioning
            const initialTarget = this.calculatedExtentBase || this.calculatedExtent;
            this.view.goTo(initialTarget, {
                animate: false,
                duration: 0
            }).catch(error => {
                log.error('MapController: Failed to apply service area bounds via goTo, using fallback:', error);
                // Fallback: set extent directly
                try {
                    this.view.extent = initialTarget;
                } catch (fallbackError) {
                    log.error('MapController: Extent fallback also failed:', fallbackError);
                }
            });
            log.info(`✅ Map constrained to ${serviceArea.name}`);
        } else {
            // Global deployment - no geographic constraints, just center the view
            this.view.constraints = {
                snapToZoom: !!isMobile  // Snap on mobile, smooth on desktop
                // No geometry constraint for global deployments
            };

            // Center on configured location
            this.view.goTo({
                center: this.calculatedCenter,
                zoom: 4  // Continental view for global deployments
            }, {
                animate: false,
                duration: 0
            }).catch(error => {
                log.error('MapController: Failed to center global view:', error);
            });
            log.info(`✅ Map configured for ${serviceArea.name} (global deployment)`);
        }

        // Re-assert snap after other async init may tweak constraints
        const ensureSnap = () => {
            try {
                if (isMobile && this.view && this.view.constraints && this.view.constraints.snapToZoom !== true) {
                    this.view.constraints = { ...this.view.constraints, snapToZoom: true };
                }
            } catch (_) { }
        };
        ensureSnap();
        setTimeout(ensureSnap, 500);
        setTimeout(ensureSnap, 2000);
    }

    // Configure home button to use service area bounds or center
    configureHomeButton() {
        if (!this.view) {
            log.warn('MapController: Cannot configure home button - view not available');
            return;
        }

        try {
            // Import required ArcGIS classes
            import('@arcgis/core/Viewpoint').then(({ default: Viewpoint }) => {
                // Create a viewpoint from our calculated extent or center
                let homeViewpoint;
                if (this.calculatedExtentBase || this.calculatedExtent) {
                    homeViewpoint = new Viewpoint({
                        targetGeometry: this.calculatedExtentBase || this.calculatedExtent
                    });
                } else {
                    // For global deployments, use center point and zoom level
                    homeViewpoint = new Viewpoint({
                        center: this.calculatedCenter,
                        scale: 50000000  // Continental scale for global deployments
                    });
                }

                // Method 1: Try to find and configure the home widget in the view UI
                const homeWidget = this.view.ui.find('arcgis-home');
                if (homeWidget && homeWidget.viewpoint !== undefined) {
                    homeWidget.viewpoint = homeViewpoint;
                    return; // Success - exit early
                }

                // Method 2: Try to find the home element in the DOM
                const homeElement = document.querySelector('arcgis-home');
                if (homeElement) {
                    // Wait for the element to be ready
                    const configureElement = () => {
                        if (homeElement.homeViewModel && homeElement.homeViewModel.viewpoint !== undefined) {
                            homeElement.homeViewModel.viewpoint = homeViewpoint;
                        } else if (homeElement.viewpoint !== undefined) {
                            homeElement.viewpoint = homeViewpoint;
                        } else {
                            // Try again after a short delay
                            setTimeout(configureElement, 500);
                        }
                    };

                    // Start configuration attempt
                    configureElement();
                }
            }).catch(error => {
                log.error('MapController: Failed to configure home button:', error);
            });
        } catch (error) {
            log.error('MapController: Error in home button configuration:', error);
        }
    }

    async waitForMapReady() {
        await customElements.whenDefined('arcgis-map');

        if (this.mapElement.ready) {
            this.onMapReady();
        } else {
            this.mapElement.addEventListener('arcgisViewReadyChange', (event) => {
                if (event.target.ready) {
                    this.onMapReady();
                }
            });
        }
    }

    onMapReady() {
        const view = this.mapElement.view || this.mapElement;
        if (!view || !view.map) return;

        this.view = view;
        this.map = view.map;
        window.mapView = view; // For theme management

        // Apply current theme now that the view is available (ensures Navigation Night on dark at startup)
        try {
            if (this.themeManager && typeof this.themeManager.applyTheme === 'function') {
                this.themeManager.applyTheme(this.themeManager.currentTheme);
            }
        } catch (e) {
            log.warn('MapController: failed to apply theme on view ready:', e);
        }

        // Wait for view to be fully ready before applying extent
        this.view.when(() => {
            this.applyServiceAreaBounds();
            this.configureHomeButton();
        }).catch(error => {
            log.error('MapController: Map view ready error:', error);
            // Fallback: try to apply bounds anyway
            setTimeout(() => {
                this.applyServiceAreaBounds();
                this.configureHomeButton();
            }, 2000);
        });
    }

    configureView() {
        if (!this.view) return;

        // Basic view configuration - extent will be applied later in applyServiceAreaBounds()
        // This prevents early extent setting that gets overridden by basemap loading
    }

    applyTheme() {
        if (this.themeManager && this.view) {
            this.themeManager.applyThemeToView(this.view);
        }
    }

    // Setup basemap fallback strategy to handle loading failures
    setupBasemapFallback(isDarkMode) {
        if (!this.view || !this.map) return;

        const fallbackBasemaps = isDarkMode
            ? ['streets-night-vector', 'dark-gray-vector', 'gray-vector']
            : ['streets-navigation-vector', 'gray-vector', 'satellite'];

        // Set the primary basemap for the theme
        const primaryBasemap = fallbackBasemaps[0];

        try {
            this.map.basemap = primaryBasemap;
        } catch (error) {
            log.warn('MapController: Failed to set primary basemap, trying fallback:', error);
            // Try the second option as fallback
            try {
                this.map.basemap = fallbackBasemaps[1] || 'gray';
            } catch (fallbackError) {
                log.error('MapController: All basemap options failed, using gray:', fallbackError);
                this.map.basemap = 'gray';
            }
        }
    }

    addLayer(layer, zOrder = 0) {
        if (!this.map) return;

        // Apply z-order for proper layer stacking
        if (layer.listMode !== 'hide') {
            layer.listMode = 'show';
        }

        // Add layer at specific index based on z-order
        // Higher z-order = higher index = appears on top
        const layers = this.map.layers;
        let insertIndex = 0;

        // Find the correct insertion point based on z-order
        for (let i = 0; i < layers.length; i++) {
            const existingLayer = layers.getItemAt(i);
            const existingZOrder = this.getLayerZOrder(existingLayer.id);

            if (zOrder > existingZOrder) {
                insertIndex = i + 1;
            } else {
                break;
            }
        }

        this.map.add(layer, insertIndex);
    }

    // Helper method to get z-order for existing layers
    getLayerZOrder(layerId) {
        const zOrderMap = {
            'rainviewer-radar': -10,
            'county-boundaries': 1,
            'fsa-boundaries': 5, // Below all point layers
            'online-subscribers': 10,
            'main-line-old': 28, // Below current main line
            'main-line-fiber': 30,
            'mst-fiber': 35,
            'closures': 40,
            'node-sites': 40,
            'mst-terminals': 50,
            'apco-outages': 51,
            'tombigbee-outages': 51,
            'splitters': 60,
            'offline-subscribers': 100,
            'fiber-outages': 120,
            'vehicles': 130,
            'weather-radar': 140
        };
        return zOrderMap[layerId] || 0;
    }
} 