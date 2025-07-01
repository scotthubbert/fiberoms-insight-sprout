// LayerManager.js - Single Responsibility: Layer operations only
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import PopupTemplate from '@arcgis/core/PopupTemplate';

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