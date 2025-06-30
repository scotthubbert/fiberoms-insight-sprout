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
            const data = await this.dataService.fetchData(layerConfig.dataSource);
            if (!data?.features?.length) {
                console.warn(`No data for layer: ${layerConfig.id}`);
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
    async updateLayerData(layerId) {
        const config = this.layerConfigs.get(layerId);
        if (!config) return false;

        try {
            const data = await this.dataService.fetchData(config.dataSource);
            const layer = this.layers.get(layerId);

            if (layer && data?.features) {
                layer.source = data.features;
                return true;
            }
        } catch (error) {
            console.error(`Failed to update layer ${layerId}:`, error);
        }
        return false;
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