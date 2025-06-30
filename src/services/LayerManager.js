// LayerManager.js - Single Responsibility: Layer operations only
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import PopupTemplate from '@arcgis/core/PopupTemplate';

export class LayerManager {
    constructor(dataService) {
        this.dataService = dataService;  // DIP: Depend on abstraction
        this.layers = new Map();
        this.layerConfigs = new Map();

        // Layer z-order configuration (Open/Closed: extend via config)
        this.zOrder = {
            onlineSubscribers: 0,
            fsaBoundaries: 10,
            mainLineFiber: 20,
            dropFiber: 30,
            mstTerminals: 40,
            splitters: 50,
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

            const layer = new GeoJSONLayer({
                id: layerConfig.id,
                source: data.features,
                renderer: layerConfig.renderer,
                popupTemplate: layerConfig.popupTemplate,
                listMode: layerConfig.visible ? 'show' : 'hide'
            });

            this.layers.set(layerConfig.id, layer);
            this.layerConfigs.set(layerConfig.id, layerConfig);

            return layer;
        } catch (error) {
            console.error(`Failed to create layer ${layerConfig.id}:`, error);
            return null;
        }
    }

    // ISP: Focused interface for layer visibility
    async toggleLayerVisibility(layerId, visible) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;

        layer.visible = visible;
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
} 