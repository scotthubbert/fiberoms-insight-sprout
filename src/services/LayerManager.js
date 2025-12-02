// LayerManager.js - Single Responsibility: Layer operations only
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Graphic from '@arcgis/core/Graphic';
import Polygon from '@arcgis/core/geometry/Polygon';
import Point from '@arcgis/core/geometry/Point';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';
import { errorService } from './ErrorService.js';
import { createLogger } from '../utils/logger.js';

// Initialize logger for this module
const log = createLogger('LayerManager');

export class LayerManager {
    constructor(dataService) {
        this.dataService = dataService;  // DIP: Depend on abstraction
        this.layers = new Map();
        this.layerConfigs = new Map();
        this.blobUrls = new Map(); // Track blob URLs for cleanup
        this.updateDebounceTimers = new Map(); // Track debounce timers for updates
        this.updateInProgress = new Map(); // Track ongoing updates

        // Layer z-order configuration
        this.zOrder = {
            rainViewerRadar: -10,
            'cec-service-boundary': 0,
            'county-boundaries': 1,
            'cullman-outages': 2, // Power outages below all markers and OSP data
            'fsa-boundaries': 5,
            'online-subscribers': 126, // Lowest priority - online markers/clusters render below offline
            'main-line-old': 28,
            'main-line-fiber': 30,
            'mst-fiber': 35,
            'closures': 40,
            'poles': 45, // Between closures (40) and MST terminals (50)
            'mst-terminals': 50,
            'splitters': 60,
            'offline-subscribers': 128, // Highest priority - offline markers/clusters render above online
            'electric-offline-subscribers': 127, // Second highest - electric offline markers/clusters render above online, below regular offline
            vehicles: 130,
            'sprout-huts': 100, // Node sites - well below subscriber clusters so cluster labels render above
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
            log.error(`Failed to create layer ${layerConfig.id}:`, error);
            errorService.report(error, { module: 'LayerManager', action: 'createLayer', id: layerConfig?.id });
            return null;
        }
    }

