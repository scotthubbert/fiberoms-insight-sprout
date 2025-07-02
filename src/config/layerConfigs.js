// layerConfigs.js - Open/Closed: Extend through configuration
import { subscriberDataService } from '../dataService.js';

// Renderer configurations
const createOfflineRenderer = () => ({
    type: 'unique-value',
    field: 'service_type',
    defaultSymbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [220, 38, 38, 0.8], // Default red for non-business internet
        size: 8,
        outline: {
            color: [220, 38, 38, 1],
            width: 2
        }
    },
    uniqueValueInfos: [
        {
            value: 'BUSINESS INTERNET',
            symbol: {
                type: 'simple-marker',
                style: 'circle',
                color: [147, 51, 234, 0.8], // Purple center for offline business internet
                size: 8,
                outline: {
                    color: [220, 38, 38, 1], // Red outline for offline business internet
                    width: 2
                }
            }
        }
    ]
});

const createOnlineRenderer = () => ({
    type: 'unique-value',
    field: 'service_type',
    defaultSymbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [34, 197, 94, 0.8], // Default green for non-business internet
        size: 6,
        outline: {
            color: [34, 197, 94, 1],
            width: 1
        }
    },
    uniqueValueInfos: [
        {
            value: 'BUSINESS INTERNET',
            symbol: {
                type: 'simple-marker',
                style: 'circle',
                color: [147, 51, 234, 0.8], // Purple for online business internet
                size: 6,
                outline: {
                    color: [147, 51, 234, 1], // Purple outline for online business internet
                    width: 1
                }
            }
        }
    ]
});

// Clustering configuration for offline subscribers
const createOfflineClusterConfig = () => ({
    type: 'cluster',
    clusterRadius: '100px',
    popupTemplate: {
        title: 'Offline Subscribers Cluster',
        content: 'This cluster represents {cluster_count} offline subscribers in this area.',
        fieldInfos: [
            {
                fieldName: 'cluster_count',
                format: {
                    places: 0,
                    digitSeparator: true
                }
            }
        ]
    },
    symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [220, 38, 38, 0.8],
        size: '20px',
        outline: {
            color: [220, 38, 38, 1],
            width: 2
        }
    },
    labelingInfo: [
        {
            deconflictionStrategy: 'none',
            labelExpressionInfo: {
                expression: '$feature.cluster_count'
            },
            symbol: {
                type: 'text',
                color: 'white',
                font: {
                    weight: 'bold',
                    family: 'Noto Sans',
                    size: '12px'
                }
            },
            labelPlacement: 'center-center'
        }
    ]
});

// Online subscribers use individual points (no clustering) for service disruption analysis

// Power outage renderers with company logos
const createPowerOutageRenderer = (company) => {
    const symbols = {
        apco: {
            type: 'picture-marker',
            url: '/apco-logo.png',
            width: '24px',
            height: '24px'
        },
        tombigbee: {
            type: 'picture-marker',
            url: '/tombigbee-logo.png',
            width: '24px',
            height: '24px'
        }
    };

    return {
        type: 'simple',
        symbol: symbols[company] || {
            type: 'simple-marker',
            style: 'circle',
            color: [255, 165, 0, 0.8], // Orange for generic outages
            size: 12,
            outline: {
                color: [255, 165, 0, 1],
                width: 2
            }
        }
    };
};

