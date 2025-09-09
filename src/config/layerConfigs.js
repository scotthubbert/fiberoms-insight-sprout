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

// Clustering configuration for offline subscribers - optimized for production
const createOfflineClusterConfig = () => ({
    type: 'cluster',
    clusterRadius: '60px',
    // Performance: Set min/max size for better rendering performance
    clusterMinSize: '12px',
    clusterMaxSize: '54px',
    // Disable clustering at high zoom levels where individual features are more useful
    maxScale: 50000,
    popupTemplate: {
        title: 'Offline Subscribers Cluster',
        content: 'This cluster represents <b>{cluster_count}</b> offline subscribers in this area.',
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
    // Use a renderer with size visual variable for dynamic sizing based on outage count
    renderer: {
        type: 'simple',
        symbol: {
            type: 'simple-marker',
            style: 'circle',
            color: [220, 38, 38, 0.8],
            outline: {
                color: [220, 38, 38, 1],
                width: 2
            }
        },
        visualVariables: [
            {
                type: 'size',
                field: 'cluster_count',
                stops: [
                    { value: 1, size: '12px' },      // Single offline subscriber
                    { value: 5, size: '18px' },      // Small cluster
                    { value: 10, size: '24px' },     // Medium cluster
                    { value: 25, size: '32px' },     // Large cluster
                    { value: 50, size: '42px' },     // Very large cluster
                    { value: 100, size: '54px' }     // Massive cluster
                ]
            }
        ]
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
                },
                haloColor: [0, 0, 0, 0.8],
                haloSize: 1
            },
            labelPlacement: 'center-center'
        }
    ]
});

// Online subscribers use individual points (no clustering) for service disruption analysis

// Power outage renderers - not used when using GraphicsLayer
const createPowerOutageRenderer = (company) => {
    // This renderer is not used since GraphicsLayer handles symbols individually
    // Kept for compatibility with layer config structure
    return {
        type: 'simple',
        symbol: {
            type: 'simple-marker',
            style: 'circle',
            color: [255, 0, 0],
            size: 8
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
                }
            ]
        };
    }
};

// Node Sites renderer
const createNodeSiteRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'diamond',
        color: [255, 165, 0, 0.8], // Orange color for Network
        size: 12,
        outline: {
            color: [255, 165, 0, 1],
            width: 1
        }
    }
});

