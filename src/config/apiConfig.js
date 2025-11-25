/**
 * apiConfig.js - Centralized configuration for API endpoints and external resources
 */

export const API_CONFIG = {
    // Supabase Storage URLs for Infrastructure Data (OSP)
    INFRASTRUCTURE: {
        SPROUT_HUTS: 'https://crguystmaihtfdttybkf.supabase.co/storage/v1/object/public/sprout_plant//sprout-huts.geojson',
        // Main Line Fiber (Backbone)
        MAIN_LINE_FIBER: 'https://crguystmaihtfdttybkf.supabase.co/storage/v1/object/public/sprout_plant//cleaned_FiberCable-wgs84.json',
        // MST Terminals (Service Access Points)
        MST_TERMINALS: 'https://crguystmaihtfdttybkf.supabase.co/storage/v1/object/public/sprout_plant//SFI_MST.geojson',
        // Splitters
        SPLITTERS: 'https://crguystmaihtfdttybkf.supabase.co/storage/v1/object/public/sprout_plant//SFI_Splitters.geojson',
        // Closures - Mapped to Slack Loops data as requested
        CLOSURES: 'https://crguystmaihtfdttybkf.supabase.co/storage/v1/object/public/sprout_plant/SFI_Slackloops.geojson',
        // Slack Loops (New)
        SLACK_LOOPS: 'https://crguystmaihtfdttybkf.supabase.co/storage/v1/object/public/sprout_plant//SFI_Slackloops.geojson',

        // FSA / DA Boundaries
        FSA_BOUNDARIES: 'https://crguystmaihtfdttybkf.supabase.co/storage/v1/object/public/sprout_plant/SFI_DABoundaries.geojson',

        // Legacy / Placeholder Data (Commented out to prevent Freedom Fiber data from loading)
        // MAIN_LINE_OLD: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/fsa-data//networkOLD.geojson',
        // MST_FIBER: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/mst-fiber-overlay.geojson?token=...'

        // Set to null/empty to prevent loading invalid data
        MAIN_LINE_OLD: null,
        MST_FIBER: null
    },

    // Supabase Storage URLs for Power Outage Data
    OUTAGES: {
        // Legacy Freedom Fiber outage data (Disabled)
        // APCo (Alabama Power) - Only relevant for Freedom Fiber area?
        // APCO: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/geojson-files/outages.geojson',
        // Tombigbee Electric - Only relevant for Freedom Fiber area?
        // TOMBIGBEE: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/geojson-files/tec_outages.geojson'

        APCO: null,
        CULLMAN: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/cec_power_outages/outages/cullman_outages.geojson'
    }
};
