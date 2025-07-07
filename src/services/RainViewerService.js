// RainViewerService.js - Single Responsibility: RainViewer API integration
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';

export class RainViewerService {
    constructor() {
        this.apiUrl = 'https://api.rainviewer.com/public/weather-maps.json';
        this.host = 'https://tilecache.rainviewer.com';
        this.radarData = null;
        this.currentLayer = null;
        this.refreshInterval = null;

        // RainViewer settings
        this.settings = {
            size: 512,        // tile size (256 or 512)
            color: 2,         // color scheme (0-8)
            smooth: 1,        // smoothing (0 or 1)
            snow: 1,          // show snow (0 or 1)
            opacity: 0.8      // layer opacity
        };

        // Theme-specific settings
        this.themeSettings = {
            light: {
                opacity: 0.5,
                blendMode: 'multiply'
            },
            dark: {
                opacity: 0.75,
                blendMode: 'normal'  // Use normal blend mode in dark theme
            }
        };
    }

    /**
     * Initialize the service and fetch initial radar data
     */
    async initialize() {
        try {
            console.log('🌧️ Initializing RainViewer service...');
            const data = await this.fetchRadarData();

            if (data) {
                console.log('✅ RainViewer service initialized successfully');
                return true;
            } else {
                console.warn('⚠️ RainViewer service initialized with limited functionality (API unavailable)');
                return true; // Still return true to allow app to continue
            }
        } catch (error) {
            console.warn('⚠️ RainViewer service initialization failed (non-critical):', error.message);
            return true; // Don't block app startup
        }
    }

    /**
     * Fetch current radar data from RainViewer API
     */
    async fetchRadarData() {
        try {
            // Add timeout and better error handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            // Add cache-busting parameter to ensure fresh data
            const url = new URL(this.apiUrl);
            url.searchParams.set('_t', Date.now());

            const response = await fetch(url.toString(), {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`⚠️ RainViewer API returned ${response.status}: ${response.statusText}`);
                return null;
            }

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.warn('⚠️ RainViewer API returned non-JSON response:', text.substring(0, 100));
                return null;
            }

            const data = await response.json();

            // Validate the response structure
            if (!data || !data.radar || !data.radar.past || !Array.isArray(data.radar.past)) {
                console.warn('⚠️ RainViewer API returned invalid data structure');
                return null;
            }

            this.radarData = data;
            console.log('✅ RainViewer data loaded successfully');
            return this.radarData;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('⚠️ RainViewer API request timeout');
            } else {
                console.warn('⚠️ RainViewer API request failed (non-critical):', error.message);
            }
            // Always return null instead of throwing to prevent app crashes
            return null;
        }
    }

    /**
 * Get current theme from global theme manager
 */
    getCurrentTheme() {
        return window.themeManager?.currentTheme || 'light';
    }

    /**
     * Get theme-specific settings
     */
    getThemeSettings() {
        const currentTheme = this.getCurrentTheme();
        return this.themeSettings[currentTheme] || this.themeSettings.light;
    }

    /**
     * Create a WebTileLayer for the latest radar frame
     */
    createRadarLayer() {
        if (!this.radarData?.radar?.past?.length) {
            console.warn('⚠️ No radar data available for layer creation');
            return null;
        }

        // Get theme-specific settings
        const themeSettings = this.getThemeSettings();

        // Get the latest radar frame
        const latestFrame = this.radarData.radar.past[this.radarData.radar.past.length - 1];
        const baseUrl = `${this.radarData.host}${latestFrame.path}`;

        // Construct tile URL template
        const urlTemplate = `${baseUrl}/${this.settings.size}/{level}/{col}/{row}/${this.settings.color}/${this.settings.smooth}_${this.settings.snow}.png`;

        const layer = new WebTileLayer({
            id: 'rainviewer-radar',
            title: 'Weather Radar',
            urlTemplate: urlTemplate,
            opacity: themeSettings.opacity,
            visible: false, // Start hidden
            copyright: 'Rain Viewer API',
            listMode: 'hide', // Hide from layer list since it's controlled via Tools
            blendMode: themeSettings.blendMode
        });

        // Add metadata
        layer.set('radarFrameTime', latestFrame.time);
        layer.set('radarFrameTimeString', new Date(latestFrame.time * 1000).toLocaleString());

        this.currentLayer = layer;

        return layer;
    }

    /**
     * Update the radar layer with the latest data
     */
    async updateRadarLayer() {
        if (!this.currentLayer) {
            console.warn('⚠️ No radar layer to update');
            return false;
        }

        try {
            await this.fetchRadarData();

            if (!this.radarData?.radar?.past?.length) {
                console.warn('⚠️ No radar data available for update');
                return false;
            }

            // Get the latest frame
            const latestFrame = this.radarData.radar.past[this.radarData.radar.past.length - 1];
            const baseUrl = `${this.radarData.host}${latestFrame.path}`;
            const urlTemplate = `${baseUrl}/${this.settings.size}/{level}/{col}/{row}/${this.settings.color}/${this.settings.smooth}_${this.settings.snow}.png`;

            // Update the layer's URL template
            this.currentLayer.urlTemplate = urlTemplate;
            this.currentLayer.set('radarFrameTime', latestFrame.time);
            this.currentLayer.set('radarFrameTimeString', new Date(latestFrame.time * 1000).toLocaleString());


            return true;
        } catch (error) {
            console.error('❌ Failed to update radar layer:', error);
            return false;
        }
    }

    /**
     * Start automatic radar updates
     */
    startAutoUpdate(intervalMinutes = 10) {
        this.stopAutoUpdate(); // Clear any existing interval

        const intervalMs = intervalMinutes * 60 * 1000;
        this.refreshInterval = setInterval(async () => {
            if (this.currentLayer?.visible) {
                await this.updateRadarLayer();
            }
        }, intervalMs);

    }

    /**
     * Stop automatic radar updates
     */
    stopAutoUpdate() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Update layer based on current theme
     */
    updateTheme() {
        if (!this.currentLayer) return;

        const themeSettings = this.getThemeSettings();

        this.currentLayer.opacity = themeSettings.opacity;
        this.currentLayer.blendMode = themeSettings.blendMode;

    }

    /**
     * Set radar layer opacity (theme-aware)
     */
    setOpacity(opacity) {
        if (this.currentLayer) {
            this.currentLayer.opacity = opacity;

            // Update theme settings to maintain custom opacity
            const currentTheme = this.getCurrentTheme();
            this.themeSettings[currentTheme].opacity = opacity;

        }
    }

    /**
     * Toggle radar layer visibility
     */
    toggleVisibility(visible) {
        if (this.currentLayer) {
            this.currentLayer.visible = visible;

            if (visible) {
                // Start auto-updates when visible
                this.startAutoUpdate();
                // Update immediately
                this.updateRadarLayer();
            } else {
                // Stop auto-updates when hidden
                this.stopAutoUpdate();
            }

            return true;
        }
        return false;
    }

    /**
     * Get current radar frame information
     */
    getCurrentFrameInfo() {
        if (!this.currentLayer) return null;

        return {
            time: this.currentLayer.get('radarFrameTime'),
            timeString: this.currentLayer.get('radarFrameTimeString'),
            opacity: this.currentLayer.opacity,
            visible: this.currentLayer.visible
        };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.stopAutoUpdate();
        this.currentLayer = null;
        this.radarData = null;
    }
} 