// Node Sites popup template with metrics
const createNodeSitePopup = () => ({
    title: '{Name}',
    content: [
        {
            type: 'custom',
            outFields: ['*'],
            creator: function (feature) {
                const attributes = feature.graphic.attributes;
                const nodeSiteName = attributes.Name;

                // Create container for popup content
                const container = document.createElement('div');
                container.style.cssText = 'padding: 0; font-family: "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;';

                // Site name display
                const siteNameDiv = document.createElement('div');
                siteNameDiv.style.cssText = 'font-weight: 600; font-size: 16px; margin-bottom: 16px; color: var(--calcite-color-text-1); padding: 0 16px;';
                siteNameDiv.textContent = nodeSiteName;
                container.appendChild(siteNameDiv);

                // Loading state
                const loadingDiv = document.createElement('div');
                loadingDiv.style.cssText = 'text-align: center; padding: 32px 16px; color: var(--calcite-color-text-3); background: var(--calcite-color-foreground-1); border: 1px solid var(--calcite-color-border-2); border-radius: 4px;';
                loadingDiv.innerHTML = `
                    <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid var(--calcite-color-border-2); border-top: 2px solid var(--calcite-color-brand); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <div style="margin-top: 12px; font-size: 14px; color: var(--calcite-color-text-2);">Loading metrics...</div>
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                `;
                container.appendChild(loadingDiv);

                // Asynchronously load metrics
                (async () => {
                    try {
                        // Import the service dynamically to avoid circular dependencies
                        const { nodeSiteMetricsService } = await import('../services/NodeSiteMetricsService.js');
                        const metrics = await nodeSiteMetricsService.getNodeSiteMetrics(nodeSiteName);

                        // Remove loading state
                        container.removeChild(loadingDiv);

                        // Create metrics display
                        const metricsDiv = document.createElement('div');
                        metricsDiv.className = 'node-site-metrics';
                        metricsDiv.innerHTML = `
                             <calcite-card class="node-metrics-card">
                                 <div class="metrics-header">
                                     <calcite-icon icon="graph-time-series" scale="s"></calcite-icon>
                                     <span class="metrics-title">Subscriber Metrics</span>
                                 </div>
                                 
                                 <div class="metrics-content">
                                     <div class="metrics-counters">
                                         <div class="metric-item" data-status="online">
                                             <div class="metric-value">${metrics.onlineSubscribers}</div>
                                             <div class="metric-label">Online</div>
                                         </div>
                                         <div class="metric-item" data-status="offline">
                                             <div class="metric-value">${metrics.offlineSubscribers}</div>
                                             <div class="metric-label">Offline</div>
                                         </div>
                                         <div class="metric-item" data-status="total">
                                             <div class="metric-value">${metrics.totalSubscribers}</div>
                                             <div class="metric-label">Total</div>
                                         </div>
                                     </div>
                                     
                                     <div class="service-type-counters" style="margin-top: 16px;">
                                         <div class="service-type-item" data-type="residential">
                                             <div class="service-type-value">${metrics.residentialCount}</div>
                                             <div class="service-type-label">Residential</div>
                                         </div>
                                         <div class="service-type-item" data-type="business">
                                             <div class="service-type-value">${metrics.businessCount}</div>
                                             <div class="service-type-label">Business</div>
                                         </div>
                                     </div>
                                     
                                     <div class="metrics-progress">
                                         <calcite-progress type="determinate" value="${metrics.onlinePercentage}" text="${metrics.onlinePercentage}% Online"></calcite-progress>
                                     </div>
                                     
                                     <div class="metrics-legend">
                                         <div class="legend-item" data-status="online">
                                             <calcite-icon icon="circle-filled" scale="s"></calcite-icon>
                                             <span>${metrics.onlinePercentage}% Online</span>
                                         </div>
                                         <div class="legend-item" data-status="offline">
                                             <calcite-icon icon="circle-filled" scale="s"></calcite-icon>
                                             <span>${metrics.offlinePercentage}% Offline</span>
                                         </div>
                                     </div>
                                     
                                     <calcite-card class="health-status-card" data-health="${metrics.healthStatus}">
                                         <div class="health-indicator">
                                             <calcite-icon icon="circle-filled" scale="s" style="color: ${metrics.healthColor}"></calcite-icon>
                                             <span class="health-label">${metrics.healthStatus}</span>
                                         </div>
                                         <div class="recent-activity">
                                             <calcite-icon icon="clock" scale="s"></calcite-icon>
                                             <span>${metrics.recentActivity} recent updates</span>
                                         </div>
                                     </calcite-card>
                                     
                                     ${metrics.ta5kNodes && metrics.ta5kNodes.length > 1 ? `
                                         <div style="margin-top: 16px; border: 1px solid var(--calcite-color-border-2); background: var(--calcite-color-foreground-2); border-radius: 4px; overflow: hidden;">
                                             <div style="padding: 12px; border-bottom: 1px solid var(--calcite-color-border-2); background: var(--calcite-color-foreground-1);">
                                                 <div style="font-weight: 600; font-size: 12px; color: var(--calcite-color-text-1); display: flex; align-items: center;">
                                                     <calcite-icon icon="organization" scale="s" style="margin-right: 6px; color: var(--calcite-color-text-3);"></calcite-icon>
                                                     TA5K Node Breakdown (${metrics.ta5kNodes.length} nodes)
                                                 </div>
                                             </div>
                                             <div style="padding: 12px;">
                                                 ${Object.entries(metrics.ta5kBreakdown || {})
                                    .map(([ta5k, data]) => `
                                                         <div style="font-size: 11px; margin-bottom: 8px; padding: 8px; background: var(--calcite-color-foreground-1); border-radius: 2px; border: 1px solid var(--calcite-color-border-3);">
                                                             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                                                 <span style="color: var(--calcite-color-text-1); font-weight: 500;">${ta5k}</span>
                                                                 <span style="color: var(--calcite-color-text-3); font-family: monospace;">${data.total} total</span>
                                                             </div>
                                                             <div style="display: flex; justify-content: space-between; color: var(--calcite-color-text-3); font-family: monospace; font-size: 10px;">
                                                                 <span>${data.online} online, ${data.offline} offline</span>
                                                                 <span>${data.residential} residential, ${data.business} business</span>
                                                             </div>
                                                         </div>
                                                     `).join('')}
                                             </div>
                                         </div>
                                     ` : ''}
                                 </div>
                             </div>
                             
                             <div style="font-size: 11px; color: var(--calcite-color-text-3); text-align: center; margin-top: 12px; padding: 8px 16px; opacity: 0.8;">
                                 Last updated: ${new Date(metrics.lastUpdated).toLocaleString()}
                             </div>
                         `;

                        container.appendChild(metricsDiv);

                    } catch (error) {
                        // Remove loading state
                        if (container.contains(loadingDiv)) {
                            container.removeChild(loadingDiv);
                        }

                        // Show error state
                        const errorDiv = document.createElement('div');
                        errorDiv.style.cssText = 'background: var(--calcite-color-status-danger-background); border: 1px solid var(--calcite-color-status-danger-border); padding: 16px; margin: 0; color: var(--calcite-color-status-danger-text); border-radius: 4px;';
                        errorDiv.innerHTML = `
                            <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                                <calcite-icon icon="exclamation-mark-triangle" scale="s" style="margin-right: 8px; color: var(--calcite-color-status-danger);"></calcite-icon>
                                Unable to load metrics
                            </div>
                            <div style="font-size: 12px; color: var(--calcite-color-text-3);">Please try refreshing the popup</div>
                        `;
                        container.appendChild(errorDiv);

                        console.error('Error loading node site metrics:', error);
                    }
                })();

                return container;
            }
        }
    ],
    actions: [
        {
            id: 'directions',
            title: 'Get Directions',
            icon: 'pin-tear',
            type: 'button'
        },
        {
            id: 'refresh-metrics',
            title: 'Refresh Metrics',
            icon: 'refresh',
            type: 'button'
        }
    ]
});

// Node Sites labeling configuration
const createNodeSiteLabeling = () => [
    {
        symbol: {
            type: 'text',
            color: [255, 255, 255],
            font: {
                family: 'Segoe UI, Arial, sans-serif',
                size: 11,
                weight: 'bold'
            },
            backgroundColor: [40, 40, 40, 0.9],
            borderLineColor: [255, 165, 0, 1],
            borderLineSize: 2,
            haloColor: [0, 0, 0, 0.8],
            haloSize: 1,
            callout: {
                type: 'line',
                color: [255, 165, 0, 1],
                size: 2,
                cap: 'round',
                join: 'round'
            }
        },
        labelPlacement: 'center-right',
        labelExpressionInfo: {
            expression: '$feature.Name'
        },
        deconflictionStrategy: 'none',
        repeatLabel: false,
        removeDuplicateLabels: true,
        maxScale: 0,
        minScale: 0,
        priority: 'high'
    }
];