// Power outage popup templates
const createPowerOutagePopup = (company) => {
    if (company === 'tombigbee') {
        return {
            title: 'Tombigbee Outage',
            content: [
                {
                    type: 'fields',
                    fieldInfos: [
                        { fieldName: 'customers_affected', label: 'Customers Affected', visible: true },
                        { fieldName: 'status', label: 'Crew Status', visible: true },
                        {
                            fieldName: 'start_time',
                            label: 'Outage Started',
                            visible: true,
                            format: {
                                dateFormat: 'short-date-short-time'
                            }
                        },
                        { fieldName: 'duration', label: 'Duration', visible: true },
                        { fieldName: 'outage_status', label: 'Status', visible: true },
                        { fieldName: 'customers_restored', label: 'Customers Restored', visible: true },
                        { fieldName: 'initially_affected', label: 'Initially Affected', visible: true },
                        { fieldName: 'equipment', label: 'Equipment', visible: true },
                        { fieldName: 'description', label: 'Description', visible: true },
                        { fieldName: 'outage_id', label: 'Outage ID', visible: true },
                        { fieldName: 'substation', label: 'Substation', visible: true },
                        { fieldName: 'feeder', label: 'Feeder', visible: true },
                        { fieldName: 'district', label: 'District', visible: true },
                        {
                            fieldName: 'last_update',
                            label: 'Last Update',
                            visible: true,
                            format: {
                                dateFormat: 'short-date-short-time'
                            }
                        }
                    ]
                }
            ]
        };
    } else {
        // APCo format - keeping original for now
        return {
            title: `Alabama Power Company - {outage_id}`,
            content: [
                {
                    type: 'fields',
                    fieldInfos: [
                        { fieldName: 'outage_id', label: 'Outage ID', visible: true },
                        { fieldName: 'customers_affected', label: 'Customers Affected', visible: true },
                        { fieldName: 'status', label: 'Status', visible: true },
                        { fieldName: 'cause', label: 'Cause', visible: true },
                        { fieldName: 'estimated_restore', label: 'Estimated Restore', visible: true },
                        { fieldName: 'start_time', label: 'Start Time', visible: true },
                        { fieldName: 'area_description', label: 'Area', visible: true },
                        { fieldName: 'comments', label: 'Status Details', visible: true },
                        { fieldName: 'crew_on_site', label: 'Crew On Site', visible: true }
                    ]
                }
            ],
            actions: [
                {
                    id: 'copy-outage-info',
                    title: 'Copy Outage Info',
                    icon: 'duplicate',
                    type: 'button'
                },
                {
                    id: 'view-affected-area',
                    title: 'View Affected Area',
                    icon: 'map',
                    type: 'button'
                }
            ]
        };
    }
};

// Power outage field definitions
const createPowerOutageFields = () => [
    { name: 'outage_id', type: 'string', alias: 'Outage ID' },
    { name: 'customers_affected', type: 'integer', alias: 'Customers Affected' },
    { name: 'cause', type: 'string', alias: 'Cause' },
    { name: 'start_time', type: 'date', alias: 'Start Time' },
    { name: 'estimated_restore', type: 'date', alias: 'Estimated Restore' },
    { name: 'status', type: 'string', alias: 'Crew Status' },
    { name: 'outage_status', type: 'string', alias: 'Status' },
    { name: 'area_description', type: 'string', alias: 'Area Description' },
    { name: 'comments', type: 'string', alias: 'Status Details' },
    { name: 'crew_on_site', type: 'string', alias: 'Crew On Site' },
    { name: 'customers_restored', type: 'integer', alias: 'Customers Restored' },
    { name: 'initially_affected', type: 'integer', alias: 'Initially Affected' },
    { name: 'equipment', type: 'string', alias: 'Equipment' },
    { name: 'description', type: 'string', alias: 'Description' },
    { name: 'substation', type: 'string', alias: 'Substation' },
    { name: 'feeder', type: 'string', alias: 'Feeder' },
    { name: 'district', type: 'string', alias: 'District' },
    { name: 'last_update', type: 'date', alias: 'Last Update' },
    { name: 'duration', type: 'string', alias: 'Duration' },
    { name: 'latitude', type: 'double', alias: 'Latitude' },
    { name: 'longitude', type: 'double', alias: 'Longitude' }
];

