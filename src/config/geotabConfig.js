// GeotabConfig.js - Configuration management for MyGeotab API integration
// Production logging utility
const isDevelopment = import.meta.env.DEV;
const log = {
    info: (...args) => isDevelopment && console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

/**
 * Get GeotabConfig configuration from environment variables
 * @returns {Object} Configuration object with credentials and settings
 */
export function getGeotabConfig() {
    const config = {
        username: import.meta.env.VITE_GEOTAB_USERNAME,
        password: import.meta.env.VITE_GEOTAB_PASSWORD,
        database: import.meta.env.VITE_GEOTAB_DATABASE,
        enabled: import.meta.env.VITE_GEOTAB_ENABLED === 'true',
        refreshInterval: parseInt(import.meta.env.VITE_GEOTAB_REFRESH_INTERVAL) || 30000, // 30 seconds default
        fallbackToSupabase: import.meta.env.VITE_GEOTAB_FALLBACK_TO_SUPABASE === 'true' || true, // Default to true
        timeout: parseInt(import.meta.env.VITE_GEOTAB_TIMEOUT) || 30000, // 30 seconds
        rememberMe: import.meta.env.VITE_GEOTAB_REMEMBER_ME === 'true' || false,
        mockMode: import.meta.env.VITE_GEOTAB_MOCK_MODE === 'true' || false,
        // Add retry settings from TRUCK_LAYER_DEFAULTS
        maxRetries: TRUCK_LAYER_DEFAULTS.maxRetries,
        retryDelay: TRUCK_LAYER_DEFAULTS.retryDelay
    };

    // Only log configuration status in development
    if (isDevelopment) {
        log.info('🚛 GeotabConfig Configuration Check:');
        log.info('Username:', config.username ? 'Set ✅' : 'Missing ❌');
        log.info('Password:', config.password ? 'Set ✅' : 'Missing ❌');
        log.info('Database:', config.database ? 'Set ✅' : 'Missing ❌');
        log.info('Enabled:', config.enabled ? 'Yes ✅' : 'No ❌');
        log.info('Refresh Interval:', config.refreshInterval + 'ms');
        log.info('Timeout:', config.timeout + 'ms');
        log.info('Max Retries:', config.maxRetries);
        log.info('Retry Delay:', config.retryDelay + 'ms');
        log.info('Mock Mode:', config.mockMode ? 'Yes ⚠️' : 'No ✅');
    }

    // Validate configuration
    if (config.enabled && !config.mockMode) {
        if (!config.username || !config.password || !config.database) {
            log.warn('⚠️ Missing MyGeotab credentials, falling back to mock mode');
            log.info('To use real MyGeotab data, set these environment variables:');
            log.info('VITE_GEOTAB_USERNAME=your-username');
            log.info('VITE_GEOTAB_PASSWORD=your-password');
            log.info('VITE_GEOTAB_DATABASE=your-database');

            // Fall back to mock mode if credentials are missing
            config.mockMode = true;
        }
    }

    return config;
}

/**
 * Check if GeotabConfig is properly configured
 * @returns {boolean} True if GeotabConfig is ready to use
 */
export function isGeotabConfigured() {
    const config = getGeotabConfig();
    return config.enabled && (config.mockMode || (config.username && config.password && config.database));
}

/**
 * Get mock truck data for testing
 * @returns {Object} Mock truck data with fiber and electric trucks
 */
export function getMockTruckData() {
    return {
        fiber: [
            {
                id: 'fiber-001',
                name: 'Fiber Truck 1',
                latitude: 33.5186,
                longitude: -86.8104,
                installer: 'John Smith',
                speed: 35,
                is_driving: true,
                last_updated: new Date().toISOString(),
                bearing: 45,
                communication_status: 'Online',
                vehicle_type: 'fiber'
            },
            {
                id: 'fiber-002',
                name: 'Fiber Truck 2',
                latitude: 32.3668,
                longitude: -86.3000,
                installer: 'Sarah Johnson',
                speed: 0,
                is_driving: false,
                last_updated: new Date().toISOString(),
                bearing: 180,
                communication_status: 'Online',
                vehicle_type: 'fiber'
            }
        ],
        electric: [
            {
                id: 'electric-001',
                name: 'Electric Truck 1',
                latitude: 34.7304,
                longitude: -86.5861,
                installer: 'Mike Wilson',
                speed: 25,
                is_driving: true,
                last_updated: new Date().toISOString(),
                bearing: 90,
                communication_status: 'Online',
                vehicle_type: 'electric'
            },
            {
                id: 'electric-002',
                name: 'Electric Truck 2',
                latitude: 30.6954,
                longitude: -88.0399,
                installer: 'Lisa Davis',
                speed: 0,
                is_driving: false,
                last_updated: new Date().toISOString(),
                bearing: 270,
                communication_status: 'Offline',
                vehicle_type: 'electric'
            }
        ]
    };
}

/**
 * Default configuration for truck layers
 */
export const TRUCK_LAYER_DEFAULTS = {
    refreshInterval: 30000, // 30 seconds
    maxSpeed: 100, // mph
    speedThreshold: 5, // mph - below this is considered stopped
    onlineTimeout: 300000, // 5 minutes - consider offline after this
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds

    // Visual settings
    colors: {
        fiber: [30, 95, 175, 0.9],     // Alabama Power blue
        electric: [74, 124, 89, 0.9]   // Tombigbee green
    },

    sizes: {
        stopped: 22,
        driving: 28
    },

    opacity: {
        stopped: 0.6,
        driving: 1.0,
        offline: 0.4
    }
}; 