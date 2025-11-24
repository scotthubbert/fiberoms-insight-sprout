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

    // Generic OSP data fetcher with persistent caching
    async fetchOSPData(url, cacheKey, memoryKey, description) {
        // Check IndexedDB cache first
        log.info(`🔍 Checking cache for ${description} (key: ${cacheKey})...`);
        const cachedData = await cacheService.getCachedData(cacheKey);
        if (cachedData) {
            log.info(`📦 Using cached ${description} data from IndexedDB`);
            cachedData.fromCache = true;
            return cachedData;
        }

        // Also check memory cache for very recent data
        if (this.isCacheValid(memoryKey)) {
            const memData = this.getCache(memoryKey);
            memData.fromCache = true;
            return memData;
        }

        try {
            log.info(`📡 Fetching ${description} data...`);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch ${description} data: ${response.status} ${response.statusText}`);
            }

            const geojson = await response.json();
            const processedFeatures = geojson.features || [];

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

    async getNodeSites() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.NODE_SITES,
            'nodeSites',
            'node_sites',
            'Node Sites'
        );
    }

    async getFSABoundaries() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.FSA_BOUNDARIES,
            'fsa',
            'fsa_boundaries',
            'FSA Boundaries'
        );
    }

    async getMainLineFiber() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.MAIN_LINE_FIBER,
            'mainFiber',
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
            'mstTerminals',
            'mst_terminals',
            'MST Terminals'
        );
    }

    async getSplitters() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.SPLITTERS,
            'splitters',
            'splitters',
            'Splitters'
        );
    }

    async getClosures() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.CLOSURES,
            'closures',
            'closures',
            'Closures'
        );
    }

    async getMSTFiber() {
        return this.fetchOSPData(
            API_CONFIG.INFRASTRUCTURE.MST_FIBER,
            'mstFiber',
            'mst_fiber',
            'MST Fiber'
        );
    }
}

export const infrastructureService = new InfrastructureService();
