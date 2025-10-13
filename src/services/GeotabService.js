// GeotabService.js - MyGeotab API integration service
import { getGeotabConfig, TRUCK_LAYER_DEFAULTS } from '../config/geotabConfig.js';
import { createLogger } from '../utils/logger.js';

// Initialize logger for this module
const log = createLogger('GeotabService');

// Try to import GeotabApi, but handle errors gracefully
let GeotabApi = null;
try {
    // Note: mg-api-js may not be compatible with ES modules in browser
    // This will be handled in initializeApi method
} catch (error) {
    log.warn('GeotabApi not available in browser environment:', error);
}

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
        this.isCurrentlyFetching = false;
        this.pendingPromise = null;

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
            log.info('✅ Rate limit expired, ready for new API calls');
            // Try to re-authenticate after rate limit expires
            if (!this.isAuthenticated) {
                setTimeout(() => {
                    log.info('🔄 Attempting re-authentication after rate limit expiry');
                    this.initialize();
                }, 1000); // Small delay to avoid immediate retry
            }
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
            // Rate limit resets after 1 minute, add significant buffer
            this.rateLimitResetTime = Date.now() + (120 * 1000); // 2 minutes buffer
            console.warn('⚠️ MyGeotab API rate limit exceeded. Waiting 2 minutes before retry...');
            console.warn('⚠️ Rate limit will reset at:', new Date(this.rateLimitResetTime).toLocaleTimeString());
            return true;
        }
        return false;
    }

    /**
     * Initialize and authenticate with MyGeotab
     */
    async initialize() {
        if (!this.config.enabled) {
            log.info('🚛 GeotabService is disabled in config');
            return false;
        }

        // Check if we're rate limited
        if (this.isCurrentlyRateLimited()) {
            const timeRemaining = Math.ceil((this.rateLimitResetTime - Date.now()) / 1000);
            console.warn(`⚠️ Currently rate limited, skipping authentication attempt. ${timeRemaining}s remaining.`);
            return false;
        }

        try {
            log.info('🚛 Starting authentication process...');

            if (!this.api) {
                log.info('🚛 No API found, initializing...');
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
            } else {
                log.error('❌ No API available after initialization');
            }
        } catch (error) {
            log.error('❌ GeotabService authentication failed:', error);
            this.isAuthenticated = false;

            // Handle rate limiting specifically
            if (this.handleRateLimitError(error)) {
                // Don't count rate limit errors as connection retries
                console.warn('⚠️ Authentication failed due to rate limiting, will retry when rate limit expires');
                // Don't retry immediately - wait for rate limit to expire
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
            const result = await this.api.call('Get', {
                typeName: 'Device'
            });
            console.log('🚛 getDevices result:', Array.isArray(result) ? `${result.length} devices` : typeof result);
            return result;
        } catch (error) {
            log.error('❌ Failed to get devices:', error);
            console.error('🚛 getDevices error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
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

            const result = await this.api.call('Get', params);
            console.log('🚛 getDeviceStatus result:', Array.isArray(result) ? `${result.length} status records` : typeof result);
            return result;
        } catch (error) {
            log.error('❌ Failed to get device status:', error);
            console.error('🚛 getDeviceStatus error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            throw error;
        }
    }

    /**
     * Get processed truck data categorized by type
     */
    async getTruckData() {
        log.info('🚛 getTruckData called at', new Date().toLocaleTimeString());

        // If already fetching, return the pending promise to avoid duplicate calls
        if (this.isCurrentlyFetching && this.pendingPromise) {
            log.info('🔄 getTruckData already in progress, returning pending promise');
            return this.pendingPromise;
        }

        // Check if we have fresh cached data (less than 60 seconds old)
        const cacheMaxAge = 60000; // 60 seconds - longer cache to reduce API calls
        if (this.lastTruckData && this.lastUpdateTime) {
            const age = Date.now() - this.lastUpdateTime.getTime();
            if (age < cacheMaxAge) {
                log.info(`🚛 Using fresh cached truck data (${Math.round(age / 1000)}s old)`);
                return this.lastTruckData;
            } else {
                log.info(`🚛 Cached data too old (${Math.round(age / 1000)}s), fetching fresh`);
            }
        } else {
            log.info('🚛 No cached data available, fetching fresh');
        }

        // Check if we're rate limited
        if (this.isCurrentlyRateLimited()) {
            const timeRemaining = Math.ceil((this.rateLimitResetTime - Date.now()) / 1000);
            console.warn(`⚠️ Currently rate limited, ${timeRemaining}s remaining. Returning cached data if available.`);
            if (this.lastTruckData) {
                console.warn('⚠️ Returning cached truck data during rate limit');
                return this.lastTruckData;
            }
            // If no cached data available during rate limit, return empty data
            console.warn('⚠️ No cached data available during rate limit, returning empty data');
            return { fiber: [], electric: [] };
        }

        // Set fetching flag and create the promise
        this.isCurrentlyFetching = true;
        this.pendingPromise = this._fetchTruckDataInternal();

        try {
            const result = await this.pendingPromise;
            return result;
        } finally {
            // Clear fetching state
            this.isCurrentlyFetching = false;
            this.pendingPromise = null;
        }
    }

    /**
     * Internal method to actually fetch truck data from MyGeotab
     * @private
     */
    async _fetchTruckDataInternal() {
        log.info('🚛 _fetchTruckDataInternal called');

        if (!this.isAuthenticated) {
            log.info('🚛 Not authenticated, trying to initialize...');
            await this.initialize();
        }

        // Double-check authentication after potential rate limit during initialize
        if (!this.isAuthenticated) {
            log.warn('⚠️ GeotabService not authenticated, returning cached data if available');
            if (this.lastTruckData) {
                log.info('🚛 Returning cached data due to no auth');
                return this.lastTruckData;
            }
            // No authentication and no cached data - return empty
            log.warn('⚠️ No authentication and no cached data available, returning empty data');
            return { fiber: [], electric: [] };
        }

        try {
            log.info('🚛 Fetching fresh truck data from MyGeotab API...');

            // Get devices and status in parallel
            const [devices, statusData] = await Promise.all([
                this.getDevices(),
                this.getDeviceStatus()
            ]);

            log.info('🚛 API calls completed');
            log.info('🚛 Devices received:', devices?.length || 0);
            log.info('🚛 Status data received:', statusData?.length || 0);

            // Create lookup map for status data
            const statusMap = new Map();
            statusData.forEach(status => {
                if (status.device?.id) {
                    statusMap.set(status.device.id, status);
                }
            });

            log.info('🚛 Status map created with', statusMap.size, 'entries');

            const fiberTrucks = [];
            const electricTrucks = [];

            log.info('🚛 Processing devices...');
            devices.forEach((device, index) => {
                if (!device.name) {
                    log.info(`🚛 Skipping device ${index + 1} - no name`);
                    return;
                }

                const status = statusMap.get(device.id);
                if (!status?.latitude || !status?.longitude) {
                    log.info(`🚛 Skipping device ${device.name} - no location data`, {
                        hasStatus: !!status,
                        lat: status?.latitude,
                        lng: status?.longitude
                    });
                    return;
                }

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
        this.isCurrentlyFetching = false;
        this.pendingPromise = null;
        log.info('🧹 GeotabService cleanup completed');
    }
}

// Export singleton instance
export const geotabService = new GeotabService(); 