// MapController.js - Single Responsibility: Map initialization only
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import Extent from '@arcgis/core/geometry/Extent';

// Service area configuration - centralized for easy updates
const SERVICE_AREA_BOUNDS = {
    xmin: -88.3319638467807,   // Western bound (SW longitude)
    ymin: 33.440523708494564,  // Southern bound (SW latitude)
    xmax: -87.35488507018964,  // Eastern bound (NE longitude)
    ymax: 34.73445506886154,   // Northern bound (NE latitude)
    spatialReference: { wkid: 4326 } // WGS84
};

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
                console.warn('MapController: Applying bounds fallback - detected world view');
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
        this.calculatedExtent = new Extent(SERVICE_AREA_BOUNDS);

        // Calculate center point for reference
        const centerLng = (SERVICE_AREA_BOUNDS.xmin + SERVICE_AREA_BOUNDS.xmax) / 2;
        const centerLat = (SERVICE_AREA_BOUNDS.ymin + SERVICE_AREA_BOUNDS.ymax) / 2;
        this.calculatedCenter = [centerLng, centerLat];
    }

    // Apply service area bounds after map is fully ready
    applyServiceAreaBounds() {
        if (!this.view) {
            console.warn('MapController: View not available for bounds application');
            return;
        }

        if (!this.calculatedExtent) {
            console.warn('MapController: Calculated extent not available, preparing bounds');
            this.prepareServiceAreaBounds();
            if (!this.calculatedExtent) {
                console.error('MapController: Failed to prepare service area bounds');
                return;
            }
        }

        // Set constraints first
        this.view.constraints = {
            snapToZoom: false,  // Smooth zoom per CLAUDE.md performance requirements
            geometry: this.calculatedExtent  // Constrain navigation to service area
        };

        // Set initial extent with immediate positioning
        this.view.goTo(this.calculatedExtent, {
            animate: false,
            duration: 0
        }).catch(error => {
            console.error('MapController: Failed to apply service area bounds via goTo, using fallback:', error);
            // Fallback: set extent directly
            try {
                this.view.extent = this.calculatedExtent;
            } catch (fallbackError) {
                console.error('MapController: Extent fallback also failed:', fallbackError);
            }
        });
    }

    // Configure home button to use service area bounds
    configureHomeButton() {
        if (!this.view || !this.calculatedExtent) {
            console.warn('MapController: Cannot configure home button - view or extent not available');
            return;
        }

        try {
            // Import required ArcGIS classes
            import('@arcgis/core/Viewpoint').then(({ default: Viewpoint }) => {
                // Create a viewpoint from our calculated extent
                const homeViewpoint = new Viewpoint({
                    targetGeometry: this.calculatedExtent
                });

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
                console.error('MapController: Failed to configure home button:', error);
            });
        } catch (error) {
            console.error('MapController: Error in home button configuration:', error);
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

        // Wait for view to be fully ready before applying extent
        this.view.when(() => {
            this.applyServiceAreaBounds();
            this.configureHomeButton();
        }).catch(error => {
            console.error('MapController: Map view ready error:', error);
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
            ? ['streets-night-vector', 'dark-gray-vector', 'satellite']
            : ['streets-navigation-vector', 'streets-vector', 'satellite'];

        // Set the primary basemap for the theme
        const primaryBasemap = fallbackBasemaps[0];

        try {
            this.map.basemap = primaryBasemap;
        } catch (error) {
            console.warn('MapController: Failed to set primary basemap, trying fallback:', error);
            // Try the second option as fallback
            try {
                this.map.basemap = fallbackBasemaps[1] || 'gray';
            } catch (fallbackError) {
                console.error('MapController: All basemap options failed, using gray:', fallbackError);
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
            'rainviewer-radar': -10,    // Weather radar at bottom (below all basemap layers)
            'online-subscribers': 10,
            'fsa-boundaries': 20,
            'main-line-fiber': 30,
            'drop-fiber': 40,
            'mst-terminals': 50,
            'splitters': 60,
            'offline-subscribers': 100,  // Highest priority - always on top
            'power-outages': 110,
            'fiber-outages': 120,
            'vehicles': 130,
            'weather-radar': 140
        };
        return zOrderMap[layerId] || 0;
    }
} 