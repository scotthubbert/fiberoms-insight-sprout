// performanceOptimization.spec.js - Tests for 25k+ subscriber performance optimizations

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LayerManager } from '../src/services/LayerManager.js';
import { workerManager } from '../src/utils/WorkerManager.js';

// Mock ArcGIS modules
vi.mock('@arcgis/core/layers/FeatureLayer', () => ({
    default: vi.fn().mockImplementation((config) => ({
        id: config.id,
        title: config.title,
        source: config.source,
        featureReduction: config.featureReduction,
        minScale: config.minScale,
        maxScale: config.maxScale,
        when: vi.fn().mockResolvedValue(),
        applyEdits: vi.fn().mockResolvedValue({ 
            addFeatureResults: new Array(config.source.length).fill({})
        })
    }))
}));

vi.mock('@arcgis/core/Graphic', () => ({
    default: vi.fn().mockImplementation((config) => config)
}));

vi.mock('@arcgis/core/geometry/Point', () => ({
    default: vi.fn().mockImplementation((config) => ({
        type: 'point',
        ...config
    }))
}));

describe('LayerManager Performance Optimizations', () => {
    let layerManager;
    let mockDataService;
    
    beforeEach(() => {
        mockDataService = {
            getOnlineSubscribers: vi.fn()
        };
        layerManager = new LayerManager(mockDataService);
        
        // Mock window.mapView
        global.window.mapView = {
            extent: {
                xmin: -87.5,
                xmax: -87.0,
                ymin: 33.0,
                ymax: 33.5,
                width: 0.5,
                height: 0.5,
                contains: vi.fn((point) => {
                    return point.longitude >= -87.5 && point.longitude <= -87.0 &&
                           point.latitude >= 33.0 && point.latitude <= 33.5;
                }),
                clone: vi.fn().mockReturnThis(),
                expand: vi.fn().mockReturnThis()
            }
        };
    });
    
    afterEach(() => {
        vi.clearAllMocks();
        workerManager.terminate();
        delete global.window.mapView;
    });
    
    // Helper to generate test features
    function generateTestFeatures(count, bounds = null) {
        const features = [];
        for (let i = 0; i < count; i++) {
            const lng = bounds ? 
                bounds.xmin + Math.random() * (bounds.xmax - bounds.xmin) :
                -88 + Math.random() * 2;
            const lat = bounds ? 
                bounds.ymin + Math.random() * (bounds.ymax - bounds.ymin) :
                32 + Math.random() * 3;
                
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                properties: {
                    id: i + 1,
                    account: `ACC${String(i + 1).padStart(6, '0')}`,
                    name: `Subscriber ${i + 1}`,
                    status: 'Online',
                    service_type: i % 10 === 0 ? 'BUSINESS INTERNET' : 'RESIDENTIAL'
                }
            });
        }
        return features;
    }
    
    it('should apply clustering to online subscribers layer', async () => {
        const layerConfig = {
            id: 'online-subscribers',
            title: 'Online Subscribers',
            visible: false,
            fields: []
        };
        
        const testData = {
            features: generateTestFeatures(100)
        };
        
        const layer = await layerManager.createSubscriberFeatureLayer(layerConfig, testData);
        
        expect(layer).toBeTruthy();
        expect(layer.featureReduction).toBeTruthy();
        expect(layer.featureReduction.type).toBe('cluster');
        expect(layer.featureReduction.clusterRadius).toBe('45px');
    });
    
    it('should implement progressive loading for 25k+ online subscribers', async () => {
        const layerConfig = {
            id: 'online-subscribers',
            title: 'Online Subscribers',
            visible: false,
            fields: []
        };
        
        // Generate 25k features
        const allFeatures = generateTestFeatures(25000);
        
        // Make ~5k visible in viewport
        const viewportBounds = {
            xmin: -87.5,
            xmax: -87.0,
            ymin: 33.0,
            ymax: 33.5
        };
        
        // Place some features in viewport
        for (let i = 0; i < 5000; i++) {
            allFeatures[i].geometry.coordinates = [
                viewportBounds.xmin + Math.random() * (viewportBounds.xmax - viewportBounds.xmin),
                viewportBounds.ymin + Math.random() * (viewportBounds.ymax - viewportBounds.ymin)
            ];
        }
        
        const testData = { features: allFeatures };
        
        const layer = await layerManager.createSubscriberFeatureLayer(layerConfig, testData);
        
        // Should only load visible features initially
        expect(layer.source.length).toBeLessThan(allFeatures.length);
        expect(layer.source.length).toBeGreaterThan(4000); // Should have most viewport features
        
        // Check that deferred features are stored
        expect(layerManager.deferredFeatures.has('online-subscribers')).toBe(true);
        const deferred = layerManager.deferredFeatures.get('online-subscribers');
        expect(deferred.features.length).toBeGreaterThan(19000);
    });
    
    it('should show loading indicator for large datasets', async () => {
        const layerConfig = {
            id: 'online-subscribers',
            title: 'Online Subscribers',
            visible: false,
            fields: []
        };
        
        const testData = {
            features: generateTestFeatures(15000)
        };
        
        // Mock DOM
        document.body.innerHTML = '<div id="map"></div>';
        const mapEl = document.getElementById('map');
        
        const showSpy = vi.spyOn(layerManager, 'showLoadingIndicator');
        const hideSpy = vi.spyOn(layerManager, 'hideLoadingIndicator');
        
        await layerManager.createSubscriberFeatureLayer(layerConfig, testData);
        
        expect(showSpy).toHaveBeenCalledWith('online-subscribers', 15000);
        expect(hideSpy).toHaveBeenCalledWith('online-subscribers');
    });
    
    it('should set scale-dependent visibility for online subscribers', async () => {
        const layerConfig = {
            id: 'online-subscribers',
            title: 'Online Subscribers',
            visible: false,
            fields: []
        };
        
        const testData = {
            features: generateTestFeatures(1000)
        };
        
        const layer = await layerManager.createSubscriberFeatureLayer(layerConfig, testData);
        
        expect(layer.minScale).toBe(500000); // Hide when zoomed out beyond 1:500,000
        expect(layer.maxScale).toBe(0); // No limit on zoom in
    });
    
    it('should use web worker for very large datasets (20k+)', async () => {
        const layerConfig = {
            id: 'online-subscribers',
            title: 'Online Subscribers',
            visible: false,
            fields: []
        };
        
        const testData = {
            features: generateTestFeatures(25000)
        };
        
        // Mock worker manager
        const filterSpy = vi.spyOn(workerManager, 'filterByExtent').mockResolvedValue({
            visible: generateTestFeatures(5000),
            deferred: generateTestFeatures(20000),
            stats: {
                totalFeatures: 25000,
                visibleCount: 5000,
                deferredCount: 20000
            }
        });
        
        await layerManager.createSubscriberFeatureLayer(layerConfig, testData);
        
        expect(filterSpy).toHaveBeenCalled();
    });
    
    it('should fall back to main thread if worker fails', async () => {
        const layerConfig = {
            id: 'online-subscribers',
            title: 'Online Subscribers',
            visible: false,
            fields: []
        };
        
        const testData = {
            features: generateTestFeatures(25000)
        };
        
        // Mock worker failure
        vi.spyOn(workerManager, 'filterByExtent').mockRejectedValue(new Error('Worker failed'));
        const mainThreadSpy = vi.spyOn(layerManager, 'filterFeaturesByExtent');
        
        await layerManager.createSubscriberFeatureLayer(layerConfig, testData);
        
        expect(mainThreadSpy).toHaveBeenCalled();
    });
    
    it('should handle smooth subscriber updates without blocking UI', async () => {
        // Create initial layer
        const layerConfig = {
            id: 'online-subscribers',
            title: 'Online Subscribers',
            visible: true,
            fields: []
        };
        
        const initialData = {
            features: generateTestFeatures(5000)
        };
        
        const layer = await layerManager.createSubscriberFeatureLayer(layerConfig, initialData);
        layerManager.layers.set('online-subscribers', layer);
        
        // Mock layer query
        layer.queryFeatures = vi.fn().mockResolvedValue({
            features: initialData.features.map((f, i) => ({
                attributes: {
                    OBJECTID: i + 1,
                    _stable_id: f.properties.id
                }
            }))
        });
        
        // Update with new data
        const updateData = {
            features: generateTestFeatures(5100) // Added 100 new subscribers
        };
        
        const updateSpy = vi.spyOn(layerManager, 'smoothSubscriberUpdate');
        await layerManager.updateLayerData('online-subscribers', updateData);
        
        // Should use debounced update
        expect(layerManager.updateDebounceTimers.has('online-subscribers')).toBe(true);
        
        // Wait for debounce
        await new Promise(resolve => setTimeout(resolve, 600));
        
        expect(updateSpy).toHaveBeenCalled();
    });
});