// Node Sites field definitions
const createNodeSiteFields = () => [
    { name: 'Name', type: 'string', alias: 'Site Name' }
];

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
    title: '{name}',
    content: [
        {
            type: 'custom',
            outFields: ['*'],
            creator: function (feature) {
                const attributes = feature.graphic.attributes;

                // Field configuration for subscriber popup
                const fieldsConfig = [
                    { fieldName: 'account', label: 'Account' },
                    { fieldName: 'status', label: 'Status' },
                    { fieldName: 'full_address', label: 'Full Address' },
                    { fieldName: 'service_type', label: 'Service Type' },
                    { fieldName: 'plan_name', label: 'Plan' },
                    { fieldName: 'ta5k', label: 'TA5K' },
                    { fieldName: 'remote_id', label: 'Remote ID' },
                    { fieldName: 'ont', label: 'ONT' },
                    { fieldName: 'has_electric', label: 'Electric Available' },
                    { fieldName: 'fiber_distance', label: 'Fiber Distance' },
                    { fieldName: 'light', label: 'Light Level' },
                    { fieldName: 'last_update', label: 'Last Update', format: { dateFormat: 'short-date-short-time' } }
                ];

                // Use clipboard utility if available
                if (window.clipboardUtils && window.clipboardUtils.createPopupWithCopyButtons) {
                    return window.clipboardUtils.createPopupWithCopyButtons(attributes, fieldsConfig);
                }

                // Fallback to simple content if clipboard utils not available
                const container = document.createElement('div');
                container.innerHTML = `
                    <div style="padding: 12px;">
                        <div><strong>Account:</strong> ${attributes.account || 'N/A'}</div>
                        <div><strong>Status:</strong> ${attributes.status || 'N/A'}</div>
                        <div><strong>Address:</strong> ${attributes.full_address || 'N/A'}</div>
                        <div><strong>Service Type:</strong> ${attributes.service_type || 'N/A'}</div>
                        <div><strong>Plan:</strong> ${attributes.plan_name || 'N/A'}</div>
                        <div><strong>TA5K:</strong> ${attributes.ta5k || 'N/A'}</div>
                        <div><strong>Remote ID:</strong> ${attributes.remote_id || 'N/A'}</div>
                        <div><strong>ONT:</strong> ${attributes.ont || 'N/A'}</div>
                        <div><strong>Electric Available:</strong> ${attributes.has_electric ? 'Yes' : 'No'}</div>
                        <div><strong>Fiber Distance:</strong> ${attributes.fiber_distance || 'N/A'}</div>
                        <div><strong>Light Level:</strong> ${attributes.light || 'N/A'}</div>
                        <div><strong>Last Update:</strong> ${attributes.last_update ? new Date(attributes.last_update).toLocaleString() : 'N/A'}</div>
                    </div>
                `;
                return container;
            }
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
    { name: 'name', type: 'string', alias: 'Customer Name' },
    { name: 'account', type: 'string', alias: 'Account Number' },
    { name: 'service_address', type: 'string', alias: 'Service Address' },
    { name: 'city', type: 'string', alias: 'City' },
    { name: 'state', type: 'string', alias: 'State' },
    { name: 'zip_code', type: 'integer', alias: 'ZIP Code' },
    { name: 'full_address', type: 'string', alias: 'Full Address' },
    { name: 'status', type: 'string', alias: 'Connection Status' },
    { name: 'county', type: 'string', alias: 'County' },
    { name: 'latitude', type: 'double', alias: 'Latitude' },
    { name: 'longitude', type: 'double', alias: 'Longitude' },
    { name: 'account_status', type: 'string', alias: 'Account Status' },
    { name: 'ont', type: 'string', alias: 'ONT' },
    { name: 'plan_name', type: 'string', alias: 'Service Plan' },
    { name: 'service_type', type: 'string', alias: 'Service Type' },
    { name: 'ta5k', type: 'string', alias: 'TA5K' },
    { name: 'remote_id', type: 'string', alias: 'Remote ID' },
    { name: 'has_electric', type: 'string', alias: 'Electric Available' },
    { name: 'fiber_distance', type: 'string', alias: 'Fiber Distance' },
    { name: 'light', type: 'string', alias: 'Light Level' },
    { name: 'bip', type: 'string', alias: 'BIP' },
    { name: 'last_update', type: 'date', alias: 'Last Update' },
    { name: 'created_at', type: 'date', alias: 'Created At' },
    { name: 'updated_at', type: 'date', alias: 'Updated At' },
    { name: 'last_sync', type: 'date', alias: 'Last Sync' },
    { name: 'last_modified', type: 'date', alias: 'Last Modified' },
    { name: 'last_updated', type: 'date', alias: 'Last Updated' },
    { name: 'id', type: 'integer', alias: 'ID' },
    { name: 'index_column', type: 'string', alias: 'Index Column' },
    { name: 'number_of_records', type: 'integer', alias: 'Number of Records' },
    { name: 'geom', type: 'string', alias: 'Geometry' }
];

// Fiber Plant renderer configurations
const createFSARenderer = () => ({
    type: "unique-value",
    // Use Arcade expression to extract prefix from NAME field
    valueExpression: `
        var name = $feature.NAME;
        if (IsEmpty(name)) return "UNKNOWN";
        
        // Check for specific longer prefixes first (at beginning)
        if (Find("FAY-C3", name) == 0) return "FAY-C3";
        if (Find("FAY-C2", name) == 0) return "FAY-C2";
        if (Find("FAY-C1", name) == 0) return "FAY-C1";
        if (Find("FAY-H", name) == 0) return "FAY-H";
        if (Find("FAYE", name) == 0) return "FAYE";
        
        // Check for 3-character prefixes at beginning
        var prefix = Left(name, 3);
        if (Includes(["BRC", "BCK", "WNG", "HAM", "HAV", "BRY", "SPP", "VRN", "VIN", "WAN", "BEN", "RBN", "WIN", "NAV", "DBS", "CBH", "RUS"], prefix)) {
            return prefix;
        }
        
        // Check for patterns like XX-YY-... where YY is the code we want
        var firstHyphen = Find("-", name);
        if (firstHyphen > -1) {
            var secondHyphen = Find("-", name, firstHyphen + 1);
            if (secondHyphen > -1) {
                var middleCode = Mid(name, firstHyphen + 1, secondHyphen - firstHyphen - 1);
                if (Includes(["BE", "WA", "RB"], middleCode)) {
                    return middleCode;
                }
            }
        }
        
        return "OTHER";
    `,
    defaultSymbol: {
        type: "simple-fill",
        color: [170, 170, 170, 0.2], // Default gray
        outline: { color: [170, 170, 170, 1.0], width: 2 }
    },
    uniqueValueInfos: [
        // Fayette-specific areas
        {
            value: "FAY-C3",
            symbol: {
                type: "simple-fill",
                color: [255, 20, 147, 0.2], // Deep pink
                outline: { color: [255, 20, 147, 1.0], width: 2 }
            },
            label: "Fayette C3"
        },
        {
            value: "FAY-C2",
            symbol: {
                type: "simple-fill",
                color: [65, 105, 225, 0.2], // Royal blue
                outline: { color: [65, 105, 225, 1.0], width: 2 }
            },
            label: "Fayette C2"
        },
        {
            value: "FAY-C1",
            symbol: {
                type: "simple-fill",
                color: [255, 69, 0, 0.2], // Orange red
                outline: { color: [255, 69, 0, 1.0], width: 2 }
            },
            label: "Fayette C1"
        },
        {
            value: "FAY-H",
            symbol: {
                type: "simple-fill",
                color: [50, 205, 50, 0.2], // Lime green
                outline: { color: [50, 205, 50, 1.0], width: 2 }
            },
            label: "Fayette H"
        },
        {
            value: "FAYE",
            symbol: {
                type: "simple-fill",
                color: [148, 0, 211, 0.2], // Dark violet
                outline: { color: [148, 0, 211, 1.0], width: 2 }
            },
            label: "Fayette E"
        },
        // Regional FSA areas
        {
            value: "BRC",
            symbol: {
                type: "simple-fill",
                color: [255, 65, 54, 0.2], // Bright red
                outline: { color: [255, 65, 54, 1.0], width: 2 }
            },
            label: "BRC"
        },
        {
            value: "BCK",
            symbol: {
                type: "simple-fill",
                color: [0, 116, 217, 0.2], // Strong blue
                outline: { color: [0, 116, 217, 1.0], width: 2 }
            },
            label: "BCK"
        },
        {
            value: "WNG",
            symbol: {
                type: "simple-fill",
                color: [46, 204, 64, 0.2], // Bright green
                outline: { color: [46, 204, 64, 1.0], width: 2 }
            },
            label: "WNG"
        },
        {
            value: "HAM",
            symbol: {
                type: "simple-fill",
                color: [255, 215, 0, 0.2], // Gold
                outline: { color: [255, 215, 0, 1.0], width: 2 }
            },
            label: "HAM"
        },
        {
            value: "HAV",
            symbol: {
                type: "simple-fill",
                color: [255, 133, 27, 0.2], // Bright orange
                outline: { color: [255, 133, 27, 1.0], width: 2 }
            },
            label: "HAV"
        },
        {
            value: "BRY",
            symbol: {
                type: "simple-fill",
                color: [139, 0, 139, 0.2], // Dark magenta
                outline: { color: [139, 0, 139, 1.0], width: 2 }
            },
            label: "BRY"
        },
        {
            value: "SPP",
            symbol: {
                type: "simple-fill",
                color: [32, 178, 170, 0.2], // Light sea green
                outline: { color: [32, 178, 170, 1.0], width: 2 }
            },
            label: "SPP"
        },
        {
            value: "VRN",
            symbol: {
                type: "simple-fill",
                color: [205, 133, 63, 0.2], // Peru (brownish)
                outline: { color: [205, 133, 63, 1.0], width: 2 }
            },
            label: "VRN"
        },
        {
            value: "VIN",
            symbol: {
                type: "simple-fill",
                color: [107, 91, 149, 0.2], // Purple-gray
                outline: { color: [107, 91, 149, 1.0], width: 2 }
            },
            label: "VIN"
        },
        {
            value: "WAN",
            symbol: {
                type: "simple-fill",
                color: [0, 107, 84, 0.2], // Deep green
                outline: { color: [0, 107, 84, 1.0], width: 2 }
            },
            label: "WAN"
        },
        {
            value: "BEN",
            symbol: {
                type: "simple-fill",
                color: [139, 0, 0, 0.2], // Dark red
                outline: { color: [139, 0, 0, 1.0], width: 2 }
            },
            label: "BEN"
        },
        {
            value: "RBN",
            symbol: {
                type: "simple-fill",
                color: [70, 130, 180, 0.2], // Steel blue
                outline: { color: [70, 130, 180, 1.0], width: 2 }
            },
            label: "RBN"
        },
        {
            value: "WIN",
            symbol: {
                type: "simple-fill",
                color: [255, 105, 180, 0.2], // Hot pink
                outline: { color: [255, 105, 180, 1.0], width: 2 }
            },
            label: "WIN"
        },
        {
            value: "NAV",
            symbol: {
                type: "simple-fill",
                color: [0, 191, 255, 0.2], // Deep sky blue
                outline: { color: [0, 191, 255, 1.0], width: 2 }
            },
            label: "NAV"
        },
        {
            value: "DBS",
            symbol: {
                type: "simple-fill",
                color: [153, 50, 204, 0.2], // Dark orchid
                outline: { color: [153, 50, 204, 1.0], width: 2 }
            },
            label: "DBS"
        },
        {
            value: "CBH",
            symbol: {
                type: "simple-fill",
                color: [255, 127, 80, 0.2], // Coral
                outline: { color: [255, 127, 80, 1.0], width: 2 }
            },
            label: "CBH"
        },
        {
            value: "RUS",
            symbol: {
                type: "simple-fill",
                color: [178, 34, 34, 0.2], // Fire brick
                outline: { color: [178, 34, 34, 1.0], width: 2 }
            },
            label: "RUS"
        },
        {
            value: "BE",
            symbol: {
                type: "simple-fill",
                color: [72, 61, 139, 0.2], // Dark slate blue
                outline: { color: [72, 61, 139, 1.0], width: 2 }
            },
            label: "BE"
        },
        {
            value: "WA",
            symbol: {
                type: "simple-fill",
                color: [34, 139, 34, 0.2], // Forest green
                outline: { color: [34, 139, 34, 1.0], width: 2 }
            },
            label: "WA"
        },
        {
            value: "RB",
            symbol: {
                type: "simple-fill",
                color: [218, 165, 32, 0.2], // Goldenrod
                outline: { color: [218, 165, 32, 1.0], width: 2 }
            },
            label: "RB"
        }
    ]
});

const createMainLineFiberRenderer = () => ({
    type: 'unique-value',
    field: 'FIBERCOUNT',
    defaultSymbol: {
        type: 'simple-line',
        color: [165, 42, 42, 0.8], // Brown default
        width: 3,
        cap: 'round',
        join: 'round'
    },
    uniqueValueInfos: [
        {
            value: 12,
            symbol: {
                type: 'simple-line',
                color: [0, 255, 0, 0.8], // Green for 12 fibers
                width: 2,
                cap: 'round',
                join: 'round'
            },
            label: '12 Fibers'
        },
        {
            value: 24,
            symbol: {
                type: 'simple-line',
                color: [255, 255, 0, 0.8], // Yellow for 24 fibers
                width: 3,
                cap: 'round',
                join: 'round'
            },
            label: '24 Fibers'
        },
        {
            value: 48,
            symbol: {
                type: 'simple-line',
                color: [255, 165, 0, 0.8], // Orange for 48 fibers
                width: 4,
                cap: 'round',
                join: 'round'
            },
            label: '48 Fibers'
        },
        {
            value: 96,
            symbol: {
                type: 'simple-line',
                color: [139, 69, 19, 0.8], // Brown for 96 fibers
                width: 5,
                cap: 'round',
                join: 'round'
            },
            label: '96 Fibers'
        },
        {
            value: 144,
            symbol: {
                type: 'simple-line',
                color: [255, 0, 0, 0.8], // Red for 144 fibers
                width: 6,
                cap: 'round',
                join: 'round'
            },
            label: '144 Fibers'
        }
    ]
});

const createMainLineOldRenderer = () => ({
    type: 'unique-value',
    field: 'FIBERCOUNT',
    defaultSymbol: {
        type: 'simple-line',
        color: [105, 105, 105, 0.8], // Gray default for "old" infrastructure
        width: 3,
        cap: 'round',
        join: 'round'
    },
    uniqueValueInfos: [
        {
            value: 12,
            symbol: {
                type: 'simple-line',
                color: [0, 200, 0, 0.6], // Dimmed green for 12 fibers
                width: 2,
                cap: 'round',
                join: 'round'
            },
            label: '12 Fibers (Old)'
        },
        {
            value: 24,
            symbol: {
                type: 'simple-line',
                color: [200, 200, 0, 0.6], // Dimmed yellow for 24 fibers
                width: 3,
                cap: 'round',
                join: 'round'
            },
            label: '24 Fibers (Old)'
        },
        {
            value: 48,
            symbol: {
                type: 'simple-line',
                color: [200, 130, 0, 0.6], // Dimmed orange for 48 fibers
                width: 4,
                cap: 'round',
                join: 'round'
            },
            label: '48 Fibers (Old)'
        },
        {
            value: 96,
            symbol: {
                type: 'simple-line',
                color: [110, 55, 15, 0.6], // Dimmed brown for 96 fibers
                width: 5,
                cap: 'round',
                join: 'round'
            },
            label: '96 Fibers (Old)'
        },
        {
            value: 144,
            symbol: {
                type: 'simple-line',
                color: [200, 0, 0, 0.6], // Dimmed red for 144 fibers
                width: 6,
                cap: 'round',
                join: 'round'
            },
            label: '144 Fibers (Old)'
        }
    ]
});

const createMSTTerminalRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [0, 191, 255, 0.8], // Deep sky blue
        size: 10,
        outline: {
            color: [0, 191, 255, 1],
            width: 2
        }
    }
});

