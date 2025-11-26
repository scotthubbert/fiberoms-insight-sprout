import { createLogger } from '../utils/logger.js';
import { getCurrentServiceArea, getServiceAreaBounds, getSearchSettings } from '../config/searchConfig.js';
import LocatorSearchSource from '@arcgis/core/widgets/Search/LocatorSearchSource.js';

const log = createLogger('WidgetController');

export class WidgetController {
    constructor(mapController) {
        this.mapController = mapController;
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

            // Search widget with localized and world geocoding sources
            // Load search widget asynchronously (non-blocking) to prevent hanging on mobile devices
            const loadSearchWidget = async () => {
                try {
                    if (!customElements.get('arcgis-search')) {
                        await import('@arcgis/map-components/dist/components/arcgis-search');
                        log.info('[MAP-UI] ✅ Search component loaded');
                    }
                    if (!mapEl.querySelector('arcgis-search')) {
                        const searchEl = document.createElement('arcgis-search');
                        searchEl.setAttribute('slot', 'top-right');
                        searchEl.setAttribute('include-default-sources-disabled', '');
                        if (mapEl.firstChild) {
                            mapEl.insertBefore(searchEl, mapEl.firstChild);
                        } else {
                            mapEl.appendChild(searchEl);
                        }
                        log.info('[MAP-UI] ✅ Search widget added to map');

                        // Wait for component with timeout to prevent hanging on mobile
                        const componentReadyPromise = searchEl.componentOnReady();
                        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
                        await Promise.race([componentReadyPromise, timeoutPromise]);

                        const searchSettings = getSearchSettings();
                        const serviceArea = getCurrentServiceArea();
                        const bounds = getServiceAreaBounds();

                        if (bounds) {
                            const searchExtent = {
                                xmin: bounds.xmin,
                                ymin: bounds.ymin,
                                xmax: bounds.xmax,
                                ymax: bounds.ymax,
                                spatialReference: { wkid: 4326 }
                            };

                            const centerLat = (bounds.ymin + bounds.ymax) / 2;
                            const centerLon = (bounds.xmin + bounds.xmax) / 2;

                            // Primary: Service area-focused geocoding
                            const localSource = new LocatorSearchSource({
                                name: 'Local Geocoding Service',
                                url: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer',
                                singleLineFieldName: 'SingleLine',
                                placeholder: searchSettings.placeholder || 'Find address or place',
                                countryCode: 'US',
                                suggestionsEnabled: true,
                                minSuggestCharacters: searchSettings.minCharacters ?? 3,
                                maxResults: searchSettings.maxResults ?? 8,
                                location: {
                                    x: centerLon,
                                    y: centerLat,
                                    spatialReference: { wkid: 4326 }
                                },
                                searchExtent,
                                filter: { geometry: searchExtent },
                                withinViewEnabled: true,
                                localSearchOptions: {
                                    distance: 25000,
                                    minScale: 300000
                                },
                                suffix: ' Alabama',
                                zoomScale: 24000
                            });

                            // Secondary: Global geocoding fallback
                            const worldSource = new LocatorSearchSource({
                                name: 'ArcGIS World Geocoding Service',
                                url: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer',
                                singleLineFieldName: 'SingleLine',
                                placeholder: 'Search worldwide...',
                                suggestionsEnabled: true,
                                minSuggestCharacters: searchSettings.minCharacters ?? 3,
                                maxResults: searchSettings.maxResults ?? 8
                            });

                            // Use setTimeout to defer sources assignment, allowing component to fully initialize
                            setTimeout(() => {
                                try {
                                    searchEl.sources = [localSource, worldSource];
                                    log.info('[MAP-UI] ✅ Search configured:', serviceArea.name, '-', searchEl.sources.length, 'sources');
                                } catch (err) {
                                    log.error('[MAP-UI] Failed to assign search sources:', err);
                                }
                            }, 500);
                        } else {
                            // Fallback: Use default sources if no bounds configured
                            searchEl.setAttribute('include-default-sources', 'true');
                            log.info('[MAP-UI] ✅ Search configured with default sources (no bounds)');
                        }
                    }
                } catch (error) {
                    log.error('[MAP-UI] Failed to load Search widget:', error);
                }
            };

            // Don't await - let search widget load in parallel to prevent blocking map initialization
            loadSearchWidget().catch(err => log.error('[MAP-UI] Search widget async error:', err));

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

}
