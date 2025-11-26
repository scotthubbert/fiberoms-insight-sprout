import { createLogger } from '../utils/logger.js';

const log = createLogger('GeoJSONTransformService');

export class GeoJSONTransformService {
    /**
     * Convert Supabase data to GeoJSON features for ArcGIS
     * @param {Array} data - Raw data from Supabase
     * @param {string} status - Default status if not present in record
     * @returns {Array} Array of GeoJSON features
     */
    convertToGeoJSONFeatures(data, status) {
        if (!data || !Array.isArray(data)) return [];

        return data.map((record, index) => {
            // Use actual field names from your MFS table
            const lat = record.latitude;
            const lng = record.longitude;

            if (!lat || !lng) {
                log.warn(`Skipping record ${index}: missing coordinates`, record);
                return null;
            }

            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                properties: {
                    // Core properties for display
                    objectId: record.id || index,
                    status: record.status || status,
                    // Preserve Status field (capital S) from database for renderer
                    Status: record.Status || record.status || status,

                    // Map database fields to display fields (using actual schema)
                    customer_name: record.name || 'Unknown',
                    customer_number: record.account || '',
                    address: record.service_address || '',
                    city: record.city || '',
                    state: record.state || '',
                    zip: record.zip_code || '',
                    county: record.county || '',
                    phone_number: '', // No phone_number in schema

                    // Create full address field combining all address components
                    full_address: [
                        record.service_address || '',
                        record.city || '',
                        record.state || '',
                        record.zip_code || ''
                    ].filter(part => part && part.toString().trim() !== '').join(', '),

                    // Include all original fields (this preserves electricOut, Status, etc.)
                    ...record
                }
            };
        }).filter(feature => feature !== null); // Remove null features
    }

    /**
     * Convert power outage data to GeoJSON features for ArcGIS layer
     * @param {Array} data - Outage data array
     * @param {string} company - Company identifier (e.g., 'cullman')
     * @param {Array} originalFeatures - Original GeoJSON features to preserve geometry
     * @returns {Array} Array of GeoJSON features
     */
    convertPowerOutageToGeoJSONFeatures(data, company, originalFeatures = []) {
        if (!data || !Array.isArray(data)) return [];

        return data.map((record, index) => {
            // Get the original GeoJSON feature to preserve geometry
            const originalFeature = originalFeatures[index];
            let geometry;

            if (originalFeature && originalFeature.geometry) {
                geometry = originalFeature.geometry;
            } else {
                // Fallback to point geometry using lat/lng
                const lat = record.latitude;
                const lng = record.longitude;

                if (!lat || !lng) {
                    log.warn(`Skipping power outage record ${index}: missing coordinates`, record);
                    return null;
                }

                geometry = {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                };
            }

            return {
                type: 'Feature',
                geometry: geometry,
                properties: {
                    objectId: record.id || index,
                    outage_id: record.outage_id || `${company}-${index}`,
                    customers_affected: record.customers_affected || 0,
                    cause: record.cause || 'Unknown',
                    start_time: record.start_time || new Date().toISOString(),
                    estimated_restore: record.estimated_restore || null,
                    status: record.status || 'Active',
                    area_description: record.area_description || '',
                    company: company,
                    latitude: record.latitude || null,
                    longitude: record.longitude || null,
                    // Include all original fields
                    ...record
                }
            };
        }).filter(feature => feature !== null);
    }

    /**
     * Convert truck data to GeoJSON features for ArcGIS layer
     * @param {Array} trucks - Truck data
     * @returns {Array} Array of GeoJSON features
     */
    convertTruckDataToGeoJSONFeatures(trucks) {
        return trucks.map(truck => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [parseFloat(truck.longitude), parseFloat(truck.latitude)]
            },
            properties: {
                id: truck.id,
                name: truck.name,
                installer: truck.installer,
                speed: truck.speed,
                is_driving: truck.is_driving,
                bearing: truck.bearing,
                communication_status: truck.communication_status,
                last_updated: truck.last_updated,
                vehicle_type: truck.vehicle_type,
                // Additional properties for popup display
                status_display: truck.is_driving ? `Moving (${truck.speed} mph)` : 'Stopped',
                last_update_display: new Date(truck.last_updated).toLocaleString(),
                connection_status: truck.communication_status
            }
        }));
    }
}

export const geoJSONTransformService = new GeoJSONTransformService();
