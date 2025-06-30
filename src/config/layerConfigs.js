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

// Popup templates
const createSubscriberPopup = (status) => ({
    title: '{customer_name}',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'customer_number', label: 'Account #' },
                { fieldName: 'address', label: 'Address' },
                { fieldName: 'city', label: 'City' },
                { fieldName: 'status', label: 'Status' },
                { fieldName: 'phone_number', label: 'Phone' }
            ]
        }
    ],
    actions: [
        {
            id: 'copy-info',
            title: 'Copy Info',
            icon: 'copy',
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