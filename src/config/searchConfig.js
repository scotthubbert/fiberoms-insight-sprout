// searchConfig.js - Geographic search configuration for different service areas
// This file centralizes search widget bounds and related settings for easy deployment across different regions

/**
 * Service area configuration for search widget bounds and map constraints
 * 
 * Usage:
 * - Update CURRENT_SERVICE_AREA to match your deployment region
 * - Add new service areas to SERVICE_AREAS object as needed
 * - Search widget will automatically use these bounds to prefer local results
 */

// Available service area configurations
const SERVICE_AREAS = {
    // Alabama Power Company service area (current deployment)
    alabama_apco: {
        name: 'Alabama Power Company Service Area',
        region: 'Alabama, USA',
        bounds: {
            xmin: -88.3319638467807,   // Western bound (SW longitude)
            ymin: 33.440523708494564,  // Southern bound (SW latitude)
            xmax: -87.35488507018964,  // Eastern bound (NE longitude)
            ymax: 34.73445506886154,   // Northern bound (NE latitude)
            spatialReference: { wkid: 4326 } // WGS84
        },
        center: {
            latitude: 34.087489,  // Calculated center latitude
            longitude: -87.843374 // Calculated center longitude
        },
        searchSettings: {
            maxResults: 8,
            minCharacters: 3,
            includeDefaultSources: true,
            searchAllEnabled: false,
            placeholder: 'Search addresses, places...'
        }
    },

    // Example: Georgia service area (template for future deployments)
    georgia_example: {
        name: 'Georgia Service Area Example',
        region: 'Georgia, USA',
        bounds: {
            xmin: -85.605166,  // Example bounds for Georgia
            ymin: 30.357851,
            xmax: -80.839729,
            ymax: 35.000659,
            spatialReference: { wkid: 4326 }
        },
        center: {
            latitude: 32.678948,
            longitude: -83.222447
        },
        searchSettings: {
            maxResults: 8,
            minCharacters: 3,
            includeDefaultSources: true,
            searchAllEnabled: false,
            placeholder: 'Search addresses, places...'
        }
    },

    // Example: Texas service area (template for future deployments)
    texas_example: {
        name: 'Texas Service Area Example',
        region: 'Texas, USA',
        bounds: {
            xmin: -106.645646,  // Example bounds for Texas
            ymin: 25.837377,
            xmax: -93.508292,
            ymax: 36.500704,
            spatialReference: { wkid: 4326 }
        },
        center: {
            latitude: 31.169058,
            longitude: -100.076969
        },
        searchSettings: {
            maxResults: 10,
            minCharacters: 3,
            includeDefaultSources: true,
            searchAllEnabled: false,
            placeholder: 'Search addresses, places...'
        }
    },

    // Global fallback (no geographic constraints)
    global: {
        name: 'Global Search (No Geographic Constraints)',
        region: 'Worldwide',
        bounds: null, // No bounds restriction
        center: {
            latitude: 39.8283, // Center of continental US
            longitude: -98.5795
        },
        searchSettings: {
            maxResults: 6,
            minCharacters: 3,
            includeDefaultSources: true,
            searchAllEnabled: true,
            placeholder: 'Search addresses, places worldwide...'
        }
    }
};

// Current deployment configuration - CHANGE THIS FOR DIFFERENT DEPLOYMENTS
const CURRENT_SERVICE_AREA = 'alabama_apco';

// Optional extent buffer (in degrees) to extend map constraints beyond service area
// Set to 0 for no buffer. Recommended small buffer like 0.5-1.0 degrees if vehicles roam outside.
const SERVICE_AREA_BUFFER_DEGREES = 1.5;

/**
 * Get the current service area configuration
 * @returns {Object} Current service area configuration object
 */
export function getCurrentServiceArea() {
    const config = SERVICE_AREAS[CURRENT_SERVICE_AREA];
    if (!config) {
        console.warn(`Service area '${CURRENT_SERVICE_AREA}' not found, falling back to global`);
        return SERVICE_AREAS.global;
    }
    return config;
}

/**
 * Get service area bounds for map constraints
 * @returns {Object|null} Bounds object or null for global
 */
export function getServiceAreaBounds() {
    const base = getCurrentServiceArea().bounds;
    if (!base) return null;
    const buf = Number.isFinite(SERVICE_AREA_BUFFER_DEGREES) ? SERVICE_AREA_BUFFER_DEGREES : 0;
    if (buf <= 0) return base;
    return {
        xmin: base.xmin - buf,
        ymin: base.ymin - buf,
        xmax: base.xmax + buf,
        ymax: base.ymax + buf,
        spatialReference: base.spatialReference
    };
}

/**
 * Get the base (unbuffered) service area bounds
 * @returns {Object|null}
 */
export function getServiceAreaBoundsBase() {
    return getCurrentServiceArea().bounds;
}

/**
 * Get service area center point
 * @returns {Object} Center coordinates {latitude, longitude}
 */
export function getServiceAreaCenter() {
    return getCurrentServiceArea().center;
}

/**
 * Get search widget configuration settings
 * @returns {Object} Search widget settings
 */
export function getSearchSettings() {
    return getCurrentServiceArea().searchSettings;
}

/**
 * Get all available service areas (for admin interfaces)
 * @returns {Object} All service area configurations
 */
export function getAllServiceAreas() {
    return SERVICE_AREAS;
}

/**
 * Validate service area configuration
 * @param {string} areaKey - Service area key to validate
 * @returns {boolean} True if valid configuration
 */
export function validateServiceArea(areaKey) {
    const area = SERVICE_AREAS[areaKey];
    if (!area) return false;

    // Check required properties
    const required = ['name', 'region', 'center', 'searchSettings'];
    return required.every(prop => area.hasOwnProperty(prop));
}

/**
 * Get deployment info for debugging/admin purposes
 * @returns {Object} Current deployment information
 */
export function getDeploymentInfo() {
    const currentArea = getCurrentServiceArea();
    return {
        serviceAreaKey: CURRENT_SERVICE_AREA,
        serviceAreaName: currentArea.name,
        region: currentArea.region,
        hasBounds: !!currentArea.bounds,
        center: currentArea.center,
        bufferDegrees: SERVICE_AREA_BUFFER_DEGREES
    };
}

// Export constants for external access
export { SERVICE_AREAS, CURRENT_SERVICE_AREA, SERVICE_AREA_BUFFER_DEGREES };