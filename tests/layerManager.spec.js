import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal mock for ArcGIS classes used in LayerManager
vi.mock('@arcgis/core/layers/GeoJSONLayer', () => ({ default: vi.fn().mockImplementation((opts) => ({ ...opts, type: 'geojson' })) }));
vi.mock('@arcgis/core/layers/FeatureLayer', () => ({ default: vi.fn().mockImplementation((opts) => ({ ...opts, type: 'feature', applyEdits: vi.fn() })) }));
vi.mock('@arcgis/core/layers/GraphicsLayer', () => ({ default: vi.fn().mockImplementation((opts) => ({ ...opts, type: 'graphics' })) }));
vi.mock('@arcgis/core/PopupTemplate', () => ({ default: vi.fn() }));
vi.mock('@arcgis/core/Graphic', () => ({ default: vi.fn().mockImplementation((opts) => ({ ...opts, clone: () => ({ ...opts }) })) }));
vi.mock('@arcgis/core/geometry/Polygon', () => ({ default: vi.fn().mockImplementation((opts) => ({ ...opts, centroid: { x: 0, y: 0 } })) }));
vi.mock('@arcgis/core/geometry/Point', () => ({ default: vi.fn().mockImplementation((opts) => ({ ...opts })) }));
vi.mock('@arcgis/core/core/reactiveUtils', () => ({ watch: vi.fn() }));

import { LayerManager } from '../src/services/LayerManager.js';

describe('LayerManager', () => {
  let manager;
  const fakeDataService = {};

  beforeEach(() => {
    manager = new LayerManager(fakeDataService);
    global.window = {
      mapView: {
        map: {
          add: vi.fn(),
          remove: vi.fn(),
          findLayerById: vi.fn()
        }
      }
    };
    global.document = {
      dispatchEvent: vi.fn()
    };
  });

  it('creates a GeoJSON layer from features', async () => {
    const layer = await manager.createLayer({
      id: 'offline-subscribers',
      layerType: 'GeoJSON',
      dataSource: { features: [{ geometry: {}, properties: {} }] },
      renderer: {},
      popupTemplate: {},
      fields: []
    });
    expect(layer).toBeTruthy();
    expect(layer.id).toBe('offline-subscribers');
  });

  it('creates FeatureLayer for trucks', async () => {
    const layer = await manager.createLayer({
      id: 'fiber-trucks',
      dataSource: { features: [{ geometry: { type: 'Point', coordinates: [0, 0] }, properties: { id: 't1' } }] },
      fields: [],
      renderer: {}
    });
    expect(layer.type).toBe('feature');
  });

  it('smoothly updates truck layer via applyEdits (add only)', async () => {
    const layerId = 'fiber-trucks';
    const mockLayer = {
      type: 'feature',
      visible: true,
      applyEdits: vi.fn(async () => ({})),
      queryFeatures: vi.fn(async () => ({ features: [] }))
    };

    manager.layers.set(layerId, mockLayer);
    manager.layerConfigs.set(layerId, { id: layerId });

    const ok = await manager.updateLayerData(layerId, [
      { id: 't1', latitude: 1, longitude: 2, is_driving: true },
      { id: 't2', latitude: 3, longitude: 4, is_driving: false }
    ]);

    expect(ok).toBe(true);
    expect(mockLayer.applyEdits).toHaveBeenCalled();
    const arg = mockLayer.applyEdits.mock.calls[0][0];
    expect(Array.isArray(arg.addFeatures)).toBe(true);
    expect(arg.addFeatures.length).toBe(2);
  });

  it('recreates GeoJSON layer on update (preserves visibility)', async () => {
    const layerId = 'offline-subscribers';
    // Seed an existing geojson layer
    const existing = { id: layerId, type: 'geojson', visible: true };
    manager.layers.set(layerId, existing);
    manager.layerConfigs.set(layerId, { id: layerId, fields: [], renderer: {} });

    const ok = await manager.updateLayerData(layerId, {
      features: [{ geometry: {}, properties: {} }]
    });

    expect(ok).toBe(true);
    expect(window.mapView.map.remove).toHaveBeenCalledWith(existing);
    expect(window.mapView.map.add).toHaveBeenCalled();
  });

  it('toggles layer visibility and dispatches event', async () => {
    const layerId = 'fsa-boundaries';
    const layerRef = { id: layerId, type: 'geojson', visible: false, listMode: 'hide' };
    manager.layers.set(layerId, layerRef);

    const mapLayerRef = { id: layerId, type: 'geojson', visible: false };
    window.mapView.map.findLayerById.mockReturnValue(mapLayerRef);

    const ok = await manager.toggleLayerVisibility(layerId, true);
    expect(ok).toBe(true);
    expect(layerRef.visible).toBe(true);
    expect(layerRef.listMode).toBe('show');
    expect(mapLayerRef.visible).toBe(true);
    expect(document.dispatchEvent).toHaveBeenCalled();
  });
});


