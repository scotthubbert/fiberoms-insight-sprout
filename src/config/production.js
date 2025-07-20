/**
 * Production Configuration
 * Optimizes settings for production deployment
 */

export const productionConfig = {
    // Disable debug features in production
    enableDebugFunctions: false,
    enableTestButtons: false,
    enableVerboseLogging: false,

    // Performance optimizations
    enableCaching: true,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes

    // Error handling
    enableErrorTracking: true,
    enableUserFeedback: true,

    // Update intervals (in milliseconds)
    pollingIntervals: {
        powerOutages: 60 * 1000,    // 1 minute
        vehicles: 5 * 60 * 1000,    // 5 minutes  
        subscribers: 2 * 60 * 1000  // 2 minutes
    },

    // Service worker
    enableServiceWorker: true,

    // Analytics (when implemented)
    enableAnalytics: false,

    // Version checking
    enableVersionCheck: true,

    // Memory management
    enableMemoryOptimizations: true
};

// Apply production optimizations
export function applyProductionOptimizations() {
    // Remove debug functions from window object if they exist
    if (typeof window !== 'undefined' && !productionConfig.enableDebugFunctions) {
        delete window.debugVehicles;
        delete window.debugVehicleListProduction;
        delete window.testCalciteUIComponents;
        delete window.diagnoseCalciteUIAssets;
        delete window.debugCalciteUIComponents;
    }

    // Hide test buttons
    if (!productionConfig.enableTestButtons) {
        const testButtons = [
            'test-subscriber-update',
            'test-outage-update'
        ];

        testButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.style.display = 'none';
                button.remove();
            }
        });
    }
}

// Optimize console logging for production
export function optimizeLogging() {
    if (!productionConfig.enableVerboseLogging && typeof window !== 'undefined') {
        // Keep only warnings and errors in production
        const originalLog = console.log;
        console.log = (...args) => {
            // Only log if it's a critical message (contains error/warn keywords) or in development
            const message = args.join(' ').toLowerCase();
            if (import.meta.env.DEV || message.includes('error') || message.includes('warn') || message.includes('failed')) {
                originalLog.apply(console, args);
            }
        };
    }
}

export default productionConfig; 