// Enhanced popup templates for field workers (updated for actual database schema)
const createSubscriberPopup = (status) => ({
    title: '{customer_name}',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'customer_number', label: 'Account #', visible: true },
                { fieldName: 'address', label: 'Service Address', visible: true },
                { fieldName: 'city', label: 'City', visible: true },
                { fieldName: 'state', label: 'State', visible: true },
                { fieldName: 'zip', label: 'ZIP', visible: true },
                { fieldName: 'status', label: 'Connection Status', visible: true },
                { fieldName: 'county', label: 'County', visible: true },
                { fieldName: 'account_status', label: 'Account Status', visible: true },
                { fieldName: 'plan_name', label: 'Service Plan', visible: true },
                { fieldName: 'service_type', label: 'Service Type', visible: true }
            ]
        }
    ],
    actions: [
        {
            id: 'copy-info',
            title: 'Copy Info',
            icon: 'duplicate',
            type: 'button'
        },
        {
            id: 'directions',
            title: 'Get Directions',
            icon: 'pin-tear',
            type: 'button'
        }
    ]
});

// Field definitions to prevent GeoJSONLayer field type inference warnings
// Updated to match actual database schema
const subscriberFields = [
    { name: 'customer_name', type: 'string', alias: 'Customer Name' },
    { name: 'customer_number', type: 'string', alias: 'Account Number' },
    { name: 'address', type: 'string', alias: 'Service Address' },
    { name: 'city', type: 'string', alias: 'City' },
    { name: 'state', type: 'string', alias: 'State' },
    { name: 'zip', type: 'string', alias: 'ZIP Code' },
    { name: 'status', type: 'string', alias: 'Connection Status' },
    { name: 'county', type: 'string', alias: 'County' },
    { name: 'latitude', type: 'double', alias: 'Latitude' },
    { name: 'longitude', type: 'double', alias: 'Longitude' },
    // Additional fields from actual schema
    { name: 'account_status', type: 'string', alias: 'Account Status' },
    { name: 'ont', type: 'string', alias: 'ONT' },
    { name: 'plan_name', type: 'string', alias: 'Service Plan' },
    { name: 'service_type', type: 'string', alias: 'Service Type' }
];

// Layer configurations
export const layerConfigs = {
    offlineSubscribers: {
        id: 'offline-subscribers',
        title: 'Offline Subscribers',
        dataSource: 'offline_subscribers',
        renderer: createOfflineRenderer(),
        popupTemplate: createSubscriberPopup('offline'),
        featureReduction: createOfflineClusterConfig(),
        fields: subscriberFields,
        visible: true,
        zOrder: 100,
        dataServiceMethod: () => subscriberDataService.getOfflineSubscribers()
    },

    onlineSubscribers: {
        id: 'online-subscribers',
        title: 'Online Subscribers',
        dataSource: 'online_subscribers',
        renderer: createOnlineRenderer(),
        popupTemplate: createSubscriberPopup('online'),
        fields: subscriberFields,
        // Individual points (no clustering)
        visible: false,
        zOrder: 0,
        dataServiceMethod: () => subscriberDataService.getOnlineSubscribers()
    },

    // Power Outages Layers
    apcoOutages: {
        id: 'apco-outages',
        title: 'APCo Power Outages',
        dataSource: 'apco_outages',
        renderer: createPowerOutageRenderer('apco'),
        popupTemplate: createPowerOutagePopup('apco'),
        fields: createPowerOutageFields(),
        visible: true,
        zOrder: 50,
        dataServiceMethod: () => subscriberDataService.getApcoOutages()
    },

    tombigbeeOutages: {
        id: 'tombigbee-outages',
        title: 'Tombigbee Power Outages',
        dataSource: 'tombigbee_outages',
        renderer: createPowerOutageRenderer('tombigbee'),
        popupTemplate: createPowerOutagePopup('tombigbee'),
        fields: createPowerOutageFields(),
        visible: true,
        zOrder: 51,
        dataServiceMethod: () => subscriberDataService.getTombigbeeOutages()
    }

    // Additional layers can be added here as needed
};

// Configuration-driven layer creation
export const getLayerConfig = (layerId) => {
    return layerConfigs[layerId];
};

export const getAllLayerIds = () => {
    return Object.keys(layerConfigs);
}; 