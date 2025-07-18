import { supabase } from '../dataService.js';

// Production logging utility
const isDevelopment = import.meta.env.DEV;
const log = {
    info: (...args) => isDevelopment && console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

/**
 * NodeSiteMetricsService - Fetches and caches subscriber metrics for node sites
 * 
 * This service is designed to be scalable and extensible for future metrics.
 * It uses caching to avoid repeated database queries and provides a clean API
 * for fetching various metrics related to node sites.
 */
export class NodeSiteMetricsService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.inProgressRequests = new Map(); // Prevent duplicate requests
    }



    /**
     * Get comprehensive metrics for a node site
     * @param {string} nodeSiteName - The name of the node site
     * @returns {Promise<Object>} - Metrics object with online/offline counts and other data
     */
    async getNodeSiteMetrics(nodeSiteName) {
        if (!nodeSiteName) {
            throw new Error('Node site name is required');
        }

        // Use original node site name for caching
        const cacheKey = `node_metrics_${nodeSiteName}`;

        // Check cache first
        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Check if request is already in progress
        if (this.inProgressRequests.has(cacheKey)) {
            return this.inProgressRequests.get(cacheKey);
        }

        // Create new request
        const request = this.fetchNodeSiteMetrics(nodeSiteName);
        this.inProgressRequests.set(cacheKey, request);

        try {
            const metrics = await request;

            // Cache the result
            this.setCache(cacheKey, metrics);

            return metrics;
        } finally {
            // Clean up in-progress request
            this.inProgressRequests.delete(cacheKey);
        }
    }

    /**
 * Get TA5K values for a node site (handles multi-TA5K sites and special mappings)
 * @param {string} nodeSiteName - Raw node site name from UI
 * @returns {Array<string>} - Array of TA5K values to query
 */
    getTA5KValuesForNodeSite(nodeSiteName) {
        if (!nodeSiteName) return [];

        // Remove "TA5K" suffix if present (with or without space)
        let normalized = nodeSiteName.replace(/\s*TA5K\s*$/i, '');

        // Special case mappings
        const specialMappings = {
            'Bear Creek Hut': ['Bearcreek'],
            'Hamilton': ['Hamilton_1', 'Hamilton_2'],
            'Winfield': ['Winfield_1', 'Winfield_2'],
            'Winfield 1 & 2': ['Winfield_1', 'Winfield_2'],
            'Fayette': ['Fayette_Hut'],
            'Fayette East': ['Fayette_East'],
            'Fayette EastTA5K': ['Fayette_East'],  // Handle the no-space case
            'Belgreen Hut': ['Belgreen'],
            'waco': ['Waco', 'Waco_2']  // Waco_1 is just "Waco" in database
        };

        // Check for special mappings first
        if (specialMappings[normalized]) {
            return specialMappings[normalized];
        }

        // For regular cases, replace spaces with underscores
        const standardized = normalized.replace(/\s+/g, '_');
        return [standardized];
    }

    /**
     * Fetch metrics from the database
     * @param {string} nodeSiteName - The name of the node site
     * @returns {Promise<Object>} - Raw metrics data
     */
    async fetchNodeSiteMetrics(nodeSiteName) {
        try {
            // Get TA5K values for this node site (handles multi-TA5K sites)
            const ta5kValues = this.getTA5KValuesForNodeSite(nodeSiteName);

            if (ta5kValues.length === 0) {
                return this.processMetrics([], nodeSiteName, []);
            }

            // Query database for all TA5K values (single or multiple)
            const { data: subscribers, error } = await supabase
                .from('mfs')
                .select('status, account, name, service_address, last_update, ta5k')
                .in('ta5k', ta5kValues);

            if (error) {
                log.error('❌ Error fetching node site metrics:', error);
                throw error;
            }

            // Process the data to calculate metrics
            const metrics = this.processMetrics(subscribers || [], nodeSiteName, ta5kValues);

            return metrics;

        } catch (error) {
            throw error;
        }
    }

    /**
 * Process raw subscriber data into metrics
 * @param {Array} subscribers - Raw subscriber data
 * @param {string} nodeSiteName - The name of the node site
 * @param {Array<string>} ta5kValues - The TA5K values queried for this node site
 * @returns {Object} - Processed metrics
 */
    processMetrics(subscribers, nodeSiteName, ta5kValues = []) {
        const now = new Date();

        // Basic counts
        const totalSubscribers = subscribers.length;
        const onlineSubscribers = subscribers.filter(sub => sub.status === 'Online').length;
        const offlineSubscribers = subscribers.filter(sub => sub.status === 'Offline').length;
        const unknownSubscribers = subscribers.filter(sub => !sub.status || sub.status === 'Unknown').length;

        // Calculate percentages
        const onlinePercentage = totalSubscribers > 0 ? Math.round((onlineSubscribers / totalSubscribers) * 100) : 0;
        const offlinePercentage = totalSubscribers > 0 ? Math.round((offlineSubscribers / totalSubscribers) * 100) : 0;

        // Health status determination
        let healthStatus = 'excellent';
        let healthColor = '#28a745'; // Green

        if (totalSubscribers === 0) {
            healthStatus = 'no data';
            healthColor = '#6c757d'; // Gray
        } else if (offlinePercentage > 50) {
            healthStatus = 'critical';
            healthColor = '#dc3545'; // Red
        } else if (offlinePercentage > 25) {
            healthStatus = 'warning';
            healthColor = '#ffc107'; // Yellow
        } else if (offlinePercentage > 10) {
            healthStatus = 'fair';
            healthColor = '#fd7e14'; // Orange
        }

        // Recent activity (subscribers updated in last 24 hours)
        const recentActivity = subscribers.filter(sub => {
            if (!sub.last_update) return false;
            const lastUpdate = new Date(sub.last_update);
            const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
            return hoursSinceUpdate <= 24;
        }).length;

        // TA5K breakdown (show which TA5K nodes have subscribers when multiple exist)
        const ta5kBreakdown = {};
        if (ta5kValues.length > 1) {
            ta5kValues.forEach(ta5k => {
                const ta5kSubscribers = subscribers.filter(sub => sub.ta5k === ta5k);
                ta5kBreakdown[ta5k] = {
                    total: ta5kSubscribers.length,
                    online: ta5kSubscribers.filter(sub => sub.status === 'Online').length,
                    offline: ta5kSubscribers.filter(sub => sub.status === 'Offline').length
                };
            });
        }

        return {
            nodeSiteName,
            totalSubscribers,
            onlineSubscribers,
            offlineSubscribers,
            unknownSubscribers,
            onlinePercentage,
            offlinePercentage,
            healthStatus,
            healthColor,
            recentActivity,
            ta5kNodes: ta5kValues,
            ta5kBreakdown,
            lastUpdated: now.toISOString(),
            // Store raw data for potential detailed views
            rawData: subscribers
        };
    }

    /**
     * Get metrics for multiple node sites efficiently
     * @param {Array<string>} nodeSiteNames - Array of node site names
     * @returns {Promise<Object>} - Object with nodeSiteName as key and metrics as value
     */
    async getMultipleNodeSiteMetrics(nodeSiteNames) {
        if (!Array.isArray(nodeSiteNames) || nodeSiteNames.length === 0) {
            return {};
        }

        log.info(`📊 Fetching metrics for ${nodeSiteNames.length} node sites`);

        const promises = nodeSiteNames.map(name =>
            this.getNodeSiteMetrics(name).catch(error => {
                log.error(`Failed to fetch metrics for ${name}:`, error);
                return { error: error.message, nodeSiteName: name };
            })
        );

        const results = await Promise.all(promises);

        // Convert to object with nodeSiteName as key
        const metricsMap = {};
        results.forEach(result => {
            if (result.nodeSiteName) {
                metricsMap[result.nodeSiteName] = result;
            }
        });

        return metricsMap;
    }

    /**
     * Invalidate cache for a specific node site or all sites
     * @param {string} nodeSiteName - Optional specific node site name
     */
    invalidateCache(nodeSiteName = null) {
        if (nodeSiteName) {
            const cacheKey = `node_metrics_${nodeSiteName}`;
            this.cache.delete(cacheKey);
            this.cacheExpiry.delete(cacheKey);
        } else {
            // Clear all node site metrics cache
            for (const [key] of this.cache) {
                if (key.startsWith('node_metrics_')) {
                    this.cache.delete(key);
                    this.cacheExpiry.delete(key);
                }
            }
        }
    }

    /**
     * Check if cached data is still valid
     * @param {string} key - Cache key
     * @returns {boolean} - Whether cache is valid
     */
    isCacheValid(key) {
        const expiry = this.cacheExpiry.get(key);
        return expiry && Date.now() < expiry;
    }

    /**
     * Set cache with expiry
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     */
    setCache(key, data) {
        this.cache.set(key, data);
        this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
    }

    /**
     * Get cache statistics for monitoring
     * @returns {Object} - Cache statistics
     */
    getCacheStats() {
        const totalEntries = this.cache.size;
        const validEntries = Array.from(this.cacheExpiry.entries())
            .filter(([_, expiry]) => Date.now() < expiry).length;

        return {
            totalEntries,
            validEntries,
            hitRate: totalEntries > 0 ? Math.round((validEntries / totalEntries) * 100) : 0
        };
    }
}

// Export singleton instance
export const nodeSiteMetricsService = new NodeSiteMetricsService(); 