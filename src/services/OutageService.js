import { createLogger } from '../utils/logger.js';
import { geoJSONTransformService } from './GeoJSONTransformService.js';
import { API_CONFIG } from '../config/apiConfig.js';

const log = createLogger('OutageService');

export class OutageService {
    // Get APCo power outages from Supabase storage - REALTIME (no caching)
    async getApcoOutages() {
        try {
            // Check if URL is configured
            if (!API_CONFIG.OUTAGES.APCO) {
                log.warn('⚠️ APCo outages URL not configured, returning empty result');
                return {
                    count: 0,
                    data: [],
                    features: [],
                    lastUpdated: new Date().toISOString(),
                    fromCache: false
                };
            }

            log.info('📡 Fetching APCo power outages from Supabase storage... (realtime - no cache)');

            let geojsonData;

            // Direct fetch from Supabase public URL
            const response = await fetch(API_CONFIG.OUTAGES.APCO);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            geojsonData = await response.json();
            log.info('✅ Loaded APCo outages from Supabase public URL');
            log.info(`📊 Total features in APCo GeoJSON: ${geojsonData.features?.length || 0}`);

            // Extract features and properties - handle Kubra data format for APCo
            const features = geojsonData.features || [];
            const outageData = features.map(feature => {
                const props = feature.properties || {};
                const desc = props.desc || {};

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

                return {
                    id: props.id,
                    outage_id: desc.inc_id || props.id,
                    customers_affected: desc.cust_a?.val || 0,
                    cause: desc.cause || 'Unknown',
                    start_time: desc.start_time || null,
                    estimated_restore: desc.etr && desc.etr !== 'ETR-EXP' ? desc.etr : null,
                    status: desc.crew_status || (desc.comments ? 'In Progress' : 'Reported'),
                    area_description: props.title || 'Area Outage',
                    comments: desc.comments || '',
                    crew_on_site: desc.crew_icon || false,
                    latitude: latitude,
                    longitude: longitude,
                    // Include original data for debugging
                    ...props
                };
            });

            // Apply geographic filtering for APCo (Alabama Power service area)
            const filteredData = outageData.filter(outage => {
                const lng = outage.longitude;
                const lat = outage.latitude;
                // APCo service area bounds
                return lng >= -88.277 && lng <= -87.263 && lat >= 33.510 && lat <= 34.632;
            });

            log.info(`📍 APCo outages after geographic filtering: ${filteredData.length}`);

            // Convert to the expected format, preserving original geometries
            // Use the same centroid calculation logic for filtering
            const filteredFeatures = features.filter(feature => {
                let longitude, latitude;
                if (feature.geometry.type === 'Point') {
                    longitude = feature.geometry.coordinates[0];
                    latitude = feature.geometry.coordinates[1];
                } else if (feature.geometry.type === 'Polygon') {
                    // Calculate centroid for filtering
                    const ring = feature.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    for (const coord of ring) {
                        sumLng += coord[0];
                        sumLat += coord[1];
                    }
                    longitude = sumLng / ring.length;
                    latitude = sumLat / ring.length;
                }
                // APCo service area bounds (using centroid for both points and polygons)
                return longitude >= -88.277 && longitude <= -87.263 && latitude >= 33.510 && latitude <= 34.632;
            });

            const processedFeatures = geoJSONTransformService.convertPowerOutageToGeoJSONFeatures(filteredData, 'apco', filteredFeatures);

            const result = {
                count: filteredData.length,
                data: filteredData,
                features: processedFeatures,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            };

            log.info('🔌 APCo outages loaded:', result.count, 'outages');
            return result;

        } catch (error) {
            log.error('Failed to fetch APCo outages:', error);

            // Return empty result as fallback
            return {
                count: 0,
                data: [],
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message,
                fromCache: false
            };
        }
    }

    // Get Tombigbee power outages from Supabase storage - REALTIME (no caching)
    async getTombigbeeOutages() {
        try {
            // Check if URL is configured
            if (!API_CONFIG.OUTAGES.TOMBIGBEE) {
                log.warn('⚠️ Tombigbee outages URL not configured, returning empty result');
                return {
                    count: 0,
                    data: [],
                    features: [],
                    lastUpdated: new Date().toISOString(),
                    fromCache: false
                };
            }

            log.info('📡 Fetching Tombigbee Electric power outages from Supabase storage... (realtime - no cache)');

            let geojsonData;

            // Direct fetch from Supabase public URL
            const response = await fetch(API_CONFIG.OUTAGES.TOMBIGBEE);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            geojsonData = await response.json();
            log.info('✅ Loaded Tombigbee outages from Supabase public URL');

            // Extract features and properties - handle Tombigbee direct format (not Kubra)
            const features = geojsonData.features || [];
            const outageData = features.map(feature => {
                const props = feature.properties;

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
                let crewStatus = 'Reported';
                if (props.crew_dispatched === true) {
                    crewStatus = 'Dispatched';
                } else if (props.verified === true) {
                    crewStatus = 'Verified';
                }

                // Get outage cause
                const cause = props.verified_cause || props.suspected_cause || 'Unknown';

                // Calculate duration from start time
                let duration = '';
                if (props.outage_start) {
                    const startTime = new Date(props.outage_start);
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

                return {
                    id: props.outage_id || props.id,
                    outage_id: props.outage_id,
                    customers_affected: props.customers_out_now || 0,
                    cause: cause,
                    start_time: props.outage_start ? new Date(props.outage_start).getTime() : null,
                    estimated_restore: props.outage_end ? new Date(props.outage_end).getTime() : null,
                    status: crewStatus,
                    outage_status: props.status || 'N/A',
                    area_description: props.outage_name || 'Area Outage',
                    comments: crewStatus,
                    crew_on_site: props.crew_dispatched || false,
                    substation: props.substation || 'N/A',
                    feeder: props.feeder || 'N/A',
                    district: props.district || 'N/A',
                    customers_restored: props.customers_restored || 0,
                    initially_affected: props.customers_out_initially || props.customers_out_now || 0,
                    equipment: props.outage_name || 'N/A',
                    description: `Outage affecting ${props.customers_out_now || 0} customers`,
                    last_update: props.last_update ? new Date(props.last_update).getTime() : null,
                    duration: duration,
                    latitude: latitude,
                    longitude: longitude,
                    ...props
                };
            });

            // Convert to the expected format, preserving original geometries
            const processedFeatures = geoJSONTransformService.convertPowerOutageToGeoJSONFeatures(outageData, 'tombigbee', features);

            const result = {
                count: outageData.length,
                data: outageData,
                features: processedFeatures,
                lastUpdated: new Date().toISOString(),
                fromCache: false
            };

            log.info('🔌 Tombigbee outages loaded:', result.count, 'outages');
            return result;

        } catch (error) {
            log.error('Failed to fetch Tombigbee outages:', error);

            // Return empty result as fallback
            return {
                count: 0,
                data: [],
                features: [],
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error.message,
                fromCache: false
            };
        }
    }
}

export const outageService = new OutageService();
