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

                    // Map database fields to display fields
                    customer_name: record.customer_name || record.name || 'Unknown',
                    customer_number: record.customer_number || record.account || '',
                    address: record.address || record.service_address || '',
                    city: record.city || '',
                    state: record.state || '',
                    zip: record.zip || record.zip_code || '',
                    county: record.county || '',
                    phone_number: record.phone_number || '',

                    // Include all original fields
                    ...record
                }
            }
        }).filter(feature => feature !== null) // Remove null features
    }
}

// Create singleton instance
export const subscriberDataService = new SubscriberDataService() 