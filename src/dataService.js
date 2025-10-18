import { createClient } from '@supabase/supabase-js'
import { cacheService } from './services/CacheService.js'
import { createLogger } from './utils/logger.js'

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
            'apcoOutages', 'tombigbeeOutages',
            'fiberTrucks', 'electricTrucks'
        ];

        if (realtimeTypes.includes(dataType)) {
            return false; // Never cached
        }

        // Map data types to cache keys for infrastructure data that can be cached
        const cacheKeyMap = {
            'nodeSites': 'nodeSites',
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

    // Generic OSP data fetcher with persistent caching
    async fetchOSPData(url, cacheKey, memoryKey, description) {
        // Check IndexedDB cache first
        log.info(`🔍 Checking cache for ${description} (key: ${cacheKey})...`)
        const cachedData = await cacheService.getCachedData(cacheKey)
        if (cachedData) {
            log.info(`📦 Using cached ${description} data from IndexedDB`)
            // Add flag to indicate data source
            cachedData.fromCache = true;
            return cachedData
        }

        // Also check memory cache for very recent data
        if (this.isCacheValid(memoryKey)) {
            const memData = this.getCache(memoryKey);
            memData.fromCache = true;
            return memData;
        }

        try {
            log.info(`📡 Fetching ${description} data...`)
            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(`Failed to fetch ${description} data: ${response.status} ${response.statusText}`)
            }

            const geojson = await response.json()
            const processedFeatures = geojson.features || []

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString(),
                fromCache: false  // Indicate data was fetched from network
            }

            // Store in both caches
            this.setCache(memoryKey, result) // Memory cache for immediate reuse
            await cacheService.setCachedData(cacheKey, result) // IndexedDB for persistence

            log.info(`✅ Fetched ${processedFeatures.length} ${description}`)
            return result

        } catch (error) {
            log.error(`Failed to fetch ${description}:`, error)
            // Return cached data if available, even if expired
            const fallbackData = cachedData || this.getCache(memoryKey)
            if (fallbackData) {
                log.warn(`⚠️ Using stale cached ${description} data due to fetch error`)
                return {
                    ...fallbackData,
                    error: true,
                    errorMessage: error.message,
                    fromCache: true
                }
            }
            return {
                count: 0,
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message
            }
        }
    }

    // Get offline subscribers for map display (includes geometry) - REALTIME (no caching)
    async getOfflineSubscribers() {
        try {
            log.info('📡 Fetching offline subscribers from Supabase... (realtime - no cache)')

            // Select all fields for feature layer creation
            const { data, error, count } = await supabase
                .from('mfs')
                .select('*', { count: 'exact' })
                .eq('status', 'Offline')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)

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
                log.warn('⚠️ Check that records exist with status="Offline" and coordinates present');
                if (isDevelopment) {
                    log.info('- Ensure status="Offline"')
                    log.info('- Ensure latitude and longitude are not null')
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

            // Convert to GeoJSON features for ArcGIS
            const features = this.convertToGeoJSONFeatures(data || [], 'offline')

            log.info('🗺️ Generated features:', features.length)
            if (isDevelopment && features.length > 0) {
                log.info('📍 Sample feature:', features[0])
                log.info('📍 Sample coordinates:', features[0].geometry.coordinates)
                log.info('📍 First 3 coordinates:', features.slice(0, 3).map(f => f.geometry.coordinates))
            }

            const result = {
                count: count || 0,
                data: data || [],
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
                .from('mfs')
                .select('*', { count: 'exact' })
                .eq('status', 'Online')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)

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
                    log.info('- Make sure you have records with status="Online"')
                    log.info('- Make sure latitude and longitude are not null')
                }
                return {
                    count: 0,
                    data: [],
                    features: [],
                    lastUpdated: new Date().toISOString(),
                    fromCache: false
                }
            }

            // Convert to GeoJSON features for ArcGIS
            const features = this.convertToGeoJSONFeatures(data || [], 'online')

            log.info('🗺️ Generated online features:', features.length)

            const result = {
                count: count || 0,
                data: data || [],
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
                .from('mfs')
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
            return sortedData
        } catch (error) {
            log.error('Failed to fetch all subscribers:', error)
            throw error
        }
    }

    // Get all subscribers with status breakdown - REALTIME (no caching)
    async getSubscribersSummary() {
        try {
            log.info('📡 Fetching subscribers summary from Supabase... (realtime - no cache)')

            const { data, error } = await supabase
                .from('mfs')
                .select('status')

            if (error) {
                log.error('Error fetching subscribers summary:', error)
                throw error
            }

            // Count by status
            const statusCounts = data.reduce((acc, row) => {
                const status = row.status || 'Unknown'
                acc[status] = (acc[status] || 0) + 1
                return acc
            }, {})

            const result = {
                total: data.length,
                online: statusCounts['Online'] || 0,
                offline: statusCounts['Offline'] || 0,
                unknown: statusCounts['Unknown'] || 0,
                statusBreakdown: statusCounts,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            }

            // No caching for realtime data
            return result
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
    async searchSubscribers(searchTerm, limit = 10) {
        if (!searchTerm || searchTerm.length < 2) {
            return { results: [], count: 0 }
        }

        const cacheKey = `search_${searchTerm.toLowerCase()}_${limit}`

        // Return cached results if valid
        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        // Use mock data if Supabase not configured
        if (isMockMode) {
            return this.searchMockData(searchTerm, limit);
        }

        try {
            log.info('Searching subscribers for:', searchTerm)

            // Search across multiple fields using OR conditions
            // Use only columns that actually exist in the database schema
            const { data, error, count } = await supabase
                .from('mfs')
                .select('*', { count: 'exact' })
                .or(`name.ilike.%${searchTerm}%,account.ilike.%${searchTerm}%,service_address.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,county.ilike.%${searchTerm}%`)
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .limit(limit)

            if (error) {
                log.error('❌ Error searching subscribers:', error)
                throw error
            }

            const results = data?.map(record => ({
                id: record.id,
                customer_name: record.name || 'Unknown',
                customer_number: record.account || '',
                address: record.service_address || '',
                city: record.city || '',
                state: record.state || '',
                zip: record.zip_code || '',
                phone_number: '', // No phone_number column in schema
                status: record.status || 'Unknown',
                latitude: record.latitude,
                longitude: record.longitude,
                county: record.county || '',
                // Include full record for detailed view
                fullRecord: record
            })) || []

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
    searchMockData(searchTerm, limit = 10) {
        const searchLower = searchTerm.toLowerCase();
        const filtered = MOCK_SUBSCRIBERS.filter(subscriber => {
            return (
                subscriber.customer_name.toLowerCase().includes(searchLower) ||
                subscriber.address.toLowerCase().includes(searchLower) ||
                subscriber.customer_number.toLowerCase().includes(searchLower) ||
                subscriber.phone_number.includes(searchTerm) ||
                subscriber.city.toLowerCase().includes(searchLower)
            );
        }).slice(0, limit);

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
                .from('mfs')
                .select('*')
                .eq('id', id)
                .single()

            if (error) {
                log.error('❌ Error fetching subscriber by ID:', error)
                throw error
            }

            // Cache the result
            this.setCache(cacheKey, data)
            return data

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
                .from('mfs')
                .select('id')
                .limit(1)

            if (tableError) {
                log.error('❌ Database connection failed:', tableError)
                return false
            }

            log.info('✅ Database connection successful')

            // Test data availability
            const { data: sampleData, error: sampleError } = await supabase
                .from('mfs')
                .select('id, name, status, latitude, longitude')
                .limit(5)

            if (sampleError) {
                log.error('❌ Sample data fetch failed:', sampleError)
                return false
            }

            log.info('📊 Sample data:', sampleData)

            // Check status values
            const { data: statusData, error: statusError } = await supabase
                .from('mfs')
                .select('status')
                .not('status', 'is', null)
                .limit(10)

            if (!statusError && statusData) {
                const uniqueStatuses = [...new Set(statusData.map(row => row.status))]
                log.info('📋 Available status values:', uniqueStatuses)
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
            keysToDelete.push('node_sites');
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

    // Convert Supabase data to GeoJSON features for ArcGIS
    convertToGeoJSONFeatures(data, status) {
        if (!data || !Array.isArray(data)) return []

        return data.map((record, index) => {
            // Use actual field names from your MFS table
            const lat = record.latitude
            const lng = record.longitude

            if (!lat || !lng) {
                log.warn(`Skipping record ${index}: missing coordinates`, record)
                return null
            }

            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                properties: {
                    // Core properties for display
                    objectId: record.id || index,
                    status: record.status || status,

                    // Map database fields to display fields (using actual schema)
                    customer_name: record.name || 'Unknown',
                    customer_number: record.account || '',
                    address: record.service_address || '',
                    city: record.city || '',
                    state: record.state || '',
                    zip: record.zip_code || '',
                    county: record.county || '',
                    phone_number: '', // No phone_number in schema

                    // Create full address field combining all address components
                    full_address: [
                        record.service_address || '',
                        record.city || '',
                        record.state || '',
                        record.zip_code || ''
                    ].filter(part => part && part.toString().trim() !== '').join(', '),

                    // Include all original fields
                    ...record
                }
            }
        }).filter(feature => feature !== null) // Remove null features
    }

    // Convert power outage data to GeoJSON features with polygon support
    convertPowerOutageToGeoJSONFeatures(data, company, originalFeatures = []) {
        if (!data || !Array.isArray(data)) return []

        return data.map((record, index) => {
            // Get the original GeoJSON feature to preserve geometry
            const originalFeature = originalFeatures[index]
            let geometry
            let geometryType = 'Point' // Default

            if (originalFeature && originalFeature.geometry) {
                geometryType = originalFeature.geometry.type
                geometry = originalFeature.geometry
            } else {
                // Fallback to point geometry using lat/lng
                const lat = record.latitude
                const lng = record.longitude

                if (!lat || !lng) {
                    log.warn(`Skipping power outage record ${index}: missing coordinates`, record)
                    return null
                }

                geometry = {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                }
            }

            return {
                type: 'Feature',
                geometry: geometry,
                properties: {
                    objectId: record.id || index,
                    outage_id: record.outage_id || `${company}-${index}`,
                    customers_affected: record.customers_affected || 0,
                    cause: record.cause || 'Unknown',
                    start_time: record.start_time || new Date().toISOString(),
                    estimated_restore: record.estimated_restore || null,
                    status: record.status || 'Active',
                    area_description: record.area_description || '',
                    company: company,

                    latitude: record.latitude || null,
                    longitude: record.longitude || null,
                    // Include all original fields
                    ...record
                }
            }
        }).filter(feature => feature !== null)
    }

    // Get APCo power outages from Supabase storage - REALTIME (no caching)
    async getApcoOutages() {
        try {
            log.info('📡 Fetching APCo power outages from Supabase storage... (realtime - no cache)')

            let geojsonData;

            // Direct fetch from Supabase public URL
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/geojson-files/outages.geojson')
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            geojsonData = await response.json()
            log.info('✅ Loaded APCo outages from Supabase public URL')
            log.info(`📊 Total features in APCo GeoJSON: ${geojsonData.features?.length || 0}`)

            // Extract features and properties - handle Kubra data format for APCo
            const features = geojsonData.features || []
            const outageData = features.map(feature => {
                const props = feature.properties || {}
                const desc = props.desc || {}

                // Extract coordinates based on geometry type
                let latitude, longitude;
                if (feature.geometry.type === 'Point') {
                    longitude = feature.geometry.coordinates[0];
                    latitude = feature.geometry.coordinates[1];
                } else if (feature.geometry.type === 'Polygon') {
                    // For polygons, calculate centroid from first ring
                    const ring = feature.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    for (const coord of ring) {
                        sumLng += coord[0];
                        sumLat += coord[1];
                    }
                    longitude = sumLng / ring.length;
                    latitude = sumLat / ring.length;
                }

                return {
                    id: props.id,
                    outage_id: desc.inc_id || props.id,
                    customers_affected: desc.cust_a?.val || 0,
                    cause: desc.cause || 'Unknown',
                    start_time: desc.start_time || null,
                    estimated_restore: desc.etr && desc.etr !== 'ETR-EXP' ? desc.etr : null,
                    status: desc.crew_status || (desc.comments ? 'In Progress' : 'Reported'),
                    area_description: props.title || 'Area Outage',
                    comments: desc.comments || '',
                    crew_on_site: desc.crew_icon || false,
                    latitude: latitude,
                    longitude: longitude,
                    // Include original data for debugging
                    ...props
                }
            })

            // Apply geographic filtering for APCo (Alabama Power service area)
            const filteredData = outageData.filter(outage => {
                const lng = outage.longitude
                const lat = outage.latitude
                // APCo service area bounds
                return lng >= -88.277 && lng <= -87.263 && lat >= 33.510 && lat <= 34.632
            })

            log.info(`📍 APCo outages after geographic filtering: ${filteredData.length}`)

            // Convert to the expected format, preserving original geometries
            // Use the same centroid calculation logic for filtering
            const filteredFeatures = features.filter(feature => {
                let longitude, latitude;
                if (feature.geometry.type === 'Point') {
                    longitude = feature.geometry.coordinates[0];
                    latitude = feature.geometry.coordinates[1];
                } else if (feature.geometry.type === 'Polygon') {
                    // Calculate centroid for filtering
                    const ring = feature.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    for (const coord of ring) {
                        sumLng += coord[0];
                        sumLat += coord[1];
                    }
                    longitude = sumLng / ring.length;
                    latitude = sumLat / ring.length;
                }
                // APCo service area bounds (using centroid for both points and polygons)
                return longitude >= -88.277 && longitude <= -87.263 && latitude >= 33.510 && latitude <= 34.632;
            })

            const processedFeatures = this.convertPowerOutageToGeoJSONFeatures(filteredData, 'apco', filteredFeatures)

            const result = {
                count: filteredData.length,
                data: filteredData,
                features: processedFeatures,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            }

            // No caching for realtime data

            log.info('🔌 APCo outages loaded:', result.count, 'outages')
            return result

        } catch (error) {
            log.error('Failed to fetch APCo outages:', error)

            // Return empty result as fallback
            return {
                count: 0,
                data: [],
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message,
                fromCache: false
            }
        }
    }

    // Get Tombigbee power outages from Supabase storage - REALTIME (no caching)
    async getTombigbeeOutages() {
        try {
            log.info('📡 Fetching Tombigbee Electric power outages from Supabase storage... (realtime - no cache)')

            let geojsonData;

            // Direct fetch from Supabase public URL
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/geojson-files/tec_outages.geojson')
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            geojsonData = await response.json()
            log.info('✅ Loaded Tombigbee outages from Supabase public URL')

            // Extract features and properties - handle Tombigbee direct format (not Kubra)
            const features = geojsonData.features || []
            const outageData = features.map(feature => {
                const props = feature.properties

                // Extract coordinates based on geometry type
                let latitude, longitude;
                if (feature.geometry.type === 'Point') {
                    longitude = feature.geometry.coordinates[0];
                    latitude = feature.geometry.coordinates[1];
                } else if (feature.geometry.type === 'Polygon') {
                    // For polygons, calculate centroid from first ring
                    const ring = feature.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    for (const coord of ring) {
                        sumLng += coord[0];
                        sumLat += coord[1];
                    }
                    longitude = sumLng / ring.length;
                    latitude = sumLat / ring.length;
                }

                // Determine crew status
                let crewStatus = 'Reported';
                if (props.crew_dispatched === true) {
                    crewStatus = 'Dispatched';
                } else if (props.verified === true) {
                    crewStatus = 'Verified';
                }

                // Get outage cause
                const cause = props.verified_cause || props.suspected_cause || 'Unknown';

                // Calculate duration from start time
                let duration = '';
                if (props.outage_start) {
                    const startTime = new Date(props.outage_start);
                    const now = new Date();
                    const diffMs = now - startTime;
                    const diffMins = Math.floor(diffMs / (1000 * 60));
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);

                    if (diffDays > 0) {
                        duration = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                    } else if (diffHours > 0) {
                        duration = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                    } else if (diffMins > 0) {
                        duration = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                    } else {
                        duration = 'Just now';
                    }
                }

                return {
                    id: props.outage_id || props.id,
                    outage_id: props.outage_id,
                    customers_affected: props.customers_out_now || 0,
                    cause: cause,
                    start_time: props.outage_start ? new Date(props.outage_start).getTime() : null,
                    estimated_restore: props.outage_end ? new Date(props.outage_end).getTime() : null,
                    status: crewStatus,
                    outage_status: props.status || 'N/A',
                    area_description: props.outage_name || 'Area Outage',
                    comments: crewStatus,
                    crew_on_site: props.crew_dispatched || false,
                    substation: props.substation || 'N/A',
                    feeder: props.feeder || 'N/A',
                    district: props.district || 'N/A',
                    customers_restored: props.customers_restored || 0,
                    initially_affected: props.customers_out_initially || props.customers_out_now || 0,
                    equipment: props.outage_name || 'N/A',
                    description: `Outage affecting ${props.customers_out_now || 0} customers`,
                    last_update: props.last_update ? new Date(props.last_update).getTime() : null,
                    duration: duration,
                    latitude: latitude,
                    longitude: longitude,
                    ...props
                }
            })

            // Convert to the expected format, preserving original geometries
            const processedFeatures = this.convertPowerOutageToGeoJSONFeatures(outageData, 'tombigbee', features)

            const result = {
                count: outageData.length,
                data: outageData,
                features: processedFeatures,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            }

            // No caching for realtime data

            log.info('🔌 Tombigbee outages loaded:', result.count, 'outages')
            return result

        } catch (error) {
            log.error('Failed to fetch Tombigbee outages:', error)

            // Return empty result as fallback
            return {
                count: 0,
                data: [],
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message,
                fromCache: false
            }
        }
    }

    // Get Node Sites data from external GeoJSON source
    async getNodeSites() {
        return this.fetchOSPData(
            'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/node-sites.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL25vZGUtc2l0ZXMuZ2VvanNvbiIsImlhdCI6MTc1MTQ4OTgyNiwiZXhwIjoxNzgzMDI1ODI2fQ.mhkiSZITSzBnJhIQUuQNojPc5_ijDGzV09grQYbhHSo',
            'nodeSites',
            'node_sites',
            'Node Sites'
        )
    }

    // Get FSA Boundaries data from external GeoJSON source
    async getFSABoundaries() {
        return this.fetchOSPData(
            'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/fsa-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2ZzYS1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTU0OTUsImV4cCI6MjA2NjkxNTQ5NX0.Gxht_fRDwIB2a7F5kVqZG-xHjzP87uVRN8YwtqQzAoY',
            'fsa',
            'fsa_boundaries',
            'FSA Boundaries'
        )
    }

    // Get Main Line Fiber data from external GeoJSON source
    async getMainLineFiber() {
        return this.fetchOSPData(
            'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/access-fiber-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2FjY2Vzcy1maWJlci1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTY4MTYsImV4cCI6MjA2NjkxNjgxNn0.XJ3CCYe-Zzt2RuCxXoZNXkn80N6WQte2akP9pT9UkDo',
            'mainFiber',
            'main_line_fiber',
            'Main Line Fiber'
        )
    }

    // Get Main Line Old Fiber data from external GeoJSON source
    async getMainLineOld() {
        return this.fetchOSPData(
            'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/fsa-data//networkOLD.geojson',
            'mainOld',
            'main_line_old',
            'Main Line Old'
        )
    }

    // Get MST Terminals data from external GeoJSON source
    async getMSTTerminals() {
        return this.fetchOSPData(
            'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/mst-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL21zdC1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTU0NzMsImV4cCI6MjA2NjkxNTQ3M30.8skgJzFWzYj6d79b64BIS91PDNGFqpNhu42eABhcy0A',
            'mstTerminals',
            'mst_terminals',
            'MST Terminals'
        )
    }

    // Get Splitters data from external GeoJSON source
    async getSplitters() {
        return this.fetchOSPData(
            'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/splitter-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL3NwbGl0dGVyLW92ZXJsYXkuZ2VvanNvbiIsImlhdCI6MTc1MTU1NTQ0NSwiZXhwIjoyMDY2OTE1NDQ1fQ.AWS6MtB8vtC5iUESPrO27CmrOaqAjU_A2lQr86l5G_E',
            'splitters',
            'splitters',
            'Splitters'
        )
    }

    // Get Closures data from external GeoJSON source
    async getClosures() {
        return this.fetchOSPData(
            'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/closure-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2Nsb3N1cmUtb3ZlcmxheS5nZW9qc29uIiwiaWF0IjoxNzUxNTU1NTM5LCJleHAiOjIwNjY5MTU1Mzl9.pKptT2hsuyD55udHF12xEuQ2C6PPt537tieE3fIpzFE',
            'closures',
            'closures',
            'Closures'
        )
    }

    // Get MST Fiber data from external GeoJSON source
    async getMSTFiber() {
        return this.fetchOSPData(
            'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/mst-fiber-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL21zdC1maWJlci1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTU1MTgsImV4cCI6MjA2NjkxNTUxOH0.4ZOQy_9gcKiy1nbMHnXn90ZLu078ZgG1qiTc11YGG3I',
            'mstFiber',
            'mst_fiber',
            'MST Fiber'
        )
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
            const features = this.convertTruckDataToGeoJSONFeatures(fiberTrucks);

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
            const features = this.convertTruckDataToGeoJSONFeatures(electricTrucks);

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

    // Convert truck data to GeoJSON features for ArcGIS layer
    convertTruckDataToGeoJSONFeatures(trucks) {
        return trucks.map(truck => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [parseFloat(truck.longitude), parseFloat(truck.latitude)]
            },
            properties: {
                id: truck.id,
                name: truck.name,
                installer: truck.installer,
                speed: truck.speed,
                is_driving: truck.is_driving,
                bearing: truck.bearing,
                communication_status: truck.communication_status,
                last_updated: truck.last_updated,
                vehicle_type: truck.vehicle_type,
                // Additional properties for popup display
                status_display: truck.is_driving ? `Moving (${truck.speed} mph)` : 'Stopped',
                last_update_display: new Date(truck.last_updated).toLocaleString(),
                connection_status: truck.communication_status
            }
        }));
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
        } else if (dataType === 'power-outages') {
            // For power outages, check if layers already have data to avoid redundant first update
            const layerManager = window.app?.services?.layerManager;
            const apcoLayer = layerManager?.getLayer('apco-outages');
            const tombigbeeLayer = layerManager?.getLayer('tombigbee-outages');
            const hasApcoData = apcoLayer?.graphics?.length > 0;
            const hasTombigbeeData = tombigbeeLayer?.graphics?.length > 0;

            // If either layer already has data, skip the immediate first update
            if (hasApcoData || hasTombigbeeData) {
                log.info('⚡ Skipping polling first update - power outage layers already have data');
                this.isFirstUpdate.set(dataType, false);
                // Start periodic polling immediately without first update
                const intervalId = setInterval(() => {
                    this.performUpdate(dataType)
                }, interval)
                this.pollingIntervals.set(dataType, intervalId)
                return;
            }

            // Wait 3 seconds before first check to ensure layer state is accurate
            setTimeout(() => {
                this.performUpdate(dataType)
            }, 3000)
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
                case 'apco-outages':
                    data = await this.dataService.getApcoOutages()
                    break
                case 'tombigbee-outages':
                    data = await this.dataService.getTombigbeeOutages()
                    break
                case 'power-outages':
                    // Fetch both power company outages
                    const [apco, tombigbee] = await Promise.all([
                        this.dataService.getApcoOutages(),
                        this.dataService.getTombigbeeOutages()
                    ])
                    data = { apco, tombigbee }
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