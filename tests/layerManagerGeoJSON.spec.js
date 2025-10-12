import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LayerManager } from '../src/services/LayerManager';

// Mock ArcGIS modules
vi.mock('@arcgis/core/layers/GeoJSONLayer', () => ({
    default: vi.fn().mockImplementation(function(config) {
        this.id = config.id;
        this.url = config.url;
        this.renderer = config.renderer;
        this.popupTemplate = config.popupTemplate;
        this.featureReduction = config.featureReduction;
        this.fields = config.fields;
        this.visible = config.visible;
        this.type = 'geojson';
    })
}));

vi.mock('@arcgis/core/layers/FeatureLayer', () => ({
    default: vi.fn().mockImplementation(function(config) {
        this.id = config.id;
        this.source = config.source;
        this.renderer = config.renderer;
        this.popupTemplate = config.popupTemplate;
        this.featureReduction = config.featureReduction;
        this.fields = config.fields;
        this.visible = config.visible;
        this.type = 'feature';
        this.queryFeatures = vi.fn().mockResolvedValue({ features: [] });
        this.applyEdits = vi.fn().mockResolvedValue({ 
            addFeatureResults: [], 
            updateFeatureResults: [], 
            deleteFeatureResults: [] 
        });
    })
}));

vi.mock('@arcgis/core/Graphic', () => ({
    default: vi.fn().mockImplementation(function(config) {
        this.geometry = config.geometry;
        this.attributes = config.attributes;
    })
}));

vi.mock('@arcgis/core/geometry/Point', () => ({
    default: vi.fn().mockImplementation(function(config) {
        this.longitude = config.longitude;
        this.latitude = config.latitude;
        this.spatialReference = config.spatialReference;
    })
}));

describe('LayerManager GeoJSONLayer Tests', () => {
    let layerManager;
    let mockDataService;

    beforeEach(() => {
        mockDataService = {
            fetchData: vi.fn()
        };
        layerManager = new LayerManager(mockDataService);

        // Mock URL.createObjectURL
        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();
    });

    describe('Layer Creation', () => {
        it('should create GeoJSONLayer for online-subscribers', async () => {
            const layerConfig = {
                id: 'online-subscribers',
                title: 'Online Subscribers',
                renderer: {},
                popupTemplate: {},
                featureReduction: {},
                fields: [{ name: '_stable_id', type: 'string' }],
                visible: true,
                dataSource: {
                    features: [
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
                            properties: { id: 1, account: 'ACC001', status: 'online' }
                        }
                    ]
                }
            };

            const layer = await layerManager.createLayer(layerConfig);

            expect(layer).toBeDefined();
            expect(layer.type).toBe('geojson');
            expect(layer.id).toBe('online-subscribers');
            
            // Verify _stable_id was added to features
            const createdBlob = global.URL.createObjectURL.mock.calls[0][0];
            const blobText = await createdBlob.text();
            const geoJson = JSON.parse(blobText);
            
            expect(geoJson.features[0].properties._stable_id).toBeDefined();
            expect(geoJson.features[0].properties.account).toBe('ACC001');
        });

        it('should create FeatureLayer for offline-subscribers', async () => {
            const layerConfig = {
                id: 'offline-subscribers',
                title: 'Offline Subscribers',
                renderer: {},
                popupTemplate: {},
                fields: [],
                visible: true,
                dataSource: {
                    features: [
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
                            properties: { id: 1, account: 'ACC002', status: 'offline' }
                        }
                    ]
                }
            };

            const layer = await layerManager.createLayer(layerConfig);

            expect(layer).toBeDefined();
            expect(layer.type).toBe('feature');
            expect(layer.id).toBe('offline-subscribers');
        });
    });

    describe('Smooth Updates', () => {
        it('should use smoothGeoJSONUpdate for online-subscribers', async () => {
            // First create the layer
            const layerConfig = {
                id: 'online-subscribers',
                title: 'Online Subscribers',
                renderer: {},
                popupTemplate: {},
                fields: [{ name: '_stable_id', type: 'string' }],
                visible: true,
                dataSource: {
                    features: [
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
                            properties: { id: 1, account: 'ACC001', status: 'online' }
                        }
                    ]
                }
            };

            await layerManager.createLayer(layerConfig);

            // Mock the updateGeoJSONLayer method
            layerManager.updateGeoJSONLayer = vi.fn().mockResolvedValue(true);

            // Update with new data
            const newData = {
                features: [
                    {
                        type: 'Feature', 
                        geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
                        properties: { id: 1, account: 'ACC001', status: 'online' }
                    },
                    {
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [-87.6300, 41.8782] },
                        properties: { id: 2, account: 'ACC003', status: 'online' }
                    }
                ]
            };

            const result = await layerManager.smoothSubscriberUpdate('online-subscribers', newData);

            expect(result).toBe(true);
            expect(layerManager.updateGeoJSONLayer).toHaveBeenCalled();
            
            // Verify _stable_id was added to new features
            const updateCall = layerManager.updateGeoJSONLayer.mock.calls[0];
            const updatedData = updateCall[2];
            expect(updatedData.features[0].properties._stable_id).toBeDefined();
            expect(updatedData.features[1].properties._stable_id).toBeDefined();
        });

        it('should use smoothFeatureLayerUpdate for offline-subscribers', async () => {
            // Create offline subscriber layer
            const layerConfig = {
                id: 'offline-subscribers',
                title: 'Offline Subscribers',
                renderer: {},
                popupTemplate: {},
                fields: [],
                visible: true,
                dataSource: {
                    features: [
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
                            properties: { id: 1, account: 'ACC002', status: 'offline' }
                        }
                    ]
                }
            };

            const layer = await layerManager.createLayer(layerConfig);

            // Update with new data
            const newData = {
                features: [
                    {
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
                        properties: { id: 1, account: 'ACC002', status: 'offline' }
                    }
                ]
            };

            const result = await layerManager.smoothSubscriberUpdate('offline-subscribers', newData);

            // Since it's a FeatureLayer, it should use applyEdits
            expect(layer.queryFeatures).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });

    describe('Performance Features', () => {
        it('should handle large datasets with _stable_id tracking', async () => {
            // Create features with 1000 points
            const features = [];
            for (let i = 0; i < 1000; i++) {
                features.push({
                    type: 'Feature',
                    geometry: { 
                        type: 'Point', 
                        coordinates: [-87.6298 + i * 0.001, 41.8781 + i * 0.001] 
                    },
                    properties: { 
                        id: i, 
                        account: `ACC${i.toString().padStart(4, '0')}`, 
                        status: 'online' 
                    }
                });
            }

            const layerConfig = {
                id: 'online-subscribers',
                title: 'Online Subscribers',
                renderer: {},
                popupTemplate: {},
                featureReduction: {},
                fields: [{ name: '_stable_id', type: 'string' }],
                visible: true,
                dataSource: { features }
            };

            const layer = await layerManager.createLayer(layerConfig);

            expect(layer).toBeDefined();
            expect(layer.type).toBe('geojson');
            
            // Verify all features have _stable_id
            const createdBlob = global.URL.createObjectURL.mock.calls[0][0];
            const blobText = await createdBlob.text();
            const geoJson = JSON.parse(blobText);
            
            expect(geoJson.features.length).toBe(1000);
            geoJson.features.forEach((f, i) => {
                expect(f.properties._stable_id).toBeDefined();
                expect(f.properties.account).toBe(`ACC${i.toString().padStart(4, '0')}`);
            });
        });
    });
});