// MST Terminal labeling configuration - enhanced for better visibility
const createMSTTerminalLabeling = () => [
    {
        symbol: {
            type: 'text',
            color: [255, 255, 255], // White text for high contrast
            font: {
                family: 'Segoe UI, Arial, sans-serif',
                size: 12, // Increased from 10px for better readability
                weight: 'bold'
            },
            backgroundColor: [25, 25, 25, 0.95], // Dark background for better contrast
            borderLineColor: [0, 191, 255, 1], // Blue border to match point color
            borderLineSize: 2, // Increased border width for better definition
            haloColor: [0, 0, 0, 1], // Stronger halo for text separation
            haloSize: 2 // Increased halo size for better visibility
        },
        labelPlacement: 'above-center',
        labelExpressionInfo: {
            expression: '$feature.STRUCTURE_'
        },
        deconflictionStrategy: 'dynamic', // Changed from static for better label positioning
        repeatLabel: false,
        removeDuplicateLabels: true,
        minScale: 6000,  // Only show labels when very zoomed in
        maxScale: 0
    }
];

const createSplitterRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'diamond',
        color: [128, 0, 128, 0.8], // Purple
        size: 10,
        outline: {
            color: [128, 0, 128, 1],
            width: 2
        }
    }
});

const createClosureRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'square',
        color: [255, 140, 0, 0.8], // Orange
        size: 8,
        outline: {
            color: [255, 140, 0, 1],
            width: 2
        }
    }
});

const createMSTFiberRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-line',
        color: [75, 0, 130, 0.8], // Indigo
        width: 2,
        cap: 'round',
        join: 'round'
    }
});

// Fiber Plant popup templates
const createFSAPopup = () => ({
    title: 'FSA: {NAME}',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'NAME', label: 'Service Area Name', visible: true },
                { fieldName: 'Area', label: 'Area (sq ft)', visible: true },
                { fieldName: 'Status', label: 'Status', visible: true }
            ]
        }
    ]
});

const createMainLineFiberPopup = () => ({
    title: 'Main Line Fiber - {FIBERCOUNT} Fibers',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'FIBERCOUNT', label: 'Fiber Count', visible: true },
                { fieldName: 'CABLE_NAME', label: 'Cable Name', visible: true },
                { fieldName: 'PLACEMENTT', label: 'Placement Type', visible: true },
                { fieldName: 'CABLETYPE', label: 'Cable Type', visible: true },
                { fieldName: 'CALCULATED', label: 'Calculated Length', visible: true, format: { places: 2 } },
                { fieldName: 'MEASUREDLE', label: 'Measured Length', visible: true, format: { places: 2 } }
            ]
        }
    ],
    actions: [
        {
            id: 'copy-cable-info',
            title: 'Copy Cable Info',
            icon: 'duplicate',
            type: 'button'
        }
    ]
});

const createMainLineOldPopup = () => ({
    title: 'Main Line Old - {FIBERCOUNT} Fibers',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'FIBERCOUNT', label: 'Fiber Count', visible: true },
                { fieldName: 'SUM_CALCULATEDLENGTH', label: 'Calculated Length', visible: true, format: { places: 2 } },
                { fieldName: 'SUM_MEASUREDLENGTH', label: 'Measured Length', visible: true, format: { places: 2 } },
                { fieldName: 'Shape_Length', label: 'Shape Length', visible: true, format: { places: 2 } },
                { fieldName: 'OBJECTID', label: 'Object ID', visible: true }
            ]
        }
    ],
    actions: [
        {
            id: 'copy-cable-info',
            title: 'Copy Cable Info',
            icon: 'duplicate',
            type: 'button'
        }
    ]
});

