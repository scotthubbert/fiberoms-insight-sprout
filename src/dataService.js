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
    console.error('🔍 DEBUG: Missing environment variables:', {
        supabaseUrl: !!supabaseUrl,
        supabaseKey: !!supabaseKey,
        allEnvVars: import.meta.env
    });
    if (isDevelopment) {
        log.info('Required variables:')
        log.info('VITE_SUPABASE_URL=https://your-project.supabase.co')
        log.info('VITE_SUPABASE_ANON_KEY=your-anon-key')
    }
} else {
    console.log('🔍 DEBUG: Supabase environment variables are set correctly');
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
    console.log('🚨 RUNNING IN MOCK MODE - No Supabase credentials found');
    console.log('📝 Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect to real database');
    console.log('🔍 Mock subscribers available:', MOCK_SUBSCRIBERS.length);
} else {
    console.log('✅ RUNNING IN SUPABASE MODE - Database connected');
}

// Data service class for subscriber operations
export class SubscriberDataService {
    constructor() {
        this.cache = new Map()
        this.cacheExpiry = new Map()
        this.CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
    }

    // Check if cached data is still valid
    isCacheValid(key) {
        const expiry = this.cacheExpiry.get(key)
        return expiry && Date.now() < expiry
    }

    // Set cache with expiry
    setCache(key, data) {
        this.cache.set(key, data)
        this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION)
    }

    // Get offline subscribers for map display (includes geometry)
    async getOfflineSubscribers() {
        const cacheKey = 'offline_subscribers'

        // Return cached data if valid
        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey)
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
            if (this.cache.has(cacheKey)) {
                const cachedData = this.cache.get(cacheKey)
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
            return this.cache.get(cacheKey)
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
            if (this.cache.has(cacheKey)) {
                const cachedData = this.cache.get(cacheKey)
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
            return this.cache.get(cacheKey)
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
            if (this.cache.has(cacheKey)) {
                const cachedData = this.cache.get(cacheKey)
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
    }

    // Search subscribers by various criteria
    async searchSubscribers(searchTerm, limit = 10) {
        if (!searchTerm || searchTerm.length < 2) {
            return { results: [], count: 0 }
        }

        const cacheKey = `search_${searchTerm.toLowerCase()}_${limit}`

        // Return cached results if valid
        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey)
        }

        // Use mock data if Supabase not configured
        if (isMockMode) {
            return this.searchMockData(searchTerm, limit);
        }

        try {
            log.info('🔍 Searching subscribers for:', searchTerm)

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
            this.cache.set(cacheKey, searchResult)
            this.cacheExpiry.set(cacheKey, Date.now() + (2 * 60 * 1000)) // 2 minutes cache

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
        this.cache.set(`search_${searchTerm.toLowerCase()}_${limit}`, searchResult);
        this.cacheExpiry.set(`search_${searchTerm.toLowerCase()}_${limit}`, Date.now() + (2 * 60 * 1000));

        return searchResult;
    }

    // Get subscriber by ID for detailed view
    async getSubscriberById(id) {
        const cacheKey = `subscriber_${id}`

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey)
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
        if (type === 'offline' || type === 'all') {
            this.cache.delete('offline_subscribers')
            this.cacheExpiry.delete('offline_subscribers')
        }
        if (type === 'online' || type === 'all') {
            this.cache.delete('online_subscribers')
            this.cacheExpiry.delete('online_subscribers')
        }
        if (type === 'summary' || type === 'all') {
            this.cache.delete('subscribers_summary')
            this.cacheExpiry.delete('subscribers_summary')
        }
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
}

// Create singleton instance
export const subscriberDataService = new SubscriberDataService() 