import { createClient } from '@supabase/supabase-js'
import { cacheService } from './services/CacheService.js'
import { createLogger } from './utils/logger.js'
import { geoJSONTransformService } from './services/GeoJSONTransformService.js'
import { infrastructureService } from './services/InfrastructureService.js'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Initialize logger for this module
const log = createLogger('DataService');
const isDevelopment = import.meta.env.DEV;

// Only log configuration status in development
if (isDevelopment) {
    log.info('🔧 Supabase Config Check:')
    log.info('URL:', supabaseUrl ? 'Set ✅' : 'Missing ❌')
    log.info('Key:', supabaseKey ? 'Set ✅' : 'Missing ❌')
}

if (!supabaseUrl || !supabaseKey) {
    log.error('❌ Missing Supabase environment variables! Check your .env file.')
    if (isDevelopment) {
        log.info('Required variables:')
        log.info('VITE_SUPABASE_URL=https://your-project.supabase.co')
        log.info('VITE_SUPABASE_ANON_KEY=your-anon-key')
    }
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Mock data for testing when Supabase is not configured
const MOCK_SUBSCRIBERS = [
    {
        id: 1,
        customer_name: "John Smith",
        customer_number: "ACC001",
        address: "123 Main Street",
        city: "Birmingham",
        state: "AL",
        zip: "35203",
        phone_number: "(205) 555-0101",
        status: "Offline",
        latitude: 33.5186,
        longitude: -86.8104
    },
    {
        id: 2,
        customer_name: "Sarah Johnson",
        customer_number: "ACC002",
        address: "456 Oak Avenue",
        city: "Montgomery",
        state: "AL",
        zip: "36104",
        phone_number: "(334) 555-0202",
        status: "Online",
        latitude: 32.3668,
        longitude: -86.3000
    },
    {
        id: 3,
        customer_name: "Michael Brown",
        customer_number: "ACC003",
        address: "789 Pine Road",
        city: "Huntsville",
        state: "AL",
        zip: "35801",
        phone_number: "(256) 555-0303",
        status: "Offline",
        latitude: 34.7304,
        longitude: -86.5861
    },
    {
        id: 4,
        customer_name: "Lisa Davis",
        customer_number: "ACC004",
        address: "321 Elm Street",
        city: "Mobile",
        state: "AL",
        zip: "36602",
        phone_number: "(251) 555-0404",
        status: "Online",
        latitude: 30.6954,
        longitude: -88.0399
    },
    {
        id: 5,
        customer_name: "David Wilson",
        customer_number: "ACC005",
        address: "654 Maple Drive",
        city: "Tuscaloosa",
        state: "AL",
        zip: "35401",
        phone_number: "(205) 555-0505",
        status: "Offline",
        latitude: 33.2098,
        longitude: -87.5692
    }
];

// Check if running in mock mode
const isMockMode = !supabaseUrl || !supabaseKey;

if (isMockMode) {
    log.warn('RUNNING IN MOCK MODE - No Supabase credentials found');
    log.info('Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect to real database');
    log.info('Mock subscribers available:', MOCK_SUBSCRIBERS.length);
} else {
    log.info('RUNNING IN SUPABASE MODE - Database connected');
}

// Data service class for subscriber operations
export class SubscriberDataService {
    constructor() {
        this.cache = new Map()
        this.cacheExpiry = new Map()
        this.CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
        this.APP_VERSION = this.getAppVersion()
    }

    // Get app version for cache versioning
    getAppVersion() {
        // Use build timestamp or version from package.json
        return Date.now().toString().slice(-8); // Last 8 digits of timestamp
    }

    // Helper to map DB record to application schema
    _mapDatabaseRecord(record) {
        if (!record) return null;
        return {
            ...record,
            // Map to standard fields expected by app
            id: record.account || record.id, // Use account as ID if ID is missing
            latitude: record.lat,
            longitude: record.lon,
            customer_name: record.name,
            customer_number: String(record.account || ''),
            address: record.address,
            service_address: record.address, // Alias for GeoJSONTransformService
            zip_code: record.postcode,
            status: record.Status,
            service_type: record.servicedesc || record.customertype,
            last_update: record.last_updated || record.updated_at,
            fiber_distance: record['Fiber Dist.'],
            ta5k: record.TA5K,
            remote_id: record.Remote_ID,
            ont: record.ONT,
            light: record.Light
        };
    }

    // Check if cached data is still valid
    isCacheValid(key) {
        const versionedKey = `${key}_${this.APP_VERSION}`;
        const expiry = this.cacheExpiry.get(versionedKey);
        return expiry && Date.now() < expiry;
    }

    // Set cache with expiry and version
    setCache(key, data) {
        const versionedKey = `${key}_${this.APP_VERSION}`;
        this.cache.set(versionedKey, data);
        this.cacheExpiry.set(versionedKey, Date.now() + this.CACHE_DURATION);

        // Clean up old versions
        this.cleanupOldVersions(key);
    }

    // Get cached data with version check
    getCache(key) {
        const versionedKey = `${key}_${this.APP_VERSION}`;
        return this.cache.get(versionedKey);
    }

    // Check if data exists in cache (used by loading indicator)
    // Note: Realtime data types (subscribers, outages, vehicles) are never cached
    isDataCached(dataType) {
        // Realtime data types that are never cached
        const realtimeTypes = [
            'offlineSubscribers', 'onlineSubscribers',
            'fiberTrucks', 'electricTrucks'
        ];

        if (realtimeTypes.includes(dataType)) {
            return false; // Never cached
        }

        // Map data types to cache keys for infrastructure data that can be cached
        const cacheKeyMap = {
            'fsaBoundaries': 'fsa',
            'mainLineFiber': 'mainFiber',
            'mainLineOld': 'mainOld',
            'mstTerminals': 'mstTerminals',
            'mstFiber': 'mstFiber',
            'splitters': 'splitters',
            'closures': 'closures'
        };

        const cacheKey = cacheKeyMap[dataType];
        return cacheKey ? this.isCacheValid(cacheKey) : false;
    }

    // Clean up old version caches
    cleanupOldVersions(baseKey) {
        const keysToDelete = [];
        for (const [key] of this.cache) {
            if (key.startsWith(baseKey) && !key.endsWith(this.APP_VERSION)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => {
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
        });
    }

    // Get offline subscribers for map display (includes geometry) - REALTIME (no caching)
    async getOfflineSubscribers() {
        try {
            log.info('📡 Fetching offline subscribers from Supabase... (realtime - no cache)')

            // Select all fields for feature layer creation
            const { data, error, count } = await supabase
                .from('fiber_subscriber_status_live')
                .select('*', { count: 'exact' })
                .eq('Status', 'Offline')
                .not('lat', 'is', null)
                .not('lon', 'is', null)

            if (isDevelopment) {
                log.info('📊 Supabase response:')
                log.info('- Count:', count)
                log.info('- Data length:', data?.length || 0)
                log.info('- Error:', error)
            }

            if (error) {
                log.error('❌ Error fetching offline subscribers:', error)
                throw error
            }

            if (!data || data.length === 0) {
                log.warn('⚠️ No offline subscribers found. Returning last known features to avoid flicker if available')
                const last = this.getCache('offline_subscribers_last');
                if (last && last.features && last.features.length) {
                    return {
                        count: last.features.length,
                        data: last.data || [],
                        features: last.features,
                        lastUpdated: new Date().toISOString(),
                        fromCache: true
                    }
                }
                // Dev guidance
                log.warn('⚠️ Check that records exist with Status="Offline" and coordinates present');
                if (isDevelopment) {
                    log.info('- Ensure Status="Offline"')
                    log.info('- Ensure lat and lon are not null')
                }
                return {
                    count: 0,
                    data: [],
                    features: [],
                    lastUpdated: new Date().toISOString(),
                    fromCache: false
                }
            }

            // Log first record for debugging in development only
            log.info('📋 Sample record:', data[0])

            // Map data to application schema
            const mappedData = data.map(r => this._mapDatabaseRecord(r));

            // Convert to GeoJSON features for ArcGIS
            const features = geoJSONTransformService.convertToGeoJSONFeatures(mappedData, 'offline')

            log.info('🗺️ Generated features:', features.length)
            if (isDevelopment && features.length > 0) {
                log.info('📍 Sample feature:', features[0])
                log.info('📍 Sample coordinates:', features[0].geometry.coordinates)
                log.info('📍 First 3 coordinates:', features.slice(0, 3).map(f => f.geometry.coordinates))
            }

            const result = {
                count: count || 0,
                data: mappedData,
                features: features,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            }

            // Persist last non-empty result in memory cache to guard against transient empty responses
            this.setCache('offline_subscribers_last', result);
            // No caching for realtime data beyond last snapshot
            return result
        } catch (error) {
            log.error('Failed to fetch offline subscribers:', error)
            throw error
        }
    }

    // Get online subscribers for map display (includes geometry) - REALTIME (no caching)
    async getOnlineSubscribers() {
        try {
            log.info('📡 Fetching online subscribers from Supabase... (realtime - no cache)')

            // Select all fields for feature layer creation
            const { data, error, count } = await supabase
                .from('fiber_subscriber_status_live')
                .select('*', { count: 'exact' })
                .eq('Status', 'Online')
                .not('lat', 'is', null)
                .not('lon', 'is', null)

            if (isDevelopment) {
                log.info('📊 Online subscribers response:')
                log.info('- Count:', count)
                log.info('- Data length:', data?.length || 0)
                log.info('- Error:', error)
            }

            if (error) {
                log.error('❌ Error fetching online subscribers:', error)
                throw error
            }

            if (!data || data.length === 0) {
                log.warn('⚠️ No online subscribers found. Check your data:')
                if (isDevelopment) {
                    log.info('- Make sure you have records with Status="Online"')
                    log.info('- Make sure lat and lon are not null')
                }
                return {
                    count: 0,
                    data: [],
                    features: [],
                    lastUpdated: new Date().toISOString(),
                    fromCache: false
                }
            }

            // Map data to application schema
            const mappedData = data.map(r => this._mapDatabaseRecord(r));

            // Convert to GeoJSON features for ArcGIS
            const features = geoJSONTransformService.convertToGeoJSONFeatures(mappedData, 'online')

            log.info('🗺️ Generated online features:', features.length)

            const result = {
                count: count || 0,
                data: mappedData,
                features: features,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            }

            // No caching for realtime data
            return result
        } catch (error) {
            log.error('Failed to fetch online subscribers:', error)
            throw error
        }
    }

    // Get all subscribers (online and offline) for CSV export - REALTIME (no caching)
    async getAllSubscribers() {
        try {
            log.info('📡 Fetching all subscribers from Supabase... (realtime - no cache)')

            // Select all fields for CSV export
            const { data, error, count } = await supabase
                .from('fiber_subscriber_status_live')
                .select('*', { count: 'exact' })

            if (isDevelopment) {
                log.info('📊 All subscribers response:')
                log.info('- Count:', count)
                log.info('- Data length:', data?.length || 0)
                log.info('- Error:', error)
            }

            if (error) {
                log.error('❌ Error fetching all subscribers:', error)
                throw error
            }

            if (!data || data.length === 0) {
                log.warn('⚠️ No subscribers found in database')
                return []
            }

            // Sort by TA5K column for better organization
            const sortedData = data.sort((a, b) => {
                const ta5kA = (a.TA5K || '').toString().toLowerCase()
                const ta5kB = (b.TA5K || '').toString().toLowerCase()

                // Handle empty/null values - put them at the end
                if (!ta5kA && !ta5kB) return 0
                if (!ta5kA) return 1
                if (!ta5kB) return -1

                return ta5kA.localeCompare(ta5kB)
            })

            log.info(`📊 Retrieved ${sortedData.length} subscribers for CSV export`)

            // No caching for realtime data
            return sortedData.map(r => this._mapDatabaseRecord(r))
        } catch (error) {
            log.error('Failed to fetch all subscribers:', error)
            throw error
        }
    }

    // Get all subscribers with status breakdown - REALTIME (no caching)
    async getSubscribersSummary() {
        try {
            log.info('📡 Fetching subscribers summary from Supabase... (realtime - no cache)')

            // Use server-side counts with case-insensitive, trimmed matching to avoid string variation issues
            const [
                { count: totalCount, error: totalError },
                { count: offlineCount, error: offlineError },
                { count: onlineCount, error: onlineError },
                { count: unknownCount, error: unknownError }
            ] = await Promise.all([
                supabase.from('fiber_subscriber_status_live').select('account', { count: 'exact', head: true }),
                // Match Status variants like 'Offline', 'offline', 'Offline ' etc.
                supabase.from('fiber_subscriber_status_live').select('account', { count: 'exact', head: true }).ilike('Status', 'offline%'),
                supabase.from('fiber_subscriber_status_live').select('account', { count: 'exact', head: true }).ilike('Status', 'online%'),
                // Unknown includes null/empty/explicit 'Unknown'
                supabase.from('fiber_subscriber_status_live').select('account', { count: 'exact', head: true }).or('Status.is.null,Status.eq.,Status.ilike.unknown%')
            ])

            if (totalError || offlineError || onlineError || unknownError) {
                const err = totalError || offlineError || onlineError || unknownError
                log.error('Error fetching subscribers summary counts:', err)
                throw err
            }

            const statusBreakdown = {
                Online: onlineCount || 0,
                Offline: offlineCount || 0,
                Unknown: unknownCount || 0
            }

            return {
                total: totalCount || 0,
                online: onlineCount || 0,
                offline: offlineCount || 0,
                unknown: unknownCount || 0,
                statusBreakdown,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            }
        } catch (error) {
            log.error('Failed to fetch subscribers summary:', error)
            throw error
        }
    }

    // Clear cache for fresh data
    clearCache() {
        this.cache.clear()
        this.cacheExpiry.clear()
        log.info('Application cache cleared')
    }

    // Search subscribers by various criteria
    async searchSubscribers(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            return { results: [], count: 0 }
        }

        const cacheKey = `search_${searchTerm.toLowerCase()}_all`

        // Return cached results if valid
        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        // Use mock data if Supabase not configured
        if (isMockMode) {
            return this.searchMockData(searchTerm);
        }

        try {
            log.info('Searching subscribers for:', searchTerm)

            // Search across multiple fields using OR conditions
            // Use only columns that actually exist in the database schema
            // Updated for Sprout Fiber schema: name, account, address, city
            const { data, error, count } = await supabase
                .from('fiber_subscriber_status_live')
                .select('*', { count: 'exact' })
                .or(`name.ilike.%${searchTerm}%,account.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
                .not('lat', 'is', null)
                .not('lon', 'is', null)
                .neq('lat', 0)
                .neq('lon', 0)

            if (error) {
                log.error('❌ Error searching subscribers:', error)
                throw error
            }

            const results = (data || []).map(record => {
                const mapped = this._mapDatabaseRecord(record);
                return {
                    ...mapped,
                    // Ensure standard fields for search results display
                    id: mapped.id,
                    customer_name: mapped.customer_name || 'Unknown',
                    customer_number: mapped.customer_number || '',
                    address: mapped.address || '',
                    city: mapped.city || '',
                    state: mapped.state || '',
                    zip: mapped.zip_code || '',
                    status: mapped.status || 'Unknown',
                    latitude: mapped.latitude,
                    longitude: mapped.longitude,
                    // Include full record for detailed view
                    fullRecord: record
                };
            });

            const searchResult = {
                results,
                count: count || 0,
                searchTerm,
                lastUpdated: new Date().toISOString()
            }

            // Cache the result (shorter cache time for search results)
            this.setCache(cacheKey, searchResult)

            log.info('🔍 Search completed:', results.length, 'results found')
            return searchResult

        } catch (error) {
            log.error('Failed to search subscribers:', error)
            throw error
        }
    }

    // Mock search function for testing
    searchMockData(searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const filtered = MOCK_SUBSCRIBERS.filter(subscriber => {
            return (
                subscriber.customer_name.toLowerCase().includes(searchLower) ||
                subscriber.address.toLowerCase().includes(searchLower) ||
                subscriber.customer_number.toLowerCase().includes(searchLower) ||
                subscriber.phone_number.includes(searchTerm) ||
                subscriber.city.toLowerCase().includes(searchLower)
            );
        });

        const results = filtered.map(record => ({
            id: record.id,
            customer_name: record.customer_name,
            customer_number: record.customer_number,
            address: record.address,
            city: record.city,
            state: record.state,
            zip: record.zip,
            phone_number: record.phone_number,
            status: record.status,
            latitude: record.latitude,
            longitude: record.longitude,
            fullRecord: record
        }));

        const searchResult = {
            results,
            count: filtered.length,
            searchTerm,
            lastUpdated: new Date().toISOString(),
            mockData: true
        };

        log.info('🔍 Mock search found', results.length, 'results for:', searchTerm);

        // Cache the mock result
        const cacheKey = `search_${searchTerm.toLowerCase()}_all`;
        this.setCache(cacheKey, searchResult);

        return searchResult;
    }

    // Get subscriber by ID for detailed view
    async getSubscriberById(id) {
        const cacheKey = `subscriber_${id}`

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            const { data, error } = await supabase
                .from('fiber_subscriber_status_live')
                .select('*')
                .eq('account', id) // Assume ID is account number in new schema
                .single()

            if (error) {
                log.error('❌ Error fetching subscriber by ID:', error)
                throw error
            }

            const mappedData = this._mapDatabaseRecord(data);

            // Cache the result
            this.setCache(cacheKey, mappedData)
            return mappedData

        } catch (error) {
            log.error('Failed to fetch subscriber by ID:', error)
            throw error
        }
    }

    // Test database connection and data
    async testConnection() {
        try {
            log.info('🧪 Testing Supabase connection...')

            // Test basic connection with a simple query
            const { data: tableData, error: tableError } = await supabase
                .from('fiber_subscriber_status_live')
                .select('account')
                .limit(1)

            if (tableError) {
                log.error('❌ Database connection failed:', tableError)
                return false
            }

            log.info('✅ Database connection successful')

            // Test data availability
            const { data: sampleData, error: sampleError } = await supabase
                .from('fiber_subscriber_status_live')
                .select('name, Status, lat, lon')
                .limit(5)

            if (sampleError) {
                log.error('❌ Sample data fetch failed:', sampleError)
                return false
            }

            log.info('📊 Sample data:', sampleData)

            // Check status values
            const { data: statusData, error: statusError } = await supabase
                .from('fiber_subscriber_status_live')
                .select('Status')
                .not('Status', 'is', null)
                .limit(10)

            if (!statusError && statusData) {
                const uniqueStatuses = [...new Set(statusData.map(row => row.Status))]
                log.info('📋 Available Status values:', uniqueStatuses)
            }

            return true
        } catch (error) {
            log.error('❌ Connection test failed:', error)
            return false
        }
    }

    // Refresh specific data type
    // Note: Realtime data types (subscribers, outages, vehicles) are never cached, so no need to clear cache
    async refreshData(type = 'all') {
        const keysToDelete = [];

        // Only clear cache for infrastructure data that can be cached
        if (type === 'infrastructure' || type === 'all') {
            // Infrastructure cache clearing (no node_sites anymore)
        }
        if (type === 'fiber-plant' || type === 'all') {
            keysToDelete.push('fsa_boundaries', 'main_line_fiber', 'main_line_old', 'mst_terminals', 'mst_fiber', 'splitters', 'closures');
        }
        if (type === 'search' || type === 'all') {
            // Clear all search cache entries
            for (const [key] of this.cache) {
                if (key.includes('search_')) {
                    keysToDelete.push(key.split('_')[0] + '_' + key.split('_')[1]);
                }
            }
        }

        // Clear versioned cache entries
        keysToDelete.forEach(baseKey => {
            const versionedKey = `${baseKey}_${this.APP_VERSION}`;
            this.cache.delete(versionedKey);
            this.cacheExpiry.delete(versionedKey);
        });

        log.info(`Refreshed ${type} data cache (realtime data is never cached)`);
    }

    // Get fiber trucks data from GeotabService - REALTIME (no caching)
    async getFiberTrucks() {
        try {
            log.info('🚛 Fetching fiber trucks from GeotabService... (realtime - no cache)');

            // Import GeotabService dynamically to avoid circular imports
            const { geotabService } = await import('./services/GeotabService.js');

            // Get truck data from GeotabService
            const allTruckData = await geotabService.getTruckData();
            const fiberTrucks = allTruckData.fiber || [];

            // Convert to GeoJSON features for ArcGIS layer
            const features = geoJSONTransformService.convertTruckDataToGeoJSONFeatures(fiberTrucks);

            const result = {
                count: fiberTrucks.length,
                data: fiberTrucks,
                features: features,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            };

            // No caching for realtime data

            log.info(`✅ Fetched ${fiberTrucks.length} fiber trucks`);
            return result;
        } catch (error) {
            log.error('Failed to fetch fiber trucks:', error);

            // Return empty result as fallback
            return {
                count: 0,
                data: [],
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message,
                fromCache: false
            };
        }
    }

    // Get electric trucks data from GeotabService - REALTIME (no caching)
    async getElectricTrucks() {
        try {
            log.info('🚛 Fetching electric trucks from GeotabService... (realtime - no cache)');

            // Import GeotabService dynamically to avoid circular imports
            const { geotabService } = await import('./services/GeotabService.js');

            // Get truck data from GeotabService
            const allTruckData = await geotabService.getTruckData();
            const electricTrucks = allTruckData.electric || [];

            // Convert to GeoJSON features for ArcGIS layer
            const features = geoJSONTransformService.convertTruckDataToGeoJSONFeatures(electricTrucks);

            const result = {
                count: electricTrucks.length,
                data: electricTrucks,
                features: features,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            };

            // No caching for realtime data

            log.info(`✅ Fetched ${electricTrucks.length} electric trucks`);
            return result;
        } catch (error) {
            log.error('Failed to fetch electric trucks:', error);

            // Return empty result as fallback
            return {
                count: 0,
                data: [],
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message,
                fromCache: false
            };
        }
    }
}

// Create singleton instance
export const subscriberDataService = new SubscriberDataService()

// Polling manager for real-time updates
export class PollingManager {
    constructor(dataService) {
        this.dataService = dataService
        this.pollingIntervals = new Map()
        this.updateCallbacks = new Map()
        this.POLLING_INTERVAL = 5 * 60 * 1000 // 5 minutes
        this.isFirstUpdate = new Map() // Track if this is the first update
    }

    // Start polling for a specific data type
    startPolling(dataType, callback, interval = this.POLLING_INTERVAL) {
        // Stop any existing polling for this data type
        this.stopPolling(dataType)

        log.info(`🔄 Starting polling for ${dataType} every ${interval / 1000} seconds`)

        // Store the callback
        this.updateCallbacks.set(dataType, callback)
        this.isFirstUpdate.set(dataType, true)

        // For subscriber data, check if layers already have data to avoid redundant first update
        if (dataType === 'subscribers') {
            const layerManager = window.app?.services?.layerManager;
            const offlineLayer = layerManager?.getLayer('offline-subscribers');

            // Check multiple ways a layer might have data
            let hasOfflineData = false;
            if (offlineLayer) {
                // Check graphics collection (GraphicsLayer)
                if (offlineLayer.graphics && offlineLayer.graphics.length > 0) {
                    hasOfflineData = true;
                } else if (offlineLayer.graphics && offlineLayer.graphics.items && offlineLayer.graphics.items.length > 0) {
                    hasOfflineData = true;
                    // Check source collection (FeatureLayer)
                } else if (offlineLayer.source && offlineLayer.source.length > 0) {
                    hasOfflineData = true;
                } else if (offlineLayer.source && offlineLayer.source.items && offlineLayer.source.items.length > 0) {
                    hasOfflineData = true;
                    // Check for GeoJSONLayer (different structure)
                } else if (offlineLayer.type === 'geojson' && offlineLayer.loaded) {
                    hasOfflineData = true;
                    // Check for layer visibility as another indicator of data presence
                } else if (offlineLayer.visible && offlineLayer.opacity > 0) {
                    hasOfflineData = true;
                }

                log.info(`📊 Offline layer data check: type=${offlineLayer.type}, loaded=${offlineLayer.loaded}, graphics=${offlineLayer.graphics?.length || offlineLayer.graphics?.items?.length || 'none'}, source=${offlineLayer.source?.length || offlineLayer.source?.items?.length || 'none'}, hasData=${hasOfflineData}`);
            }

            // If offline layer already has data, skip the delayed first update
            if (hasOfflineData) {
                log.info('📊 Skipping polling first update - offline layer already has data');
                this.isFirstUpdate.set(dataType, false);
                // Start periodic polling immediately without first update
                const intervalId = setInterval(() => {
                    this.performUpdate(dataType)
                }, interval)
                this.pollingIntervals.set(dataType, intervalId)
                return;
            }

            // Wait 5 seconds before first check to ensure layer graphics are populated
            setTimeout(() => {
                this.performUpdate(dataType)
            }, 5000)
        } else {
            // Perform immediate update for other data types
            this.performUpdate(dataType)
        }

        // Set up interval for periodic updates
        const intervalId = setInterval(() => {
            this.performUpdate(dataType)
        }, interval)

        this.pollingIntervals.set(dataType, intervalId)
    }

    // Stop polling for a specific data type
    stopPolling(dataType) {
        const intervalId = this.pollingIntervals.get(dataType)
        if (intervalId) {
            clearInterval(intervalId)
            this.pollingIntervals.delete(dataType)
            this.updateCallbacks.delete(dataType)
            log.info(`⏹️ Stopped polling for ${dataType}`)
        }
    }

    /**
     * Perform update for a specific data type
     * @param {string} dataType - Type of data to update (e.g., 'subscribers', 'power-outages')
     * @returns {Promise<void>}
     */
    async performUpdate(dataType) {
        const callback = this.updateCallbacks.get(dataType)
        if (!callback) return

        try {
            log.info(`🔄 Fetching updated data for ${dataType}`)

            let data
            switch (dataType) {
                case 'offline-subscribers':
                    data = await this.dataService.getOfflineSubscribers()
                    break
                case 'online-subscribers':
                    data = await this.dataService.getOnlineSubscribers()
                    break
                case 'subscribers':
                    // Only fetch data for layers that exist to save bandwidth
                    const layerManager = window.app?.services?.layerManager;
                    const offlineLayer = layerManager?.getLayer('offline-subscribers');
                    const onlineLayer = layerManager?.getLayer('online-subscribers');
                    const offlineExists = offlineLayer !== null && offlineLayer !== undefined;
                    const onlineExists = onlineLayer !== null && onlineLayer !== undefined;
                    const onlineLayerLoaded = window.app?.onlineLayerLoaded || false;
                    const isFirst = this.isFirstUpdate.get(dataType);

                    log.info(`📊 Polling update ${isFirst ? '(INITIAL)' : '(PERIODIC)'} - Offline layer exists: ${offlineExists}, Online layer exists: ${onlineExists}, onlineLayerLoaded: ${onlineLayerLoaded}`);

                    // For the first update, only fetch offline data to save bandwidth
                    let offline = null;
                    let online = null;

                    if (isFirst && !onlineLayerLoaded) {
                        // First update and online layer not manually loaded - only fetch offline
                        log.info('📊 Initial load - fetching only offline subscriber data to save bandwidth');
                        offline = await this.dataService.getOfflineSubscribers();
                        this.isFirstUpdate.set(dataType, false);
                    } else if (offlineExists && onlineExists && onlineLayerLoaded) {
                        // Both layers exist, fetch both
                        log.info('📊 Fetching both offline and online subscriber data');
                        const results = await Promise.all([
                            this.dataService.getOfflineSubscribers(),
                            this.dataService.getOnlineSubscribers()
                        ]);
                        offline = results[0];
                        online = results[1];
                    } else if (offlineExists) {
                        // Only offline exists
                        log.info('📊 Fetching only offline subscriber data (online layer not loaded)');
                        offline = await this.dataService.getOfflineSubscribers();
                    } else if (onlineExists && onlineLayerLoaded) {
                        // Only online exists and is loaded
                        log.info('📊 Fetching only online subscriber data');
                        online = await this.dataService.getOnlineSubscribers();
                    } else {
                        log.warn('📊 No subscriber layers exist or are loaded, skipping data fetch');
                    }

                    data = { offline, online }
                    break
                default:
                    log.warn(`Unknown data type for polling: ${dataType}`)
                    return
            }

            // Call the update callback with the new data
            if (data) {
                callback(data)
            }
        } catch (error) {
            log.error(`Failed to update ${dataType}:`, error)
        }
    }

    // Stop all polling
    stopAll() {
        this.pollingIntervals.forEach((intervalId, dataType) => {
            clearInterval(intervalId)
            log.info(`⏹️ Stopped polling for ${dataType}`)
        })
        this.pollingIntervals.clear()
        this.updateCallbacks.clear()
    }

    // Check if polling is active for a data type
    isPolling(dataType) {
        return this.pollingIntervals.has(dataType)
    }

    // Get all active polling types
    getActivePolling() {
        return Array.from(this.pollingIntervals.keys())
    }
}

// Create singleton polling manager
export const pollingManager = new PollingManager(subscriberDataService)