const createMSTTerminalPopup = () => ({
    title: 'MST Terminal: {STRUCTURE_}',
    content: [
        {
            type: 'custom',
            outFields: ['*'],
            creator: function (feature) {
                const attributes = feature.graphic.attributes;

                // Create container for popup content
                const container = document.createElement('div');
                container.style.cssText = 'padding: 0; font-family: "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;';

                // Field configuration with null handling
                const fieldsConfig = [
                    { fieldName: 'CLLI', label: 'CLLI Code' },
                    { fieldName: 'STRUCTURE_', label: 'Structure ID' },
                    { fieldName: 'EQUIP_FRAB', label: 'Equipment FRAB' },
                    { fieldName: 'MODELNUMBE', label: 'Model Number' },
                    { fieldName: 'LOCID', label: 'Location ID' },
                    { fieldName: 'OUTPUTPORT', label: 'Output Ports' },
                    { fieldName: 'GPSLATITUD', label: 'GPS Latitude', format: { places: 8 } },
                    { fieldName: 'GPSLONGITU', label: 'GPS Longitude', format: { places: 8 } }
                ];

                // Create fields table
                const table = document.createElement('table');
                table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 14px;';

                fieldsConfig.forEach(field => {
                    const row = document.createElement('tr');
                    row.style.cssText = 'border-bottom: 1px solid var(--calcite-color-border-3);';

                    const labelCell = document.createElement('td');
                    labelCell.style.cssText = 'padding: 8px 12px; font-weight: 600; color: var(--calcite-color-text-2); width: 40%; vertical-align: top;';
                    labelCell.textContent = field.label;

                    const valueCell = document.createElement('td');
                    valueCell.style.cssText = 'padding: 8px 12px; color: var(--calcite-color-text-1); word-break: break-word;';

                    const value = attributes[field.fieldName];

                    if (value === null || value === undefined || value === '') {
                        valueCell.innerHTML = '<span style="color: var(--calcite-color-text-3); font-style: italic;">Not Available in Dataset</span>';
                    } else {
                        let displayValue = value.toString();

                        // Apply formatting if specified
                        if (field.format && field.format.places && !isNaN(value)) {
                            displayValue = parseFloat(value).toFixed(field.format.places);
                        }

                        valueCell.textContent = displayValue;
                    }

                    row.appendChild(labelCell);
                    row.appendChild(valueCell);
                    table.appendChild(row);
                });

                container.appendChild(table);

                // Add data source note
                const noteDiv = document.createElement('div');
                noteDiv.style.cssText = 'margin-top: 12px; padding: 8px; background: var(--calcite-color-foreground-2); border-radius: 4px; font-size: 12px; color: var(--calcite-color-text-3); border-left: 3px solid var(--calcite-color-brand);';
                noteDiv.innerHTML = '<strong>Note:</strong> Fields showing "Not Available in Dataset" indicate the information was not provided in the source data, not a system error.';
                container.appendChild(noteDiv);

                return container;
            }
        }
    ],
    actions: [
        {
            id: 'copy-info',
            title: 'Copy Terminal Info',
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

const createSplitterPopup = () => ({
    title: 'Splitter: {STRUCTURE_}',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'STRUCTURE_', label: 'Structure ID', visible: true },
                { fieldName: 'CLLI', label: 'CLLI Code', visible: true },
                { fieldName: 'EQUIP_FRAB', label: 'Equipment FRAB', visible: true },
                { fieldName: 'OUTPUTPORT', label: 'Output Port Count', visible: true }
            ]
        }
    ],
    actions: [
        {
            id: 'directions',
            title: 'Get Directions',
            icon: 'pin-tear',
            type: 'button'
        }
    ]
});

const createClosurePopup = () => ({
    title: 'Closure: {STRUCTURE_}',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'STRUCTURE_', label: 'Structure ID', visible: true },
                { fieldName: 'CLLI', label: 'CLLI Code', visible: true }
            ]
        }
    ],
    actions: [
        {
            id: 'directions',
            title: 'Get Directions',
            icon: 'pin-tear',
            type: 'button'
        }
    ]
});

const createMSTFiberPopup = () => ({
    title: 'MST Fiber Connection',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'Name', label: 'Connection Name', visible: true },
                { fieldName: 'FIBERCOUNT', label: 'Fiber Count', visible: true },
                { fieldName: 'Status', label: 'Status', visible: true },
                { fieldName: 'Length', label: 'Length', visible: true, format: { places: 2 } }
            ]
        }
    ]
});

// Fiber Plant field definitions
const createFSAFields = () => [
    { name: 'NAME', type: 'string', alias: 'Service Area Name' },
    { name: 'Area', type: 'double', alias: 'Area (sq ft)' },
    { name: 'Status', type: 'string', alias: 'Status' }
];

// FSA Labeling configuration for scale-dependent display
const createFSALabeling = () => [
    {
        symbol: {
            type: "text",
            color: [255, 255, 255], // White text for good contrast
            font: {
                family: "Arial",
                size: 12, // Professional size
                weight: "bold"
            },
            haloColor: [0, 0, 0],
            haloSize: 2 // Black halo for readability against any background
        },
        labelPlacement: "always-horizontal",
        labelExpressionInfo: {
            expression: "$feature.NAME"
        },
        deconflictionStrategy: "static", // Enable collision detection to prevent overlap
        repeatLabel: false, // Don't repeat labels for the same feature
        removeDuplicateLabels: true, // Remove duplicate labels
        maxScale: 0, // No limit on zooming in
        minScale: 80000 // Hide labels when zoomed out past zoom level 14 (scale 1:80,000)
    }
];

