// layerConfigs.js - Open/Closed: Extend through configuration
import { subscriberDataService } from '../dataService.js';

// Renderer configurations
const createOfflineRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [220, 38, 38, 0.8],
        size: 8,
        outline: {
            color: [220, 38, 38, 1],
            width: 2
        }
    }
});

const createOnlineRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [34, 197, 94, 0.8],
        size: 6,
        outline: {
            color: [34, 197, 94, 1],
            width: 1
        }
    }
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

// Enhanced popup templates for field workers
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
                { fieldName: 'phone_number', label: 'Phone', visible: true },
                { fieldName: 'county', label: 'County', visible: true }
            ]
        }
    ],
    actions: [
        {
            id: 'copy-info',
            title: 'Copy Info',
            icon: 'copy',
            type: 'button'
        },
        {
            id: 'directions',
            title: 'Get Directions',
            icon: 'navigation',
            type: 'button'
        }
    ]
});

// Layer configurations - OCP: Add new layers without modifying existing code
export const layerConfigs = {
    offlineSubscribers: {
        id: 'offline-subscribers',
        title: 'Offline Subscribers',
        dataSource: 'offline_subscribers',
        renderer: createOfflineRenderer(),
        popupTemplate: createSubscriberPopup('offline'),
        featureReduction: createOfflineClusterConfig(),
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