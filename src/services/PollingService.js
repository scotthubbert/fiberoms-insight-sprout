// PollingService.js - Handles periodic data updates for layers

export class PollingService {
    constructor(layerManager) {
        this.layerManager = layerManager;
        this.pollingTimers = {};
        this.pollingIntervals = {
            offlineSubscribers: 30000,  // 30 seconds for critical offline data
            onlineSubscribers: 300000,  // 5 minutes for online data
            vehicles: 10000,            // 10 seconds for real-time vehicle tracking
            outages: 60000              // 1 minute for outage data
        };

        window.addEventListener('beforeunload', () => this.cleanup());
    }

    startPolling(layerName) {
        // Polling disabled for Phase 1 - will implement in Phase 2
        return;
    }

    stopPolling(layerName) {
        if (this.pollingTimers[layerName]) {
            clearInterval(this.pollingTimers[layerName]);
            delete this.pollingTimers[layerName];
        }
    }

    async updateLayerData(layerName) {
        // Delegate to LayerManager
        return this.layerManager.updateLayerData(layerName);
    }

    cleanup() {
        Object.keys(this.pollingTimers).forEach(layerName => {
            this.stopPolling(layerName);
        });
    }
}

export default PollingService;

