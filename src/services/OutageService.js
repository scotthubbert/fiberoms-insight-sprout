import { createLogger } from '../utils/logger.js';
import { geoJSONTransformService } from './GeoJSONTransformService.js';
import { API_CONFIG } from '../config/apiConfig.js';

const log = createLogger('OutageService');

export class OutageService {
    // Get Cullman Electric power outages from Supabase storage - REALTIME (no caching)
    async getCullmanOutages() {
        try {
            // Check if URL is configured
            if (!API_CONFIG.OUTAGES?.CULLMAN) {
                log.warn('⚠️ Cullman outages URL not configured, returning empty result');
                return {
                    count: 0,
                    data: [],
                    features: [],
                    lastUpdated: new Date().toISOString(),
                    fromCache: false
                };
            }

            log.info('📡 Fetching Cullman Electric power outages from Supabase storage... (realtime - no cache)');

            let geojsonData;

            // Direct fetch from Supabase public URL
            const response = await fetch(API_CONFIG.OUTAGES.CULLMAN);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            geojsonData = await response.json();
            log.info('✅ Loaded Cullman outages from Supabase public URL');

            // Extract features and properties - handle Cullman direct format (CEC)
            const features = geojsonData.features || [];
            const outageData = features.map(feature => {
                const props = feature.properties || {};

                // Extract coordinates based on geometry type
                let latitude, longitude;
                if (feature.geometry.type === 'Point') {
                    longitude = feature.geometry.coordinates[0];
                    latitude = feature.geometry.coordinates[1];
                } else if (feature.geometry.type === 'Polygon') {
                    // For polygons, calculate centroid from first ring
                    const ring = feature.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    for (const coord of ring) {
                        sumLng += coord[0];
                        sumLat += coord[1];
                    }
                    longitude = sumLng / ring.length;
                    latitude = sumLat / ring.length;
                }

                // Determine crew status
                let crewStatus = props.status || 'Reported';
                if (props.crew_assigned === true) {
                    crewStatus = 'Dispatched';
                } else if (props.verified === true) {
                    crewStatus = 'Verified';
                }

                // Get outage cause
                const cause = props.cause || props.suspected_cause || 'Unknown';

                // Calculate duration from start time
                let duration = '';
                if (props.start_time) {
                    const startTime = new Date(props.start_time);
                    const now = new Date();
                    const diffMs = now - startTime;
                    const diffMins = Math.floor(diffMs / (1000 * 60));
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);

                    if (diffDays > 0) {
                        duration = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                    } else if (diffHours > 0) {
                        duration = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                    } else if (diffMins > 0) {
                        duration = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                    } else {
                        duration = 'Just now';
                    }
                }

                // Map fields based on useOutages.ts from reference project
                return {
                    id: props.outage_id,
                    outage_id: props.outage_id,
                    customers_affected: parseInt(props.customers_affected || 0),
                    cause: cause,
                    start_time: props.start_time ? new Date(props.start_time).getTime() : null,
                    estimated_restore: props.estimated_restoration ? new Date(props.estimated_restoration).getTime() : null,
                    status: crewStatus,
                    outage_status: props.status || 'N/A',
                    area_description: props.outage_id || 'Area Outage',
                    comments: crewStatus,
                    crew_on_site: props.crew_assigned || false,
                    substation: props.substation || 'N/A',
                    feeder: props.feeder || 'N/A',
                    district: props.district || 'N/A',
                    customers_restored: parseInt(props.customers_restored || 0),
                    initially_affected: parseInt(props.customers_affected || 0),
                    equipment: props.troubled_element || 'N/A',
                    description: `Outage affecting ${props.customers_affected || 0} customers`,
                    last_update: props.last_update ? new Date(props.last_update).getTime() : null,
                    duration: duration,
                    latitude: latitude,
                    longitude: longitude,
                    crew_responsible: props.crew_responsible,
                    verified: props.verified,
                    upline_element: props.upline_element,
                    outaged_phase: props.outaged_phase,
                    ...props
                };
            });

            // Convert to the expected format, preserving original geometries
            const processedFeatures = geoJSONTransformService.convertPowerOutageToGeoJSONFeatures(outageData, 'cullman', features);

            const result = {
                count: outageData.length,
                data: outageData,
                features: processedFeatures,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            };

            log.info('🔌 Cullman outages loaded:', result.count, 'outages');
            return result;

        } catch (error) {
            log.error('Failed to fetch Cullman outages:', error);

            // Return empty result as fallback
            return {
                count: 0,
                data: [],
                features: [],
                lastUpdated: new Date().toISOString(),
                fromCache: false,
                error: true,
                errorMessage: error.message
            };
        }
    }
}

export const outageService = new OutageService();

