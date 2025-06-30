// MapController.js - Single Responsibility: Map initialization only
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';

export class MapController {
    constructor(layerManager, themeManager) {
        this.layerManager = layerManager;  // DIP: Depend on abstractions
        this.themeManager = themeManager;
        this.mapElement = document.getElementById('map');
        this.view = null;
        this.map = null;
    }

    async initialize() {
        await this.waitForMapReady();
        this.configureView();
        this.applyTheme();
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
    }

    configureView() {
        if (!this.view) return;

        this.view.constraints = {
            snapToZoom: false  // Smooth zoom per CLAUDE.md performance requirements
        };
    }

    applyTheme() {
        if (this.themeManager && this.view) {
            this.themeManager.applyThemeToView(this.view);
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
        console.log(`📍 Added layer "${layer.id}" at index ${insertIndex} with z-order ${zOrder}`);
    }

    // Helper method to get z-order for existing layers
    getLayerZOrder(layerId) {
        const zOrderMap = {
            'online-subscribers': 0,
            'fsa-boundaries': 10,
            'main-line-fiber': 20,
            'drop-fiber': 30,
            'mst-terminals': 40,
            'splitters': 50,
            'offline-subscribers': 100,  // Highest priority - always on top
            'power-outages': 110,
            'fiber-outages': 120,
            'vehicles': 130,
            'weather-radar': 140
        };
        return zOrderMap[layerId] || 0;
    }
} 