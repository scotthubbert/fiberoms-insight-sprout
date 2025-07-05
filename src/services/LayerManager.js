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
            'online-subscribers': 10,  // Fixed: was onlineSubscribers without hyphen
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
            visible: layerConfig.visible !== undefined ? layerConfig.visible : true
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
            visible: false // Start with layer hidden to force proper rendering
        });

        // Layer load handler
        layer.when(() => {
            // Layer loaded successfully
            console.log(`✅ ${layerConfig.title} layer loaded with ${graphics.length} graphics`);
            
            // Force proper rendering by toggling visibility if layer should be visible
            if (layerConfig.visible) {
                setTimeout(() => {
                    layer.visible = true;
                    console.log(`🔄 Forced initial rendering of ${layerConfig.id} layer`);
                }, 500);
            }
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
        if (!layer) {
            console.error(`Layer not found: ${layerId}`);
            return false;
        }

        // Set visibility on our stored layer reference
        layer.visible = visible;
        layer.listMode = visible ? 'show' : 'hide';
        
        // For GraphicsLayer, also use opacity as a fallback
        if (layer.type === 'graphics') {
            layer.opacity = visible ? 1 : 0;
        }
        
        // IMPORTANT: Also update the layer instance on the map
        // The layer in LayerManager might not be the same instance as on the map
        if (window.mapView && window.mapView.map) {
            const mapLayer = window.mapView.map.findLayerById(layerId);
            if (mapLayer) {
                mapLayer.visible = visible;
                if (mapLayer.type === 'graphics') {
                    mapLayer.opacity = visible ? 1 : 0;
                }
            }
        }

        // For special layers like RainViewer, trigger additional behavior
        const config = this.layerConfigs.get(layerId);
        if (config?.onVisibilityChange) {
            config.onVisibilityChange(visible);
        }

        // Dispatch event for other components to listen to
        document.dispatchEvent(new CustomEvent('layerVisibilityChanged', {
            detail: { layerId, visible }
        }));

        return true;
    }

    // ISP: Focused interface for layer updates
    async updateLayerData(layerId, newData) {
        const layer = this.layers.get(layerId);
        const config = this.layerConfigs.get(layerId);
        
        if (!layer || !config) {
            console.warn(`Layer ${layerId} not found for update`);
            return false;
        }

        try {
            console.log(`🔄 Updating layer: ${layerId}`);
            
            // Special handling for GraphicsLayer (power outages)
            if (layer.type === 'graphics') {
                return this.updateGraphicsLayer(layer, config, newData);
            }
            
            // For GeoJSONLayer, we need to recreate it with new data
            if (layer.type === 'geojson') {
                return this.updateGeoJSONLayer(layerId, config, newData);
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to update layer ${layerId}:`, error);
            return false;
        }
    }

    // Update GraphicsLayer by replacing graphics
    async updateGraphicsLayer(layer, config, newData) {
        // Preserve current visibility state
        const wasVisible = layer.visible;
        
        // Clear existing graphics
        layer.removeAll();
        
        // Re-create graphics with new data
        if (config.id.includes('outages')) {
            // Recreate power outage graphics
            const tempConfig = {
                ...config,
                dataSource: newData
            };
            const newLayer = await this.createPowerOutageLayer(tempConfig, newData);
            
            // Copy graphics from new layer to existing layer
            if (newLayer && newLayer.graphics) {
                layer.addMany(newLayer.graphics.toArray());
                
                // Force the layer to refresh its display if it was visible
                if (wasVisible) {
                    layer.visible = false;
                    setTimeout(() => {
                        layer.visible = true;
                        console.log(`🔄 Forced refresh of ${config.id} layer`);
                    }, 100);
                }
            }
        }
        
        console.log(`✅ Updated ${layer.graphics.length} graphics in ${config.id}`);
        return true;
    }

    // Update GeoJSONLayer by recreating it
    async updateGeoJSONLayer(layerId, config, newData) {
        const map = this.getMapForLayer(layerId);
        if (!map) {
            console.warn(`No map found for layer ${layerId}`);
            return false;
        }

        // Get old layer to preserve visibility state
        const oldLayer = this.layers.get(layerId);
        let wasVisible = false;
        
        if (oldLayer) {
            // Preserve the visibility state
            wasVisible = oldLayer.visible;
            
            // Remove old layer
            map.remove(oldLayer);
            
            // Clean up blob URL
            const blobUrl = this.blobUrls.get(layerId);
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
                this.blobUrls.delete(layerId);
            }
        }

        // Create new layer with updated data and preserved visibility
        const newConfig = {
            ...config,
            dataSource: newData,
            visible: wasVisible  // Preserve visibility state
        };
        
        const newLayer = await this.createGeoJSONLayer(newConfig);
        
        if (newLayer) {
            // Add to map at correct position first
            const zOrder = this.getZOrder(layerId);
            map.add(newLayer, zOrder);
            
            // Set visibility after a small delay to ensure layer is properly initialized
            setTimeout(() => {
                newLayer.visible = wasVisible;
                console.log(`✅ Set visibility for ${layerId} to ${wasVisible}`);
                
                // Force refresh if visible
                if (wasVisible && typeof newLayer.refresh === 'function') {
                    newLayer.refresh();
                }
            }, 100);
            
            console.log(`✅ Recreated layer ${layerId} with ${newData.features?.length || 0} features, visible: ${wasVisible}`);
            return true;
        }
        
        return false;
    }

    // Helper to get map reference for a layer
    getMapForLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (layer && layer.parent) {
            return layer.parent;
        }
        
        // Fallback to window.mapView if available
        if (typeof window !== 'undefined' && window.mapView && window.mapView.map) {
            return window.mapView.map;
        }
        
        return null;
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