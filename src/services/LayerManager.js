// LayerManager.js - Single Responsibility: Layer operations only
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Graphic from '@arcgis/core/Graphic';
import Polygon from '@arcgis/core/geometry/Polygon';
import Point from '@arcgis/core/geometry/Point';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

export class LayerManager {
    constructor(dataService) {
        this.dataService = dataService;  // DIP: Depend on abstraction
        this.layers = new Map();
        this.layerConfigs = new Map();
        this.blobUrls = new Map(); // Track blob URLs for cleanup

        // Layer z-order configuration
        this.zOrder = {
            rainViewerRadar: -10,
            'fsa-boundaries': 5, // Below all point layers
            onlineSubscribers: 10,
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

        // Set up scale-dependent labeling for FSA boundaries
        if (layerConfig.id === 'fsa-boundaries' && layerConfig.labelingInfo) {
            layer.when(() => {
                // Delay to ensure layer is added to map
                setTimeout(() => {
                    this.setupScaleDependentLabeling(layer, layerConfig.labelingInfo);
                }, 1000);
            });
        }

        return layer;
    }

    // Create power outage layer using GraphicsLayer approach for better mixed geometry support
    async createPowerOutageLayer(layerConfig, data) {

        const originalFeatures = data.features;
        const graphics = [];

        // Company symbol configurations
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
                    color: [30, 95, 175, 0.4],
                    outline: {
                        color: [20, 75, 145],
                        width: 3,
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
                    color: [74, 124, 89, 0.4],
                    outline: {
                        color: [54, 104, 69],
                        width: 3,
                        style: 'solid'
                    }
                }
            }
        };

        const company = layerConfig.id.includes('apco') ? 'apco' : 'tombigbee';
        const companyConfig = companyConfigs[company];

        let pointCount = 0, polygonCount = 0;

        // Process each feature and create individual graphics
        for (const feature of originalFeatures) {
            if (!feature.geometry) continue;

            let arcgisGeometry;
            let symbol;
            const attributes = { ...feature.properties };

            if (feature.geometry.type === 'Point') {
                // Create Point geometry
                arcgisGeometry = new Point({
                    longitude: feature.geometry.coordinates[0],
                    latitude: feature.geometry.coordinates[1],
                    spatialReference: { wkid: 4326 }
                });
                symbol = companyConfig.pointSymbol;
                pointCount++;

            } else if (feature.geometry.type === 'Polygon') {
                // Create Polygon geometry
                arcgisGeometry = new Polygon({
                    rings: feature.geometry.coordinates,
                    spatialReference: { wkid: 4326 }
                });
                symbol = companyConfig.polygonSymbol;
                polygonCount++;

                // Create main polygon graphic
                const polygonGraphic = new Graphic({
                    geometry: arcgisGeometry,
                    symbol: symbol,
                    attributes: attributes,
                    popupTemplate: layerConfig.popupTemplate
                });
                graphics.push(polygonGraphic);

                // Add centroid logo for polygon outages
                try {
                    const centroid = arcgisGeometry.centroid;
                    if (centroid) {
                        const centroidGraphic = new Graphic({
                            geometry: centroid,
                            symbol: companyConfig.pointSymbol,
                            attributes: {
                                ...attributes,
                                _is_centroid: true,
                                _parent_polygon_id: attributes.outage_id
                            },
                            popupTemplate: layerConfig.popupTemplate
                        });
                        graphics.push(centroidGraphic);
                    }
                } catch (error) {
                    console.error('Failed to create polygon centroid:', error);
                }
                continue; // Skip the generic graphic creation below
            }

            // Create graphic for points (polygons handled above)
            if (arcgisGeometry && symbol) {
                const graphic = new Graphic({
                    geometry: arcgisGeometry,
                    symbol: symbol,
                    attributes: attributes,
                    popupTemplate: layerConfig.popupTemplate
                });
                graphics.push(graphic);
            }
        }

        // Create GraphicsLayer with all graphics
        const layer = new GraphicsLayer({
            id: layerConfig.id,
            title: layerConfig.title,
            graphics: graphics,
            listMode: layerConfig.visible ? 'show' : 'hide',
            visible: layerConfig.visible
        });

        // Layer load handler
        layer.when(() => {
            // Layer loaded successfully
        }).catch(error => {
            console.error(`❌ ${layerConfig.title} layer failed to load:`, error);
        });

        this.layers.set(layerConfig.id, layer);
        this.layerConfigs.set(layerConfig.id, layerConfig);


        return layer;
    }

    // Create WebTile layer (for RainViewer and similar services)
    async createWebTileLayer(layerConfig) {
        // For WebTileLayer, we expect the layer instance to be provided
        if (layerConfig.layerInstance) {
            const layer = layerConfig.layerInstance;

            this.layers.set(layerConfig.id, layer);
            this.layerConfigs.set(layerConfig.id, layerConfig);

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
                if (typeof layer.refresh === 'function') {
                    layer.refresh();
                }
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
        // Layer update skipping for Phase 1
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

    // Clean up layers
    removeLayer(layerId) {
        // Clean up blob URLs for GeoJSONLayers only
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

    // Set up scale-dependent labeling for FSA layer
    setupScaleDependentLabeling(layer, labelingInfo) {
        // Try to get the map view from various sources
        let mapView = layer.view;

        // If no view on layer, try to get from global window (fallback)
        if (!mapView && typeof window !== 'undefined' && window.mapView) {
            mapView = window.mapView;
        }

        if (!mapView) {
            console.warn('🏷️ No map view available for FSA scale-dependent labeling, trying later...');
            // Retry after a delay
            setTimeout(() => {
                this.setupScaleDependentLabeling(layer, labelingInfo);
            }, 2000);
            return;
        }

        const targetScale = 80000; // Show labels when zoomed in to around zoom level 14 (scale 1:80,000 or closer)

        console.log('🏷️ Setting up FSA scale-dependent labeling');

        // Watch for scale changes
        mapView.watch('scale', (scale) => {
            if (scale <= targetScale) {
                // Zoomed in enough - add labels
                if (!layer.labelingInfo || layer.labelingInfo.length === 0) {
                    console.log('🏷️ Adding FSA labels at scale 1:' + Math.round(scale));
                    layer.labelingInfo = labelingInfo;
                }
            } else {
                // Zoomed out too far - remove labels
                if (layer.labelingInfo && layer.labelingInfo.length > 0) {
                    console.log(`🚫 Removing FSA labels at scale 1:${Math.round(scale)} (zoom level <14)`);
                    layer.labelingInfo = [];
                }
            }
        });

        // Set initial state based on current scale
        const currentScale = mapView.scale;
        if (currentScale <= targetScale) {
            console.log('🏷️ Initial scale is within threshold, applying FSA labels');
            layer.labelingInfo = labelingInfo;
        } else {
            console.log('🏷️ Initial scale too far out, FSA labels will appear at zoom level 14+');
            layer.labelingInfo = [];
        }
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