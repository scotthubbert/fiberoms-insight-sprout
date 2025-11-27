// layerConfigs.js - Open/Closed: Extend through configuration
import { subscriberDataService } from '../dataService.js';
import { infrastructureService } from '../services/InfrastructureService.js';

// Renderer configurations
// Offline renderer - excludes electric offline (those are in a separate layer)
const createOfflineRenderer = () => ({
    type: 'unique-value',
    field: 'service_type',
    defaultSymbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [220, 38, 38, 0.8], // Default red for non-business internet
        size: 12,
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
                size: 12,
                outline: {
                    color: [220, 38, 38, 1], // Red outline for offline business internet
                    width: 2
                }
            }
        }
    ],
    // Scale-dependent sizing with smooth interpolation to prevent cluttering at different zoom levels
    visualVariables: [{
        type: "size",
        valueExpression: "$view.scale",
        stops: [
            { value: 80000, size: 12 },      // Zoom 14 and closer: Full size
            { value: 1000000, size: 6 },     // Zoom 10-13: Smaller size
            { value: 10000000, size: 3 }     // Zoom 6-9: Tiny size
        ],
        interpolation: "linear"  // Smooth interpolation between zoom levels
    }]
});

// Electric Offline renderer - simple yellow markers (all are electric offline)
const createElectricOfflineRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [255, 193, 7, 0.9], // Yellow for electric offline
        size: 12,
        outline: {
            color: [255, 152, 0, 1], // Darker yellow/orange outline
            width: 2
        }
    },
    // Scale-dependent sizing with smooth interpolation
    visualVariables: [{
        type: "size",
        valueExpression: "$view.scale",
        stops: [
            { value: 80000, size: 12 },      // Zoom 14 and closer: Full size
            { value: 1000000, size: 6 },     // Zoom 10-13: Smaller size
            { value: 10000000, size: 3 }     // Zoom 6-9: Tiny size
        ],
        interpolation: "linear"  // Smooth interpolation between zoom levels
    }]
});

const createOnlineRenderer = () => ({
    type: 'unique-value',
    field: 'service_type',
    defaultSymbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [50, 255, 50, 0.9], // Brighter green for better visibility on satellite view
        size: 10,
        outline: {
            color: [0, 200, 0, 1], // Darker green outline for contrast
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
                size: 10,
                outline: {
                    color: [147, 51, 234, 1], // Purple outline for online business internet
                    width: 1
                }
            }
        }
    ],
    // Scale-dependent sizing with smooth interpolation to prevent cluttering at different zoom levels
    visualVariables: [{
        type: "size",
        valueExpression: "$view.scale",
        stops: [
            { value: 80000, size: 10 },      // Zoom 14 and closer: Full size
            { value: 1000000, size: 4 },     // Zoom 10-13: Smaller size
            { value: 10000000, size: 2 }     // Zoom 6-9: Tiny size
        ],
        interpolation: "linear"  // Smooth interpolation between zoom levels
    }]
});

// Clustering configuration for offline subscribers - optimized for production
const createOfflineClusterConfig = () => ({
    type: 'cluster',
    clusterRadius: '60px',
    // Performance: Set min/max size for better rendering performance
    clusterMinSize: '24px',
    clusterMaxSize: '108px',
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
                    { value: 1, size: '24px' },      // Single offline subscriber
                    { value: 5, size: '36px' },      // Small cluster
                    { value: 10, size: '48px' },     // Medium cluster
                    { value: 25, size: '64px' },     // Large cluster
                    { value: 50, size: '84px' },     // Very large cluster
                    { value: 100, size: '108px' }     // Massive cluster
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
                    size: '24px'
                },
                haloColor: [0, 0, 0, 0.8],
                haloSize: 2
            },
            labelPlacement: 'center-center'
        }
    ]
});

// Online subscribers clustering configuration - optimized for 25k+ features
const createOnlineClusterConfig = () => ({
    type: 'cluster',
    clusterRadius: '45px', // Smaller radius for denser data
    clusterMinSize: '20px',
    clusterMaxSize: '80px',
    // Disable clustering at street level zoom for detail work
    maxScale: 80000, // Only show individual points when zoomed to ~zoom level 14
    popupTemplate: {
        title: 'Online Subscribers Cluster',
        content: 'This cluster represents <b>{cluster_count}</b> online subscribers.',
        fieldInfos: [{
            fieldName: 'cluster_count',
            format: {
                places: 0,
                digitSeparator: true
            }
        }]
    },
    renderer: {
        type: 'simple',
        symbol: {
            type: 'simple-marker',
            style: 'circle',
            color: [50, 255, 50, 0.9], // Brighter green for online (matches main renderer)
            outline: {
                color: [0, 200, 0, 1], // Darker green outline for contrast
                width: 2
            }
        },
        visualVariables: [{
            type: 'size',
            field: 'cluster_count',
            stops: [
                { value: 1, size: '20px' },
                { value: 10, size: '32px' },
                { value: 50, size: '44px' },
                { value: 100, size: '56px' },
                { value: 500, size: '68px' },
                { value: 1000, size: '80px' }
            ]
        }]
    }
});

