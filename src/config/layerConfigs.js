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

// Layer configurations - OCP: Add new layers without modifying existing code
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
        // No clustering for online subscribers - individual points needed for service disruption analysis
        visible: false,
        zOrder: 0,
        dataServiceMethod: () => subscriberDataService.getOnlineSubscribers()
    }

    // Future layers can be added here without modifying existing code:
    // fsaBoundaries: { ... },
    // mainLineFiber: { ... },
    // vehicles: { ... }
};

// Configuration-driven layer creation
export const getLayerConfig = (layerId) => {
    return layerConfigs[layerId];
};

export const getAllLayerIds = () => {
    return Object.keys(layerConfigs);
}; 