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
        refreshInterval: parseInt(import.meta.env.VITE_GEOTAB_REFRESH_INTERVAL) || TRUCK_LAYER_DEFAULTS.refreshInterval, // Use truck layer default (2 minutes)
        fallbackToSupabase: import.meta.env.VITE_GEOTAB_FALLBACK_TO_SUPABASE === 'true' || true, // Default to true
        timeout: parseInt(import.meta.env.VITE_GEOTAB_TIMEOUT) || 30000, // 30 seconds
        rememberMe: import.meta.env.VITE_GEOTAB_REMEMBER_ME === 'true' || false,
        // Add retry settings from TRUCK_LAYER_DEFAULTS
        maxRetries: TRUCK_LAYER_DEFAULTS.maxRetries,
        retryDelay: TRUCK_LAYER_DEFAULTS.retryDelay
    };

    // Log configuration status (production-appropriate for diagnostics)
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
        log.info('Environment:', import.meta.env.MODE);
    } else {
        // Production: Only log if there are configuration issues
        if (config.enabled && (!config.username || !config.password || !config.database)) {
            console.warn('🚛 GeotabConfig: Missing required credentials - service will be disabled');
        }
    }

    // Production environment validation (only log if there are issues)
    if (!isDevelopment && config.enabled) {
        const hasCredentials = config.username && config.password && config.database;
        if (!hasCredentials) {
            console.warn('🚛 Production GeotabConfig: Environment variables not properly configured');
        }
    }

    // Validate configuration
    if (config.enabled) {
        if (!config.username || !config.password || !config.database) {
            log.warn('⚠️ Missing MyGeotab credentials, disabling GeotabService');
            log.info('To use MyGeotab data, set these environment variables:');
            log.info('VITE_GEOTAB_USERNAME=your-username');
            log.info('VITE_GEOTAB_PASSWORD=your-password');
            log.info('VITE_GEOTAB_DATABASE=your-database');

            // Disable service if credentials are missing
            config.enabled = false;
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
    return config.enabled && config.username && config.password && config.database;
}



/**
 * Default configuration for truck layers
 */
export const TRUCK_LAYER_DEFAULTS = {
    refreshInterval: 90000, // 90 seconds - respect 10 calls/minute limit (6 calls/minute = safe)
    maxSpeed: 100, // mph
    speedThreshold: 5, // mph - below this is considered stopped
    onlineTimeout: 300000, // 5 minutes - consider offline after this
    maxRetries: 2, // Conservative retry count
    retryDelay: 30000, // 30 seconds - longer retry timing for rate limits

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