const createMainLineFiberFields = () => [
    { name: 'FIBERCOUNT', type: 'integer', alias: 'Fiber Count' },
    { name: 'CABLE_NAME', type: 'string', alias: 'Cable Name' },
    { name: 'PLACEMENTT', type: 'string', alias: 'Placement Type' },
    { name: 'CABLETYPE', type: 'string', alias: 'Cable Type' },
    { name: 'CALCULATED', type: 'double', alias: 'Calculated Length' },
    { name: 'MEASUREDLE', type: 'double', alias: 'Measured Length' }
];

const createMainLineOldFields = () => [
    { name: 'OBJECTID', type: 'oid', alias: 'Object ID' },
    { name: 'FIBERCOUNT', type: 'integer', alias: 'Fiber Count' },
    { name: 'SUM_CALCULATEDLENGTH', type: 'double', alias: 'Calculated Length' },
    { name: 'SUM_MEASUREDLENGTH', type: 'double', alias: 'Measured Length' },
    { name: 'Shape_Length', type: 'double', alias: 'Shape Length' }
];

const createMSTTerminalFields = () => [
    { name: 'CLLI', type: 'string', alias: 'CLLI Code' },
    { name: 'STRUCTURE_', type: 'string', alias: 'Structure ID' },
    { name: 'EQUIP_FRAB', type: 'string', alias: 'Equipment FRAB' },
    { name: 'MODELNUMBE', type: 'string', alias: 'Model Number' },
    { name: 'LOCID', type: 'string', alias: 'Location ID' },
    { name: 'GPSLATITUD', type: 'double', alias: 'GPS Latitude' },
    { name: 'GPSLONGITU', type: 'double', alias: 'GPS Longitude' },
    { name: 'OUTPUTPORT', type: 'integer', alias: 'Output Ports' }
];

const createSplitterFields = () => [
    { name: 'STRUCTURE_', type: 'string', alias: 'Structure ID' },
    { name: 'CLLI', type: 'string', alias: 'CLLI Code' },
    { name: 'EQUIP_FRAB', type: 'string', alias: 'Equipment FRAB' },
    { name: 'OUTPUTPORT', type: 'integer', alias: 'Output Port Count' }
];

const createClosureFields = () => [
    { name: 'STRUCTURE_', type: 'string', alias: 'Structure ID' },
    { name: 'CLLI', type: 'string', alias: 'CLLI Code' }
];

const createMSTFiberFields = () => [
    { name: 'Name', type: 'string', alias: 'Connection Name' },
    { name: 'FIBERCOUNT', type: 'integer', alias: 'Fiber Count' },
    { name: 'Status', type: 'string', alias: 'Status' },
    { name: 'Length', type: 'double', alias: 'Length' }
];

// Truck renderer configurations (with proper visual variables for smooth updates)
const createTruckRenderer = (truckType) => {
    const colors = {
        fiber: [30, 95, 175, 0.9],     // Alabama Power blue
        electric: [74, 124, 89, 0.9]   // Tombigbee green
    };

    const color = colors[truckType] || [128, 128, 128, 0.9]; // Default gray

    return {
        type: 'simple',
        symbol: {
            type: "simple-marker",
            style: "triangle",
            color: color,
            size: 24,
            outline: {
                color: [255, 255, 255],
                width: 2
            }
        },
        visualVariables: [
            {
                type: "rotation",
                field: "bearing",
                rotationType: "geographic"
            },
            {
                type: "color",
                field: "is_driving",
                stops: [
                    { value: 0, color: [...color.slice(0, 3), 0.6] },
                    { value: 1, color: color }
                ]
            },
            {
                type: "size",
                field: "is_driving",
                stops: [
                    { value: 0, size: 22 },
                    { value: 1, size: 28 }
                ]
            }
        ]
    };
};

// Truck popup templates
const createTruckPopup = (truckType) => {
    const vehicleTypeDisplay = truckType === 'fiber' ? 'Fiber Installation' : 'Electric Maintenance';

    return {
        title: '{name}',
        content: [
            {
                type: 'fields',
                fieldInfos: [
                    { fieldName: 'name', label: 'Vehicle Name', visible: true },
                    { fieldName: 'installer', label: 'Installer/Driver', visible: true },
                    { fieldName: 'vehicle_type', label: 'Vehicle Type', visible: true },
                    { fieldName: 'speed', label: 'Speed (mph)', visible: true },
                    { fieldName: 'bearing', label: 'Bearing', visible: true },
                    { fieldName: 'communication_status', label: 'Connection Status', visible: true },
                    { fieldName: 'last_updated', label: 'Last Update', visible: true }
                ]
            },
            {
                type: 'text',
                text: `<div style="margin-top: 10px; padding: 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px;">
                    <strong>Vehicle Type:</strong> ${vehicleTypeDisplay}<br/>
                    <strong>Real-time tracking:</strong> Updates every 3 seconds
                </div>`
            }
        ],
        actions: [
            {
                id: 'copy-truck-info',
                title: 'Copy Truck Info',
                icon: 'duplicate',
                type: 'button'
            },
            {
                id: 'get-directions',
                title: 'Get Directions',
                icon: 'pin-tear',
                type: 'button'
            },
            {
                id: 'track-vehicle',
                title: 'Track Vehicle',
                icon: 'locate',
                type: 'button'
            }
        ]
    };
};