describe('Online Subscriber Clustering Configuration', () => {
    it('should have appropriate cluster sizes for different counts', () => {
        const layerManager = new LayerManager({});
        const clusterConfig = layerManager.createOnlineSubscriberClustering();
        
        expect(clusterConfig.type).toBe('cluster');
        expect(clusterConfig.clusterRadius).toBe('45px');
        expect(clusterConfig.maxScale).toBe(24000); // Zoom level ~15
        
        // Check size stops
        const sizeStops = clusterConfig.renderer.visualVariables[0].stops;
        expect(sizeStops).toContainEqual({ value: 1, size: '10px' });
        expect(sizeStops).toContainEqual({ value: 1000, size: '40px' });
    });
    
    it('should only show cluster labels for actual clusters', () => {
        const layerManager = new LayerManager({});
        const clusterConfig = layerManager.createOnlineSubscriberClustering();
        
        const labelExpression = clusterConfig.labelingInfo[0].labelExpressionInfo.expression;
        expect(labelExpression).toContain('cluster_count > 1');
    });
});

describe('Viewport-based Progressive Loading', () => {
    let layerManager;
    
    beforeEach(() => {
        layerManager = new LayerManager({});
    });
    
    it('should load additional features when viewport changes', async () => {
        const mockLayer = {
            id: 'online-subscribers',
            applyEdits: vi.fn().mockResolvedValue({
                addFeatureResults: new Array(100).fill({})
            })
        };
        
        // Set up deferred features
        const deferredFeatures = generateTestFeatures(1000);
        layerManager.deferredFeatures.set('online-subscribers', {
            features: deferredFeatures,
            nextObjectId: 5001
        });
        
        // Mock reactive utils
        let extentWatcher;
        vi.mock('@arcgis/core/core/reactiveUtils', () => ({
            watch: vi.fn((getter, callback) => {
                extentWatcher = callback;
                return { remove: vi.fn() };
            })
        }));
        
        layerManager.setupViewportLoading(mockLayer, 'online-subscribers');
        
        // Simulate viewport change after delay
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        // Should attempt to load features in new viewport
        expect(mockLayer.applyEdits).toHaveBeenCalled();
    });
});