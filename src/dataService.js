import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Production logging utility
const isDevelopment = import.meta.env.DEV;
const log = {
    info: (...args) => isDevelopment && console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

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

    // Get offline subscribers for map display (includes geometry)
    async getOfflineSubscribers() {
        const cacheKey = 'offline_subscribers'

        // Return cached data if valid
        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching offline subscribers from Supabase...')

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
                log.warn('⚠️ No offline subscribers found. Check your data:')
                if (isDevelopment) {
                    log.info('- Make sure you have records with status="Offline"')
                    log.info('- Make sure latitude and longitude are not null')
                }
                return {
                    count: 0,
                    data: [],
                    features: [],
                    lastUpdated: new Date().toISOString()
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
                lastUpdated: new Date().toISOString()
            }

            // Cache the result
            this.setCache(cacheKey, result)

            return result
        } catch (error) {
            log.error('Failed to fetch offline subscribers:', error)
            // Return cached data if available, even if expired
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
                }
            }
            throw error
        }
    }

    // Get online subscribers for map display (includes geometry)
    async getOnlineSubscribers() {
        const cacheKey = 'online_subscribers'

        // Return cached data if valid
        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching online subscribers from Supabase...')

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
                    lastUpdated: new Date().toISOString()
                }
            }

            // Convert to GeoJSON features for ArcGIS
            const features = this.convertToGeoJSONFeatures(data || [], 'online')

            log.info('🗺️ Generated online features:', features.length)

            const result = {
                count: count || 0,
                data: data || [],
                features: features,
                lastUpdated: new Date().toISOString()
            }

            // Cache the result
            this.setCache(cacheKey, result)

            return result
        } catch (error) {
            log.error('Failed to fetch online subscribers:', error)
            // Return cached data if available, even if expired
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
                }
            }
            throw error
        }
    }

    // Get all subscribers with status breakdown
    async getSubscribersSummary() {
        const cacheKey = 'subscribers_summary'

        // Return cached data if valid
        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
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
                lastUpdated: new Date().toISOString()
            }

            // Cache the result
            this.setCache(cacheKey, result)

            return result
        } catch (error) {
            log.error('Failed to fetch subscribers summary:', error)
            // Return cached data if available, even if expired
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
                }
            }
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
    async refreshData(type = 'all') {
        const keysToDelete = [];

        if (type === 'offline' || type === 'all') {
            keysToDelete.push('offline_subscribers');
        }
        if (type === 'online' || type === 'all') {
            keysToDelete.push('online_subscribers');
        }
        if (type === 'summary' || type === 'all') {
            keysToDelete.push('subscribers_summary');
        }
        if (type === 'outages' || type === 'all') {
            keysToDelete.push('apco_outages', 'tombigbee_outages');
        }
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

        log.info(`Refreshed ${type} data cache`);
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

    // Get APCo power outages from Supabase storage
    async getApcoOutages() {
        const cacheKey = 'apco_outages'

        // Return cached data if valid
        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching APCo power outages from Supabase storage...')

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
                const props = feature.properties
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
                lastUpdated: new Date().toISOString()
            }

            // Cache the result with shorter cache time for outage data (2 minutes)
            this.setCache(cacheKey, result)

            log.info('🔌 APCo outages loaded:', result.count, 'outages')
            return result

        } catch (error) {
            log.error('Failed to fetch APCo outages:', error)
            // Return cached data if available, even if expired
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
                }
            }

            // Return empty result as fallback
            return {
                count: 0,
                data: [],
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message
            }
        }
    }

    // Get Tombigbee Electric power outages from Supabase storage
    async getTombigbeeOutages() {
        const cacheKey = 'tombigbee_outages'

        // Return cached data if valid
        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching Tombigbee Electric power outages from Supabase storage...')

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
                lastUpdated: new Date().toISOString()
            }

            // Cache the result with shorter cache time for outage data (2 minutes)
            this.setCache(cacheKey, result)

            log.info('🔌 Tombigbee outages loaded:', result.count, 'outages')
            return result

        } catch (error) {
            log.error('Failed to fetch Tombigbee outages:', error)
            // Return cached data if available, even if expired
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
                }
            }

            // Return empty result as fallback
            return {
                count: 0,
                data: [],
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message
            }
        }
    }

    // Get Node Sites data from external GeoJSON source
    async getNodeSites() {
        const cacheKey = 'node_sites'

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching Node Sites data...')
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/node-sites.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL25vZGUtc2l0ZXMuZ2VvanNvbiIsImlhdCI6MTc1MTQ4OTgyNiwiZXhwIjoxNzgzMDI1ODI2fQ.mhkiSZITSzBnJhIQUuQNojPc5_ijDGzV09grQYbhHSo')

            if (!response.ok) {
                throw new Error(`Failed to fetch Node Sites data: ${response.status} ${response.statusText}`)
            }

            const geojson = await response.json()

            // Process the features - they're already in GeoJSON format
            const processedFeatures = geojson.features || []

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString()
            }

            // Cache the result (node sites don't change frequently, so longer cache)
            this.setCache(cacheKey, result)

            log.info(`✅ Fetched ${processedFeatures.length} Node Sites`)
            return result

        } catch (error) {
            log.error('Failed to fetch Node Sites:', error)
            // Return cached data if available, even if expired
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
                }
            }
            // Return empty result on error
            return {
                count: 0,
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message
            }
        }
    }

    // Get FSA Boundaries data from external GeoJSON source
    async getFSABoundaries() {
        const cacheKey = 'fsa_boundaries'

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching FSA Boundaries data...')
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/fsa-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2ZzYS1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTU0OTUsImV4cCI6MjA2NjkxNTQ5NX0.Gxht_fRDwIB2a7F5kVqZG-xHjzP87uVRN8YwtqQzAoY')

            if (!response.ok) {
                throw new Error(`Failed to fetch FSA Boundaries data: ${response.status} ${response.statusText}`)
            }

            const geojson = await response.json()
            const processedFeatures = geojson.features || []

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString()
            }

            this.setCache(cacheKey, result)
            log.info(`✅ Fetched ${processedFeatures.length} FSA Boundaries`)
            return result

        } catch (error) {
            log.error('Failed to fetch FSA Boundaries:', error)
            // Return cached data if available, even if expired
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
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

    // Get Main Line Fiber data from external GeoJSON source
    async getMainLineFiber() {
        const cacheKey = 'main_line_fiber'

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching Main Line Fiber data...')
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/access-fiber-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2FjY2Vzcy1maWJlci1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTY4MTYsImV4cCI6MjA2NjkxNjgxNn0.XJ3CCYe-Zzt2RuCxXoZNXkn80N6WQte2akP9pT9UkDo')

            if (!response.ok) {
                throw new Error(`Failed to fetch Main Line Fiber data: ${response.status} ${response.statusText}`)
            }

            const geojson = await response.json()
            const processedFeatures = geojson.features || []

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString()
            }

            this.setCache(cacheKey, result)
            log.info(`✅ Fetched ${processedFeatures.length} Main Line Fiber features`)
            return result

        } catch (error) {
            log.error('Failed to fetch Main Line Fiber:', error)
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
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

    // Get Main Line Old Fiber data from external GeoJSON source
    async getMainLineOld() {
        const cacheKey = 'main_line_old'

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching Main Line Old data...')
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/fsa-data//networkOLD.geojson')

            if (!response.ok) {
                throw new Error(`Failed to fetch Main Line Old data: ${response.status} ${response.statusText}`)
            }

            const geojson = await response.json()
            const processedFeatures = geojson.features || []

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString()
            }

            this.setCache(cacheKey, result)
            log.info(`✅ Fetched ${processedFeatures.length} Main Line Old features`)
            return result

        } catch (error) {
            log.error('Failed to fetch Main Line Old:', error)
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
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

    // Get MST Terminals data from external GeoJSON source
    async getMSTTerminals() {
        const cacheKey = 'mst_terminals'

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching MST Terminals data...')
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/mst-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL21zdC1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTU0NzMsImV4cCI6MjA2NjkxNTQ3M30.8skgJzFWzYj6d79b64BIS91PDNGFqpNhu42eABhcy0A')

            if (!response.ok) {
                throw new Error(`Failed to fetch MST Terminals data: ${response.status} ${response.statusText}`)
            }

            const geojson = await response.json()
            const processedFeatures = geojson.features || []

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString()
            }

            this.setCache(cacheKey, result)
            log.info(`✅ Fetched ${processedFeatures.length} MST Terminals`)
            return result

        } catch (error) {
            log.error('Failed to fetch MST Terminals:', error)
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
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

    // Get Splitters data from external GeoJSON source
    async getSplitters() {
        const cacheKey = 'splitters'

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching Splitters data...')
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/splitter-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL3NwbGl0dGVyLW92ZXJsYXkuZ2VvanNvbiIsImlhdCI6MTc1MTU1NTQ0NSwiZXhwIjoyMDY2OTE1NDQ1fQ.AWS6MtB8vtC5iUESPrO27CmrOaqAjU_A2lQr86l5G_E')

            if (!response.ok) {
                throw new Error(`Failed to fetch Splitters data: ${response.status} ${response.statusText}`)
            }

            const geojson = await response.json()
            const processedFeatures = geojson.features || []

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString()
            }

            this.setCache(cacheKey, result)
            log.info(`✅ Fetched ${processedFeatures.length} Splitters`)
            return result

        } catch (error) {
            log.error('Failed to fetch Splitters:', error)
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
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

    // Get Closures data from external GeoJSON source
    async getClosures() {
        const cacheKey = 'closures'

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching Closures data...')
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/closure-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2Nsb3N1cmUtb3ZlcmxheS5nZW9qc29uIiwiaWF0IjoxNzUxNTU1NTM5LCJleHAiOjIwNjY5MTU1Mzl9.pKptT2hsuyD55udHF12xEuQ2C6PPt537tieE3fIpzFE')

            if (!response.ok) {
                throw new Error(`Failed to fetch Drop Fiber data: ${response.status} ${response.statusText}`)
            }

            const geojson = await response.json()
            const processedFeatures = geojson.features || []

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString()
            }

            this.setCache(cacheKey, result)
            log.info(`✅ Fetched ${processedFeatures.length} Closures`)
            return result

        } catch (error) {
            log.error('Failed to fetch Closures:', error)
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
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

    // Get MST Fiber data from external GeoJSON source
    async getMSTFiber() {
        const cacheKey = 'mst_fiber'

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey)
        }

        try {
            log.info('📡 Fetching MST Fiber data...')
            const response = await fetch('https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/mst-fiber-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL21zdC1maWJlci1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTU1MTgsImV4cCI6MjA2NjkxNTUxOH0.4ZOQy_9gcKiy1nbMHnXn90ZLu078ZgG1qiTc11YGG3I')

            if (!response.ok) {
                throw new Error(`Failed to fetch MST Fiber data: ${response.status} ${response.statusText}`)
            }

            const geojson = await response.json()
            const processedFeatures = geojson.features || []

            const result = {
                count: processedFeatures.length,
                features: processedFeatures,
                lastUpdated: new Date().toISOString()
            }

            this.setCache(cacheKey, result)
            log.info(`✅ Fetched ${processedFeatures.length} MST Fiber features`)
            return result

        } catch (error) {
            log.error('Failed to fetch MST Fiber:', error)
            if (this.getCache(cacheKey)) {
                const cachedData = this.getCache(cacheKey)
                return {
                    ...cachedData,
                    error: true,
                    errorMessage: error.message
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
    }

    // Start polling for a specific data type
    startPolling(dataType, callback, interval = this.POLLING_INTERVAL) {
        // Stop any existing polling for this data type
        this.stopPolling(dataType)

        log.info(`🔄 Starting polling for ${dataType} every ${interval / 1000} seconds`)

        // Store the callback
        this.updateCallbacks.set(dataType, callback)

        // Perform immediate update
        this.performUpdate(dataType)

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

    // Perform update for a specific data type
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
                    // Fetch both online and offline
                    const [offline, online] = await Promise.all([
                        this.dataService.getOfflineSubscribers(),
                        this.dataService.getOnlineSubscribers()
                    ])
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