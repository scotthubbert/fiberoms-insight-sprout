// MapController.js - Single Responsibility: Map initialization only
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import Basemap from '@arcgis/core/Basemap';
import Extent from '@arcgis/core/geometry/Extent';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';
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
        this._boundsApplied = false; // Guard to prevent multiple bounds applications
    }

    async initialize() {
        // Pre-calculate bounds before waiting for map to be ready
        await this.prepareServiceAreaBounds();

        // Set initial extent on map element BEFORE view initializes (prevents world-view flash)
        if (this.mapElement) {
            try {
                // Hide visually but keep layout (will be shown after extent is applied)
                this.mapElement.style.visibility = 'hidden';

                // Set extent directly on map element as property (preferred over attribute for complex objects)
                if (this.calculatedExtentBase) {
                    // Set as property - ArcGIS map component accepts Extent objects directly
                    console.log('[ZOOM DEBUG] Step 1: Setting extent on mapElement BEFORE view init', {
                        extent: this.calculatedExtentBase,
                        xmin: this.calculatedExtentBase.xmin,
                        ymin: this.calculatedExtentBase.ymin,
                        xmax: this.calculatedExtentBase.xmax,
                        ymax: this.calculatedExtentBase.ymax,
                        width: this.calculatedExtentBase.width,
                        height: this.calculatedExtentBase.height
                    });
                    this.mapElement.extent = this.calculatedExtentBase;
                    log.info('✅ Set initial extent on map element (DA boundaries)');
                } else if (this.calculatedCenter?.length === 2) {
                    // Fallback to center if extent not available
                    this.mapElement.setAttribute('center', `${this.calculatedCenter[0]},${this.calculatedCenter[1]}`);
                    this.mapElement.setAttribute('zoom', '10'); // Reasonable zoom level
                }
            } catch (error) {
                log.warn('Failed to set initial extent on map element:', error);
            }
        }

        await this.waitForMapReady();
        this.setupInitialConfiguration();
        this.configureView();
        this.applyTheme();

        // Fallback: ensure bounds are applied even if timing issues occur
        // Only check if bounds haven't been applied yet
        setTimeout(async () => {
            if (!this._boundsApplied && this.view && this.view.extent && this.view.extent.width > 180) {
                log.warn('MapController: Applying bounds fallback - detected world view');
                await this.applyServiceAreaBounds();
            }
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
    async prepareServiceAreaBounds() {
        const bufferedBounds = getServiceAreaBounds();        // for constraints
        const baseBounds = getServiceAreaBoundsBase();         // for initial/home
        const serviceArea = getCurrentServiceArea();

        // Try to load DA boundaries and calculate extent from them for initial view
        let daExtent = null;
        try {
            const { API_CONFIG } = await import('../config/apiConfig.js');
            const daUrl = API_CONFIG.INFRASTRUCTURE.FSA_BOUNDARIES;
            if (daUrl) {
                const response = await fetch(daUrl);
                if (response.ok) {
                    const geojson = await response.json();
                    const features = geojson.features || [];
                    if (features.length > 0) {
                        // Calculate extent from all DA boundary features
                        let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
                        features.forEach(feature => {
                            if (feature.geometry && feature.geometry.coordinates) {
                                const coords = feature.geometry.coordinates;
                                const processPoint = (point) => {
                                    const [lng, lat] = point;
                                    xmin = Math.min(xmin, lng);
                                    ymin = Math.min(ymin, lat);
                                    xmax = Math.max(xmax, lng);
                                    ymax = Math.max(ymax, lat);
                                };

                                // Handle both Polygon and MultiPolygon geometries
                                if (feature.geometry.type === 'Polygon') {
                                    // Polygon: array of rings, each ring is array of [lng, lat] points
                                    coords.forEach(ring => {
                                        ring.forEach(point => processPoint(point));
                                    });
                                } else if (feature.geometry.type === 'MultiPolygon') {
                                    // MultiPolygon: array of polygons, each polygon is array of rings
                                    coords.forEach(polygon => {
                                        polygon.forEach(ring => {
                                            ring.forEach(point => processPoint(point));
                                        });
                                    });
                                }
                            }
                        });

                        if (xmin !== Infinity) {
                            // Add small buffer (5% on each side) for better view
                            const xBuffer = (xmax - xmin) * 0.05;
                            const yBuffer = (ymax - ymin) * 0.05;
                            daExtent = {
                                xmin: xmin - xBuffer,
                                ymin: ymin - yBuffer,
                                xmax: xmax + xBuffer,
                                ymax: ymax + yBuffer,
                                spatialReference: { wkid: 4326 }
                            };
                            log.info('✅ Calculated extent from DA boundaries');
                        }
                    }
                }
            }
        } catch (error) {
            log.warn('Failed to load DA boundaries for extent calculation, using service area bounds:', error);
        }

        // Use DA extent for initial view if available, otherwise fall back to service area bounds
        const initialBounds = daExtent || baseBounds;
        const bufferedInitialBounds = daExtent ? {
            ...daExtent,
            xmin: daExtent.xmin - 0.01,
            ymin: daExtent.ymin - 0.01,
            xmax: daExtent.xmax + 0.01,
            ymax: daExtent.ymax + 0.01
        } : bufferedBounds;

        // Calculate final extent with padding (20px equivalent in degrees) - this is the final zoom level
        // We'll use this as the initial extent to avoid double zoom
        let finalExtent = initialBounds;
        if (initialBounds) {
            // Add padding equivalent to 20px on each side (roughly 0.001 degrees per 100px at zoom 10)
            // More conservative padding for better initial view
            const paddingDegrees = 0.002; // Small padding for better view
            finalExtent = {
                ...initialBounds,
                xmin: initialBounds.xmin - paddingDegrees,
                ymin: initialBounds.ymin - paddingDegrees,
                xmax: initialBounds.xmax + paddingDegrees,
                ymax: initialBounds.ymax + paddingDegrees,
                spatialReference: initialBounds.spatialReference || { wkid: 4326 }
            };
        }

        // Store extents - use final extent (with padding) as the initial extent
        this.calculatedExtent = bufferedInitialBounds ? new Extent(bufferedInitialBounds) : null;
        this.calculatedExtentBase = finalExtent ? new Extent(finalExtent) : null; // Final extent with padding is the base

        if (initialBounds) {
            // Calculate center from initial extent
            const centerLng = (initialBounds.xmin + initialBounds.xmax) / 2;
            const centerLat = (initialBounds.ymin + initialBounds.ymax) / 2;
            this.calculatedCenter = [centerLng, centerLat];
        } else {
            // Use configured center for global deployments
            this.calculatedCenter = [serviceArea.center.longitude, serviceArea.center.latitude];
        }
    }

    // Apply service area bounds after map is fully ready
    async applyServiceAreaBounds() {
        if (!this.view) {
            log.warn('MapController: View not available for bounds application');
            return;
        }

        // Prevent multiple bounds applications (causes double zoom)
        if (this._boundsApplied) {
            log.info('MapController: Bounds already applied, skipping duplicate call');
            return;
        }

        // Prepare bounds if not already done
        if (this.calculatedExtent === undefined) {
            await this.prepareServiceAreaBounds();
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
            // Project constraint geometry to match view's spatial reference
            let constraintGeometry = this.calculatedExtent;

            // Check if spatial references match
            const viewSR = this.view.spatialReference;
            const extentSR = this.calculatedExtent.spatialReference;

            if (viewSR && extentSR && viewSR.wkid !== extentSR.wkid) {
                log.info(`Projecting constraint from WKID ${extentSR.wkid} to ${viewSR.wkid}`);
                try {
                    // Import the new projectOperator (replaces deprecated projection module since 4.32)
                    const projectOperatorModule = await import('@arcgis/core/geometry/operators/projectOperator.js');
                    const projectOperator = projectOperatorModule.default || projectOperatorModule;

                    // Load projection engine
                    await projectOperator.load();

                    // Project the extent using the new operator - method is 'execute' in ArcGIS 4.32+
                    constraintGeometry = projectOperator.execute(this.calculatedExtent, viewSR);

                    if (constraintGeometry) {
                        log.info('✅ Constraint geometry projected successfully');
                    } else {
                        throw new Error('Projection returned null');
                    }
                } catch (projError) {
                    log.error('Projection failed:', projError);
                    log.warn('WARNING: Constraint geometry projection failed - not applying constraint to avoid clipping');
                    // DON'T use constraint if projection fails - it's worse than no constraint
                    constraintGeometry = null;
                }
            }

            // Apply geographic bounds for regional deployments
            // Only apply geometry constraint if projection succeeded
            if (constraintGeometry) {
                this.view.constraints = {
                    snapToZoom: !!isMobile,  // Snap on mobile, smooth on desktop
                    geometry: constraintGeometry  // Constrain navigation to service area (now in correct SR)
                };
                log.info('✅ Constraint geometry applied to view');
            } else {
                // Projection failed - use no geometry constraint to avoid clipping
                this.view.constraints = {
                    snapToZoom: !!isMobile  // Snap on mobile, smooth on desktop
                    // NO geometry constraint - better to have no constraint than wrong constraint
                };
                log.warn('⚠️  NO constraint geometry applied (projection failed)');
            }

            // Set initial extent - check if already correct to avoid double zoom
            // Since extent was already set on mapElement before view initialized, we may not need to set it again
            const initialTarget = this.calculatedExtentBase || this.calculatedExtent;

            // Check if current extent is already close to target (within 1% tolerance)
            const currentExtent = this.view.extent;
            let needsExtentUpdate = true;
            if (currentExtent && initialTarget) {
                const widthDiff = Math.abs(currentExtent.width - initialTarget.width) / initialTarget.width;
                const heightDiff = Math.abs(currentExtent.height - initialTarget.height) / initialTarget.height;
                const centerDiff = currentExtent.center && initialTarget.center ?
                    Math.sqrt(
                        Math.pow(currentExtent.center.longitude - initialTarget.center.longitude, 2) +
                        Math.pow(currentExtent.center.latitude - initialTarget.center.latitude, 2)
                    ) : 0;

                // If extent is already very close (within 1% and center within 0.01 degrees), skip update
                if (widthDiff < 0.01 && heightDiff < 0.01 && centerDiff < 0.01) {
                    needsExtentUpdate = false;
                    console.log('[ZOOM DEBUG] Step 3: Extent already correct, skipping update', {
                        currentZoom: this.view.zoom,
                        widthDiff: (widthDiff * 100).toFixed(2) + '%',
                        heightDiff: (heightDiff * 100).toFixed(2) + '%',
                        centerDiff: centerDiff.toFixed(4)
                    });
                }
            }

            console.log('[ZOOM DEBUG] Step 3: About to apply bounds', {
                needsExtentUpdate,
                currentViewExtent: currentExtent ? {
                    xmin: currentExtent.xmin,
                    ymin: currentExtent.ymin,
                    xmax: currentExtent.xmax,
                    ymax: currentExtent.ymax,
                    width: currentExtent.width,
                    height: currentExtent.height,
                    zoom: this.view.zoom
                } : null,
                targetExtent: initialTarget ? {
                    xmin: initialTarget.xmin,
                    ymin: initialTarget.ymin,
                    xmax: initialTarget.xmax,
                    ymax: initialTarget.ymax,
                    width: initialTarget.width,
                    height: initialTarget.height
                } : null,
                currentZoom: this.view.zoom
            });

            if (needsExtentUpdate) {
                try {
                    // Expose initial extent for other modules (e.g., search widget)
                    const toJson = (ext) => (ext && typeof ext.toJSON === 'function') ? ext.toJSON() : ext;
                    window.initialMapExtent = toJson(initialTarget);

                    // Set extent directly (no goTo with padding) since final extent was already calculated with padding
                    // This ensures single zoom operation
                    const beforeZoom = this.view.zoom;
                    this.view.extent = initialTarget;
                    const afterZoom = this.view.zoom;

                    console.log('[ZOOM DEBUG] Step 4: Extent set directly', {
                        beforeZoom,
                        afterZoom,
                        zoomChanged: beforeZoom !== afterZoom,
                        newExtent: this.view.extent ? {
                            xmin: this.view.extent.xmin,
                            ymin: this.view.extent.ymin,
                            xmax: this.view.extent.xmax,
                            ymax: this.view.extent.ymax,
                            width: this.view.extent.width,
                            height: this.view.extent.height
                        } : null
                    });

                    log.info('✅ Extent set directly (no double zoom)');
                } catch (error) {
                    console.error('[ZOOM DEBUG] Step 4 ERROR: Failed to set extent directly', error);
                    log.error('MapController: Failed to set extent directly, using goTo fallback:', error);
                    // Fallback: use goTo if direct assignment fails
                    try {
                        const beforeZoom = this.view.zoom;
                        console.log('[ZOOM DEBUG] Step 4 FALLBACK: Using goTo', { beforeZoom });
                        this.view.goTo(initialTarget, {
                            animate: false,
                            duration: 0
                        }).then(() => {
                            console.log('[ZOOM DEBUG] Step 4 FALLBACK: goTo completed', {
                                afterZoom: this.view.zoom,
                                zoomChanged: beforeZoom !== this.view.zoom
                            });
                        });
                    } catch (fallbackError) {
                        console.error('[ZOOM DEBUG] Step 4 FALLBACK ERROR:', fallbackError);
                        log.error('MapController: Extent fallback also failed:', fallbackError);
                    }
                }
            } else {
                // Extent already correct, just expose it for other modules
                try {
                    const toJson = (ext) => (ext && typeof ext.toJSON === 'function') ? ext.toJSON() : ext;
                    window.initialMapExtent = toJson(currentExtent || initialTarget);
                    console.log('[ZOOM DEBUG] Step 4: Skipped extent update (already correct)', {
                        zoom: this.view.zoom
                    });
                } catch (_) { }
            }

            // Mark bounds as applied to prevent duplicate calls
            this._boundsApplied = true;
            // Map already visible for progressive loading - extent set (single zoom)
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
                zoom: 6  // Slightly closer than world to reduce initial flash
            }, {
                animate: false,
                duration: 0
            }).catch(error => {
                log.error('MapController: Failed to center global view:', error);
            }).finally(() => {
                // Mark bounds as applied to prevent duplicate calls
                this._boundsApplied = true;
                // Map already visible for progressive loading - centering complete
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

        // Log initial view state
        console.log('[ZOOM DEBUG] Step 2: Map view is ready', {
            currentExtent: view.extent ? {
                xmin: view.extent.xmin,
                ymin: view.extent.ymin,
                xmax: view.extent.xmax,
                ymax: view.extent.ymax,
                width: view.extent.width,
                height: view.extent.height,
                zoom: view.zoom
            } : null,
            zoom: view.zoom,
            center: view.center ? [view.center.longitude, view.center.latitude] : null,
            mapElementExtent: this.mapElement.extent ? {
                xmin: this.mapElement.extent.xmin,
                ymin: this.mapElement.extent.ymin,
                xmax: this.mapElement.extent.xmax,
                ymax: this.mapElement.extent.ymax
            } : null
        });

        // Show map immediately for progressive loading (extent already set on element, so no world view flash)
        // Components will load progressively in the background
        try {
            if (this.mapElement) {
                this.mapElement.style.visibility = 'visible';
                log.info('✅ Map visible - progressive component loading enabled');
            }
        } catch (_) { }

        // Configure popup NOW that view exists
        this.configurePopup();

        // Apply current theme now that the view is available (ensures Navigation Night on dark at startup)
        try {
            if (this.themeManager && typeof this.themeManager.applyTheme === 'function') {
                this.themeManager.applyTheme(this.themeManager.currentTheme);
            }
        } catch (error) {
            log.error('Error applying theme on map ready:', error);
        }

        // Apply service area bounds when view is ready (happens in background, map already visible)
        // But only if extent wasn't already set correctly on mapElement
        reactiveUtils.when(() => view.stationary, async () => {
            try {
                // Check if extent is already correct before applying bounds
                const currentExtent = view.extent;
                const targetExtent = this.calculatedExtentBase || this.calculatedExtent;

                if (currentExtent && targetExtent) {
                    const widthDiff = Math.abs(currentExtent.width - targetExtent.width) / targetExtent.width;
                    const heightDiff = Math.abs(currentExtent.height - targetExtent.height) / targetExtent.height;

                    // If extent is already very close (within 2%), skip applying bounds to avoid double zoom
                    if (widthDiff < 0.02 && heightDiff < 0.02) {
                        console.log('[ZOOM DEBUG] Skipping applyServiceAreaBounds - extent already correct', {
                            currentZoom: view.zoom,
                            widthDiff: (widthDiff * 100).toFixed(2) + '%',
                            heightDiff: (heightDiff * 100).toFixed(2) + '%'
                        });
                        // Mark as applied to prevent fallback from triggering
                        this._boundsApplied = true;
                        return;
                    }
                }

                await this.applyServiceAreaBounds();
            } catch (error) {
                log.error('MapController: Map view ready error:', error);
                // Fallback: try to apply bounds anyway (only if not already applied)
                if (!this._boundsApplied) {
                    setTimeout(async () => {
                        try {
                            await this.applyServiceAreaBounds();
                        } catch (fallbackError) {
                            log.error('MapController: Fallback bounds application also failed:', fallbackError);
                        }
                    }, 2000);
                }
            }
        });
    }

    configurePopup() {
        if (!this.view) {
            log.error('[MapController] configurePopup called but view does not exist!');
            return;
        }

        log.info('[MapController] Configuring popup for top-left docking');

        // Wait for popup to exist before configuring it
        const configurePopupWhenReady = () => {
            if (!this.view.popup) {
                setTimeout(configurePopupWhenReady, 100);
                return;
            }

            // Configure popup to always dock at top-left
            this.view.popup.dockEnabled = true;
            this.view.popup.collapseEnabled = false;
            this.view.popup.dockOptions = {
                buttonEnabled: false, // Hide dock button
                breakpoint: {
                    width: 9999, // Force docking at all screen sizes
                    height: 9999
                },
                position: 'top-left'
            };

            // Hide dock button via CSS
            const style = document.createElement('style');
            style.textContent = `
                .esri-popup__button[data-action-id="popup-dock-action"],
                .esri-popup__action[data-action-id="popup-dock-action"],
                calcite-action[data-action-id="popup-dock-action"] {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);

            log.info('[MapController] Popup configured to dock at top-left');
        };

        configurePopupWhenReady();

        // Watch for popup instance changes and re-apply configuration
        reactiveUtils.watch(
            () => this.view.popup,
            (popup) => {
                if (popup) {
                    popup.dockEnabled = true;
                    popup.collapseEnabled = false;
                    popup.dockOptions = {
                        buttonEnabled: false,
                        breakpoint: { width: 9999, height: 9999 },
                        position: 'top-left'
                    };
                }
            },
            { initial: true }
        );
    }

    configureView() {
        if (!this.view) {
            log.warn('configureView called but view does not exist');
            return;
        }

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

        // Use style-based basemap for dark mode to match ThemeManager (Navigation Night)
        // Light mode uses standard Navigation vector
        const primaryBasemap = isDarkMode
            ? new Basemap({ style: { id: 'arcgis/navigation-night' } })
            : 'streets-navigation-vector';

        const fallbackBasemaps = isDarkMode
            ? ['streets-night-vector', 'dark-gray-vector', 'gray-vector']
            : ['streets-navigation-vector', 'gray-vector', 'satellite'];

        try {
            this.map.basemap = primaryBasemap;
        } catch (error) {
            log.warn('MapController: Failed to set primary basemap, trying fallback:', error);
            // Try the first fallback
            try {
                this.map.basemap = fallbackBasemaps[0];
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
            'online-subscribers': 127, // Above node sites (125) so cluster markers are visible
            'main-line-old': 28, // Below current main line
            'main-line-fiber': 30,
            'mst-fiber': 35,
            'closures': 40,
            'mst-terminals': 50,
            'splitters': 60,
            'offline-subscribers': 126, // Above node sites (100) so cluster markers and labels are visible
            'electric-offline-subscribers': 128, // Above node sites (100) so cluster markers and labels are visible
            'vehicles': 130,
            'sprout-huts': 100, // Node sites - well below subscriber clusters so cluster labels render above
            'weather-radar': 140
        };
        return zOrderMap[layerId] || 0;
    }
} 