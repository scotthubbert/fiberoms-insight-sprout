// EnhancedSearchService.js - Client-side fuzzy search with Fuse.js
// Based on React Mapbox implementation, adapted for ArcGIS/Calcite UI

import Fuse from 'fuse.js';
import { subscriberDataService, supabase } from '../dataService.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('EnhancedSearchService');

export class EnhancedSearchService {
    constructor() {
        this.allSubscribers = [];
        this.fuse = null;
        this.accountFuse = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        this.lastFetchTime = null;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Initialize the search service by fetching all subscribers
     */
    async initialize() {
        if (this.isInitialized && this.isCacheValid()) {
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._doInitialize();
        return this.initializationPromise;
    }

    async _doInitialize() {
        try {
            log.info('Initializing Enhanced Search Service...');
            
            // Fetch all subscribers
            const subscribers = await subscriberDataService.getAllSubscribers();
            
            // Process and normalize the data
            this.allSubscribers = this._processSubscribers(subscribers);
            
            // Create Fuse instances
            this._createFuseInstances();
            
            this.lastFetchTime = Date.now();
            this.isInitialized = true;
            this.initializationPromise = null;
            
            log.info(`✅ Enhanced Search Service initialized with ${this.allSubscribers.length} subscribers`);
        } catch (error) {
            log.error('Failed to initialize Enhanced Search Service:', error);
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Process and normalize subscriber data for better search matching
     */
    _processSubscribers(subscribers) {
        return subscribers.map(subscriber => {
            const address = subscriber.address || '';
            const city = subscriber.city || '';
            const state = subscriber.state || '';
            const postcode = subscriber.postcode || '';
            
            // Create full address string
            const fullAddress = [address, city, state, postcode]
                .filter(Boolean)
                .join(', ')
                .replace(/,\s*,/g, ',')
                .replace(/,\s*$/, '')
                .replace(/^\s*,\s*/, '');

            // Normalize address for better fuzzy matching
            const normalizedAddress = this._normalizeAddress(
                `${address} ${city} ${state} ${postcode}`
            );

            return {
                ...subscriber,
                // Map to expected format
                name: subscriber.name || subscriber.customer_name || '',
                account: String(subscriber.account || ''),
                status: subscriber.Status || subscriber.status || '',
                service_address: fullAddress,
                normalized_address: normalizedAddress,
                latitude: subscriber.lat || subscriber.latitude,
                longitude: subscriber.lon || subscriber.longitude,
                // Preserve original data
                originalData: subscriber
            };
        });
    }

    /**
     * Normalize address for better fuzzy matching
     * Standardizes common address suffixes and removes punctuation
     */
    _normalizeAddress(address) {
        if (!address) return '';
        
        const standardized = address
            .toLowerCase()
            // Standardize common address prefixes/suffixes
            .replace(/\b(county\s*)(highway|hwy)\b/gi, 'county hwy')
            .replace(/\b(highway|hwy)\b/gi, 'hwy')
            .replace(/\b(street|st)\b/gi, 'st')
            .replace(/\b(road|rd)\b/gi, 'rd')
            .replace(/\b(avenue|ave)\b/gi, 'ave')
            .replace(/\b(drive|dr)\b/gi, 'dr')
            .replace(/\b(lane|ln)\b/gi, 'ln')
            .replace(/\b(circle|cir)\b/gi, 'cir')
            .replace(/\b(court|ct)\b/gi, 'ct')
            .replace(/\b(boulevard|blvd)\b/gi, 'blvd')
            .replace(/\b(parkway|pkwy)\b/gi, 'pkwy')
            .replace(/\b(arrow\s*head|arrow\s*heads)\b/gi, 'arrowhead')
            .replace(/\b(village|villages)\b/gi, 'village')
            // Remove punctuation but preserve spaces
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Also create a version without suffixes for more flexible matching
        const withoutSuffixes = standardized
            .replace(/\b(st|rd|ave|dr|ln|cir|ct|blvd|way|pkwy)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Return both versions concatenated with a space to allow matching against either
        return standardized + ' ' + withoutSuffixes;
    }

    /**
     * Create Fuse.js instances for fuzzy search
     */
    _createFuseInstances() {
        // Main Fuse instance with weighted keys
        this.fuse = new Fuse(this.allSubscribers, {
            keys: [
                { name: 'name', weight: 2.0 }, // Higher weight for name matches
                { name: 'account', weight: 0.8 },
                { name: 'service_address', weight: 0.7 },
                { name: 'normalized_address', weight: 0.9 },
                { name: 'city', weight: 0.6 },
                { name: 'postcode', weight: 0.5 },
                { name: 'TA5K', weight: 0.7 },
                { name: 'Remote_ID', weight: 0.7 }
            ],
            threshold: 0.4, // More lenient threshold for better fuzzy matching
            distance: 100, // Increased distance to allow more character transpositions
            includeScore: true,
            minMatchCharLength: 2,
            ignoreLocation: false, // Consider location to prioritize matches at beginning
            useExtendedSearch: true,
            shouldSort: true,
            findAllMatches: true,
            location: 0
        });

        // Separate Fuse instance for exact account number matching
        this.accountFuse = new Fuse(this.allSubscribers, {
            keys: ['account'],
            threshold: 0.0, // Exact matching for account numbers
            distance: 0, // No character transpositions
            includeScore: true,
            minMatchCharLength: 2,
            ignoreLocation: false,
            useExtendedSearch: true,
            shouldSort: true,
            findAllMatches: false,
            location: 0
        });
    }

    /**
     * Check if cache is still valid
     */
    isCacheValid() {
        if (!this.lastFetchTime) return false;
        return (Date.now() - this.lastFetchTime) < this.CACHE_DURATION;
    }

    /**
     * Search poles directly in the database
     */
    async searchPoles(term) {
        try {
            // Only select fields needed for search results and navigation (reduces data transfer)
            // Note: sfi_poles table doesn't have an 'id' column, only wmElementN, latitude, longitude
            let query = supabase.from('sfi_poles').select('wmElementN, latitude, longitude');

            // If searching with a specific pole ID pattern
            if (/^[pP]?\d+$/.test(term)) {
                const numericPart = term.replace(/^[pP]/, '');
                // Search in wmElementN for pole IDs
                query = query.ilike('wmElementN', `%${numericPart}%`);
            } else {
                // For general text search, still use wmElementN
                query = query.ilike('wmElementN', `%${term}%`);
            }

            // Limit results
            query = query.limit(20);

            const { data, error } = await query;

            if (error) {
                log.error('Error searching poles:', error);
                return [];
            }

            // Map the results to the expected format
            return (data || []).map(item => ({
                name: item.wmElementN || 'Unknown Pole',
                wmElementN: item.wmElementN,
                type: 'pole',
                latitude: item.latitude || 0,
                longitude: item.longitude || 0,
                // Store minimal original data (only what we fetched)
                originalData: { 
                    wmElementN: item.wmElementN,
                    latitude: item.latitude,
                    longitude: item.longitude
                }
            }));
        } catch (error) {
            log.error('Error in pole search:', error);
            return [];
        }
    }

    /**
     * Search MSTs directly in the database
     */
    async searchMSTs(term) {
        try {
            let query = supabase.from('sfi_mst').select('*');

            // If it's a direct EQUIP_FRAB pattern, do an exact match
            if (/^\d{2}-[A-Z]{2}\d{3}-\d{3}-[A-Z]{3}-\d{2}$/i.test(term) || 
                /^\d{2}-[A-Z]{2}\d{3}-\d{2}-[A-Z]{3}-\d{2}$/i.test(term)) {
                query = query.ilike('equipmentname', term);
            } else {
                // Otherwise do a partial match
                query = query.ilike('equipmentname', `%${term}%`);
            }

            // Limit results
            query = query.limit(20);

            const { data, error } = await query;

            if (error) {
                log.error('Error searching MSTs:', error);
                return [];
            }

            // Map the results to the expected format
            return (data || []).map(item => ({
                name: item.equipmentname || 'Unknown MST',
                equipmentname: item.equipmentname,
                type: 'mst',
                latitude: item.latitude || 0,
                longitude: item.longitude || 0,
                // Store all original data for use in marker creation
                originalData: {
                    distributi: item.distribution_area || item.distributi || '',
                    equip_frab: item.equipmentname || '',
                    modelnumber: item.modelnumber || item.modelnumbe || 'MST 12 Port 1500',
                    outputportcount: item.outputportcount || item.outputport || 12,
                    partnumber: item.partnumber || '',
                    ...item
                }
            }));
        } catch (error) {
            log.error('Error in MST search:', error);
            return [];
        }
    }

    /**
     * Perform fuzzy search with pattern detection for MSTs, Poles, and Subscribers
     */
    async search(searchTerm) {
        // Ensure service is initialized
        if (!this.isInitialized || !this.isCacheValid()) {
            await this.initialize();
        }

        if (!searchTerm || searchTerm.trim().length < 2) {
            return { results: [], count: 0, searchTerm };
        }

        const term = searchTerm.trim();

        // Check if this is a pole search
        const poleMatch = term.match(/^pole(?:\s*|\s+)([pP]?\d*\S*)?/i);
        if (poleMatch) {
            const poleSearchTerm = poleMatch[1] ? poleMatch[1].trim() : '';
            const poleResults = await this.searchPoles(poleSearchTerm);
            return {
                results: poleResults,
                count: poleResults.length,
                searchTerm: term,
                searchType: 'pole'
            };
        }

        // Check if this is an MST search (either with MST prefix or direct MST name pattern)
        const mstMatch = term.match(/^mst(?:\s*|\s+)(\S*)?/i);
        const directMstMatch = term.match(/^\d{2}-[A-Z]{2}\d{3}-\d{3}-[A-Z]{3}-\d{2}$/i) || 
                              term.match(/^\d{2}-[A-Z]{2}\d{3}-\d{2}-[A-Z]{3}-\d{2}$/i);

        if (mstMatch || directMstMatch) {
            const mstSearchTerm = mstMatch ? mstMatch[1]?.trim() : term;
            const mstResults = await this.searchMSTs(mstSearchTerm || '');
            return {
                results: mstResults,
                count: mstResults.length,
                searchTerm: term,
                searchType: 'mst'
            };
        }

        // Try exact account number match first for any numeric input
        if (/^\d+$/.test(term)) {
            const accountResults = this.accountFuse
                .search(term)
                .filter(result => result.score && result.score < 0.3)
                .map(result => result.item);
            
            if (accountResults.length > 0) {
                return {
                    results: accountResults,
                    count: accountResults.length,
                    searchTerm: term,
                    searchType: 'account'
                };
            }
        }

        // If no account found, then check for pole IDs (4+ digits, optionally prefixed with P)
        if (/^[pP]?\d{4,}$/.test(term)) {
            const poleResults = await this.searchPoles(term);
            if (poleResults.length > 0) {
                return {
                    results: poleResults,
                    count: poleResults.length,
                    searchTerm: term,
                    searchType: 'pole'
                };
            }
        }

        // Check for direct MST pattern (like 02-HP072-125-SAA-01)
        if (/^\d{2}-[A-Z]{2}\d{3}-\d{3}-[A-Z]{3}-\d{2}$/i.test(term) || 
            /^\d{2}-[A-Z]{2}\d{3}-\d{2}-[A-Z]{3}-\d{2}$/i.test(term)) {
            const mstResults = await this.searchMSTs(term);
            if (mstResults.length > 0) {
                return {
                    results: mstResults,
                    count: mstResults.length,
                    searchTerm: term,
                    searchType: 'mst'
                };
            }
        }

        // General fuzzy subscriber search
        const searchResults = this.fuse
            .search(term)
            .filter(result => result.score && result.score < 0.8)
            .map(result => result.item);

        return {
            results: searchResults,
            count: searchResults.length,
            searchTerm: term,
            searchType: 'fuzzy'
        };
    }

    /**
     * Refresh the subscriber cache
     */
    async refresh() {
        this.isInitialized = false;
        this.lastFetchTime = null;
        await this.initialize();
    }

    /**
     * Get all subscribers (for debugging)
     */
    getAllSubscribers() {
        return this.allSubscribers;
    }
}

// Export singleton instance
export const enhancedSearchService = new EnhancedSearchService();

