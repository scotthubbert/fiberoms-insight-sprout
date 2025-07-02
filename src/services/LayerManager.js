// LayerManager.js - Single Responsibility: Layer operations only
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Graphic from '@arcgis/core/Graphic';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

export class LayerManager {
    constructor(dataService) {
        this.dataService = dataService;  // DIP: Depend on abstraction
        this.layers = new Map();
        this.layerConfigs = new Map();
        this.blobUrls = new Map(); // Track blob URLs for cleanup

        // Layer z-order configuration (Open/Closed: extend via config)
        this.zOrder = {
            rainViewerRadar: -10,  // Weather radar at bottom (below all basemap layers)
            onlineSubscribers: 10,
            fsaBoundaries: 20,
            mainLineFiber: 30,
            dropFiber: 40,
            mstTerminals: 50,
            splitters: 60,
            offlineSubscribers: 100,
            powerOutages: 110,
            fiberOutages: 120,
            vehicles: 130,
            weatherRadar: 140
        };
    }

    // OCP: Create layers through configuration, not modification
    async createLayer(layerConfig) {
        try {
            // Determine layer type based on configuration
            if (layerConfig.layerType === 'WebTileLayer') {
                return this.createWebTileLayer(layerConfig);
            } else {
                return this.createGeoJSONLayer(layerConfig);
            }
        } catch (error) {
            console.error(`Failed to create layer ${layerConfig.id}:`, error);
            return null;
        }
    }

