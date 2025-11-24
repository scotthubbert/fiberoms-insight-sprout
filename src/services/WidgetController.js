import { createLogger } from '../utils/logger.js';
import { getCurrentServiceArea, getServiceAreaBounds, getSearchSettings } from '../config/searchConfig.js';

const log = createLogger('WidgetController');

export class WidgetController {
    constructor(mapController) {
        this.mapController = mapController;
        this._searchWidgetListener = null;
    }

    // Idle scheduler reused across paths
    scheduleIdle(fn) {
        if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2000 });
        else setTimeout(fn, 500);
    }

    // Cross-browser media query change listener
    addMqChange(mq, handler) {
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else if (mq.addListener) mq.addListener(handler);
    }

    async loadWidgets() {
        log.info('[MAP-UI] 🚀 loadWidgets() called');

        // Lazy inject core widgets on all devices
        const injectCoreWidgets = async () => {
            const mapEl = this.mapController?.mapElement;
            log.info('[MAP-UI] 📍 Map element:', mapEl ? 'FOUND' : 'NOT FOUND');

            if (!mapEl) {
                log.warn('[MAP-UI] ❌ Map element not found, retrying in 1 second...');
                setTimeout(async () => {
                    log.info('[MAP-UI] 🔄 Retrying loadWidgets...');
                    await this.loadWidgets();
                }, 1000);
                return;
            }

            // Wait for map view to be ready before adding components
            if (!mapEl.view) {
                log.warn('[MAP-UI] ⏳ Map view not ready yet, waiting...');
                try {
                    await mapEl.arcgisViewReadyChange;
                    log.info('[MAP-UI] ✅ Map view ready via event, injecting widgets');
                } catch (e) {
                    log.warn('[MAP-UI] arcgisViewReadyChange event failed, polling...');
                    let attempts = 0;
                    while (!mapEl.view && attempts < 10) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        attempts++;
                    }
                    if (!mapEl.view) {
                        log.error('[MAP-UI] ❌ Map view never became ready, aborting widget injection');
                        return;
                    }
                    log.info('[MAP-UI] ✅ Map view ready via polling, injecting widgets');
                }
            } else {
                log.info('[MAP-UI] ✅ Map view already ready, injecting widgets');
            }

            // Search widget - load FIRST
            const loadSearchWidget = async () => {
                try {
                    if (!customElements.get('arcgis-search')) {
                        await import('@arcgis/map-components/dist/components/arcgis-search');
                        log.info('[MAP-UI] ✅ Search component loaded');
                    }
                    if (!mapEl.querySelector('arcgis-search')) {
                        const s = document.createElement('arcgis-search');
                        s.setAttribute('slot', 'top-right');
                        s.setAttribute('include-default-sources', 'true');
                        s.setAttribute('max-results', '8');
                        s.setAttribute('min-characters', '3');
                        s.setAttribute('search-all-enabled', 'false');
                        s.setAttribute('placeholder', 'Search addresses, places...');
                        if (mapEl.firstChild) {
                            mapEl.insertBefore(s, mapEl.firstChild);
                        } else {
                            mapEl.appendChild(s);
                        }
                        log.info('[MAP-UI] ✅ Search widget added to map');
                        try {
                            await s.componentOnReady();
                            log.info('[MAP-UI] ✅ Search component ready, visible:', !s.hidden, 'display:', getComputedStyle(s).display);
                            if (this.mapController?.view) {
                                this.configureSearchWidget();
                            } else {
                                setTimeout(() => {
                                    if (this.mapController?.view) {
                                        this.configureSearchWidget();
                                    }
                                }, 1000);
                            }
                        } catch (error) {
                            log.error('[MAP-UI] Search widget ready error:', error);
                        }
                    }
                } catch (error) {
                    log.error('[MAP-UI] Failed to load Search widget:', error);
                }
            };

            await loadSearchWidget();

            // Verify widgets were added and check visibility
            setTimeout(() => {
                const widgets = {
                    search: mapEl.querySelector('arcgis-search'),
                    locate: mapEl.querySelector('arcgis-locate'),
                    track: mapEl.querySelector('arcgis-track')
                };
                const widgetCount = Object.values(widgets).filter(w => w).length;
                log.info(`[MAP-UI] 📊 Total map components in DOM: ${widgetCount}`);
                Object.entries(widgets).forEach(([name, el]) => {
                    if (el) {
                        const style = getComputedStyle(el);
                        const visible = !el.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                        log.info(`[MAP-UI]    ${name}: DOM=${el ? '✅' : '❌'} visible=${visible ? '✅' : '❌'} display=${style.display} visibility=${style.visibility} opacity=${style.opacity}`);
                    } else {
                        log.info(`[MAP-UI]    ${name}: ❌ NOT IN DOM`);
                    }
                });
            }, 2000);

            // Locate
            try {
                if (!customElements.get('arcgis-locate')) {
                    await import('@arcgis/map-components/dist/components/arcgis-locate');
                }
                if (!mapEl.querySelector('arcgis-locate')) {
                    const l = document.createElement('arcgis-locate');
                    l.setAttribute('slot', 'top-right');
                    mapEl.appendChild(l);
                    log.info('[MAP-UI] ✅ Locate widget added');
                }
            } catch (error) {
                log.error('[MAP-UI] Failed to load Locate widget:', error);
            }

            // Track
            try {
                if (!customElements.get('arcgis-track')) {
                    await import('@arcgis/map-components/dist/components/arcgis-track');
                }
                if (!mapEl.querySelector('arcgis-track')) {
                    const t = document.createElement('arcgis-track');
                    t.setAttribute('slot', 'top-right');
                    mapEl.appendChild(t);
                    log.info('[MAP-UI] ✅ Track widget added');
                }
            } catch (error) {
                log.error('[MAP-UI] Failed to load Track widget:', error);
            }
        };
        await injectCoreWidgets();

        // Basemap Toggle
        try {
            const mapEl = this.mapController?.mapElement;
            if (mapEl) {
                if (!customElements.get('arcgis-basemap-toggle')) {
                    try {
                        await import('@arcgis/map-components/dist/components/arcgis-basemap-toggle');
                        log.info('[MAP-UI] ✅ Basemap Toggle component loaded');
                    } catch (error) {
                        log.error('[MAP-UI] Failed to load Basemap Toggle component:', error);
                    }
                }
                if (!mapEl.querySelector('arcgis-basemap-toggle')) {
                    const toggleEl = document.createElement('arcgis-basemap-toggle');
                    toggleEl.setAttribute('slot', 'bottom-right');
                    toggleEl.setAttribute('next-basemap', 'hybrid');
                    mapEl.appendChild(toggleEl);
                    log.info('[MAP-UI] ✅ Basemap Toggle added to map');
                }
            }
        } catch (error) {
            log.error('[MAP-UI] Error setting up Basemap Toggle:', error);
        }

        // Desktop-only Basemap Gallery
        const mq = window.matchMedia('(min-width: 900px) and (pointer: fine)');
        const ensureBasemapGallery = async () => {
            try {
                const mapEl = this.mapController?.mapElement;
                if (!mapEl) return;

                if (mq.matches) {
                    if (!customElements.get('arcgis-basemap-gallery')) {
                        try { await import('@arcgis/map-components/dist/components/arcgis-basemap-gallery'); } catch (_) { /* no-op */ }
                    }
                    if (!customElements.get('arcgis-expand')) {
                        try { await import('@arcgis/map-components/dist/components/arcgis-expand'); } catch (_) { /* no-op */ }
                    }
                    const existingExpand = mapEl.querySelector('arcgis-expand[icon="basemap"]');
                    if (!existingExpand) {
                        const expandEl = document.createElement('arcgis-expand');
                        expandEl.setAttribute('slot', 'top-right');
                        expandEl.setAttribute('icon', 'basemap');
                        expandEl.setAttribute('tooltip', 'Basemap Gallery');
                        const galleryEl = document.createElement('arcgis-basemap-gallery');
                        expandEl.appendChild(galleryEl);
                        mapEl.appendChild(expandEl);
                    }
                } else {
                    const existingExpand = mapEl.querySelector('arcgis-expand[icon="basemap"]');
                    if (existingExpand) existingExpand.parentNode?.removeChild(existingExpand);
                }
            } catch (_) { /* no-op */ }
        };
        if (mq.matches) {
            this.scheduleIdle(ensureBasemapGallery);
        }
        this.addMqChange(mq, ensureBasemapGallery);

        // Desktop-only Fullscreen
        const fsMq = window.matchMedia('(min-width: 900px) and (pointer: fine)');
        const ensureFullscreen = async () => {
            try {
                const mapEl = this.mapController?.mapElement;
                if (!mapEl) return;
                if (fsMq.matches) {
                    if (!customElements.get('arcgis-fullscreen')) {
                        try { await import('@arcgis/map-components/dist/components/arcgis-fullscreen'); } catch (_) { /* no-op */ }
                    }
                    if (!mapEl.querySelector('arcgis-fullscreen')) {
                        const fsEl = document.createElement('arcgis-fullscreen');
                        fsEl.setAttribute('slot', 'top-right');
                        mapEl.appendChild(fsEl);
                    }
                } else {
                    const fsEl = mapEl.querySelector('arcgis-fullscreen');
                    if (fsEl) fsEl.parentNode?.removeChild(fsEl);
                }
            } catch (_) { /* no-op */ }
        };
        await ensureFullscreen();
        this.addMqChange(fsMq, ensureFullscreen);
    }

    configureSearchWidget() {
        const searchWidget = document.querySelector('arcgis-search');
        if (!searchWidget || !this.mapController.view) {
            console.warn('Search widget or map view not available for configuration');
            return;
        }

        const serviceArea = getCurrentServiceArea();
        const initialExtent = (typeof window !== 'undefined' && window.initialMapExtent) ? window.initialMapExtent : null;
        const bounds = initialExtent || this.mapController?.calculatedExtentBase || this.mapController?.calculatedExtent || getServiceAreaBounds();
        const searchSettings = getSearchSettings();

        try {
            if (searchSettings.placeholder) {
                searchWidget.setAttribute('placeholder', searchSettings.placeholder);
            }

            if (this._searchWidgetListener) {
                searchWidget.removeEventListener('arcgisReady', this._searchWidgetListener);
                this._searchWidgetListener = null;
            }

            const applyBoundsToSources = () => {
                const widget = searchWidget.widget;
                if (!widget || !widget.allSources) return;

                if (bounds) {
                    const searchExtent = {
                        type: 'extent',
                        xmin: bounds.xmin,
                        ymin: bounds.ymin,
                        xmax: bounds.xmax,
                        ymax: bounds.ymax,
                        spatialReference: bounds.spatialReference || { wkid: 4326 }
                    };
                    widget.searchExtent = searchExtent;

                    const centerLat = (bounds.ymin + bounds.ymax) / 2;
                    const centerLon = (bounds.xmin + bounds.xmax) / 2;

                    widget.allSources.forEach(source => {
                        if (!source.locator) return;

                        source.location = {
                            type: 'point',
                            latitude: centerLat,
                            longitude: centerLon,
                            spatialReference: { wkid: 4326 }
                        };

                        source.countryCode = 'US';
                        source.searchExtent = searchExtent;
                        source.withinViewEnabled = true;
                        source.localSearchDisabled = false;
                        source.localSearchOptions = {
                            distance: 50000,
                            minScale: 300000
                        };

                        if (source.zoomScale == null) {
                            source.zoomScale = 24000;
                        }
                    });

                    console.info('✅ Search configured with local preference:', {
                        area: serviceArea.name,
                        extent: searchExtent
                    });
                } else {
                    widget.searchExtent = null;
                    widget.allSources.forEach(source => {
                        if (!source.locator) return;

                        if (source.location) delete source.location;
                        if (source.countryCode) delete source.countryCode;
                        if (source.localSearchOptions) delete source.localSearchOptions;
                        if (source.searchExtent) delete source.searchExtent;

                        if (source.hasOwnProperty('withinViewEnabled')) {
                            source.withinViewEnabled = false;
                        }
                        if (source.hasOwnProperty('localSearchDisabled')) {
                            source.localSearchDisabled = false;
                        }
                    });
                    console.info('✅ Search configured for global search (no local preference)');
                }
            };

            this._searchWidgetListener = applyBoundsToSources;
            searchWidget.addEventListener('arcgisReady', applyBoundsToSources, { once: true });
            if (searchWidget.widget && searchWidget.widget.allSources) applyBoundsToSources();
        } catch (error) {
            log.error(`Failed to configure search widget with ${serviceArea.name} bounds:`, error);
        }
    }
}