// Electric Offline cluster configuration - yellow to match electric offline markers
const createElectricOfflineClusterConfig = () => ({
    type: 'cluster',
    clusterRadius: '60px',
    clusterMinSize: '24px',
    clusterMaxSize: '108px',
    // Disable clustering at high zoom levels where individual features are more useful
    maxScale: 50000,
    popupTemplate: {
        title: 'Electric Offline Subscribers Cluster',
        content: 'This cluster represents <b>{cluster_count}</b> electric offline subscribers in this area.',
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
    renderer: {
        type: 'simple',
        symbol: {
            type: 'simple-marker',
            style: 'circle',
            color: [255, 193, 7, 0.9], // Yellow for electric offline (matches main renderer)
            outline: {
                color: [255, 152, 0, 1], // Darker yellow/orange outline for contrast
                width: 2
            }
        },
        visualVariables: [{
            type: 'size',
            field: 'cluster_count',
            stops: [
                { value: 1, size: '24px' },
                { value: 5, size: '36px' },
                { value: 10, size: '48px' },
                { value: 25, size: '64px' },
                { value: 50, size: '84px' },
                { value: 100, size: '108px' }
            ]
        }]
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
                    size: '24px'
                },
                haloColor: [0, 0, 0, 0.8],
                haloSize: 2
            },
            labelPlacement: 'center-center'
        }
    ]
});

// Sprout Huts renderer
const createSproutHutRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'square',
        color: [255, 140, 0, 0.8], // Orange color for Huts (APWA communication standard)
        size: 14,
        outline: {
            color: [255, 255, 255, 1],
            width: 2
        }
    }
});

