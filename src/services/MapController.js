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

        this.map.add(layer);
    }
} 