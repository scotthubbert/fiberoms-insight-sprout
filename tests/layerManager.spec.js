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
    global.window = { mapView: { map: { add: vi.fn(), findLayerById: vi.fn() } } };
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
});


