// HoverHighlightService.js - Handles hover highlighting for map features
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import { createLogger } from '../utils/logger.js';

const log = createLogger('HoverHighlightService');

export class HoverHighlightService {
    constructor() {
        this.view = null;
        this.highlightLayer = null;
        this.currentHighlight = null;
        this.hoverHandler = null;
        this.leaveHandler = null;
    }

    /**
     * Initialize the hover highlight service with a map view
     * @param {import('@arcgis/core/views/MapView').default} view - The map view
     */
    initialize(view) {
        if (!view) {
            log.error('HoverHighlightService: View is required for initialization');
            return;
        }

        this.view = view;
        this.createHighlightLayer();
        this.setupHoverHandlers();
        log.info('HoverHighlightService initialized');
        
        // Verify fiber layer exists
        setTimeout(() => {
            const fiberLayer = this.view.map.layers.find(layer => layer.id === 'main-line-fiber');
            if (fiberLayer) {
                log.info(`Fiber layer found: ${fiberLayer.id}, visible: ${fiberLayer.visible}`);
            } else {
                log.warn('Fiber layer not found - hover highlighting may not work');
            }
        }, 1000);
    }

    /**
     * Create a graphics layer for hover highlights
     */
    createHighlightLayer() {
        if (!this.view || !this.view.map) {
            log.error('HoverHighlightService: View or map not available');
            return;
        }

        // Create highlight layer
        this.highlightLayer = new GraphicsLayer({
            id: 'fiber-hover-highlight',
            title: 'Fiber Hover Highlight',
            listMode: 'hide', // Hide from layer list
            visible: true
        });

        // Add layer to map above fiber layers (z-order 31, just above main-line-fiber at 30)
        this.view.map.add(this.highlightLayer);
        log.info('Hover highlight layer created');
    }

    /**
     * Set up pointer move and leave handlers for hover highlighting
     */
    setupHoverHandlers() {
        if (!this.view) return;

        // Remove existing handlers if any
        if (this.hoverHandler) {
            this.hoverHandler.remove();
            this.hoverHandler = null;
        }
        if (this.leaveHandler) {
            this.leaveHandler.remove();
            this.leaveHandler = null;
        }

        // Handle pointer move (hover) - use throttling to improve performance
        let throttleTimeout = null;
        this.hoverHandler = this.view.on('pointer-move', (event) => {
            // Throttle hover events to improve performance
            if (throttleTimeout) {
                clearTimeout(throttleTimeout);
            }
            throttleTimeout = setTimeout(() => {
                this.handlePointerMove(event);
            }, 16); // ~60fps throttling
        });

        // Handle pointer leave (clear highlight)
        this.leaveHandler = this.view.on('pointer-leave', () => {
            if (throttleTimeout) {
                clearTimeout(throttleTimeout);
                throttleTimeout = null;
            }
            this.clearHighlight();
        });

        log.info('Hover handlers set up for fiber cables');
    }

    /**
     * Handle pointer move events to detect hover over fiber cables
     * @param {Object} event - Pointer move event
     */
    async handlePointerMove(event) {
        if (!this.view || !this.highlightLayer) return;

        try {
            // Find the main-line-fiber layer
            const fiberLayer = this.view.map.layers.find(layer => 
                layer.id === 'main-line-fiber' && layer.visible
            );

            if (!fiberLayer) {
                this.clearHighlight();
                return;
            }

            // Wait for layer to be loaded
            if (fiberLayer.loading) {
                await fiberLayer.when();
            }

            // Perform hit test to find features under the cursor
            // The event should have x and y properties for screen coordinates
            const hitTestResult = await this.view.hitTest(event, {
                include: [fiberLayer]
            });

            if (hitTestResult.results && hitTestResult.results.length > 0) {
                // Find fiber cable features - check both graphic.layer and layer properties
                const fiberResults = hitTestResult.results.filter(result => {
                    if (!result.graphic) return false;
                    
                    // Check if the result belongs to the fiber layer
                    const layer = result.graphic.layer || result.layer;
                    return layer && layer.id === 'main-line-fiber';
                });

                if (fiberResults.length > 0) {
                    const result = fiberResults[0];
                    const graphic = result.graphic;
                    
                    // Ensure we have geometry - if not, try to get it from the layer
                    if (!graphic.geometry) {
                        // Try to query the feature from the layer
                        if (fiberLayer.queryFeatures) {
                            const objectId = graphic.attributes?.objectId || 
                                            graphic.attributes?.id || 
                                            graphic.attributes?.OBJECTID;
                            if (objectId) {
                                try {
                                    const queryResult = await fiberLayer.queryFeatures({
                                        objectIds: [objectId],
                                        returnGeometry: true,
                                        num: 1
                                    });
                                    if (queryResult.features && queryResult.features.length > 0) {
                                        this.highlightFeature(queryResult.features[0]);
                                        return;
                                    }
                                } catch (queryError) {
                                    log.debug('Query failed, using graphic as-is:', queryError);
                                }
                            }
                        }
                        // If we can't get geometry, skip highlighting
                        this.clearHighlight();
                        return;
                    }
                    
                    this.highlightFeature(graphic);
                } else {
                    this.clearHighlight();
                }
            } else {
                this.clearHighlight();
            }
        } catch (error) {
            // Only log if it's not a common/expected error
            if (!error.message?.includes('canceled') && !error.message?.includes('abort')) {
                log.debug('Hit test error (may be expected):', error.message);
            }
            this.clearHighlight();
        }
    }

