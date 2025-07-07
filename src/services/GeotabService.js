// GeotabService.js - MyGeotab API integration service
import { getGeotabConfig, getMockTruckData, TRUCK_LAYER_DEFAULTS } from '../config/geotabConfig.js';

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

        // Initialize GeotabApi if needed
        this.initializeApi();
    }

    /**
 * Initialize the GeotabApi instance
 */
    async initializeApi() {
        if (this.config.mockMode || !this.config.enabled) {
            log.info('🚛 GeotabService running in mock mode');
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
            log.warn('🚛 Falling back to mock mode');
            this.config.mockMode = true;
        }
    }

    /**
     * Initialize and authenticate with MyGeotab
     */
    async initialize() {
        if (this.config.mockMode) {
            this.isAuthenticated = true;
            log.info('🚛 GeotabService initialized in mock mode');
            return true;
        }

        if (!this.config.enabled) {
            log.info('🚛 GeotabService is disabled');
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
                log.info('✅ GeotabService authenticated successfully');
                return true;
            }
        } catch (error) {
            log.error('❌ GeotabService authentication failed:', error);
            this.isAuthenticated = false;
            this.connectionRetries++;

            if (this.connectionRetries < this.config.maxRetries) {
                log.info(`🔄 Retrying authentication (${this.connectionRetries}/${this.config.maxRetries})...`);
                setTimeout(() => this.initialize(), this.config.retryDelay);
            } else {
                log.warn('🚛 Max retries reached, falling back to mock mode');
                this.config.mockMode = true;
                this.isAuthenticated = true;
            }
        }

        return this.isAuthenticated;
    }

    /**
     * Get all devices from MyGeotab
     */
    async getDevices() {
        if (this.config.mockMode) {
            // Return mock devices
            return [
                { id: 'fiber-001', name: 'Fiber Truck 1', comment: 'John Smith' },
                { id: 'fiber-002', name: 'Fiber Truck 2', comment: 'Sarah Johnson' },
                { id: 'electric-001', name: 'Electric Truck 1', comment: 'Mike Wilson' },
                { id: 'electric-002', name: 'Electric Truck 2', comment: 'Lisa Davis' }
            ];
        }

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
        if (this.config.mockMode) {
            // Return mock device status
            const mockData = getMockTruckData();
            const allTrucks = [...mockData.fiber, ...mockData.electric];

            return allTrucks.map(truck => ({
                device: { id: truck.id },
                latitude: truck.latitude,
                longitude: truck.longitude,
                speed: truck.speed / 0.621371, // Convert from mph to m/s
                bearing: truck.bearing,
                dateTime: truck.last_updated,
                isDeviceCommunicating: truck.communication_status === 'Online'
            }));
        }

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
        if (this.config.mockMode) {
            const mockData = getMockTruckData();
            this.lastTruckData = mockData;
            this.lastUpdateTime = new Date();
            return mockData;
        }

        if (!this.isAuthenticated) {
            await this.initialize();
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

            // Return cached data if available
            if (this.lastTruckData) {
                log.warn('⚠️ Using cached truck data due to fetch error');
                return this.lastTruckData;
            }

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
        if (this.config.mockMode) {
            return {
                success: true,
                message: 'Mock mode - connection test passed',
                mockMode: true
            };
        }

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
            mockMode: this.config.mockMode,
            lastUpdate: this.lastUpdateTime,
            activeFeedCount: this.feedIntervals.size,
            connectionRetries: this.connectionRetries,
            config: {
                refreshInterval: this.config.refreshInterval,
                timeout: this.config.timeout,
                fallbackToSupabase: this.config.fallbackToSupabase
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