// Sprout Huts popup
const createSproutHutPopup = () => ({
    title: '{name}',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'name', label: 'Name', visible: true },
                { fieldName: 'description', label: 'Description', visible: true },
                { fieldName: 'id', label: 'ID', visible: true }
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

// Sprout Huts fields
const createSproutHutFields = () => [
    { name: 'name', type: 'string', alias: 'Name' },
    { name: 'description', type: 'string', alias: 'Description' },
    { name: 'id', type: 'string', alias: 'ID' }
];

// Sprout Huts labeling configuration
const createSproutHutLabeling = () => [
    {
        symbol: {
            type: 'text',
            color: [255, 255, 255], // White text for better aesthetics and readability
            font: {
                family: 'Arial', // Single font name to avoid ArcGIS font loading issues
                size: 12,
                weight: 'bold'
            },
            haloColor: [0, 0, 0, 0.85], // Black halo
            haloSize: 2
        },
        labelPlacement: 'above-center',
        labelExpressionInfo: {
            expression: '$feature.name'
        },
        deconflictionStrategy: 'dynamic', // Enable collision detection to avoid overlapping with clusters
        repeatLabel: false,
        removeDuplicateLabels: false,
        maxScale: 0,
        minScale: 0
    }
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
    { name: 'Status', type: 'string', alias: 'Status' }, // Database field (capital S)
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
    { name: 'electricOut', type: 'string', alias: 'Electric Out' },
    { name: 'electric_out', type: 'string', alias: 'Electric Out' }, // Alternative field name
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
    { name: 'geom', type: 'string', alias: 'Geometry' },
    { name: '_stable_id', type: 'string', alias: 'Stable ID' } // For tracking updates in LayerManager
];

// Fiber Plant renderer configurations
// DA (Distribution Area) colors matching reference repository
// Uses Arcade expression to extract 2-letter prefix from areaname (e.g., "HE-18-2434" -> "HE")
const createFSARenderer = () => ({
    type: "unique-value",
    // When using valueExpression, don't specify field property
    // Extract first 2 characters from areaname (e.g., "HE-18-2434" -> "HE")
    valueExpression: "IIf(IsEmpty($feature.areaname), 'Unknown', Upper(Left(Text($feature.areaname), 2)))",
    defaultSymbol: {
        type: "simple-fill",
        color: [204, 204, 204, 0.1], // Very low fill opacity - mainly show lines
        outline: { color: [204, 204, 204, 1.0], width: 3 } // Increased width for better visibility
    },
    // Generate a distinct color palette for the areas
    // This matches the Mapbox style logic from the reference app (/Users/scotthubbert/Developer/clients/sprout-fiber/insight)
    uniqueValueInfos: [
        // Red group - AD
        { value: "AD", symbol: { type: "simple-fill", color: [211, 47, 47, 0.1], outline: { color: [211, 47, 47, 1], width: 3 } } },
        // Blue group
        { value: "BH", symbol: { type: "simple-fill", color: [25, 118, 210, 0.1], outline: { color: [25, 118, 210, 1], width: 3 } } },
        { value: "EB", symbol: { type: "simple-fill", color: [2, 136, 209, 0.1], outline: { color: [2, 136, 209, 1], width: 3 } } },
        { value: "TB", symbol: { type: "simple-fill", color: [2, 136, 209, 0.1], outline: { color: [2, 136, 209, 1], width: 3 } } },
        { value: "TD", symbol: { type: "simple-fill", color: [25, 118, 210, 0.1], outline: { color: [25, 118, 210, 1], width: 3 } } },
        // Green group
        { value: "BL", symbol: { type: "simple-fill", color: [56, 142, 60, 0.1], outline: { color: [56, 142, 60, 1], width: 3 } } },
        { value: "JC", symbol: { type: "simple-fill", color: [56, 142, 60, 0.1], outline: { color: [56, 142, 60, 1], width: 3 } } },
        // Yellow/Gold group
        { value: "BM", symbol: { type: "simple-fill", color: [251, 192, 45, 0.1], outline: { color: [251, 192, 45, 1], width: 3 } } },
        { value: "FV", symbol: { type: "simple-fill", color: [175, 180, 43, 0.1], outline: { color: [175, 180, 43, 1], width: 3 } } },
        { value: "HP", symbol: { type: "simple-fill", color: [125, 102, 8, 0.1], outline: { color: [125, 102, 8, 1], width: 3 } } },
        // Pink/Purple group
        { value: "ER", symbol: { type: "simple-fill", color: [194, 24, 91, 0.1], outline: { color: [194, 24, 91, 1], width: 3 } } },
        { value: "SC", symbol: { type: "simple-fill", color: [142, 36, 170, 0.1], outline: { color: [142, 36, 170, 1], width: 3 } } },
        // Cyan/Teal group
        { value: "HE", symbol: { type: "simple-fill", color: [0, 151, 167, 0.1], outline: { color: [0, 151, 167, 1], width: 3 } } },
        // Orange group
        { value: "HV", symbol: { type: "simple-fill", color: [245, 124, 0, 0.1], outline: { color: [245, 124, 0, 1], width: 3 } } },
        // Unknown/Default
        { value: "Unknown", symbol: { type: "simple-fill", color: [204, 204, 204, 0.1], outline: { color: [204, 204, 204, 1.0], width: 3 } } }
    ],
    // Fallback logic using Arcade for dynamic prefixes
    visualVariables: []
});

// Helper function to create fiber line symbol with optional dash pattern
const createFiberLineSymbol = (color, width, isUnderground = false) => ({
    type: 'simple-line',
    color: color,
    width: width,
    cap: 'round',
    join: 'round',
    style: isUnderground ? 'dash' : 'solid' // Dash pattern for underground cables
});

// Main Line Fiber renderer - matching reference repository color codes
// Uses unique-value renderer with Arcade expression to handle both fiber_count and placement
const createMainLineFiberRenderer = () => {
    const fiberCounts = [1, 4, 6, 8, 12, 24, 48, 72, 96, 144];
    const colors = {
        1: [32, 178, 170, 0.8],    // Light Sea Green (#20B2AA)
        4: [153, 50, 204, 0.8],    // Purple (#9932CC)
        6: [255, 140, 0, 0.8],     // Dark Orange (#FF8C00)
        8: [70, 130, 180, 0.8],    // Steel Blue (#4682B4)
        12: [0, 255, 0, 0.8],      // Green (#00ff00)
        24: [255, 255, 0, 0.8],    // Yellow (#ffff00)
        48: [255, 165, 0, 0.8],    // Orange (#ffa500)
        72: [0, 191, 255, 0.8],    // Deep Sky Blue (#00BFFF)
        96: [139, 69, 19, 0.8],    // Brown (#8b4513)
        144: [255, 0, 0, 0.8]      // Red (#ff0000)
    };
    const widths = {
        1: 2, 4: 2, 6: 2, 8: 2, 12: 2,
        24: 3, 48: 4, 72: 4, 96: 5, 144: 6
    };

    const uniqueValueInfos = [];

    // Create entries for each fiber count with both aerial (solid) and underground (dashed) styles
    fiberCounts.forEach(count => {
        const color = colors[count];
        const width = widths[count];
        const label = count === 1 ? '1 Fiber' : `${count} Fibers`;

        // Aerial (solid line)
        uniqueValueInfos.push({
            value: `${count}_Aerial`,
            symbol: createFiberLineSymbol(color, width, false),
            label: `${label} (Aerial)`
        });

        // Underground (dashed line) - handle various underground placement values
        uniqueValueInfos.push({
            value: `${count}_Underground`,
            symbol: createFiberLineSymbol(color, width, true),
            label: `${label} (Underground)`
        });
    });

    return {
        type: 'unique-value',
        field: 'fiber_count',
        valueExpression: `
            var count = $feature.fiber_count;
            var placement = Upper(Text($feature.placement));
            if (placement == 'UNDERGROUND' || placement == 'BURIED') {
                return count + '_Underground';
            } else {
                return count + '_Aerial';
            }
        `,
        defaultSymbol: createFiberLineSymbol([0, 0, 255, 0.8], 3, false), // Blue default
        uniqueValueInfos: uniqueValueInfos
    };
};

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
                family: 'Arial', // Single font name to avoid ArcGIS font loading issues
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

// Pole renderer - brown color matching React implementation
const createPoleRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [139, 69, 19, 0.8], // Brown (#8B4513) matching React version
        size: 8,
        outline: {
            color: [139, 69, 19, 1],
            width: 2
        }
    },
    // Scale-dependent sizing with smooth interpolation to prevent cluttering at different zoom levels
    visualVariables: [{
        type: "size",
        valueExpression: "$view.scale",
        stops: [
            { value: 80000, size: 8 },      // Zoom 14 and closer: Full size
            { value: 1000000, size: 5 },    // Zoom 10-13: Smaller size
            { value: 10000000, size: 3 }    // Zoom 6-9: Tiny size
        ],
        interpolation: "linear"  // Smooth interpolation between zoom levels
    }]
});

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
        style: 'circle',
        color: [0, 200, 83, 0.8], // Bright green (Slack Loops style)
        size: 8,
        outline: {
            color: [255, 255, 255, 1],
            width: 1.5
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
    title: 'DA: {areaname}',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'areaname', label: 'Area Name', visible: true },
                { fieldName: 'distribution_area', label: 'Distribution Area', visible: true },
                { fieldName: 'comments', label: 'Status', visible: true }
            ]
        }
    ]
});

