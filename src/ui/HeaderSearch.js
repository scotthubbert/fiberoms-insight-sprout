// HeaderSearch.js - Manages search functionality across desktop and mobile interfaces
// Enhanced with client-side fuzzy search using Fuse.js

import { subscriberDataService } from '../dataService.js';
import { enhancedSearchService } from '../services/EnhancedSearchService.js';
import { createLogger } from '../utils/logger.js';
// POSTHOG DISABLED - Process of elimination for RDP click capture testing
// import { trackSearch } from '../services/AnalyticsService.js';

// Initialize logger for this module
const log = createLogger('HeaderSearch');

export class HeaderSearch {
    constructor() {
        this.searchInput = document.getElementById('header-search');
        this.mobileSearchInput = document.getElementById('mobile-search-input');
        this.desktopSearchInput = document.getElementById('desktop-search');
        this.searchTimeout = null;
        this.mobileSearchTimeout = null;
        this.desktopSearchTimeout = null;
        this.currentResults = [];
        this.currentIndicatorGraphics = null;
    }

    async init() {
        if (!this.searchInput && !this.mobileSearchInput && !this.desktopSearchInput) return;

        await customElements.whenDefined('calcite-autocomplete');
        await customElements.whenDefined('calcite-autocomplete-item');
        await customElements.whenDefined('calcite-input');

        // Initialize enhanced search service in background
        enhancedSearchService.initialize().catch(error => {
            log.warn('Enhanced search service initialization failed, falling back to server-side search:', error);
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Header search (autocomplete)
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                const searchValue = e.target.inputValue || e.target.value;
                if (searchValue) {
                    this.handleSearchInput(searchValue, 'header');
                }
            });

            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleEnterKeySelection(this.searchInput);
                }
            });

            this.searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Escape') {
                    this.clearEverything('header');
                }
            });

            this.searchInput.addEventListener('calciteAutocompleteChange', (e) => {
                if (e.target.selectedItem) {
                    this.handleSearchSelection(e.target.selectedItem);
                } else if (e.target.value) {
                    const selectedElement = e.target.querySelector(`calcite-autocomplete-item[value="${e.target.value}"]`);
                    if (selectedElement && selectedElement._resultData) {
                        this.handleSearchSelection(selectedElement);
                    }
                }
            });
        }

        // Desktop search (autocomplete)
        if (this.desktopSearchInput) {
            this.desktopSearchInput.addEventListener('input', (e) => {
                if (e.target.inputValue) {
                    this.handleSearchInput(e.target.inputValue, 'desktop');
                }
            });

            this.desktopSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleEnterKeySelection(this.desktopSearchInput);
                }
            });

            this.desktopSearchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Escape') {
                    this.clearEverything('desktop');
                }
            });

            this.desktopSearchInput.addEventListener('calciteAutocompleteChange', (e) => {
                if (e.target.selectedItem) {
                    this.handleSearchSelection(e.target.selectedItem);
                }
            });
        }

        // Mobile search (regular input)
        if (this.mobileSearchInput) {
            this.mobileSearchInput.addEventListener('input', (e) => {
                this.handleMobileSearchInput(e.target.value);
            });

            this.mobileSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleMobileEnterKey(e.target.value);
                }
            });

            this.mobileSearchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Escape') {
                    this.clearEverything('mobile');
                }
            });
        }
    }

    handleSearchInput(searchTerm, source = 'header') {
        const timeoutKey = source === 'desktop' ? 'desktopSearchTimeout' : 'searchTimeout';
        if (this[timeoutKey]) clearTimeout(this[timeoutKey]);

        if (!searchTerm || searchTerm.trim() === '') {
            this.clearEverything(source);
            return;
        }

        // Reduced minimum length to 2 characters (matching React implementation)
        if (searchTerm.length < 2) {
            this.clearSearchResults(source);
            return;
        }

        this[timeoutKey] = setTimeout(() => {
            this.performSearch(searchTerm, source);
        }, 300);
    }

    async performSearch(searchTerm, source = 'header') {
        try {
            const targetInput = source === 'desktop' ? this.desktopSearchInput : this.searchInput;
            this.setSearchLoading(true, targetInput);
            
            let searchResult;
            
            // Try enhanced search first (client-side fuzzy search)
            try {
                await enhancedSearchService.initialize();
                searchResult = await enhancedSearchService.search(searchTerm);
                
                // Map enhanced search results to expected format
                searchResult.results = searchResult.results.map(item => {
                    // Handle different result types
                    if (item.type === 'pole') {
                        return {
                            id: item.wmElementN || `pole-${item.latitude}-${item.longitude}`,
                            name: item.name,
                            wmElementN: item.wmElementN,
                            type: 'pole',
                            latitude: item.latitude,
                            longitude: item.longitude,
                            // For display
                            customer_name: `Pole: ${item.name}`,
                            ...item.originalData
                        };
                    } else if (item.type === 'mst') {
                        return {
                            id: item.equipmentname || `mst-${item.latitude}-${item.longitude}`,
                            name: item.name,
                            equipmentname: item.equipmentname,
                            type: 'mst',
                            latitude: item.latitude,
                            longitude: item.longitude,
                            // For display
                            customer_name: `MST: ${item.name}`,
                            ...item.originalData
                        };
                    } else {
                        // Subscriber result
                        return {
                            id: item.account || item.id,
                            customer_name: item.name,
                            customer_number: item.account,
                            address: item.address || item.originalData?.address,
                            city: item.city || item.originalData?.city,
                            state: item.state || item.originalData?.state,
                            zip: item.postcode || item.originalData?.postcode,
                            zip_code: item.postcode || item.originalData?.postcode,
                            status: item.status,
                            latitude: item.latitude,
                            longitude: item.longitude,
                            // Include all original data
                            ...item.originalData
                        };
                    }
                });
            } catch (enhancedError) {
                log.warn('Enhanced search failed, falling back to server-side search:', enhancedError);
                // Fallback to server-side search
                searchResult = await subscriberDataService.searchSubscribers(searchTerm);
                
                // Check if search returned an error (e.g., table not configured)
                if (searchResult.error) {
                    log.warn('Search returned error:', searchResult.error);
                    // Show no results instead of error for graceful degradation
                    this.updateSearchResults({ results: [], searchTerm }, targetInput);
                    return;
                }
            }
            
            // Track search event
            // POSTHOG DISABLED - Process of elimination for RDP click capture testing
            // trackSearch(searchTerm, searchResult.results?.length || 0, {
            //     source,
            //     has_results: (searchResult.results?.length || 0) > 0,
            //     search_type: searchResult.searchType || 'server'
            // });
            
            this.updateSearchResults(searchResult, targetInput);
        } catch (error) {
            log.error('Search failed:', error);
            
            // Track failed search
            // POSTHOG DISABLED - Process of elimination for RDP click capture testing
            // trackSearch(searchTerm, 0, {
            //     source,
            //     has_results: false,
            //     error: error.message
            // });
            
            this.showSearchError(source === 'desktop' ? this.desktopSearchInput : this.searchInput);
        } finally {
            this.setSearchLoading(false, source === 'desktop' ? this.desktopSearchInput : this.searchInput);
        }
    }

    updateSearchResults(searchResult, targetInput) {
        this.clearSearchResults(null, targetInput, false);
        this.currentResults = searchResult.results;

        if (this.currentResults.length === 0) {
            this.showNoResults(searchResult.searchTerm, targetInput);
            return;
        }

        this.currentResults.forEach((result, index) => {
            const item = document.createElement('calcite-autocomplete-item');
            item.setAttribute('value', String(result.id || index));
            const label = this.formatSearchResultLabel(result);
            item.setAttribute('text-label', label || 'Unknown');
            const description = this.formatEnhancedDescription(result);
            item.setAttribute('description', description || '');
            
            // Set icon and styling based on result type
            if (result.type === 'pole') {
                item.setAttribute('data-type', 'pole');
                item.innerHTML = `<calcite-icon slot="icon" icon="pin" style="color: #8B4513;"></calcite-icon>`;
            } else if (result.type === 'mst') {
                item.setAttribute('data-type', 'mst');
                item.innerHTML = `<calcite-icon slot="icon" icon="network" style="color: #4B8EF5;"></calcite-icon>`;
            } else {
                item.setAttribute('data-status', result.status || 'unknown');
                const statusColor = result.status === 'Online' ? 'success' : 'danger';
                item.innerHTML = `<calcite-icon slot="icon" icon="person" style="color: var(--calcite-color-status-${statusColor});"></calcite-icon>`;
            }
            
            item._resultData = result;
            targetInput.appendChild(item);
        });
    }

    formatSearchResultLabel(result) {
        if (!result) return 'Unknown';
        
        // Handle different result types
        if (result.type === 'pole') {
            return `Pole: ${result.wmElementN || result.name || 'Unknown Pole'}`;
        } else if (result.type === 'mst') {
            return `MST: ${result.equipmentname || result.name || 'Unknown MST'}`;
        }
        
        return String(result.customer_name || result.name || 'Unnamed Customer');
    }

    formatSearchResultDescription(result) {
        if (!result) return '';
        const parts = [];
        if (result.customer_number) parts.push(`#${result.customer_number}`);
        if (result.address) parts.push(result.address);
        if (result.city) parts.push(result.city);
        return parts.join(' • ') || 'No details available';
    }

    formatFullAddress(result) {
        const parts = [];
        if (result.address) parts.push(result.address);
        if (result.city) parts.push(result.city);
        if (result.state) parts.push(result.state);
        if (result.zip) parts.push(result.zip);
        return parts.length > 0 ? parts.join(', ') : 'No address available';
    }

    formatEnhancedDescription(result) {
        if (!result) return 'No details available';
        
        // Handle different result types
        if (result.type === 'pole') {
            // Only show pole ID, not coordinates (reduces data transfer)
            return result.wmElementN ? `Pole ID: ${result.wmElementN}` : 'No details available';
        } else if (result.type === 'mst') {
            const parts = [];
            if (result.equipmentname) parts.push(`Equipment: ${result.equipmentname}`);
            if (result.latitude && result.longitude) {
                parts.push(`Coordinates: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`);
            }
            return parts.join(' • ') || 'No details available';
        }
        
        // Subscriber result
        const parts = [];
        if (result.customer_name) parts.push(String(result.customer_name));
        if (result.customer_number) parts.push(String(result.customer_number));
        const address = this.formatFullAddress(result);
        if (address && address !== 'No address available') parts.push(String(address));
        return parts.join(' • ') || 'No details available';
    }

    handleSearchSelection(selectedItem) {
        const resultData = selectedItem._resultData;
        if (resultData) {
            this.navigateToResult(resultData);
            if (this.searchInput) {
                this.searchInput.value = '';
                this.clearSearchResults('header');
            }
            if (this.desktopSearchInput) {
                this.desktopSearchInput.value = '';
                this.clearSearchResults('desktop');
            }
        }
    }

    handleEnterKeySelection(targetInput) {
        const firstItem = targetInput.querySelector('calcite-autocomplete-item:not([disabled])');
        if (firstItem && firstItem._resultData) {
            this.handleSearchSelection(firstItem);
        } else if (this.currentResults && this.currentResults.length > 0) {
            const firstResult = this.currentResults[0];
            const mockSelectedItem = { _resultData: firstResult };
            this.handleSearchSelection(mockSelectedItem);
        }
    }

    navigateToResult(result) {
        if (!result.latitude || !result.longitude) {
            log.warn('Missing coordinates for navigation');
            return;
        }

        if (!window.mapView) {
            const mapView = window.app?.services?.mapController?.view;
            if (!mapView) {
                log.error('No mapView available');
                return;
            }
            window.mapView = mapView;
        }

        this.clearLocationIndicator();

        const point = {
            type: 'point',
            longitude: parseFloat(result.longitude),
            latitude: parseFloat(result.latitude)
        };

        window.mapView.center = [parseFloat(result.longitude), parseFloat(result.latitude)];
        window.mapView.zoom = Math.max(window.mapView.zoom, 16);

        // Show appropriate indicator based on result type
        if (result.type === 'pole' || result.type === 'mst') {
            this.showInfrastructureIndicator(point, result);
        } else {
            this.showLocationIndicator(point, result);
            this.showLayerPopup(result, point);
        }
    }

    showInfrastructureIndicator(point, result) {
        if (!window.mapView) return;
        this.clearLocationIndicator();
        
        import('@arcgis/core/Graphic').then(({ default: Graphic }) => {
            import('@arcgis/core/symbols/SimpleMarkerSymbol').then(({ default: SimpleMarkerSymbol }) => {
                const indicatorGraphics = [];
                
                // Different colors for different types
                let centerColor, centerSize, outlineColor;
                if (result.type === 'pole') {
                    centerColor = [139, 69, 19, 1]; // Brown for poles
                    centerSize = 10;
                    outlineColor = [255, 255, 255, 1];
                } else if (result.type === 'mst') {
                    centerColor = [75, 142, 245, 1]; // Blue for MSTs
                    centerSize = 10;
                    outlineColor = [255, 255, 255, 1];
                }

                const centerDot = new Graphic({
                    geometry: point,
                    symbol: new SimpleMarkerSymbol({
                        style: 'circle',
                        color: centerColor,
                        size: centerSize,
                        outline: { color: outlineColor, width: 2 }
                    })
                });

                const ring = new Graphic({
                    geometry: point,
                    symbol: new SimpleMarkerSymbol({
                        style: 'circle',
                        color: [0, 0, 0, 0],
                        size: 45,
                        outline: { color: centerColor, width: 3 }
                    })
                });

                indicatorGraphics.push(ring);
                indicatorGraphics.push(centerDot);
                indicatorGraphics.forEach(graphic => window.mapView.graphics.add(graphic));
                this.currentIndicatorGraphics = indicatorGraphics;
                
                // Show popup with infrastructure details
                this.showInfrastructurePopup(result, point);
                
                setTimeout(() => this.clearLocationIndicator(), 10000);
            });
        });
    }

    showInfrastructurePopup(result, point) {
        if (!window.mapView) return;
        
        let title, content;
        if (result.type === 'pole') {
            title = `Pole: ${result.wmElementN || 'Unknown'}`;
            content = `
                <div class="search-result-popup">
                    <p><strong>Pole ID:</strong> ${result.wmElementN || 'N/A'}</p>
                    <p><strong>Coordinates:</strong> ${result.latitude?.toFixed(6)}, ${result.longitude?.toFixed(6)}</p>
                </div>
            `;
        } else if (result.type === 'mst') {
            title = `MST: ${result.equipmentname || 'Unknown'}`;
            content = `
                <div class="search-result-popup">
                    <p><strong>Equipment:</strong> ${result.equipmentname || 'N/A'}</p>
                    <p><strong>Coordinates:</strong> ${result.latitude?.toFixed(6)}, ${result.longitude?.toFixed(6)}</p>
                    ${result.originalData?.distributi ? `<p><strong>DA:</strong> ${result.originalData.distributi}</p>` : ''}
                </div>
            `;
        }
        
        window.mapView.openPopup({
            title: title,
            content: content,
            location: point
        });
    }

    showLocationIndicator(point, result) {
        if (!window.mapView) return;
        this.clearLocationIndicator();
        this.createRingIndicator(point, result);
    }

    createRingIndicator(point, result) {
        if (!window.mapView) return;
        import('@arcgis/core/Graphic').then(({ default: Graphic }) => {
            import('@arcgis/core/symbols/SimpleMarkerSymbol').then(({ default: SimpleMarkerSymbol }) => {
                const indicatorGraphics = [];
                const isOnline = result.status === 'Online';
                const layerId = isOnline ? 'online-subscribers' : 'offline-subscribers';
                const layer = window.mapView.map.layers.find(l => l.id === layerId);
                const isLayerVisible = layer ? layer.visible : false;

                let centerColor, centerSize, outlineWidth;
                if (isOnline) {
                    centerColor = [50, 255, 50, 1]; // Brighter green for better visibility
                    centerSize = 6;
                    outlineWidth = 1;
                } else {
                    centerColor = [220, 38, 38, 1];
                    centerSize = 8;
                    outlineWidth = 2;
                }

                const centerDot = new Graphic({
                    geometry: point,
                    symbol: new SimpleMarkerSymbol({
                        style: 'circle',
                        color: centerColor,
                        size: centerSize,
                        outline: { color: [255, 255, 255, 1], width: outlineWidth }
                    })
                });

                let temporaryPoint = null;
                if (!isLayerVisible) {
                    temporaryPoint = new Graphic({
                        geometry: point,
                        symbol: new SimpleMarkerSymbol({
                            style: 'circle',
                            color: isOnline ? [50, 255, 50, 0.9] : [220, 38, 38, 0.8], // Brighter green for online
                            size: isOnline ? 6 : 8,
                            outline: { color: centerColor, width: isOnline ? 1 : 2 }
                        })
                    });
                }

                const ring = new Graphic({
                    geometry: point,
                    symbol: new SimpleMarkerSymbol({
                        style: 'circle',
                        color: [0, 0, 0, 0],
                        size: 45,
                        outline: { color: [0, 150, 255, 1], width: 3 }
                    })
                });

                indicatorGraphics.push(ring);
                if (temporaryPoint) indicatorGraphics.push(temporaryPoint);
                indicatorGraphics.push(centerDot);
                indicatorGraphics.forEach(graphic => window.mapView.graphics.add(graphic));
                this.currentIndicatorGraphics = indicatorGraphics;
                setTimeout(() => this.clearLocationIndicator(), 10000);
            });
        });
    }

    clearLocationIndicator() {
        if (this.currentIndicatorGraphics && window.mapView) {
            this.currentIndicatorGraphics.forEach(graphic => {
                window.mapView.graphics.remove(graphic);
            });
            this.currentIndicatorGraphics = null;
        }
    }

    async showLayerPopup(result, point) {
        if (!window.mapView) return;
        try {
            const layerId = result.status === 'Online' ? 'online-subscribers' : 'offline-subscribers';
            const layer = window.mapView.map.layers.find(l => l.id === layerId);
            if (!layer) {
                log.warn('Layer not found:', layerId);
                this.fallbackPopup(result, point);
                return;
            }
            const query = layer.createQuery();
            query.geometry = point;
            query.spatialRelationship = 'intersects';
            query.distance = 10;
            query.units = 'meters';
            query.returnGeometry = true;
            query.outFields = ['*'];
            const queryResult = await layer.queryFeatures(query);
            if (queryResult.features.length > 0) {
                const feature = queryResult.features[0];
                window.mapView.openPopup({ features: [feature], location: point });
            } else if (result.customer_number) {
                await this.queryByCustomerNumber(layer, result, point);
            } else {
                this.fallbackPopup(result, point);
            }
        } catch (error) {
            log.error('Layer feature error:', error);
            this.fallbackPopup(result, point);
        }
    }

    async queryByCustomerNumber(layer, result, point) {
        try {
            const query = layer.createQuery();
            query.where = `customer_number = '${result.customer_number}' OR customer_number = ${result.customer_number}`;
            query.returnGeometry = true;
            query.outFields = ['*'];
            const queryResult = await layer.queryFeatures(query);
            if (queryResult.features.length > 0) {
                const feature = queryResult.features[0];
                window.mapView.openPopup({ features: [feature], location: feature.geometry || point });
            } else {
                this.fallbackPopup(result, point);
            }
        } catch (error) {
            log.error('Customer query failed:', error);
            this.fallbackPopup(result, point);
        }
    }

    fallbackPopup(result, point) {
        window.mapView.openPopup({
            title: `${result.customer_name}`,
            content: `
        <div class="search-result-popup">
          <p><strong>Customer:</strong> ${result.customer_name || 'Unknown'}</p>
          <p><strong>Account:</strong> ${result.customer_number || 'N/A'}</p>
          <p><strong>Address:</strong> ${result.address || 'No address'}</p>
          <p><strong>City:</strong> ${result.city || 'N/A'}</p>
          <p><strong>Status:</strong> <span class="status-${result.status}">${result.status || 'Unknown'}</span></p>
          <p><strong>County:</strong> ${result.county || 'N/A'}</p>
          <p><em>Note: Using search result data (layer feature not found)</em></p>
        </div>
      `,
            location: point
        });
    }

    clearSearchResults(source = null, targetInput = null, clearState = true) {
        if (targetInput) {
            const items = targetInput.querySelectorAll('calcite-autocomplete-item');
            items.forEach(item => item.remove());
        } else if (source === 'desktop' && this.desktopSearchInput) {
            const items = this.desktopSearchInput.querySelectorAll('calcite-autocomplete-item');
            items.forEach(item => item.remove());
        } else if (source === 'header' && this.searchInput) {
            const items = this.searchInput.querySelectorAll('calcite-autocomplete-item');
            items.forEach(item => item.remove());
        } else {
            [this.searchInput, this.desktopSearchInput].forEach(input => {
                if (input) {
                    const items = input.querySelectorAll('calcite-autocomplete-item');
                    items.forEach(item => item.remove());
                }
            });
        }
        if (clearState) this.currentResults = [];
    }

    showNoResults(searchTerm, targetInput) {
        const item = document.createElement('calcite-autocomplete-item');
        item.setAttribute('value', 'no-results');
        item.setAttribute('text-label', 'No results found');
        item.setAttribute('description', `No subscribers found for "${searchTerm || ''}"` || 'No subscribers found');
        item.innerHTML = `<calcite-icon slot="icon" icon="information"></calcite-icon>`;
        item.disabled = true;
        targetInput.appendChild(item);
    }

    showSearchError(targetInput) {
        const item = document.createElement('calcite-autocomplete-item');
        item.setAttribute('value', 'error');
        item.setAttribute('text-label', 'Search Error');
        item.setAttribute('description', 'Unable to perform search. Please try again.');
        item.innerHTML = `<calcite-icon slot="icon" icon="exclamation-mark-triangle"></calcite-icon>`;
        item.disabled = true;
        targetInput.appendChild(item);
    }

    setSearchLoading(loading, targetInput) {
        if (loading) {
            const item = document.createElement('calcite-autocomplete-item');
            item.setAttribute('value', 'loading');
            item.setAttribute('text-label', 'Searching...');
            item.setAttribute('description', 'Please wait while we search for subscribers');
            item.innerHTML = `<calcite-icon slot="icon" icon="spinner"></calcite-icon>`;
            item.disabled = true;
            item.id = 'search-loading-item';
            targetInput.appendChild(item);
        } else {
            const loadingItem = targetInput.querySelector('#search-loading-item');
            if (loadingItem) loadingItem.remove();
        }
    }

    handleMobileSearchInput(searchTerm) {
        if (this.mobileSearchTimeout) clearTimeout(this.mobileSearchTimeout);
        if (!searchTerm || searchTerm.trim() === '') {
            this.clearMobileSearchResults();
            return;
        }
        // Reduced minimum length to 2 characters (matching React implementation)
        if (searchTerm.length < 2) {
            this.clearMobileSearchResults();
            return;
        }
        this.mobileSearchTimeout = setTimeout(() => {
            this.performMobileSearch(searchTerm);
        }, 300);
    }

    async performMobileSearch(searchTerm) {
        try {
            let searchResult;
            
            // Try enhanced search first (client-side fuzzy search)
            try {
                await enhancedSearchService.initialize();
                searchResult = await enhancedSearchService.search(searchTerm);
                
                // Map enhanced search results to expected format
                searchResult.results = searchResult.results.map(item => {
                    // Handle different result types
                    if (item.type === 'pole') {
                        return {
                            id: item.wmElementN || `pole-${item.latitude}-${item.longitude}`,
                            name: item.name,
                            wmElementN: item.wmElementN,
                            type: 'pole',
                            latitude: item.latitude,
                            longitude: item.longitude,
                            // For display
                            customer_name: `Pole: ${item.name}`,
                            ...item.originalData
                        };
                    } else if (item.type === 'mst') {
                        return {
                            id: item.equipmentname || `mst-${item.latitude}-${item.longitude}`,
                            name: item.name,
                            equipmentname: item.equipmentname,
                            type: 'mst',
                            latitude: item.latitude,
                            longitude: item.longitude,
                            // For display
                            customer_name: `MST: ${item.name}`,
                            ...item.originalData
                        };
                    } else {
                        // Subscriber result
                        return {
                            id: item.account || item.id,
                            customer_name: item.name,
                            customer_number: item.account,
                            address: item.address || item.originalData?.address,
                            city: item.city || item.originalData?.city,
                            state: item.state || item.originalData?.state,
                            zip: item.postcode || item.originalData?.postcode,
                            zip_code: item.postcode || item.originalData?.postcode,
                            status: item.status,
                            latitude: item.latitude,
                            longitude: item.longitude,
                            // Include all original data
                            ...item.originalData
                        };
                    }
                });
            } catch (enhancedError) {
                log.warn('Enhanced mobile search failed, falling back to server-side search:', enhancedError);
                // Fallback to server-side search
                searchResult = await subscriberDataService.searchSubscribers(searchTerm);
            }
            
            this.updateMobileSearchResults(searchResult);
        } catch (error) {
            log.error('Mobile search failed:', error);
        }
    }

    updateMobileSearchResults(searchResult) {
        const resultsContainer = this.createMobileResultsContainer();
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';
        if (searchResult.results.length === 0) {
            this.showMobileNoResults(resultsContainer, searchResult.searchTerm);
            return;
        }
        searchResult.results.forEach(result => {
            const listItem = document.createElement('calcite-list-item');
            listItem.setAttribute('label', result.customer_name || 'Unnamed Customer');
            const statusColor = result.status === 'Online' ? 'success' : 'danger';
            listItem.setAttribute('description', this.formatEnhancedDescription(result));
            listItem.innerHTML = `
        <calcite-icon slot="content-start" icon="person" style="color: var(--calcite-color-status-${statusColor});"></calcite-icon>
        <calcite-action slot="actions-end" icon="arrowRight"></calcite-action>
      `;
            listItem._resultData = result;
            listItem.addEventListener('click', () => {
                this.handleMobileSearchSelection(result);
            });
            resultsContainer.appendChild(listItem);
        });
        const resultsBlock = resultsContainer.closest('calcite-block');
        if (resultsBlock) resultsBlock.hidden = false;
    }

    handleMobileSearchSelection(result) {
        if (this.mobileSearchInput) this.mobileSearchInput.value = '';
        this.clearMobileSearchResults();
        const mobileDialog = document.getElementById('mobile-search-sheet');
        if (mobileDialog) mobileDialog.open = false;
        if (window.app?.services?.mobileTabBar) {
            window.app.services.mobileTabBar.closeCurrentPanel();
        }
        this.navigateToResult(result);
    }

    async handleMobileEnterKey(searchTerm) {
        const resultsContainer = document.querySelector('#mobile-search-sheet .mobile-search-results-list');
        const firstResultItem = resultsContainer?.querySelector('calcite-list-item');
        if (firstResultItem && firstResultItem._resultData) {
            this.handleMobileSearchSelection(firstResultItem._resultData);
            return;
        }
        if (searchTerm && searchTerm.length >= 2) {
            try {
                const searchResult = await subscriberDataService.searchSubscribers(searchTerm);
                if (searchResult.results && searchResult.results.length > 0) {
                    if (this.mobileSearchInput) this.mobileSearchInput.value = '';
                    this.clearMobileSearchResults();
                    const mobileDialog = document.getElementById('mobile-search-sheet');
                    if (mobileDialog) mobileDialog.open = false;
                    if (window.app?.services?.mobileTabBar) {
                        window.app.services.mobileTabBar.closeCurrentPanel();
                    }
                    this.navigateToResult(searchResult.results[0]);
                } else {
                    this.performMobileSearch(searchTerm);
                }
            } catch (error) {
                log.error('Mobile search failed:', error);
                this.performMobileSearch(searchTerm);
            }
        } else {
            this.performMobileSearch(searchTerm);
        }
    }

    createMobileResultsContainer() {
        const searchSheet = document.getElementById('mobile-search-sheet');
        if (!searchSheet) return null;
        let resultsBlock = searchSheet.querySelector('.mobile-search-results');
        if (!resultsBlock) {
            resultsBlock = document.createElement('calcite-block');
            resultsBlock.className = 'mobile-search-results';
            resultsBlock.setAttribute('heading', 'Search Results');
            resultsBlock.setAttribute('expanded', '');
            resultsBlock.hidden = true;
            const content = searchSheet.querySelector('[slot="content"]');
            if (content) content.appendChild(resultsBlock);
        }
        let resultsList = resultsBlock.querySelector('calcite-list');
        if (!resultsList) {
            resultsList = document.createElement('calcite-list');
            resultsList.className = 'mobile-search-results-list';
            resultsList.setAttribute('selection-mode', 'none');
            resultsBlock.appendChild(resultsList);
        }
        return resultsList;
    }

    showMobileNoResults(container, searchTerm) {
        const listItem = document.createElement('calcite-list-item');
        listItem.setAttribute('label', 'No results found');
        listItem.setAttribute('description', `No subscribers found for "${searchTerm}"`);
        listItem.innerHTML = `<calcite-icon slot="content-start" icon="information"></calcite-icon>`;
        container.appendChild(listItem);
    }

    clearMobileSearchResults() {
        const resultsContainer = document.querySelector('#mobile-search-sheet .mobile-search-results-list');
        if (resultsContainer) resultsContainer.innerHTML = '';
        const resultsBlock = document.querySelector('#mobile-search-sheet .mobile-search-results');
        if (resultsBlock) resultsBlock.hidden = true;
    }

    clearEverything(source = null) {
        if (window.mapView && window.mapView.popup) window.mapView.popup.close();
        this.clearLocationIndicator();
        if (source === 'mobile') {
            this.clearMobileSearchResults();
            if (this.mobileSearchInput) this.mobileSearchInput.value = '';
        } else {
            this.clearSearchResults(source);
            if (source === 'desktop' && this.desktopSearchInput) {
                this.desktopSearchInput.value = '';
                this.desktopSearchInput.inputValue = '';
                this.desktopSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (source === 'header' && this.searchInput) {
                this.searchInput.value = '';
                this.searchInput.inputValue = '';
                this.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        const timeoutKey = source === 'desktop' ? 'desktopSearchTimeout' : source === 'mobile' ? 'mobileSearchTimeout' : 'searchTimeout';
        if (this[timeoutKey]) {
            clearTimeout(this[timeoutKey]);
            this[timeoutKey] = null;
        }
        this.currentResults = [];
    }

    cleanup() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
        if (this.mobileSearchTimeout) {
            clearTimeout(this.mobileSearchTimeout);
            this.mobileSearchTimeout = null;
        }
        if (this.desktopSearchTimeout) {
            clearTimeout(this.desktopSearchTimeout);
            this.desktopSearchTimeout = null;
        }
        this.clearLocationIndicator();
        this.clearSearchResults();
        this.clearMobileSearchResults();
    }
}

export default HeaderSearch;