    // Create GeoJSON layer (existing functionality)
    async createGeoJSONLayer(layerConfig) {
        // Check if this is a URL-based layer
        if (layerConfig.layerType === 'GeoJSONLayer' && layerConfig.dataUrl) {
            return this.createGeoJSONLayerFromUrl(layerConfig);
        }

        // Skip URL-based layers with null dataUrl
        if (layerConfig.layerType === 'GeoJSONLayer' && !layerConfig.dataUrl && !layerConfig.dataSource) {
            log.warn(`⚠️ Skipping layer ${layerConfig.id} - no data source available`);
            return null;
        }

        // Use the data directly if provided, otherwise fetch it
        let data;
        if (layerConfig.dataSource?.features) {
            data = layerConfig.dataSource;
        } else {
            log.warn(`No data provided for layer: ${layerConfig.id}`);
            return null;
        }

        if (!data?.features?.length) {
            log.warn(`No features available for layer: ${layerConfig.id}`);
            return null;
        }

        // Special handling for truck layers - use FeatureLayer for smooth updates
        if (layerConfig.id.includes('trucks')) {
            return this.createTruckFeatureLayer(layerConfig, data);
        }

        // Create GeoJSON blob for the layer source
        // Add _stable_id to features if this is a subscriber layer
        const features = layerConfig.id.includes('subscribers') ?
            data.features.map(f => {
                const attributes = f.properties || {};
                const stableId = attributes.id || attributes.account || attributes.remote_id || `${layerConfig.id}-${Math.random()}`;
                return {
                    ...f,
                    properties: {
                        ...attributes,
                        _stable_id: stableId
                    }
                };
            }) : data.features;

        const geojson = {
            type: "FeatureCollection",
            features: features
        };

        const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(geojson)], {
            type: "application/json"
        }));

        // Detect geometry type from data for layers with mixed geometry support
        // Power outage layers can have Point (small outages) or Polygon (larger areas)
        let renderer = layerConfig.renderer;
        if (layerConfig.geometryType === 'mixed' && features.length > 0) {
            const firstGeomType = features[0]?.geometry?.type;
            if (firstGeomType === 'Point' && layerConfig.pointRenderer) {
                renderer = layerConfig.pointRenderer;
                log.info(`🔧 Using Point renderer for ${layerConfig.id} (detected Point geometry)`);
            } else if ((firstGeomType === 'Polygon' || firstGeomType === 'MultiPolygon') && layerConfig.polygonRenderer) {
                renderer = layerConfig.polygonRenderer;
                log.info(`🔧 Using Polygon renderer for ${layerConfig.id} (detected ${firstGeomType} geometry)`);
            }
        }

        // Create LabelClass objects for node sites/sprout huts synchronously if needed
        let labelingInfo = layerConfig.labelingInfo || [];
        if (layerConfig.id === 'sprout-huts' && labelingInfo.length > 0) {
            try {
                // Import LabelClass synchronously (will be available by the time layer is created)
                const LabelClassModule = await import('@arcgis/core/layers/support/LabelClass.js');
                const LabelClass = LabelClassModule.default;
                labelingInfo = labelingInfo.map(labelConfig => {
                    return new LabelClass({
                        symbol: labelConfig.symbol,
                        labelPlacement: labelConfig.labelPlacement,
                        labelExpressionInfo: labelConfig.labelExpressionInfo,
                        deconflictionStrategy: labelConfig.deconflictionStrategy,
                        repeatLabel: labelConfig.repeatLabel,
                        removeDuplicateLabels: labelConfig.removeDuplicateLabels,
                        maxScale: labelConfig.maxScale,
                        minScale: labelConfig.minScale
                    });
                });
                log.info(`${layerConfig.title} LabelClass objects created: ${labelingInfo.length} label class(es)`);
            } catch (error) {
                log.warn('Could not create LabelClass objects synchronously, will retry:', error);
            }
        }

        const layer = new GeoJSONLayer({
            id: layerConfig.id,
            url: blobUrl,
            renderer: layerConfig.renderer,
            popupTemplate: layerConfig.popupTemplate,
            featureReduction: layerConfig.featureReduction,
            fields: layerConfig.fields, // Explicit field definitions to prevent inference warnings
            listMode: layerConfig.visible ? 'show' : 'hide',
            visible: layerConfig.visible !== undefined ? layerConfig.visible : true,
            labelingInfo: labelingInfo,
            minScale: layerConfig.minScale || 0, // Apply scale-dependent visibility
            maxScale: layerConfig.maxScale || 0  // 0 means no limit
        });

        this.layers.set(layerConfig.id, layer);
        this.layerConfigs.set(layerConfig.id, layerConfig);
        this.blobUrls.set(layerConfig.id, blobUrl);

        // Set up scale-dependent labeling for FSA boundaries
        if (layerConfig.id === 'fsa-boundaries' && layerConfig.labelingInfo) {
            layer.when(() => {
                // Delay to ensure layer is added to map
                setTimeout(() => {
                    this.setupScaleDependentLabeling(layer, layerConfig.labelingInfo);
                }, 1000);
            });
        }

        // Verify labels are set for node sites/sprout huts after layer is ready
        if (layerConfig.id === 'sprout-huts' && labelingInfo.length > 0) {
            layer.when(async () => {
                await layer.load();
                const featureCount = layer.sourceJSON?.features?.length || 0;
                log.info(`${layerConfig.title} layer loaded with ${featureCount} features`);

                // Verify labels are still set
                if (layer.labelingInfo && layer.labelingInfo.length > 0) {
                    log.info(`✅ ${layerConfig.title} labels verified: ${layer.labelingInfo.length} label class(es), expression: ${layer.labelingInfo[0]?.labelExpressionInfo?.expression || 'N/A'}`);
                    // Refresh to ensure labels render
                    if (layer.visible) {
                        layer.refresh();
                    }
                } else {
                    log.warn(`⚠️ ${layerConfig.title} labelingInfo is missing, reapplying...`);
                    layer.labelingInfo = labelingInfo;
                    if (layer.visible) {
                        layer.refresh();
                    }
                }
            });
        }

        return layer;
    }

    // Create GeoJSON layer from URL
    async createGeoJSONLayerFromUrl(layerConfig) {
        // Early return if no URL is provided
        if (!layerConfig.dataUrl) {
            log.warn(`⚠️ Skipping layer ${layerConfig.id} - no dataUrl configured`);
            return null;
        }

        try {
            // Create LabelClass objects for node sites/sprout huts synchronously if needed
            let labelingInfo = layerConfig.labelingInfo || [];
            if (layerConfig.id === 'sprout-huts' && labelingInfo.length > 0) {
                try {
                    const LabelClassModule = await import('@arcgis/core/layers/support/LabelClass.js');
                    const LabelClass = LabelClassModule.default;
                    labelingInfo = labelingInfo.map(labelConfig => {
                        return new LabelClass({
                            symbol: labelConfig.symbol,
                            labelPlacement: labelConfig.labelPlacement,
                            labelExpressionInfo: labelConfig.labelExpressionInfo,
                            deconflictionStrategy: labelConfig.deconflictionStrategy,
                            repeatLabel: labelConfig.repeatLabel,
                            removeDuplicateLabels: labelConfig.removeDuplicateLabels,
                            maxScale: labelConfig.maxScale,
                            minScale: labelConfig.minScale
                        });
                    });
                    log.info(`${layerConfig.title} LabelClass objects created (URL-based): ${labelingInfo.length} label class(es)`);
                } catch (error) {
                    log.warn('Could not create LabelClass objects synchronously (URL-based), will retry:', error);
                }
            }

            const layer = new GeoJSONLayer({
                id: layerConfig.id,
                url: layerConfig.dataUrl,
                renderer: layerConfig.renderer,
                popupTemplate: layerConfig.popupTemplate,
                featureReduction: layerConfig.featureReduction,
                fields: layerConfig.fields, // Explicit field definitions to prevent inference warnings
                listMode: layerConfig.visible ? 'show' : 'hide',
                visible: layerConfig.visible !== undefined ? layerConfig.visible : true,
                labelingInfo: labelingInfo,
                minScale: layerConfig.minScale || 0, // Apply scale-dependent visibility
                maxScale: layerConfig.maxScale || 0  // 0 means no limit
            });

            this.layers.set(layerConfig.id, layer);
            this.layerConfigs.set(layerConfig.id, layerConfig);

            // Verify labels are set for node sites/sprout huts after layer is ready (URL-based)
            if (layerConfig.id === 'sprout-huts' && labelingInfo.length > 0) {
                layer.when(async () => {
                    await layer.load();
                    if (layer.labelingInfo && layer.labelingInfo.length > 0) {
                        log.info(`✅ ${layerConfig.title} labels verified (URL-based): ${layer.labelingInfo.length} label class(es)`);
                        if (layer.visible) {
                            layer.refresh();
                        }
                    } else {
                        log.warn(`⚠️ ${layerConfig.title} labelingInfo is missing (URL-based), reapplying...`);
                        layer.labelingInfo = labelingInfo;
                        if (layer.visible) {
                            layer.refresh();
                        }
                    }
                });
            }

            log.info(`✅ Created URL-based GeoJSON layer: ${layerConfig.id}`);
            return layer;
        } catch (error) {
            log.error(`Failed to create URL-based GeoJSON layer ${layerConfig.id}:`, error);
            errorService.report(error, { module: 'LayerManager', action: 'createGeoJSONLayerFromUrl', id: layerConfig?.id });
            return null;
        }
    }

    // Create empty GeoJSON layer that can be updated later
    async createEmptyGeoJSONLayer(layerConfig) {
        try {
            // Determine initial geometry type from config
            // For layers with mixed geometry types (like power outages), default to Point
            // as Point data is more common for small outages
            const isPointLayer = layerConfig.geometryType === 'point' ||
                layerConfig.geometryType === 'mixed' ||
                layerConfig.id === 'cullman-outages';

            // Create empty GeoJSON with appropriate dummy feature to help ArcGIS understand geometry type
            // This prevents the "table feature layer can't be displayed" error
            // The dummy feature will be replaced when real data arrives
            const emptyGeoJSON = {
                type: "FeatureCollection",
                features: [
                    isPointLayer ? {
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [0, 0] // Dummy point at null island
                        },
                        properties: {
                            _dummy: true // Mark as dummy so it can be filtered out if needed
                        }
                    } : {
                        type: "Feature",
                        geometry: {
                            type: "Polygon",
                            coordinates: [[[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]]]
                        },
                        properties: {
                            _dummy: true // Mark as dummy so it can be filtered out if needed
                        }
                    }
                ]
            };

            // Use point renderer for point layers, or default renderer
            const renderer = isPointLayer && layerConfig.pointRenderer
                ? layerConfig.pointRenderer
                : layerConfig.renderer;

            // Create blob URL for the GeoJSON
            const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(emptyGeoJSON)], {
                type: "application/json"
            }));

            const layer = new GeoJSONLayer({
                id: layerConfig.id,
                url: blobUrl,
                renderer: renderer,
                popupTemplate: layerConfig.popupTemplate,
                featureReduction: layerConfig.featureReduction,
                fields: layerConfig.fields || [],
                listMode: layerConfig.visible ? 'show' : 'hide',
                visible: layerConfig.visible !== undefined ? layerConfig.visible : true,
                labelingInfo: layerConfig.labelingInfo || [],
                minScale: layerConfig.minScale || 0,
                maxScale: layerConfig.maxScale || 0
            });

            this.layers.set(layerConfig.id, layer);
            this.layerConfigs.set(layerConfig.id, layerConfig);
            this.blobUrls.set(layerConfig.id, blobUrl);

            log.info(`✅ Created empty GeoJSON layer: ${layerConfig.id} (${isPointLayer ? 'Point' : 'Polygon'} geometry, ready for updates)`);
            return layer;
        } catch (error) {
            log.error(`Failed to create empty GeoJSON layer ${layerConfig.id}:`, error);
            errorService.report(error, { module: 'LayerManager', action: 'createEmptyGeoJSONLayer', id: layerConfig?.id });
            return null;
        }
    }

    // Create power outage layer using GraphicsLayer for mixed geometry support (Point + Polygon)
    // This approach allows custom icons (PictureMarkerSymbol) for point outages
    async createPowerOutageLayer(layerConfig, data = null) {
        try {
            const features = data?.features || [];
            const graphics = [];

            // Company symbol configurations - CEC (Cullman Electric Cooperative)
            // Logo downloaded from: https://cullmanec.com/sites/default/files/NRECA_Circle_Transparent_0.png
            // Saved locally to avoid CORS issues with ArcGIS PictureMarkerSymbol
            const companyConfigs = {
                'cullman': {
                    pointSymbol: {
                        type: 'picture-marker',
                        url: '/logos/cec-logo.png',
                        width: '28px',
                        height: '28px'
                    },
                    // Fallback simple marker if logo not available
                    pointSymbolFallback: {
                        type: 'simple-marker',
                        style: 'circle',
                        size: 16,
                        color: [255, 140, 0, 0.9], // Orange
                        outline: {
                            color: [255, 255, 255, 1],
                            width: 2
                        }
                    },
                    polygonSymbol: {
                        type: 'simple-fill',
                        color: [255, 140, 0, 0.35], // Orange with transparency
                        outline: {
                            color: [255, 100, 0, 0.9],
                            width: 3,
                            style: 'solid'
                        }
                    }
                }
            };

            // Determine company from layer ID
            const company = layerConfig.id.includes('cullman') ? 'cullman' : 'cullman';
            const companyConfig = companyConfigs[company];

            let pointCount = 0, polygonCount = 0;

            // Use the CEC logo as the point symbol
            const pointSymbol = companyConfig.pointSymbol;

            // Process each feature
            for (const feature of features) {
                if (!feature.geometry) continue;

                let arcgisGeometry;
                let symbol;
                const attributes = { ...feature.properties };

                if (feature.geometry.type === 'Point') {
                    arcgisGeometry = new Point({
                        longitude: feature.geometry.coordinates[0],
                        latitude: feature.geometry.coordinates[1],
                        spatialReference: { wkid: 4326 }
                    });
                    symbol = pointSymbol;
                    pointCount++;

                } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                    const rings = feature.geometry.type === 'MultiPolygon'
                        ? feature.geometry.coordinates[0] // Use first polygon of MultiPolygon
                        : feature.geometry.coordinates;

                    arcgisGeometry = new Polygon({
                        rings: rings,
                        spatialReference: { wkid: 4326 }
                    });
                    symbol = companyConfig.polygonSymbol;
                    polygonCount++;

                    // Create polygon graphic
                    const polygonGraphic = new Graphic({
                        geometry: arcgisGeometry,
                        symbol: symbol,
                        attributes: attributes,
                        popupTemplate: layerConfig.popupTemplate
                    });
                    graphics.push(polygonGraphic);

                    // Add logo/marker at centroid for better visibility
                    try {
                        const centroid = arcgisGeometry.centroid;
                        if (centroid) {
                            const centroidGraphic = new Graphic({
                                geometry: centroid,
                                symbol: pointSymbol,
                                attributes: {
                                    ...attributes,
                                    _is_centroid: true
                                },
                                popupTemplate: layerConfig.popupTemplate
                            });
                            graphics.push(centroidGraphic);
                        }
                    } catch (error) {
                        log.warn('Failed to create polygon centroid marker:', error.message);
                    }
                    continue; // Already added polygon graphic above
                }

                // Create point graphic
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

            // Create GraphicsLayer
            const layer = new GraphicsLayer({
                id: layerConfig.id,
                title: layerConfig.title,
                graphics: graphics,
                listMode: layerConfig.visible ? 'show' : 'hide',
                visible: layerConfig.visible !== undefined ? layerConfig.visible : true
            });

            log.info(`✅ Created ${layerConfig.title} with ${graphics.length} graphics (${pointCount} points, ${polygonCount} polygons)`);

            this.layers.set(layerConfig.id, layer);
            this.layerConfigs.set(layerConfig.id, layerConfig);

            return layer;
        } catch (error) {
            log.error(`Failed to create power outage layer ${layerConfig.id}:`, error);
            errorService.report(error, { module: 'LayerManager', action: 'createPowerOutageLayer', id: layerConfig?.id });
            return null;
        }
    }

    // Update power outage GraphicsLayer with new data
    async updatePowerOutageLayer(layerId, config, newData) {
        const map = this.getMapForLayer(layerId);
        if (!map) {
            log.warn(`No map found for layer ${layerId}`);
            return false;
        }

        // Get old layer to preserve visibility state
        const oldLayer = this.layers.get(layerId);
        let wasVisible = true;

        if (oldLayer) {
            wasVisible = oldLayer.visible;
            map.remove(oldLayer);
            this.layers.delete(layerId);
        }

        // Create new layer with updated data
        const newConfig = {
            ...config,
            visible: wasVisible
        };

        const newLayer = await this.createPowerOutageLayer(newConfig, newData);

        if (newLayer) {
            const zOrder = this.getZOrder(layerId);
            map.add(newLayer, zOrder);
            newLayer.visible = wasVisible;

            log.info(`✅ Updated power outage layer ${layerId}: ${newData.features?.length || 0} features`);
            return true;
        }

        return false;
    }

    // Create truck FeatureLayer for smooth real-time updates
    async createTruckFeatureLayer(layerConfig, data) {
        const originalFeatures = data.features;
        const graphics = [];

        // Convert GeoJSON features to ArcGIS Graphics
        originalFeatures.forEach((feature, index) => {
            if (!feature.geometry || feature.geometry.type !== 'Point') return;

            const arcgisGeometry = new Point({
                longitude: feature.geometry.coordinates[0],
                latitude: feature.geometry.coordinates[1],
                spatialReference: { wkid: 4326 }
            });

            const attributes = {
                OBJECTID: index + 1,  // Required for FeatureLayer
                ...feature.properties,
                is_driving: feature.properties.is_driving ? 1 : 0  // Convert boolean to integer
            };

            // Create graphic
            const graphic = new Graphic({
                geometry: arcgisGeometry,
                attributes: attributes
            });

            graphics.push(graphic);
        });

        // Create FeatureLayer from graphics (supports applyEdits)
        const layer = new FeatureLayer({
            id: layerConfig.id,
            title: layerConfig.title,
            source: graphics,
            fields: layerConfig.fields,
            objectIdField: 'OBJECTID',
            renderer: layerConfig.renderer,
            popupTemplate: layerConfig.popupTemplate,
            labelingInfo: layerConfig.labelingInfo,
            listMode: layerConfig.visible ? 'show' : 'hide',
            visible: layerConfig.visible !== undefined ? layerConfig.visible : true
        });

        log.info(`✅ Created ${layerConfig.title} FeatureLayer with ${graphics.length} truck features`);

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
            log.warn(`No layer instance provided for WebTileLayer: ${layerConfig.id}`);
            return null;
        }
    }




    // Smooth update for GeoJSONLayer (all subscriber layers) - efficient recreation with diff tracking
    async smoothGeoJSONUpdate(layerId, layer, newData) {
        try {
            const incoming = (newData.features || []).filter(f => f.geometry?.type === 'Point');

            // Add _stable_id to features for tracking
            const featuresWithStableId = incoming.map(f => {
                const attributes = f.properties;
                const stableId = attributes.id || attributes.account || attributes.remote_id || `${layerId}-${Math.random()}`;
                return {
                    ...f,
                    properties: {
                        ...attributes,
                        _stable_id: stableId
                    }
                };
            });

            // Create updated GeoJSON data
            const updatedData = {
                ...newData,
                features: featuresWithStableId
            };

            // Track update statistics (for logging)
            const featureCount = featuresWithStableId.length;

            // Use the existing updateGeoJSONLayer method which handles recreation
            const result = await this.updateGeoJSONLayer(layerId, this.layerConfigs.get(layerId), updatedData);

            if (result) {
                log.info(`✅ GeoJSON layer updated (${layerId}): ${featureCount} total features`);
            }

            return result;
        } catch (error) {
            log.error(`❌ Failed to smooth update GeoJSON layer ${layerId}:`, error);
            errorService.report(error, { module: 'LayerManager', action: 'smoothGeoJSONUpdate', id: layerId });
            return false;
        }
    }

    // ISP: Focused interface for layer visibility
    async toggleLayerVisibility(layerId, visible) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            log.error(`Layer not found: ${layerId}`);
            return false;
        }

        // Track layer toggle
        const { trackLayerToggle } = await import('../services/AnalyticsService.js');
        trackLayerToggle(layerId, visible, {
            layer_type: layer.type || 'unknown'
        });

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

                // Reapply labels for node-sites/sprout-huts when it becomes visible
                if ((layerId === 'node-sites' || layerId === 'sprout-huts') && visible && mapLayer.labelingInfo && mapLayer.labelingInfo.length > 0) {
                    // Ensure labels are properly set
                    setTimeout(() => {
                        if (mapLayer.visible && mapLayer.labelingInfo) {
                            mapLayer.refresh();
                            log.info(`${layerId} labels refreshed after visibility change`);
                        }
                    }, 300);
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
            log.warn(`Layer ${layerId} not found for update`);
            return false;
        }

        try {
            log.info(`🔄 Updating layer: ${layerId}`);

            // Subscriber layers use smoothGeoJSONUpdate with debouncing; ignore empties to avoid flicker
            if (layerId === 'offline-subscribers' || layerId === 'online-subscribers') {
                const count = newData?.features?.length || 0;
                if (count === 0) {
                    log.warn(`⏭️ Ignoring empty update for ${layerId} to preserve existing markers`);
                    return true;
                }
                return this.debouncedUpdateLayerData(layerId, newData);
            }

            // Trucks via FeatureLayer edits
            if (layerId.includes('trucks') && layer.type === 'feature') {
                const truckData = newData.features ? newData.features.map(f => f.properties) : newData;
                return this.smoothTruckUpdate(layerId, truckData);
            }

            // Power outage layers use GraphicsLayer for mixed geometry (Point + Polygon) support
            if (layerId.includes('outages') && layer.type === 'graphics') {
                return this.updatePowerOutageLayer(layerId, config, newData);
            }

            // GeoJSON layers
            if (layer.type === 'geojson') {
                return this.updateGeoJSONLayer(layerId, config, newData);
            }

            return true;
        } catch (error) {
            log.error(`Failed to update layer ${layerId}:`, error);
            errorService.report(error, { module: 'LayerManager', action: 'updateLayerData', id: layerId });
            return false;
        }
    }

    // Debounced update method for subscriber layers
    async debouncedUpdateLayerData(layerId, newData) {
        // Clear existing debounce timer
        if (this.updateDebounceTimers.has(layerId)) {
            clearTimeout(this.updateDebounceTimers.get(layerId));
        }

        // Skip if update is already in progress
        if (this.updateInProgress.get(layerId)) {
            log.info(`⏭️ Skipping update for ${layerId} - update already in progress`);
            return false;
        }

        // Set debounce timer
        return new Promise((resolve) => {
            const timer = setTimeout(async () => {
                try {
                    this.updateInProgress.set(layerId, true);
                    const layer = this.layers.get(layerId);
                    const result = await this.smoothGeoJSONUpdate(layerId, layer, newData);
                    resolve(result);
                } catch (error) {
                    log.error(`Failed to update ${layerId}:`, error);
                    resolve(false);
                } finally {
                    this.updateInProgress.set(layerId, false);
                    this.updateDebounceTimers.delete(layerId);
                }
            }, 500); // 500ms debounce delay

            this.updateDebounceTimers.set(layerId, timer);
        });
    }

    // Update GeoJSONLayer by recreating it
    async updateGeoJSONLayer(layerId, config, newData) {
        const map = this.getMapForLayer(layerId);
        if (!map) {
            log.warn(`No map found for layer ${layerId}`);
            return false;
        }

        // If incoming dataset is empty, keep existing layer to avoid wiping markers due to transient backend empties
        // Exception: Allow empty updates for power outages (outages can be resolved)
        const incomingCount = newData?.features?.length || 0;
        const isPowerOutageLayer = layerId.includes('outages');
        if (incomingCount === 0 && !isPowerOutageLayer) {
            log.warn(`⚠️ Skipping ${layerId} update: incoming feature count is 0 (preserving existing markers)`);
            return true;
        }

        // Get old layer to preserve visibility state and definition expression
        const oldLayer = this.layers.get(layerId);
        let wasVisible = false;
        let definitionExpression = null;

        if (oldLayer) {
            // Preserve the visibility state
            wasVisible = oldLayer.visible;

            // Preserve the definition expression (for filters like Business Internet Only)
            definitionExpression = oldLayer.definitionExpression;

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

            // Set visibility and definition expression after a small delay to ensure layer is properly initialized
            setTimeout(() => {
                newLayer.visible = wasVisible;

                // Restore definition expression if it existed
                // This preserves filters like Business Internet and Electric Offline
                if (definitionExpression) {
                    newLayer.definitionExpression = definitionExpression;
                    log.info(`✅ Restored definition expression for ${layerId}: ${definitionExpression}`);
                }

                log.info(`✅ Set visibility for ${layerId} to ${wasVisible}`);

                // Force refresh if visible
                if (wasVisible && typeof newLayer.refresh === 'function') {
                    newLayer.refresh();
                }
            }, 100);

            log.info(`✅ Recreated layer ${layerId} with ${newData.features?.length || 0} features, visible: ${wasVisible}`);
            return true;
        }

        return false;
    }

    // Smooth truck update using applyEdits for real-time performance (like working implementation)
    async smoothTruckUpdate(layerId, truckData) {
        const layer = this.layers.get(layerId);
        if (!layer || !layer.visible) {
            return false;
        }

        try {
            // 1. Get current features on the map
            const currentFeaturesResult = await layer.queryFeatures({
                where: '1=1',
                outFields: ['*'],
                returnGeometry: true
            });
            const currentFeatures = currentFeaturesResult.features;

            // 2. Index current trucks by ID for O(1) lookup
            const currentTrucks = new Map();
            currentFeatures.forEach(feature => {
                const truckId = feature.attributes.id;
                if (truckId) {
                    currentTrucks.set(truckId, feature);
                }
            });

            // 3. Process fresh truck data - categorize changes
            const updatedFeatures = [];
            const newFeatures = [];
            const deletedFeatures = [];

            // 4. Find trucks to add or update
            truckData.forEach(truck => {
                const truckId = truck.id;
                const existingFeature = currentTrucks.get(truckId);

                if (existingFeature) {
                    // Update existing truck position
                    const newGeometry = new Point({
                        longitude: parseFloat(truck.longitude),
                        latitude: parseFloat(truck.latitude),
                        spatialReference: { wkid: 4326 }
                    });

                    // Clone and update feature (preserves ArcGIS internal state)
                    const updatedFeature = existingFeature.clone();
                    updatedFeature.geometry = newGeometry;

                    // Update all attributes
                    Object.assign(updatedFeature.attributes, {
                        id: truck.id,
                        name: truck.name,
                        latitude: truck.latitude,
                        longitude: truck.longitude,
                        installer: truck.installer,
                        speed: truck.speed,
                        is_driving: truck.is_driving ? 1 : 0,  // Convert boolean to integer
                        last_updated: truck.last_updated,
                        bearing: truck.bearing,
                        communication_status: truck.communication_status,
                        vehicle_type: truck.vehicle_type
                    });

                    updatedFeatures.push(updatedFeature);
                } else {
                    // New truck appeared - create new feature
                    const maxObjectId = Math.max(...currentFeatures.map(f => f.attributes.OBJECTID || 0), 0);

                    const newFeature = new Graphic({
                        geometry: new Point({
                            longitude: parseFloat(truck.longitude),
                            latitude: parseFloat(truck.latitude),
                            spatialReference: { wkid: 4326 }
                        }),
                        attributes: {
                            OBJECTID: maxObjectId + newFeatures.length + 1,  // Unique OBJECTID
                            id: truck.id,
                            name: truck.name,
                            latitude: truck.latitude,
                            longitude: truck.longitude,
                            installer: truck.installer,
                            speed: truck.speed,
                            is_driving: truck.is_driving ? 1 : 0,  // Convert boolean to integer
                            last_updated: truck.last_updated,
                            bearing: truck.bearing,
                            communication_status: truck.communication_status,
                            vehicle_type: truck.vehicle_type
                        }
                    });

                    newFeatures.push(newFeature);
                }
            });

            // 5. Find trucks to delete (trucks that exist on map but not in fresh data)
            const freshTruckIds = new Set(truckData.map(truck => truck.id));
            currentFeatures.forEach(existingFeature => {
                const truckId = existingFeature.attributes.id;
                if (!freshTruckIds.has(truckId)) {
                    deletedFeatures.push(existingFeature);
                }
            });

            // 6. Apply all changes in ONE batch operation
            const edits = {};
            if (updatedFeatures.length > 0) edits.updateFeatures = updatedFeatures;
            if (newFeatures.length > 0) edits.addFeatures = newFeatures;
            if (deletedFeatures.length > 0) edits.deleteFeatures = deletedFeatures;

            if (Object.keys(edits).length > 0) {
                await layer.applyEdits(edits);
                log.info(`✅ Smooth truck update applied: +${newFeatures.length} ~${updatedFeatures.length} -${deletedFeatures.length} trucks`);
            }

            return true;
        } catch (error) {
            log.error(`❌ Failed to smooth update truck layer ${layerId}:`, error);
            errorService.report(error, { module: 'LayerManager', action: 'smoothTruckUpdate', id: layerId });
            return false;
        }
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
            log.warn('🏷️ No map view available for FSA scale-dependent labeling, trying later...');
            // Retry after a delay
            setTimeout(() => {
                this.setupScaleDependentLabeling(layer, labelingInfo);
            }, 2000);
            return;
        }

        const targetScale = 80000; // Show labels when zoomed in to around zoom level 14 (scale 1:80,000 or closer)

        log.info('🏷️ Setting up FSA scale-dependent labeling');

        // Watch for scale changes using reactiveUtils (ArcGIS 4.33+)
        reactiveUtils.watch(() => mapView.scale, (scale) => {
            if (scale <= targetScale) {
                // Zoomed in enough - add labels
                if (!layer.labelingInfo || layer.labelingInfo.length === 0) {
                    log.info('🏷️ Adding FSA labels at scale 1:' + Math.round(scale));
                    layer.labelingInfo = labelingInfo;
                }
            } else {
                // Zoomed out too far - remove labels
                if (layer.labelingInfo && layer.labelingInfo.length > 0) {
                    log.info(`🚫 Removing FSA labels at scale 1:${Math.round(scale)} (zoom level <14)`);
                    layer.labelingInfo = [];
                }
            }
        });

        // Set initial state based on current scale
        const currentScale = mapView.scale;
        if (currentScale <= targetScale) {
            log.info('🏷️ Initial scale is within threshold, applying FSA labels');
            layer.labelingInfo = labelingInfo;
        } else {
            log.info('🏷️ Initial scale too far out, FSA labels will appear at zoom level 14+');
            layer.labelingInfo = [];
        }
    }


    // Clean up all blob URLs
    cleanup() {
        // Clear all debounce timers
        this.updateDebounceTimers.forEach((timer) => {
            clearTimeout(timer);
        });
        this.updateDebounceTimers.clear();
        this.updateInProgress.clear();

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