// Truck field definitions (matching actual GeotabService data structure)
const createTruckFields = () => [
    { name: 'OBJECTID', type: 'oid', alias: 'Object ID' },
    { name: 'id', type: 'string', alias: 'Vehicle ID' },
    { name: 'name', type: 'string', alias: 'Vehicle Name' },
    { name: 'latitude', type: 'double', alias: 'Latitude' },
    { name: 'longitude', type: 'double', alias: 'Longitude' },
    { name: 'installer', type: 'string', alias: 'Installer/Driver' },
    { name: 'speed', type: 'integer', alias: 'Speed (mph)' },
    { name: 'is_driving', type: 'integer', alias: 'Is Driving' }, // boolean converted to 0/1
    { name: 'bearing', type: 'double', alias: 'Bearing' },
    { name: 'communication_status', type: 'string', alias: 'Communication Status' },
    { name: 'last_updated', type: 'string', alias: 'Last Updated' }, // ISO string, not date
    { name: 'vehicle_type', type: 'string', alias: 'Vehicle Type' }
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
        zOrder: 10,  // Changed from 0 to ensure it's above basemap
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
        zOrder: 8, // Below subscriber points and clusters
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
        zOrder: 8, // Below subscriber points and clusters
        dataServiceMethod: () => subscriberDataService.getTombigbeeOutages()
    },

    // Node Sites Layer
    nodeSites: {
        id: 'node-sites',
        title: 'Node Sites',
        dataSource: 'node_sites',
        renderer: createNodeSiteRenderer(),
        popupTemplate: createNodeSitePopup(),
        fields: createNodeSiteFields(),
        labelingInfo: createNodeSiteLabeling(),
        visible: false,
        zOrder: 120,
        dataServiceMethod: () => subscriberDataService.getNodeSites()
    },

    // Fiber Plant Layers
    fsaBoundaries: {
        id: 'fsa-boundaries',
        title: 'FSA Boundaries',
        dataSource: 'fsa_boundaries',
        renderer: createFSARenderer(),
        popupTemplate: createFSAPopup(),
        fields: createFSAFields(),
        labelingInfo: createFSALabeling(),
        visible: false,
        zOrder: 5, // Below all point layers
        dataServiceMethod: () => subscriberDataService.getFSABoundaries()
    },

    mainLineFiber: {
        id: 'main-line-fiber',
        title: 'Main Line Fiber',
        dataSource: 'main_line_fiber',
        renderer: createMainLineFiberRenderer(),
        popupTemplate: createMainLineFiberPopup(),
        fields: createMainLineFiberFields(),
        visible: false,
        zOrder: 30,
        dataServiceMethod: () => subscriberDataService.getMainLineFiber()
    },

    mainLineOld: {
        id: 'main-line-old',
        title: 'Main Line Old',
        dataSource: 'main_line_old',
        renderer: createMainLineOldRenderer(),
        popupTemplate: createMainLineOldPopup(),
        fields: createMainLineOldFields(),
        visible: false,
        zOrder: 28, // Slightly below current main line
        dataServiceMethod: () => subscriberDataService.getMainLineOld()
    },

    mstTerminals: {
        id: 'mst-terminals',
        title: 'MST Terminals',
        dataSource: 'mst_terminals',
        renderer: createMSTTerminalRenderer(),
        popupTemplate: createMSTTerminalPopup(),
        fields: createMSTTerminalFields(),
        labelingInfo: createMSTTerminalLabeling(),
        visible: false,
        zOrder: 50,
        // Only show when zoomed in past zoom level 15 (street level)
        minScale: 24000,  // Hide when zoomed out beyond this scale
        maxScale: 0,      // No limit on zooming in
        dataServiceMethod: () => subscriberDataService.getMSTTerminals()
    },

    splitters: {
        id: 'splitters',
        title: 'Splitters',
        dataSource: 'splitters',
        renderer: createSplitterRenderer(),
        popupTemplate: createSplitterPopup(),
        fields: createSplitterFields(),
        visible: false,
        zOrder: 60,
        // Only show when zoomed in past zoom level 15 (street level)
        minScale: 24000,  // Hide when zoomed out beyond this scale
        maxScale: 0,      // No limit on zooming in
        dataServiceMethod: () => subscriberDataService.getSplitters()
    },

    closures: {
        id: 'closures',
        title: 'Closures',
        dataSource: 'closures',
        renderer: createClosureRenderer(),
        popupTemplate: createClosurePopup(),
        fields: createClosureFields(),
        visible: false,
        zOrder: 40,
        // Only show when zoomed in past zoom level 16 (closer street level)
        minScale: 12000,  // Hide when zoomed out beyond this scale
        maxScale: 0,      // No limit on zooming in
        dataServiceMethod: () => subscriberDataService.getClosures()
    },

    mstFiber: {
        id: 'mst-fiber',
        title: 'MST Fiber',
        dataSource: 'mst_fiber',
        renderer: createMSTFiberRenderer(),
        popupTemplate: createMSTFiberPopup(),
        fields: createMSTFiberFields(),
        visible: false,
        zOrder: 35,
        dataServiceMethod: () => subscriberDataService.getMSTFiber()
    },

    // Truck layers
    fiberTrucks: {
        id: 'fiber-trucks',
        title: 'Fiber Trucks',
        dataSource: 'fiber_trucks',
        renderer: createTruckRenderer('fiber'),
        popupTemplate: createTruckPopup('fiber'),
        fields: createTruckFields(),
        visible: false,
        zOrder: 130,
        dataServiceMethod: () => subscriberDataService.getFiberTrucks()
    },

    electricTrucks: {
        id: 'electric-trucks',
        title: 'Electric Trucks',
        dataSource: 'electric_trucks',
        renderer: createTruckRenderer('electric'),
        popupTemplate: createTruckPopup('electric'),
        fields: createTruckFields(),
        visible: false,
        zOrder: 130,
        dataServiceMethod: () => subscriberDataService.getElectricTrucks()
    },

    // County Boundaries Layer
    countyBoundaries: {
        id: 'county-boundaries',
        title: 'County Boundaries',
        layerType: 'GeoJSONLayer',
        dataUrl: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/ff-counties.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2ZmLWNvdW50aWVzLmdlb2pzb24iLCJpYXQiOjE3NTQ2MjIzNDIsImV4cCI6MjA2OTk4MjM0Mn0.j-_q73dD2iJvR20l7V93aIcUUcCGIbCjcynTqHLdf6I',
        renderer: {
            type: 'simple',
            symbol: {
                type: 'simple-fill',
                style: 'none', // No fill, just outline
                outline: {
                    color: [128, 128, 128, 0.8], // Gray outline
                    width: 1.5
                }
            }
        },
        popupTemplate: {
            title: 'County Boundary',
            content: 'County boundary information'
        },
        visible: true, // Load by default
        zOrder: 1, // Above basemap, below most other layers
        fields: [] // Will be inferred from GeoJSON
    },

    // Weather Radar Layer (RainViewer)
    rainViewerRadar: {
        id: 'rainviewer-radar',
        title: 'Weather Radar',
        layerType: 'WebTileLayer',
        visible: false,
        zOrder: -10, // Below all basemap layers
        // This layer is created dynamically by RainViewerService
        // No dataServiceMethod needed - handled by service
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