    // Create GeoJSON layer (existing functionality)
    async createGeoJSONLayer(layerConfig) {
        // Use the data directly if provided, otherwise fetch it
        let data;
        if (layerConfig.dataSource?.features) {
            data = layerConfig.dataSource;
        } else {
            console.warn(`No data provided for layer: ${layerConfig.id}`);
            return null;
        }

        if (!data?.features?.length) {
            console.warn(`No features available for layer: ${layerConfig.id}`);
            return null;
        }

        // Special handling for power outage layers with polygon support
        if (layerConfig.id.includes('outages')) {
            return this.createPowerOutageLayer(layerConfig, data);
        }

        // Create GeoJSON blob for the layer source
        const geojson = {
            type: "FeatureCollection",
            features: data.features
        };

        const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(geojson)], {
            type: "application/json"
        }));

        const layer = new GeoJSONLayer({
            id: layerConfig.id,
            url: blobUrl,
            renderer: layerConfig.renderer,
            popupTemplate: layerConfig.popupTemplate,
            featureReduction: layerConfig.featureReduction,
            fields: layerConfig.fields, // Explicit field definitions to prevent inference warnings
            listMode: layerConfig.visible ? 'show' : 'hide',
            visible: layerConfig.visible
        });

        this.layers.set(layerConfig.id, layer);
        this.layerConfigs.set(layerConfig.id, layerConfig);
        this.blobUrls.set(layerConfig.id, blobUrl); // Track for cleanup

        return layer;
    }

    // Create power outage layer with manual dual-rendering for polygons
    async createPowerOutageLayer(layerConfig, data) {
        const originalFeatures = data.features;
        const processedFeatures = [];

        // Company configurations with enhanced polygon visibility
        const companyConfigs = {
            'apco': {
                pointSymbol: {
                    type: 'picture-marker',
                    url: '/apco-logo.png',
                    width: '24px',
                    height: '24px'
                },
                polygonSymbol: {
                    type: 'simple-fill',
                    color: [30, 95, 175, 0.4], // Enhanced Alabama Power blue visibility (40% opacity)
                    outline: {
                        color: [20, 75, 145], // Darker blue outline for better definition
                        width: 3, // Thicker outline for better visibility
                        style: 'solid'
                    }
                }
            },
            'tombigbee': {
                pointSymbol: {
                    type: 'picture-marker',
                    url: '/tombigbee-logo.png',
                    width: '24px',
                    height: '24px'
                },
                polygonSymbol: {
                    type: 'simple-fill',
                    color: [74, 124, 89, 0.4], // Enhanced Tombigbee green visibility (40% opacity)
                    outline: {
                        color: [54, 104, 69], // Darker green outline for better definition
                        width: 3, // Thicker outline for better visibility
                        style: 'solid'
                    }
                }
            }
        };

        const company = layerConfig.id.includes('apco') ? 'apco' : 'tombigbee';
        const companyConfig = companyConfigs[company];

        // Process each feature and create appropriate graphics
        for (const feature of originalFeatures) {
            if (feature.geometry.type === 'Point') {
                // For point features, add as-is (will get point symbol)
                processedFeatures.push({
                    ...feature,
                    properties: {
                        ...feature.properties,
                        _render_type: 'point'
                    }
                });
            } else if (feature.geometry.type === 'Polygon') {
                // 1. Polygon feature with fill (company-based styling)
                processedFeatures.push({
                    ...feature,
                    properties: {
                        ...feature.properties,
                        _render_type: 'polygon'
                    }
                });

                // 2. Point feature at centroid with logo
                try {
                    const coordinates = feature.geometry.coordinates[0]; // First ring
                    let sumX = 0, sumY = 0;
                    for (const coord of coordinates) {
                        sumX += coord[0];
                        sumY += coord[1];
                    }
                    const centroidX = sumX / coordinates.length;
                    const centroidY = sumY / coordinates.length;

                    processedFeatures.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [centroidX, centroidY]
                        },
                        properties: {
                            ...feature.properties,
                            _render_type: 'point', // Will get the logo symbol
                            _is_centroid: true,
                            _parent_polygon_id: feature.properties.outage_id
                        }
                    });
                } catch (error) {
                    console.warn('Could not create centroid for polygon:', error);
                }
            }
        }

        // Create simple dual renderer using company colors
        const dualRenderer = {
            type: 'unique-value',
            field: '_render_type',
            defaultSymbol: companyConfig.pointSymbol,
            uniqueValueInfos: [
                {
                    value: 'point',
                    symbol: companyConfig.pointSymbol
                },
                {
                    value: 'polygon',
                    symbol: companyConfig.polygonSymbol
                }
            ]
        };

        // Alternative simple renderer for debugging polygon visibility issues
        // Uncomment this and comment out the dual renderer above if polygons aren't visible
        /*
        const debugPolygonRenderer = {
            type: 'simple',
            symbol: {
                type: 'simple-fill',
                color: [255, 0, 0, 0.7], // Bright red for maximum visibility
                outline: {
                    color: [255, 0, 0],
                    width: 4,
                    style: 'solid'
                }
            }
        };
        */

        // Create GeoJSON blob with processed features
        const geojson = {
            type: "FeatureCollection",
            features: processedFeatures
        };

        const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(geojson)], {
            type: "application/json"
        }));

        const layer = new GeoJSONLayer({
            id: layerConfig.id,
            url: blobUrl,
            renderer: dualRenderer, // Change to debugPolygonRenderer for polygon visibility testing
            popupTemplate: layerConfig.popupTemplate,
            featureReduction: layerConfig.featureReduction,
            fields: layerConfig.fields,
            listMode: layerConfig.visible ? 'show' : 'hide',
            visible: layerConfig.visible,
            // Ensure polygons render above basemap but below points
            elevationInfo: {
                mode: 'on-the-ground'
            }
        });

        // Simple but effective layer load handler with forced visibility reset
        layer.when(() => {
            // Force visibility state reset to trigger proper rendering
            const originalVisibility = layer.visible;
            if (originalVisibility) {
                // Temporarily hide then show to force proper rendering
                layer.visible = false;
                setTimeout(() => {
                    layer.visible = true;
                    layer.refresh();
                    console.log(`🔄 Layer ${layerConfig.id} visibility reset and refreshed`);
                }, 100);
            }
        }).catch(error => {
            console.warn(`Layer ${layerConfig.id} failed to load:`, error);
        });

        this.layers.set(layerConfig.id, layer);
        this.layerConfigs.set(layerConfig.id, layerConfig);
        this.blobUrls.set(layerConfig.id, blobUrl);

        // Enhanced debugging for polygon visibility issues
        const polygonFeatures = processedFeatures.filter(f => f.properties._render_type === 'polygon');
        const pointFeatures = processedFeatures.filter(f => f.properties._render_type === 'point');

        console.log(`📍 Power outage layer created with manual dual-rendering: ${layerConfig.id}`, {
            originalFeatures: originalFeatures.length,
            processedFeatures: processedFeatures.length,
            polygons: polygonFeatures.length,
            points: pointFeatures.length
        });

        // Log polygon geometry details for debugging
        if (polygonFeatures.length > 0) {
            console.log('🔹 Polygon debugging info:', {
                firstPolygon: polygonFeatures[0],
                polygonGeometryType: polygonFeatures[0].geometry?.type,
                polygonCoordinates: polygonFeatures[0].geometry?.coordinates?.[0]?.slice(0, 3), // First 3 coords
                polygonProperties: {
                    _render_type: polygonFeatures[0].properties._render_type,
                    customers_affected: polygonFeatures[0].properties.customers_affected,
                    outage_id: polygonFeatures[0].properties.outage_id
                }
            });
            console.log('🎨 Polygon renderer config:', {
                rendererType: dualRenderer.type,
                polygonSymbol: dualRenderer.uniqueValueInfos.find(u => u.value === 'polygon')?.symbol
            });
        }
        return layer;
    }

    // Create WebTile layer (for RainViewer and similar services)
    async createWebTileLayer(layerConfig) {
        // For WebTileLayer, we expect the layer instance to be provided
        if (layerConfig.layerInstance) {
            const layer = layerConfig.layerInstance;

            this.layers.set(layerConfig.id, layer);
            this.layerConfigs.set(layerConfig.id, layerConfig);

            console.log(`📍 WebTileLayer created: ${layer.id}`);
            return layer;
        } else {
            console.warn(`No layer instance provided for WebTileLayer: ${layerConfig.id}`);
            return null;
        }
    }

    // ISP: Focused interface for layer visibility
    async toggleLayerVisibility(layerId, visible) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;

        layer.visible = visible;

        // Force refresh for power outage layers to ensure proper rendering
        if (visible && (layerId.includes('outages') || layerId.includes('apco') || layerId.includes('tombigbee'))) {
            setTimeout(() => {
                layer.refresh();
                console.log(`🔄 ${layerId} refreshed after visibility toggle`);
            }, 100);
        }

        // For special layers like RainViewer, trigger additional behavior
        const config = this.layerConfigs.get(layerId);
        if (config?.onVisibilityChange) {
            config.onVisibilityChange(visible);
        }

        return true;
    }

    // ISP: Focused interface for layer updates
    // Note: Layer updates disabled for Phase 1 - will implement in Phase 2
    async updateLayerData(layerId) {
        console.log(`📝 Layer update requested for ${layerId} - skipping for Phase 1`);
        return true; // Return true to avoid error logging
    }

    getLayer(layerId) {
        return this.layers.get(layerId);
    }

    getAllLayers() {
        return Array.from(this.layers.values());
    }

    // Get layer with proper z-order
    getZOrder(layerId) {
        return this.zOrder[layerId] || 0;
    }

    // Clean up blob URLs to prevent memory leaks
    removeLayer(layerId) {
        const blobUrl = this.blobUrls.get(layerId);
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            this.blobUrls.delete(layerId);
        }

        // Call cleanup for special layers
        const config = this.layerConfigs.get(layerId);
        if (config?.onCleanup) {
            config.onCleanup();
        }

        this.layers.delete(layerId);
        this.layerConfigs.delete(layerId);
    }

    // Clean up all blob URLs
    cleanup() {
        this.blobUrls.forEach((blobUrl) => {
            URL.revokeObjectURL(blobUrl);
        });
        this.blobUrls.clear();

        // Call cleanup for all special layers
        this.layerConfigs.forEach((config) => {
            if (config.onCleanup) {
                config.onCleanup();
            }
        });

        this.layers.clear();
        this.layerConfigs.clear();
    }
} 