const createMainLineFiberPopup = () => ({
    title: 'Fiber Cable - {fiber_count} Fibers',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'fiber_count', label: 'Fiber Count', visible: true },
                { fieldName: 'cable_name', label: 'Cable Name', visible: true },
                { fieldName: 'cable_category', label: 'Category', visible: true },
                { fieldName: 'placement', label: 'Placement', visible: true },
                { fieldName: 'used_for', label: 'Used For', visible: true },
                { fieldName: 'distribution_area', label: 'Distribution Area', visible: true }
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
    title: 'Type: MST',
    content: [
        {
            type: 'custom',
            outFields: ['*'],
            creator: function (feature) {
                const attributes = feature.graphic.attributes;

                // Create container for popup content
                const container = document.createElement('div');
                container.style.cssText = 'padding: 0; font-family: "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;';

                // Field configuration with null handling - matching actual field names from data
                const fieldsConfig = [
                    { fieldName: 'distributi', label: 'DA' },
                    { fieldName: 'equipmentn', label: 'EQUIP_FRAB' },
                    { fieldName: 'modelnumbe', label: 'Model Number' },
                    { fieldName: 'outputport', label: 'Output Port Count' },
                    { fieldName: 'partnumber', label: 'Part Number' }
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

                    // Check both lowercase and uppercase field names for compatibility
                    const value = attributes[field.fieldName] ||
                        attributes[field.fieldName.toUpperCase()] ||
                        attributes[field.fieldName.toLowerCase()];

                    if (value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim() === '')) {
                        valueCell.innerHTML = '<span style="color: var(--calcite-color-text-3); font-style: italic;">N/A</span>';
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

                // Add coordinates row if geometry is available
                if (feature.graphic.geometry) {
                    const geometry = feature.graphic.geometry;
                    let latitude, longitude;

                    // Handle different geometry types and coordinate systems
                    if (geometry.type === 'point') {
                        // ArcGIS Point geometry uses x (longitude) and y (latitude) or longitude/latitude properties
                        longitude = geometry.longitude !== undefined ? geometry.longitude : geometry.x;
                        latitude = geometry.latitude !== undefined ? geometry.latitude : geometry.y;
                    } else if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
                        // GeoJSON format: [longitude, latitude]
                        [longitude, latitude] = geometry.coordinates;
                    }

                    if (latitude !== undefined && longitude !== undefined) {
                        const coordRow = document.createElement('tr');
                        coordRow.style.cssText = 'border-bottom: 1px solid var(--calcite-color-border-3);';

                        const coordLabelCell = document.createElement('td');
                        coordLabelCell.style.cssText = 'padding: 8px 12px; font-weight: 600; color: var(--calcite-color-text-2); width: 40%; vertical-align: top;';
                        coordLabelCell.textContent = 'Coordinates';

                        const coordValueCell = document.createElement('td');
                        coordValueCell.style.cssText = 'padding: 8px 12px; color: var(--calcite-color-text-1); word-break: break-word;';
                        coordValueCell.textContent = `${latitude.toFixed(14)}, ${longitude.toFixed(14)}`;

                        coordRow.appendChild(coordLabelCell);
                        coordRow.appendChild(coordValueCell);
                        table.appendChild(coordRow);

                        // Add Maps Link
                        const mapsRow = document.createElement('tr');
                        const mapsLabelCell = document.createElement('td');
                        mapsLabelCell.style.cssText = 'padding: 8px 12px; font-weight: 600; color: var(--calcite-color-text-2); width: 40%; vertical-align: top;';
                        mapsLabelCell.textContent = 'Maps Link';

                        const mapsValueCell = document.createElement('td');
                        mapsValueCell.style.cssText = 'padding: 8px 12px; color: var(--calcite-color-text-1);';
                        const mapsLink = document.createElement('a');
                        mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                        mapsLink.target = '_blank';
                        mapsLink.rel = 'noopener noreferrer';
                        mapsLink.textContent = mapsLink.href;
                        mapsLink.style.cssText = 'color: var(--calcite-color-brand); text-decoration: underline;';
                        mapsValueCell.appendChild(mapsLink);

                        mapsRow.appendChild(mapsLabelCell);
                        mapsRow.appendChild(mapsValueCell);
                        table.appendChild(mapsRow);
                    }
                }

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

// Pole popup template
const createPolePopup = () => ({
    title: 'Pole: {wmElementN}',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'wmElementN', label: 'Pole ID', visible: true },
                { fieldName: 'latitude', label: 'Latitude', visible: true, format: { places: 6 } },
                { fieldName: 'longitude', label: 'Longitude', visible: true, format: { places: 6 } }
            ]
        }
    ],
    actions: [
        {
            id: 'copy-info',
            title: 'Copy Pole Info',
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
    title: 'Slack Loop Item',
    content: 'This is a slack loop item',
    actions: []
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

// Slack Loops renderer
const createSlackLoopRenderer = () => ({
    type: 'simple',
    symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [0, 200, 83, 0.8], // Bright green
        size: 8,
        outline: {
            color: [255, 255, 255, 1],
            width: 1.5
        }
    }
});

// Slack Loops popup
const createSlackLoopPopup = () => ({
    title: 'Slack Loop',
    content: [
        {
            type: 'fields',
            fieldInfos: [
                { fieldName: 'structure', label: 'Structure ID', visible: true },
                { fieldName: 'type', label: 'Type', visible: true },
                { fieldName: 'cable', label: 'Cable', visible: true },
                { fieldName: 'length', label: 'Length (ft)', visible: true }
            ]
        }
    ]
});

// Slack Loops fields
const createSlackLoopFields = () => [
    { name: 'structure', type: 'string', alias: 'Structure ID' },
    { name: 'type', type: 'string', alias: 'Type' },
    { name: 'cable', type: 'string', alias: 'Cable' },
    { name: 'length', type: 'double', alias: 'Length' }
];

// Vehicle labeling configuration (shows vehicle name at closer zooms)
const createTruckLabeling = () => [
    {
        symbol: {
            type: 'text',
            color: [255, 255, 255, 1],
            font: {
                size: 10,
                family: 'Noto Sans',
                weight: 'bold'
            },
            haloColor: [0, 0, 0, 0.85],
            haloSize: 1.5
        },
        labelPlacement: 'above-center',
        labelExpressionInfo: {
            expression: '$feature.name'
        },
        deconflictionStrategy: 'dynamic',
        repeatLabel: false,
        removeDuplicateLabels: true,
        minScale: 144000,
        maxScale: 0
    }
];

// Fiber Plant field definitions
const createFSAFields = () => [
    { name: 'areaname', type: 'string', alias: 'Area Name' },
    { name: 'distribution_area', type: 'string', alias: 'Distribution Area' },
    { name: 'comments', type: 'string', alias: 'Status' }
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
            expression: "$feature.areaname"
        },
        deconflictionStrategy: "static", // Enable collision detection to prevent overlap
        repeatLabel: false, // Don't repeat labels for the same feature
        removeDuplicateLabels: true, // Remove duplicate labels
        maxScale: 0, // No limit on zooming in
        minScale: 80000 // Hide labels when zoomed out past zoom level 14 (scale 1:80,000)
    }
];

const createMainLineFiberFields = () => [
    { name: 'fiber_count', type: 'integer', alias: 'Fiber Count' },
    { name: 'cable_name', type: 'string', alias: 'Cable Name' },
    { name: 'cable_category', type: 'string', alias: 'Category' },
    { name: 'placement', type: 'string', alias: 'Placement' },
    { name: 'used_for', type: 'string', alias: 'Used For' },
    { name: 'distribution_area', type: 'string', alias: 'Distribution Area' }
];

const createMainLineOldFields = () => [
    { name: 'OBJECTID', type: 'oid', alias: 'Object ID' },
    { name: 'FIBERCOUNT', type: 'integer', alias: 'Fiber Count' },
    { name: 'SUM_CALCULATEDLENGTH', type: 'double', alias: 'Calculated Length' },
    { name: 'SUM_MEASUREDLENGTH', type: 'double', alias: 'Measured Length' },
    { name: 'Shape_Length', type: 'double', alias: 'Shape Length' }
];

const createMSTTerminalFields = () => [
    { name: 'distributi', type: 'string', alias: 'DA' },
    { name: 'equipmentn', type: 'string', alias: 'EQUIP_FRAB' },
    { name: 'modelnumbe', type: 'string', alias: 'Model Number' },
    { name: 'outputport', type: 'integer', alias: 'Output Port Count' },
    { name: 'partnumber', type: 'string', alias: 'Part Number' }
];

const createSplitterFields = () => [
    { name: 'STRUCTURE_', type: 'string', alias: 'Structure ID' },
    { name: 'CLLI', type: 'string', alias: 'CLLI Code' },
    { name: 'EQUIP_FRAB', type: 'string', alias: 'Equipment FRAB' },
    { name: 'OUTPUTPORT', type: 'integer', alias: 'Output Port Count' }
];

// Pole fields
const createPoleFields = () => [
    { name: 'wmElementN', type: 'string', alias: 'Pole ID' },
    { name: 'latitude', type: 'double', alias: 'Latitude' },
    { name: 'longitude', type: 'double', alias: 'Longitude' },
    { name: 'id', type: 'oid', alias: 'Object ID' }
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
        fiber: [30, 95, 175, 0.9],     // Fiber blue
        electric: [74, 124, 89, 0.9]   // Electric green
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
                text: `<div style="margin-top: 10px; padding: 8px; background: var(--calcite-color-foreground-2); border-radius: 4px; font-size: 12px; color: var(--calcite-color-text-2);">
                    <strong style="color: var(--calcite-color-text-1);">Vehicle Type:</strong> ${vehicleTypeDisplay}<br/>
                    <strong style="color: var(--calcite-color-text-1);">Real-time tracking:</strong> Updates every 3 seconds
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
        zOrder: 126, // Above node sites (125) so cluster labels are visible
        dataServiceMethod: () => subscriberDataService.getOfflineSubscribers()
    },

    onlineSubscribers: {
        id: 'online-subscribers',
        title: 'Online Subscribers',
        dataSource: 'online_subscribers',
        renderer: createOnlineRenderer(),
        popupTemplate: createSubscriberPopup('online'),
        featureReduction: createOnlineClusterConfig(), // Enable clustering for performance
        fields: subscriberFields,
        visible: false,
        zOrder: 127, // Above node sites (125) so cluster labels are visible
        dataServiceMethod: () => subscriberDataService.getOnlineSubscribers()
    },

    electricOfflineSubscribers: {
        id: 'electric-offline-subscribers',
        title: 'Electric Offline Subscribers',
        dataSource: 'electric_offline_subscribers',
        renderer: createElectricOfflineRenderer(),
        popupTemplate: createSubscriberPopup('offline'),
        featureReduction: createElectricOfflineClusterConfig(), // Yellow cluster configuration
        fields: subscriberFields,
        visible: true, // Visible by default
        zOrder: 128, // Above node sites (125) so cluster labels are visible
        dataServiceMethod: () => subscriberDataService.getElectricOfflineSubscribers()
    },

    // Sprout Huts Layer
    sproutHuts: {
        id: 'sprout-huts',
        title: 'Sprout Huts',
        dataSource: 'sprout_huts',
        renderer: createSproutHutRenderer(),
        popupTemplate: createSproutHutPopup(),
        fields: createSproutHutFields(),
        labelingInfo: createSproutHutLabeling(),
        visible: true, // Visible by default as they are major landmarks
        zOrder: 100, // Well below subscriber clusters (126-128) so cluster markers and labels render above
        dataServiceMethod: () => infrastructureService.getSproutHuts()
    },

    // Fiber Plant Layers
    fsaBoundaries: {
        id: 'fsa-boundaries',
        title: 'DA Boundaries',
        dataSource: 'fsa_boundaries',
        renderer: createFSARenderer(),
        popupTemplate: createFSAPopup(),
        fields: createFSAFields(),
        labelingInfo: createFSALabeling(),
        visible: false,
        zOrder: 5, // Below all point layers
        dataServiceMethod: () => infrastructureService.getFSABoundaries()
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
        dataServiceMethod: () => infrastructureService.getMainLineFiber()
    },

    // Removed mainLineOld layer configuration

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
        dataServiceMethod: () => infrastructureService.getMSTTerminals()
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
        dataServiceMethod: () => infrastructureService.getSplitters()
    },

    // Poles Layer
    poles: {
        id: 'poles',
        title: 'Poles',
        dataSource: 'poles',
        renderer: createPoleRenderer(),
        popupTemplate: createPolePopup(),
        fields: createPoleFields(),
        visible: false,
        zOrder: 45, // Between closures (40) and MST terminals (50)
        // Only show when zoomed in past zoom level 15 (street level)
        minScale: 24000,  // Hide when zoomed out beyond this scale
        maxScale: 0,      // No limit on zooming in
        dataServiceMethod: () => infrastructureService.getPoles()
    },

    closures: {
        id: 'closures',
        title: 'Slack Loops',
        dataSource: 'closures',
        renderer: createClosureRenderer(),
        popupTemplate: createClosurePopup(),
        fields: createClosureFields(),
        visible: false,
        zOrder: 40,
        // Only show when zoomed in past zoom level 16 (closer street level)
        minScale: 12000,  // Hide when zoomed out beyond this scale
        maxScale: 0,      // No limit on zooming in
        dataServiceMethod: () => infrastructureService.getClosures()
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
        dataServiceMethod: () => infrastructureService.getMSTFiber()
    },

    // Slack Loops Layer
    slackLoops: {
        id: 'slack-loops',
        title: 'Slack Loops',
        dataSource: 'slack_loops',
        renderer: createSlackLoopRenderer(),
        popupTemplate: createSlackLoopPopup(),
        fields: createSlackLoopFields(),
        visible: false,
        zOrder: 55, // Between MST Terminals (50) and Splitters (60)
        minScale: 24000,
        maxScale: 0,
        dataServiceMethod: () => infrastructureService.getSlackLoops()
    },

    // Truck layers
    fiberTrucks: {
        id: 'fiber-trucks',
        title: 'Fiber Trucks',
        dataSource: 'fiber_trucks',
        renderer: createTruckRenderer('fiber'),
        popupTemplate: createTruckPopup('fiber'),
        fields: createTruckFields(),
        labelingInfo: createTruckLabeling(),
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
        labelingInfo: createTruckLabeling(),
        visible: false,
        zOrder: 130,
        dataServiceMethod: () => subscriberDataService.getElectricTrucks()
    },

    // CEC Service Boundary Layer (Visual Reference)
    cecServiceBoundary: {
        id: 'cec-service-boundary',
        title: 'CEC Service Boundary',
        layerType: 'GeoJSONLayer',
        dataUrl: 'https://crguystmaihtfdttybkf.supabase.co/storage/v1/object/public/sprout_plant/CEC_Service_Boundary.geojson',
        renderer: {
            type: 'simple',
            symbol: {
                type: 'simple-fill',
                style: 'none', // No fill, just outline
                outline: {
                    color: [128, 128, 128, 0.9], // Grey outline for service boundary (works in light and dark mode)
                    width: 2.5
                }
            }
        },
        popupTemplate: {
            title: 'CEC Service Boundary',
            content: 'Cullman Electric Cooperative service area boundary'
        },
        visible: true, // Visible by default as visual reference
        zOrder: 0, // Above basemap, below all other layers
        fields: [] // Will be inferred from GeoJSON
    },

    // County Boundaries Layer
    countyBoundaries: {
        id: 'county-boundaries',
        title: 'County Boundaries',
        layerType: 'GeoJSONLayer',
        // dataUrl: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/ff-counties.geojson?token=...',
        dataUrl: null, // Sprout Fiber county boundaries not yet available
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
        visible: false, // Disabled until data is available
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
    },

    // Power Outage Layer (Cullman Electric)
    cullmanOutages: {
        id: 'cullman-outages',
        title: 'Cullman Power Outages',
        layerType: 'GeoJSONLayer',
        dataUrl: null, // Data loaded dynamically via OutageService
        renderer: {
            type: 'simple',
            symbol: {
                type: 'simple-fill',
                color: [255, 140, 0, 0.3], // Orange fill with transparency
                outline: {
                    color: [255, 140, 0, 0.9], // Orange outline
                    width: 2
                }
            }
        },
        popupTemplate: {
            title: 'Power Outage: {outage_id}',
            content: [
                {
                    type: 'fields',
                    fieldInfos: [
                        { fieldName: 'outage_id', label: 'Outage ID' },
                        { fieldName: 'customers_affected', label: 'Customers Affected' },
                        {
                            fieldName: 'status',
                            label: 'Status',
                            format: {
                                places: 0,
                                digitSeparator: false
                            }
                        },
                        { fieldName: 'cause', label: 'Cause' },
                        {
                            fieldName: 'start_time',
                            label: 'Start Time',
                            format: {
                                dateFormat: 'short-date-long-time'
                            }
                        },
                        {
                            fieldName: 'estimated_restoration',
                            label: 'Estimated Restoration',
                            format: {
                                dateFormat: 'short-date-long-time'
                            }
                        },
                        {
                            fieldName: 'estimated_restore',
                            label: 'Estimated Restoration',
                            format: {
                                dateFormat: 'short-date-long-time'
                            }
                        },
                        {
                            fieldName: 'crew_assigned',
                            label: 'Crew Assigned'
                        },
                        {
                            fieldName: 'is_planned',
                            label: 'Planned Outage'
                        },
                        {
                            fieldName: 'last_update',
                            label: 'Last Update',
                            format: {
                                dateFormat: 'short-date-long-time'
                            }
                        }
                    ]
                }
            ]
        },
        visible: true, // Visible by default
        zOrder: 2, // Below all markers and OSP data, above service boundaries
        fields: [
            { name: 'outage_id', type: 'string', alias: 'Outage ID' },
            { name: 'customers_affected', type: 'integer', alias: 'Customers Affected' },
            { name: 'status', type: 'string', alias: 'Status' },
            { name: 'cause', type: 'string', alias: 'Cause' },
            { name: 'start_time', type: 'date', alias: 'Start Time' },
            { name: 'estimated_restoration', type: 'date', alias: 'Estimated Restoration' },
            { name: 'estimated_restore', type: 'date', alias: 'Estimated Restoration' }, // Alternative field name
            { name: 'crew_assigned', type: 'string', alias: 'Crew Assigned' }, // Boolean stored as string
            { name: 'is_planned', type: 'string', alias: 'Planned Outage' }, // Boolean stored as string
            { name: 'last_update', type: 'date', alias: 'Last Update' }
        ]
    }

    // Additional layers can be added here as needed
};

// Configuration-driven layer creation
export const getLayerConfig = (layerId) => {
    // First try direct key lookup (camelCase)
    if (layerConfigs[layerId]) {
        return layerConfigs[layerId];
    }

    // If not found, search by id property (kebab-case)
    for (const key in layerConfigs) {
        if (layerConfigs[key] && layerConfigs[key].id === layerId) {
            return layerConfigs[key];
        }
    }

    return null;
};

export const getAllLayerIds = () => {
    return Object.keys(layerConfigs);
}; 