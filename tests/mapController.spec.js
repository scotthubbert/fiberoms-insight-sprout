import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@arcgis/core/geometry/Extent', () => ({ default: vi.fn().mockImplementation((opts) => ({ ...opts })) }));

// Helpers
const ensureArcgisMapDefined = () => {
    if (!globalThis.customElements) globalThis.customElements = {};
    if (!globalThis.customElements.whenDefined) {
        globalThis.customElements.whenDefined = vi.fn().mockResolvedValue(undefined);
    } else {
        vi.spyOn(globalThis.customElements, 'whenDefined').mockResolvedValue(undefined);
    }
};

describe('MapController (init)', () => {
    let MapController;
    let LayerManager;
    let ThemeManager;
    let mapEl;

    beforeEach(async () => {
        ensureArcgisMapDefined();

        // Fresh DOM element real Node
        mapEl = document.createElement('div');
        mapEl.id = 'map';
        mapEl.ready = false;
        mapEl.view = {
            map: { layers: { length: 0, getItemAt: vi.fn(), add: vi.fn() } },
            when: (cb) => { cb(); return { catch: () => { } }; },
            goTo: vi.fn(() => Promise.resolve()),
            ui: { find: vi.fn() }
        };
        document.body.appendChild(mapEl);

        // Minimal layer manager + theme manager doubles
        LayerManager = function () { };
        ThemeManager = function () { this.applyThemeToView = vi.fn(); };

        const mod = await import('../src/services/MapController.js');
        MapController = mod.MapController;
    });

    it('initializes and applies service area bounds without throwing', async () => {
        const controller = new MapController(new LayerManager(), new ThemeManager());
        await controller.initialize();
        // Simulate map becoming ready
        mapEl.dispatchEvent(new CustomEvent('arcgisViewReadyChange'));
        expect(controller.view).toBeTruthy();
        expect(controller.map).toBeTruthy();
    });
});


