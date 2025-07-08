// GeotabService.js - MyGeotab API integration service
import { getGeotabConfig, TRUCK_LAYER_DEFAULTS } from '../config/geotabConfig.js';

// Try to import GeotabApi, but handle errors gracefully
let GeotabApi = null;
try {
    // Note: mg-api-js may not be compatible with ES modules in browser
    // This will be handled in initializeApi method
} catch (error) {
    console.warn('GeotabApi not available in browser environment:', error);
}

// Production logging utility
const isDevelopment = import.meta.env.DEV;
const log = {
    info: (...args) => isDevelopment && console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

/**
 * GeotabService - Handles MyGeotab API integration for vehicle tracking
 */
export class GeotabService {
    constructor() {
        this.api = null;
        this.isAuthenticated = false;
        this.config = getGeotabConfig();
        this.feedIntervals = new Map();
        this.connectionRetries = 0;
        this.lastTruckData = null;
        this.lastUpdateTime = null;
        this.lastApiCallTime = 0;
        this.isRateLimited = false;
        this.rateLimitResetTime = 0;
        this.authRetryCount = 0;

        // Initialize GeotabApi if needed
        this.initializeApi();
    }

    /**
 * Initialize the GeotabApi instance
 */
    async initializeApi() {
        if (!this.config.enabled) {
            log.info('🚛 GeotabService is disabled');
            return;
        }

        try {
            // Dynamically import mg-api-js only when needed
            const { default: GeotabApi } = await import('mg-api-js');

            const authentication = {
                credentials: {
                    database: this.config.database,
                    userName: this.config.username,
                    password: this.config.password
                }
            };

            this.api = new GeotabApi(authentication, {
                rememberMe: this.config.rememberMe,
                timeout: Math.floor(this.config.timeout / 1000) // Convert to seconds
            });

            log.info('🚛 GeotabApi initialized');
        } catch (error) {
            log.error('❌ Failed to initialize GeotabApi:', error);
            log.error('🚛 GeotabService initialization failed - API not available');
        }
    }

    /**
     * Check if we're currently rate limited
     */
    isCurrentlyRateLimited() {
        if (!this.isRateLimited) return false;

        const now = Date.now();
        if (now > this.rateLimitResetTime) {
            this.isRateLimited = false;
            this.rateLimitResetTime = 0;
            return false;
        }

        return true;
    }

    /**
     * Handle rate limiting error
     */
    handleRateLimitError(error) {
        if (error.message && error.message.includes('OverLimitException')) {
            this.isRateLimited = true;
            // Rate limit resets after 1 minute, add buffer
            this.rateLimitResetTime = Date.now() + (70 * 1000); // 70 seconds
            log.warn('⚠️ MyGeotab API rate limit exceeded. Waiting 70 seconds before retry...');
            return true;
        }
        return false;
    }

    /**
     * Initialize and authenticate with MyGeotab
     */
    async initialize() {
        if (!this.config.enabled) {
            log.info('🚛 GeotabService is disabled');
            return false;
        }

        // Check if we're rate limited
        if (this.isCurrentlyRateLimited()) {
            log.warn('⚠️ Currently rate limited, skipping authentication attempt');
            return false;
        }

        try {
            if (!this.api) {
                await this.initializeApi();
            }

            if (this.api) {
                log.info('🚛 Authenticating with MyGeotab...');
                await this.api.authenticate();
                this.isAuthenticated = true;
                this.connectionRetries = 0;
                this.authRetryCount = 0;
                log.info('✅ GeotabService authenticated successfully');
                return true;
            }
        } catch (error) {
            log.error('❌ GeotabService authentication failed:', error);
            this.isAuthenticated = false;

            // Handle rate limiting specifically
            if (this.handleRateLimitError(error)) {
                // Don't count rate limit errors as connection retries
                setTimeout(() => this.initialize(), 70000); // Wait 70 seconds
                return false;
            }

            this.connectionRetries++;
            this.authRetryCount++;

            if (this.connectionRetries < this.config.maxRetries) {
                // Use exponential backoff for retries
                const backoffDelay = this.config.retryDelay * Math.pow(2, this.authRetryCount - 1);
                log.info(`🔄 Retrying authentication (${this.connectionRetries}/${this.config.maxRetries}) in ${backoffDelay / 1000}s...`);
                setTimeout(() => this.initialize(), backoffDelay);
            } else {
                log.error('🚛 Max retries reached, GeotabService authentication failed permanently');
                this.isAuthenticated = false;
            }
        }

        return this.isAuthenticated;
    }

    /**
     * Get all devices from MyGeotab
     */
    async getDevices() {
        if (!this.isAuthenticated || !this.api) {
            throw new Error('GeotabService not authenticated');
        }

        try {
            return await this.api.call('Get', {
                typeName: 'Device'
            });
        } catch (error) {
            log.error('❌ Failed to get devices:', error);
            throw error;
        }
    }

    /**
     * Get device status information
     */
    async getDeviceStatus(deviceIds = null) {
        if (!this.isAuthenticated || !this.api) {
            throw new Error('GeotabService not authenticated');
        }

        try {
            const params = {
                typeName: 'DeviceStatusInfo'
            };

            if (deviceIds?.length > 0) {
                params.search = {
                    deviceSearch: { id: deviceIds }
                };
            }

            return await this.api.call('Get', params);
        } catch (error) {
            log.error('❌ Failed to get device status:', error);
            throw error;
        }
    }

    /**
     * Get processed truck data categorized by type
     */
    async getTruckData() {
        // Check if we're rate limited
        if (this.isCurrentlyRateLimited()) {
            log.warn('⚠️ Currently rate limited, returning cached data if available');
            if (this.lastTruckData) {
                return this.lastTruckData;
            }
            // If no cached data available during rate limit, return empty data
            log.warn('⚠️ No cached data available during rate limit, returning empty data');
            return { fiber: [], electric: [] };
        }

        if (!this.isAuthenticated) {
            await this.initialize();
        }

        // Double-check authentication after potential rate limit during initialize
        if (!this.isAuthenticated) {
            log.warn('⚠️ GeotabService not authenticated, returning cached data if available');
            if (this.lastTruckData) {
                return this.lastTruckData;
            }
            // No authentication and no cached data - return empty
            log.warn('⚠️ No authentication and no cached data available, returning empty data');
            return { fiber: [], electric: [] };
        }

        try {
            // Get devices and status in parallel
            const [devices, statusData] = await Promise.all([
                this.getDevices(),
                this.getDeviceStatus()
            ]);

            // Create lookup map for status data
            const statusMap = new Map();
            statusData.forEach(status => {
                if (status.device?.id) {
                    statusMap.set(status.device.id, status);
                }
            });

            const fiberTrucks = [];
            const electricTrucks = [];

            devices.forEach(device => {
                if (!device.name) return;

                const status = statusMap.get(device.id);
                if (!status?.latitude || !status?.longitude) return;

                // Convert speed from m/s to mph
                const speedMph = Math.round((status.speed || 0) * 0.621371);

                const truckData = {
                    id: device.id,
                    name: device.name,
                    latitude: parseFloat(status.latitude),
                    longitude: parseFloat(status.longitude),
                    installer: device.comment || device.name,
                    speed: speedMph,
                    is_driving: speedMph > TRUCK_LAYER_DEFAULTS.speedThreshold,
                    last_updated: status.dateTime || new Date().toISOString(),
                    bearing: parseFloat(status.bearing || 0),
                    communication_status: status.isDeviceCommunicating ? 'Online' : 'Offline',
                    vehicle_type: this.categorizeVehicle(device.name)
                };

                // Categorize based on name
                if (truckData.vehicle_type === 'fiber') {
                    fiberTrucks.push(truckData);
                } else {
                    electricTrucks.push(truckData);
                }
            });

            const result = { fiber: fiberTrucks, electric: electricTrucks };
            this.lastTruckData = result;
            this.lastUpdateTime = new Date();

            log.info(`✅ Fetched ${fiberTrucks.length} fiber trucks and ${electricTrucks.length} electric trucks`);
            return result;
        } catch (error) {
            log.error('❌ Failed to get truck data:', error);

            // Handle rate limiting errors
            if (this.handleRateLimitError(error)) {
                // Return cached data if available during rate limit
                if (this.lastTruckData) {
                    log.warn('⚠️ Using cached truck data due to rate limit');
                    return this.lastTruckData;
                }
                // If no cached data, return empty data during rate limit
                log.warn('⚠️ No cached data available during rate limit, returning empty data');
                return { fiber: [], electric: [] };
            }

            // Return cached data if available for other errors
            if (this.lastTruckData) {
                log.warn('⚠️ Using cached truck data due to fetch error');
                return this.lastTruckData;
            }

            // No cached data available and error occurred
            log.error('❌ No cached data available and API error occurred');
            throw error;
        }
    }

    /**
     * Categorize vehicle based on name
     */
    categorizeVehicle(name) {
        const nameLower = name.toLowerCase();
        if (nameLower.includes('fiber') || nameLower.includes('cable')) {
            return 'fiber';
        }
        return 'electric'; // Default to electric
    }

    /**
     * Setup real-time data feed with polling
     */
    async setupRealtimeDataFeed(callback) {
        if (!callback || typeof callback !== 'function') {
            throw new Error('Callback function is required');
        }

        const config = this.config;
        let updateCount = 0;

        log.info(`🔄 Starting real-time truck data feed (${config.refreshInterval}ms interval)`);

        const pollForUpdates = async () => {
            try {
                const truckData = await this.getTruckData();

                updateCount++;
                callback([{
                    data: truckData,
                    type: 'truck_data',
                    timestamp: new Date().toISOString(),
                    updateCount: updateCount
                }]);

                if (isDevelopment && updateCount % 10 === 0) {
                    log.info(`📊 Truck data updates: ${updateCount}`);
                }
            } catch (error) {
                log.error('❌ Error in real-time feed polling:', error);

                // Notify callback of error
                callback([{
                    data: null,
                    type: 'truck_data_error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                }]);
            }
        };

        // Initial call
        await pollForUpdates();

        // Set up interval
        const intervalId = setInterval(pollForUpdates, config.refreshInterval);
        this.feedIntervals.set('main_feed', intervalId);

        log.info('✅ Real-time truck data feed started');

        return {
            intervalId,
            stop: () => {
                clearInterval(intervalId);
                this.feedIntervals.delete('main_feed');
                log.info('🛑 Real-time truck data feed stopped');
            }
        };
    }

    /**
     * Test connection to MyGeotab
     */
    async testConnection() {
        if (!this.config.enabled) {
            return {
                success: false,
                message: 'GeotabService is disabled'
            };
        }

        try {
            await this.initialize();

            if (this.isAuthenticated) {
                // Try to get a small amount of data
                const devices = await this.getDevices();
                return {
                    success: true,
                    message: `Connected successfully. Found ${devices.length} devices.`,
                    deviceCount: devices.length
                };
            } else {
                return {
                    success: false,
                    message: 'Authentication failed'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error
            };
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            authenticated: this.isAuthenticated,
            lastUpdate: this.lastUpdateTime,
            activeFeedCount: this.feedIntervals.size,
            connectionRetries: this.connectionRetries,
            rateLimited: this.isRateLimited,
            rateLimitResetTime: this.rateLimitResetTime,
            config: {
                refreshInterval: this.config.refreshInterval,
                timeout: this.config.timeout,
                fallbackToSupabase: this.config.fallbackToSupabase,
                maxRetries: this.config.maxRetries,
                retryDelay: this.config.retryDelay
            }
        };
    }

    /**
     * Stop all real-time feeds
     */
    stopAllFeeds() {
        this.feedIntervals.forEach((intervalId, key) => {
            clearInterval(intervalId);
            log.info(`🛑 Stopped feed: ${key}`);
        });
        this.feedIntervals.clear();
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopAllFeeds();
        this.isAuthenticated = false;
        this.api = null;
        this.lastTruckData = null;
        this.lastUpdateTime = null;
        log.info('🧹 GeotabService cleanup completed');
    }
}

// Export singleton instance
export const geotabService = new GeotabService(); 