    /**
     * Highlight a feature by creating a highlight graphic
     * @param {Graphic} featureGraphic - The graphic to highlight
     */
    highlightFeature(featureGraphic) {
        if (!this.highlightLayer || !featureGraphic || !featureGraphic.geometry) {
            return;
        }

        // Create a unique identifier for comparison
        const currentId = this.currentHighlight?.attributes?.objectId || 
                         this.currentHighlight?.attributes?.id ||
                         this.currentHighlight?.attributes?.OBJECTID;
        const newId = featureGraphic.attributes?.objectId || 
                     featureGraphic.attributes?.id ||
                     featureGraphic.attributes?.OBJECTID;

        // Don't re-highlight if it's the same feature
        if (currentId && newId && currentId === newId) {
            return;
        }

        // Clear existing highlight
        this.clearHighlight();

        // Get fiber count to determine highlight color
        const fiberCount = featureGraphic.attributes?.fiber_count || 
                          featureGraphic.attributes?.FIBERCOUNT || 
                          0;
        const placement = featureGraphic.attributes?.placement || 
                         featureGraphic.attributes?.PLACEMENTT || 
                         'Aerial';

        // Determine highlight color based on fiber count (similar to Mapbox version)
        // Use contrasting colors: Aqua for red/brown/orange fibers, Hot Pink for others
        const isHighCount = [144, 96, 48].includes(fiberCount);
        const highlightColor = isHighCount ? [0, 255, 255, 0.9] : [255, 105, 180, 0.9]; // Aqua or Hot Pink
        const isUnderground = placement === 'Underground' || 
                             placement === 'BURIED' || 
                             placement === 'Buried' ||
                             placement === 'underground';

        // Get original width from the graphic's symbol or use default
        const originalWidth = featureGraphic.symbol?.width || 3;
        
        // Create highlight symbol with thicker width (at least 6px wider)
        const highlightSymbol = new SimpleLineSymbol({
            color: highlightColor,
            width: Math.max(8, originalWidth + 6), // Significantly thicker for visibility
            style: isUnderground ? 'dash' : 'solid',
            cap: 'round',
            join: 'round'
        });

        // Create highlight graphic with the same geometry
        const highlightGraphic = new Graphic({
            geometry: featureGraphic.geometry.clone(), // Clone geometry to avoid reference issues
            symbol: highlightSymbol,
            attributes: {
                ...featureGraphic.attributes,
                objectId: newId || featureGraphic.attributes?.OBJECTID
            }
        });

        // Add to highlight layer
        this.highlightLayer.add(highlightGraphic);
        this.currentHighlight = highlightGraphic;

        // Change cursor to pointer
        if (this.view && this.view.container) {
            this.view.container.style.cursor = 'pointer';
        }
    }

    /**
     * Clear the current highlight
     */
    clearHighlight() {
        if (this.highlightLayer && this.currentHighlight) {
            this.highlightLayer.remove(this.currentHighlight);
            this.currentHighlight = null;
        }

        // Reset cursor
        if (this.view && this.view.container) {
            this.view.container.style.cursor = '';
        }
    }

    /**
     * Clean up handlers and resources
     */
    cleanup() {
        if (this.hoverHandler) {
            this.hoverHandler.remove();
            this.hoverHandler = null;
        }

        if (this.leaveHandler) {
            this.leaveHandler.remove();
            this.leaveHandler = null;
        }

        this.clearHighlight();

        if (this.highlightLayer && this.view && this.view.map) {
            this.view.map.remove(this.highlightLayer);
            this.highlightLayer = null;
        }

        log.info('HoverHighlightService cleaned up');
    }

    /**
     * Destroy the service and clean up all resources
     */
    destroy() {
        this.cleanup();
        this.view = null;
        log.info('HoverHighlightService destroyed');
    }
}

export const hoverHighlightService = new HoverHighlightService();

