import { cacheService } from './CacheService.js';
import { createLogger } from '../utils/logger.js';
import { API_CONFIG } from '../config/apiConfig.js';

const log = createLogger('InfrastructureService');

export class InfrastructureService {
    constructor(subscriberDataService) {
        // We need subscriberDataService for its cache management methods (isCacheValid, setCache, getCache)
        // Ideally these should be in a shared CacheManager, but for now we'll accept the dependency
        // or duplicate the logic. Duplicating the simple memory cache logic is cleaner to avoid circular deps.
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes memory cache
        this.APP_VERSION = this.getAppVersion();
    }

    getAppVersion() {
        return Date.now().toString().slice(-8);
    }

    isCacheValid(key) {
        const versionedKey = `${key}_${this.APP_VERSION}`;
        const expiry = this.cacheExpiry.get(versionedKey);
        return expiry && Date.now() < expiry;
    }

    setCache(key, data) {
        const versionedKey = `${key}_${this.APP_VERSION}`;
        this.cache.set(versionedKey, data);
        this.cacheExpiry.set(versionedKey, Date.now() + this.CACHE_DURATION);
    }

    getCache(key) {
        const versionedKey = `${key}_${this.APP_VERSION}`;
        return this.cache.get(versionedKey);
    }

    clearCache() {
        this.cache.clear();
        this.cacheExpiry.clear();
        log.info('InfrastructureService memory cache cleared');
    }

    // Generic OSP data fetcher with persistent caching
    async fetchOSPData(url, cacheKey, memoryKey, description) {
        // Check IndexedDB cache first
        log.info(`🔍 Checking cache for ${description} (key: ${cacheKey})...`);
        const cachedData = await cacheService.getCachedData(cacheKey);
        if (cachedData) {
            console.log(`[OSP Debug] 📦 Using CACHED ${description} data from IndexedDB`);
            console.log(`[OSP Debug] 📦 Cache key: ${cacheKey}`);
            console.log(`[OSP Debug] 📦 Cached features count: ${cachedData.features?.length || 0}`);
            if (cachedData.features && cachedData.features.length > 0) {
                const sampleCached = cachedData.features[0];
                console.log(`[OSP Debug] 📦 Sample cached feature props:`, Object.keys(sampleCached.properties || {}));
            }
            log.info(`📦 Using cached ${description} data from IndexedDB`);
            cachedData.fromCache = true;
            return cachedData;
        }

        // Also check memory cache for very recent data
        if (this.isCacheValid(memoryKey)) {
            const memData = this.getCache(memoryKey);
            console.log(`[OSP Debug] 📦 Using MEMORY cached ${description} data`);
            console.log(`[OSP Debug] 📦 Memory cache key: ${memoryKey}`);
            console.log(`[OSP Debug] 📦 Memory cached features count: ${memData.features?.length || 0}`);
            memData.fromCache = true;
            return memData;
        }

        try {
            if (!url) {
                throw new Error(`Configuration URL for ${description} is missing or invalid.`);
            }

            // Debug logging for OSP data sources
            console.log(`[OSP Debug] 📡 Fetching ${description} data...`);
            console.log(`[OSP Debug] 🔗 URL: ${url}`);

            log.info(`📡 Fetching ${description} data...`);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch ${description} data: ${response.status} ${response.statusText}`);
            }

            const geojson = await response.json();
            const processedFeatures = geojson.features || [];
            
            // Debug: Log sample of fetched data to verify it's Sprout Fiber data
            if (processedFeatures.length > 0) {
                const sampleFeature = processedFeatures[0];
                console.log(`[OSP Debug] ✅ Fetched ${processedFeatures.length} features for ${description}`);
                console.log(`[OSP Debug] 📊 Sample feature properties:`, Object.keys(sampleFeature.properties || {}));
                console.log(`[OSP Debug] 📊 Sample feature (first 3 props):`, 
                    Object.entries(sampleFeature.properties || {}).slice(0, 3).reduce((acc, [k, v]) => {
                        acc[k] = v;
                        return acc;
                    }, {})
                );
                
                // Check for Freedom Fiber indicators
                const props = sampleFeature.properties || {};
                const hasFreedomFiberIndicators = 
                    props.NAME || props.ServiceArea || props.FSA_NAME || 
                    (props.areaname && props.areaname.includes('FSA')) ||
                    (props.distribution_area && !props.distribution_area.match(/^[A-Z]{2}-\d{2}-\d{4}$/));
                
                if (hasFreedomFiberIndicators) {
                    console.warn(`[OSP Debug] ⚠️ WARNING: Data may contain Freedom Fiber indicators!`, {
                        hasNAME: !!props.NAME,
                        hasServiceArea: !!props.ServiceArea,
                        hasFSA_NAME: !!props.FSA_NAME,
                        areaname: props.areaname,
                        distribution_area: props.distribution_area
                    });
                }
            } else {
                console.warn(`[OSP Debug] ⚠️ No features found in ${description} data`);
            }

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            };

            // Store in both caches
            this.setCache(memoryKey, result); // Memory cache for immediate reuse
            await cacheService.setCachedData(cacheKey, result); // IndexedDB for persistence

            log.info(`✅ Fetched ${processedFeatures.length} ${description}`);
            return result;

        } catch (error) {
            log.error(`Failed to fetch ${description}:`, error);
            // Return cached data if available, even if expired
            const fallbackData = cachedData || this.getCache(memoryKey);
            if (fallbackData) {
                log.warn(`⚠️ Using stale cached ${description} data due to fetch error`);
                return {
                    ...fallbackData,
                    error: true,
                    errorMessage: error.message,
                    fromCache: true
                };
            }
            return {
                count: 0,
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message
            };
        }
    }

    async getSproutHuts() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.SPROUT_HUTS,
            'sproutHuts_v2', // Versioned cache key
            'sprout_huts',
            'Sprout Huts'
        );
    }

    async getFSABoundaries() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.FSA_BOUNDARIES,
            'fsa_sprout_v3', // Updated cache key to force refresh with new renderer
            'fsa_boundaries',
            'FSA Boundaries'
        );
    }

    async getMainLineFiber() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.MAIN_LINE_FIBER,
            'mainFiber_sprout_v2', // Changed cache key to force refresh from Sprout Fiber data
            'main_line_fiber',
            'Main Line Fiber'
        );
    }

    async getMainLineOld() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.MAIN_LINE_OLD,
            'mainOld',
            'main_line_old',
            'Main Line Old'
        );
    }

    async getMSTTerminals() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.MST_TERMINALS,
            'mstTerminals_sprout_v2', // Changed cache key to force refresh from Sprout Fiber data
            'mst_terminals',
            'MST Terminals'
        );
    }

    async getSplitters() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.SPLITTERS,
            'splitters_sprout_v2', // Changed cache key to force refresh from Sprout Fiber data
            'splitters',
            'Splitters'
        );
    }

    async getClosures() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.CLOSURES,
            'closures_slackloops_v1', // New cache key for Slack Loops data
            'closures',
            'Closures'
        );
    }

    async getMSTFiber() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.MST_FIBER,
            'mstFiber_sprout_v2', // Changed cache key to force refresh from Sprout Fiber data
            'mst_fiber',
            'MST Fiber'
        );
    }

    async getSlackLoops() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.SLACK_LOOPS,
            'slackLoops_sprout_v2', // Changed cache key to force refresh from Sprout Fiber data
            'slack_loops',
            'Slack Loops'
        );
    }
}

export const infrastructureService = new InfrastructureService();
