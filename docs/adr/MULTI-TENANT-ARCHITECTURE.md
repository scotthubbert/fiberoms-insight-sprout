# Multi-Tenant Architecture: Public Outage Map Application

## Table of Contents
1. [Application Overview](#application-overview)
2. [Multi-Tenant Configuration Strategy](#multi-tenant-configuration-strategy)
3. [Key Architectural Patterns](#key-architectural-patterns)
4. [How Configuration Drives the Application](#how-configuration-drives-the-application)
5. [Applying This Pattern to ArcGIS + Calcite UI](#applying-this-pattern-to-arcgis--calcite-ui)
6. [Benefits and Trade-offs](#benefits-and-trade-offs)

---

## Application Overview

### What It Does
This is a **real-time public-facing outage map** that displays service disruptions for Internet Service Providers (ISPs). It shows offline subscriber locations on an interactive map using **Mapbox GL JS** for mapping and **Supabase** for real-time data.

### Core Features
- **Real-time visualization** of offline subscribers with marker clustering
- **Multi-ISP support** - One codebase serves multiple ISPs with unique branding
- **Responsive design** with mobile/desktop optimizations
- **Light/dark theme** following system preferences
- **Search functionality** with geocoding
- **Configurable UI components** (counters, legends, disclaimers)
- **Performance optimized** with lazy loading and code splitting

### Technology Stack
- **Pure vanilla JavaScript** (no framework) with ES6 modules
- **Mapbox GL JS** for mapping
- **Supabase** for real-time PostgreSQL data
- **Vite** for build tooling
- **Cloudflare Pages** for deployment

---

## Multi-Tenant Configuration Strategy

### The Core Concept
**Single codebase, multiple deployments** - Each ISP gets a unique branded experience from the same application code by using a centralized configuration file (`config.js`).

### Configuration File Structure

The `config.js` file contains:

```javascript
const CONFIG = {
    version: '1.0.0',
    
    // Active ISP resolution (development vs production)
    activeConfig: 'isp2', // dev only; production uses URL routing
    
    // Shared Mapbox token
    mapbox: { accessToken: 'TOKEN_HERE' },
    
    // ISP-specific configurations
    isps: {
        isp1: { /* Freedom Fiber config */ },
        isp2: { /* Sprout Fiber config */ },
        isp3: { /* Flash Fiber config */ }
    }
};
```

### Per-ISP Configuration Schema

Each ISP configuration includes:

#### 1. **Branding**
```javascript
name: 'Sprout Fiber',
logo: '/sprout-fiber/logo.png',
logoLight: '/sprout-fiber/logo-color.png',    // Light mode
logoDark: '/sprout-fiber/logo-white.png',     // Dark mode
favicon: 'https://example.com/favicon.png',
tabTitle: 'Sprout Fiber Outage Map',
primaryColor: '#055229',
secondaryColor: '#FFFFFF'
```

#### 2. **Map Configuration**
```javascript
map: {
    // Service area boundaries [SW, NE]
    bounds: [[-87.368548, 33.858112], [-86.537743, 34.374038]],
    minZoom: 6,
    maxZoom: 12,
    boundsPadding: 50,  // Desktop padding
    
    // Theme-aware map styles
    styleLight: 'mapbox://styles/username/light-style-id',
    styleDark: 'mapbox://styles/username/dark-style-id'
},

// Mobile-specific overrides
mobile: {
    map: {
        bounds: [/* same or adjusted */],
        minZoom: 6,
        maxZoom: 10,
        boundsPadding: 30  // Less padding on mobile
    }
}
```

#### 3. **Geocoder (Search) Settings**
```javascript
geocoder: {
    countries: 'us',
    bbox: [-87.368548, 33.858112, -86.537743, 34.374038],  // Limit search area
    placeholder: 'Search Sprout Fiber area...',
    limit: 5,
    collapsed: true,
    enforceBBoxDesktop: true  // Enforce search boundaries
}
```

#### 4. **Database Configuration**
```javascript
supabase: {
    url: import.meta.env.VITE_ISP2_SUPABASE_URL,
    anonKey: import.meta.env.VITE_ISP2_SUPABASE_ANON_KEY,
    
    // Table and column mappings (each ISP may have different schemas)
    tables: {
        subscribers: 'offline_devices',
        columns: {
            latitude: 'lat',      // Column name in ISP's database
            longitude: 'lon',
            id: 'id',
            updated_at: 'offline_since'
        }
    },
    
    // Query filters
    filters: {
        statusField: 'is_long_term_offline',
        offlineValue: false,
        requireCoordinates: true
    }
}
```

#### 5. **Visual Styling**
```javascript
statusColors: {
    offline: '#EF4444',
    online: '#34D399',
    degraded: '#FCD34D'
},

markerSettings: {
    size: 8,
    hoverSize: 12,
    clusterRadius: 50,
    enableClustering: true
}
```

#### 6. **UI Component Configuration** (Dynamic Components)
```javascript
ui: {
    // Header counters
    counters: [
        {
            id: 'offline',
            type: 'default',
            enabled: true
        },
        {
            id: 'electric',
            label: 'Fiber Offline by Power Outage',
            enabled: true,
            color: '#FF8C00',
            dataSource: {
                table: 'electric',
                statusField: null,
                statusValue: null
            }
        }
    ],
    
    // Map overlay components
    mapComponents: [
        {
            id: 'disclaimer',
            type: 'disclaimer',
            enabled: true,
            position: 'top-left',
            content: {
                logo: '/sprout-fiber/explainer.png',
                height: 138
            }
        },
        {
            id: 'legend',
            type: 'legend',
            enabled: true,
            position: 'bottom-left',
            content: {
                title: 'Legend',
                clusterLabel: 'Clustered Offline',
                individualLabel: 'Individual Offline',
                showClusters: true,
                showIndividualMarkers: true,
                showElectric: false
            }
        }
    ]
}
```

---

## Key Architectural Patterns

### 1. URL-Based Tenant Resolution

The application automatically determines which ISP configuration to use based on the URL:

```javascript
function resolveActiveConfig(initialKey) {
    const url = new URL(window.location.href);
    const hostname = url.hostname;
    const pathname = url.pathname;
    const params = url.searchParams;

    // Priority 1: Query parameter (?isp=sprout or ?brand=sprout)
    const ispParam = params.get('isp') || params.get('brand');
    if (ispParam && CONFIG.isps[ispParam]) return ispParam;

    // Priority 2: Hostname mapping
    const hostnameToConfig = {
        'outages.sproutfiberinternet.com': 'isp2',
        'tombigbee.fiberoms.com': 'isp1',
        'flash.fiberoms.com': 'isp3'
    };
    if (hostnameToConfig[hostname]) return hostnameToConfig[hostname];

    // Priority 3: Subdomain (sprout.example.com)
    const subdomain = hostname.split('.')[0];
    if (subdomain === 'sprout') return 'isp2';

    // Priority 4: Path segment (/sprout/map)
    const firstSegment = pathname.split('/')[1];
    if (firstSegment === 'sprout') return 'isp2';

    // Fallback
    return initialKey || 'isp1';
}
```

**Result**: Same build can be deployed to multiple domains, each serving a different ISP.

### 2. Configuration-Driven UI Components

The `ui-components.js` module dynamically creates UI elements based on configuration:

```javascript
export function initializeUIComponents(ispConfig, supabaseClient) {
    // Read configuration
    const counters = ispConfig.ui.counters.filter(c => c.enabled);
    
    // Dynamically render each counter
    counters.forEach(counter => {
        if (counter.type === 'default') {
            renderDefaultCounter();
        } else {
            // Create custom counter from config
            const element = createCounterElement(
                counter.id, 
                counter.label, 
                counter.color
            );
            
            // Set up data source if specified
            if (counter.dataSource) {
                setupCounterDataSource(counter.id, counter.dataSource);
            }
        }
    });
    
    // Similarly render map components
    ispConfig.ui.mapComponents?.forEach(component => {
        renderMapComponent(component, ispConfig);
    });
}
```

**Result**: ISPs can have different counters, disclaimers, and legends without code changes.

### 3. Theme-Aware Styling

The `theme.js` module applies ISP-specific branding and follows system theme:

```javascript
export function initializeTheme(activeISP) {
    // Apply ISP colors to CSS variables
    document.documentElement.style.setProperty(
        '--primary-color', 
        activeISP.primaryColor
    );
    
    // Apply logo based on theme
    const logoElement = document.getElementById('isp-logo');
    const logoUrl = isDarkMode 
        ? activeISP.logoDark || activeISP.logo
        : activeISP.logoLight || activeISP.logo;
    logoElement.src = logoUrl;
    
    // Update map style for theme
    const mapStyle = isDarkMode
        ? activeISP.map.styleDark
        : activeISP.map.styleLight;
    map.setStyle(mapStyle);
}
```

**Result**: Each ISP gets its brand colors, logos, and map styles automatically.

### 4. Flexible Database Mapping

Different ISPs may have different database schemas. The `supabase-helpers.js` module abstracts this:

```javascript
export function buildSubscriberQuery(client, ispConfig, options = {}) {
    const { tables, filters } = ispConfig.supabase;
    const { columns } = tables;
    
    // Build query using ISP's specific column names
    let query = client
        .from(tables.subscribers)
        .select(`${columns.latitude}, ${columns.longitude}, ${columns.id}`);
    
    // Apply ISP-specific filters
    if (filters.statusField) {
        query = query.eq(filters.statusField, filters.offlineValue);
    }
    
    // Ensure coordinates exist
    if (filters.requireCoordinates) {
        query = query.not(columns.latitude, 'is', null)
                     .not(columns.longitude, 'is', null);
    }
    
    return query;
}
```

**Result**: Application works with any database schema by mapping in config.

### 5. Device-Aware Configuration

The application detects device type and uses appropriate settings:

```javascript
function getMapConfig() {
    if (isMobileDevice() && activeISP.mobile?.map) {
        return activeISP.mobile.map;  // Mobile-specific config
    }
    return activeISP.map;  // Desktop config
}

// Usage
const mapConfig = getMapConfig();
map = new mapboxgl.Map({
    bounds: mapConfig.bounds,
    minZoom: mapConfig.minZoom,
    maxZoom: mapConfig.maxZoom
});
```

**Result**: Optimized experience for mobile vs desktop per ISP.

---

## How Configuration Drives the Application

### Application Initialization Flow

1. **DOMContentLoaded** event fires
2. **Configuration validation** - Check if config is valid
3. **Theme initialization** - Apply ISP branding
4. **Map initialization** - Create map with ISP's settings
5. **Data loading** - Query ISP's database with their schema
6. **UI component rendering** - Create ISP's configured components
7. **Realtime subscriptions** - Subscribe to ISP's data changes

### Configuration Points Throughout the App

| Feature | Config-Driven | Example |
|---------|---------------|---------|
| **Page Title** | `activeISP.tabTitle` | "Sprout Fiber Outage Map" |
| **Favicon** | `activeISP.favicon` | Custom icon per ISP |
| **Logo** | `activeISP.logo{Light,Dark}` | Theme-aware logos |
| **Colors** | `activeISP.primaryColor` | CSS variables |
| **Map Area** | `activeISP.map.bounds` | Service territory |
| **Map Style** | `activeISP.map.style{Light,Dark}` | Custom Mapbox styles |
| **Search Area** | `activeISP.geocoder.bbox` | Limit to service area |
| **Database** | `activeISP.supabase.*` | Connection & schema mapping |
| **Markers** | `activeISP.markerSettings` | Size, clustering |
| **Counters** | `activeISP.ui.counters[]` | Custom data displays |
| **Map Overlays** | `activeISP.ui.mapComponents[]` | Disclaimers, legends |

---

## Applying This Pattern to ArcGIS + Calcite UI

### Recommended Architecture

Here's how you could apply this multi-tenant pattern to an ArcGIS application with Calcite UI:

### 1. Configuration File Structure

```javascript
// arcgis-config.js
const CONFIG = {
    version: '1.0.0',
    activeConfig: resolveActiveConfig(),
    
    // Shared settings
    arcgis: {
        apiKey: import.meta.env.VITE_ARCGIS_API_KEY,
        defaultBasemap: 'arcgis-streets'
    },
    
    clients: {
        client1: {
            // Branding
            name: 'City of Springfield',
            logo: '/clients/springfield/logo.svg',
            favicon: '/clients/springfield/favicon.ico',
            theme: {
                primary: '#0066CC',
                secondary: '#004499',
                // Calcite theme tokens
                calciteTheme: 'light',  // or 'dark'
                calciteMode: 'auto'
            },
            
            // Map configuration
            map: {
                center: [-89.6501, 39.7817],
                zoom: 12,
                basemap: 'arcgis-streets-relief',
                
                // Service boundaries (optional)
                extent: {
                    xmin: -89.7,
                    ymin: 39.7,
                    xmax: -89.6,
                    ymax: 39.9,
                    spatialReference: { wkid: 4326 }
                }
            },
            
            // Data sources (Feature Layers)
            layers: [
                {
                    id: 'outages',
                    url: 'https://services.arcgis.com/ORG/arcgis/rest/services/Outages/FeatureServer/0',
                    visible: true,
                    renderer: {
                        type: 'simple',
                        symbol: {
                            type: 'simple-marker',
                            color: [220, 38, 38, 0.8],  // Red
                            size: 8,
                            outline: {
                                color: [255, 255, 255, 1],
                                width: 1
                            }
                        }
                    },
                    popup: {
                        title: '{ADDRESS}',
                        content: [{
                            type: 'fields',
                            fieldInfos: [
                                { fieldName: 'STATUS', label: 'Status' },
                                { fieldName: 'OFFLINE_SINCE', label: 'Offline Since' }
                            ]
                        }]
                    },
                    clustering: {
                        enabled: true,
                        radius: 50,
                        maxZoom: 14
                    }
                },
                {
                    id: 'service-boundary',
                    url: 'https://services.arcgis.com/.../ServiceArea/FeatureServer/0',
                    visible: true,
                    renderer: {
                        type: 'simple',
                        symbol: {
                            type: 'simple-fill',
                            color: [0, 102, 204, 0.1],
                            outline: { color: [0, 102, 204, 0.8], width: 2 }
                        }
                    }
                }
            ],
            
            // Calcite UI Components
            ui: {
                // Header components
                header: {
                    title: 'Springfield Outage Map',
                    showLogo: true,
                    components: ['search', 'theme-toggle', 'account']
                },
                
                // Shell panels
                panels: [
                    {
                        id: 'statistics',
                        position: 'start',
                        open: true,
                        width: 300,
                        component: {
                            type: 'stats-panel',
                            title: 'Current Statistics',
                            stats: [
                                {
                                    id: 'total-outages',
                                    label: 'Total Outages',
                                    icon: 'exclamation-mark-triangle',
                                    color: 'danger',
                                    query: {
                                        layerId: 'outages',
                                        where: "STATUS = 'OFFLINE'"
                                    }
                                },
                                {
                                    id: 'affected-customers',
                                    label: 'Affected Customers',
                                    icon: 'users',
                                    color: 'warning',
                                    query: {
                                        layerId: 'outages',
                                        aggregate: 'sum',
                                        field: 'CUSTOMER_COUNT'
                                    }
                                }
                            ]
                        }
                    },
                    {
                        id: 'legend',
                        position: 'end',
                        open: false,
                        width: 300,
                        component: {
                            type: 'legend',
                            title: 'Map Legend',
                            layerIds: ['outages', 'service-boundary']
                        }
                    }
                ],
                
                // Map widgets
                widgets: [
                    {
                        type: 'search',
                        position: 'top-right',
                        config: {
                            // Limit search to service area
                            sources: [{
                                locator: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer',
                                filter: {
                                    geometry: '/* extent from config */'
                                }
                            }]
                        }
                    },
                    {
                        type: 'home',
                        position: 'top-right'
                    },
                    {
                        type: 'zoom',
                        position: 'top-right'
                    },
                    {
                        type: 'locate',
                        position: 'top-right'
                    }
                ],
                
                // Custom components (Calcite Components)
                customComponents: [
                    {
                        id: 'disclaimer-notice',
                        type: 'calcite-notice',
                        position: 'top-center',
                        props: {
                            kind: 'warning',
                            open: true,
                            closable: true,
                            icon: 'information'
                        },
                        content: {
                            title: 'Data Disclaimer',
                            message: 'Outage information is updated every 5 minutes.'
                        }
                    }
                ]
            },
            
            // Refresh interval for real-time updates
            refreshInterval: 300000,  // 5 minutes
            
            // Query filters
            filters: {
                defaultWhere: "STATUS = 'OFFLINE' AND COORDINATES IS NOT NULL"
            }
        },
        
        client2: {
            name: 'County of Shelby',
            // ... similar structure with different settings
        }
    }
};

// URL-based resolution (same pattern as Mapbox app)
function resolveActiveConfig() {
    const url = new URL(window.location.href);
    const hostname = url.hostname;
    
    // Query param: ?client=springfield
    const clientParam = url.searchParams.get('client');
    if (clientParam && CONFIG.clients[clientParam]) return clientParam;
    
    // Hostname mapping
    const hostnameMap = {
        'outages.springfield.gov': 'client1',
        'gis.shelbycounty.tn.gov': 'client2'
    };
    if (hostnameMap[hostname]) return hostnameMap[hostname];
    
    // Fallback
    return 'client1';
}

export { CONFIG };
export const activeClient = CONFIG.clients[CONFIG.activeConfig];
```

### 2. Application Structure

```javascript
// main.js - Application entry point
import { activeClient } from './arcgis-config.js';
import { initializeTheme } from './theme.js';
import { initializeMap } from './map.js';
import { initializeUI } from './ui.js';

// Set up Calcite theme based on client config
import '@esri/calcite-components/dist/calcite/calcite.css';
import { setAssetPath } from '@esri/calcite-components/dist/components';
setAssetPath('https://js.arcgis.com/calcite-components/2.x/assets');

async function init() {
    // Apply client branding
    initializeTheme(activeClient);
    
    // Initialize map with client config
    const map = await initializeMap(activeClient);
    
    // Initialize UI components
    await initializeUI(activeClient, map);
}

document.addEventListener('DOMContentLoaded', init);
```

### 3. Theme Module (theme.js)

```javascript
// theme.js - Handle client branding and Calcite theme
import { activeClient } from './arcgis-config.js';

export function initializeTheme(clientConfig) {
    // Set page title and favicon
    document.title = clientConfig.ui.header.title;
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.href = clientConfig.favicon;
    
    // Apply CSS variables for client colors
    const root = document.documentElement;
    root.style.setProperty('--client-primary', clientConfig.theme.primary);
    root.style.setProperty('--client-secondary', clientConfig.theme.secondary);
    
    // Set Calcite theme mode
    const calciteMode = clientConfig.theme.calciteMode || 'auto';
    root.setAttribute('data-calcite-mode', calciteMode);
    
    // Apply logo
    const logo = document.getElementById('client-logo');
    if (logo && clientConfig.logo) {
        logo.src = clientConfig.logo;
        logo.alt = `${clientConfig.name} Logo`;
    }
}
```

### 4. Map Module (map.js)

```javascript
// map.js - Initialize ArcGIS map with client config
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';

export async function initializeMap(clientConfig) {
    // Create map with client's basemap
    const map = new Map({
        basemap: clientConfig.map.basemap
    });
    
    // Add client's feature layers
    clientConfig.layers.forEach(layerConfig => {
        const layer = createFeatureLayer(layerConfig, clientConfig);
        map.add(layer);
    });
    
    // Create view with client's center/zoom
    const view = new MapView({
        container: 'map-container',
        map: map,
        center: clientConfig.map.center,
        zoom: clientConfig.map.zoom,
        extent: clientConfig.map.extent,
        constraints: {
            // Optionally restrict panning to service area
            geometry: clientConfig.map.extent
        }
    });
    
    // Add client's configured widgets
    await addWidgets(view, clientConfig);
    
    // Set up auto-refresh for real-time updates
    if (clientConfig.refreshInterval) {
        setInterval(() => {
            refreshLayers(map, clientConfig);
        }, clientConfig.refreshInterval);
    }
    
    return { map, view };
}

function createFeatureLayer(layerConfig, clientConfig) {
    const layer = new FeatureLayer({
        id: layerConfig.id,
        url: layerConfig.url,
        visible: layerConfig.visible,
        renderer: layerConfig.renderer,
        popupTemplate: layerConfig.popup,
        definitionExpression: clientConfig.filters?.defaultWhere
    });
    
    // Enable clustering if configured
    if (layerConfig.clustering?.enabled) {
        layer.featureReduction = {
            type: 'cluster',
            clusterRadius: layerConfig.clustering.radius,
            clusterMaxZoom: layerConfig.clustering.maxZoom
        };
    }
    
    return layer;
}

async function addWidgets(view, clientConfig) {
    const widgets = clientConfig.ui.widgets || [];
    
    for (const widgetConfig of widgets) {
        const widget = await createWidget(widgetConfig, view, clientConfig);
        if (widget) {
            view.ui.add(widget, widgetConfig.position);
        }
    }
}

async function createWidget(widgetConfig, view, clientConfig) {
    switch (widgetConfig.type) {
        case 'search': {
            const { default: Search } = await import('@arcgis/core/widgets/Search');
            return new Search({
                view: view,
                ...widgetConfig.config
            });
        }
        case 'home': {
            const { default: Home } = await import('@arcgis/core/widgets/Home');
            return new Home({ view });
        }
        case 'zoom': {
            const { default: Zoom } = await import('@arcgis/core/widgets/Zoom');
            return new Zoom({ view });
        }
        case 'locate': {
            const { default: Locate } = await import('@arcgis/core/widgets/Locate');
            return new Locate({ view });
        }
        default:
            console.warn(`Unknown widget type: ${widgetConfig.type}`);
            return null;
    }
}

function refreshLayers(map, clientConfig) {
    clientConfig.layers.forEach(layerConfig => {
        const layer = map.findLayerById(layerConfig.id);
        if (layer) {
            layer.refresh();
        }
    });
}
```

### 5. UI Module (ui.js)

```javascript
// ui.js - Render Calcite UI components based on config
import '@esri/calcite-components';

export async function initializeUI(clientConfig, mapContext) {
    // Render header
    renderHeader(clientConfig);
    
    // Render shell panels
    if (clientConfig.ui.panels) {
        clientConfig.ui.panels.forEach(panel => {
            renderPanel(panel, clientConfig, mapContext);
        });
    }
    
    // Render custom components
    if (clientConfig.ui.customComponents) {
        clientConfig.ui.customComponents.forEach(component => {
            renderCustomComponent(component, clientConfig);
        });
    }
}

function renderHeader(clientConfig) {
    const header = document.getElementById('app-header');
    if (!header) return;
    
    const headerConfig = clientConfig.ui.header;
    
    // Create Calcite Shell header
    header.innerHTML = `
        <calcite-shell-panel slot="header">
            <calcite-panel heading="${headerConfig.title}">
                ${headerConfig.showLogo ? `
                    <img id="client-logo" slot="header-content" 
                         src="${clientConfig.logo}" 
                         alt="${clientConfig.name}" 
                         style="height: 40px;">
                ` : ''}
                <calcite-action-bar slot="header-actions-end">
                    ${headerConfig.components.includes('search') ? 
                        '<calcite-action icon="search" text="Search"></calcite-action>' : ''}
                    ${headerConfig.components.includes('theme-toggle') ? 
                        '<calcite-action icon="brightness" text="Toggle Theme"></calcite-action>' : ''}
                </calcite-action-bar>
            </calcite-panel>
        </calcite-shell-panel>
    `;
}

function renderPanel(panelConfig, clientConfig, mapContext) {
    const shellEl = document.querySelector('calcite-shell');
    if (!shellEl) return;
    
    // Create panel based on type
    if (panelConfig.component.type === 'stats-panel') {
        const panel = renderStatsPanel(panelConfig, clientConfig, mapContext);
        shellEl.appendChild(panel);
    } else if (panelConfig.component.type === 'legend') {
        const panel = renderLegendPanel(panelConfig, mapContext);
        shellEl.appendChild(panel);
    }
}

function renderStatsPanel(panelConfig, clientConfig, mapContext) {
    const { map, view } = mapContext;
    const config = panelConfig.component;
    
    // Create Calcite panel
    const panel = document.createElement('calcite-panel');
    panel.id = panelConfig.id;
    panel.slot = panelConfig.position;
    panel.heading = config.title;
    panel.width = panelConfig.width;
    if (panelConfig.open) panel.setAttribute('open', '');
    
    // Add stats blocks
    config.stats.forEach(stat => {
        const block = createStatBlock(stat, map, view, clientConfig);
        panel.appendChild(block);
    });
    
    return panel;
}

function createStatBlock(statConfig, map, view, clientConfig) {
    const block = document.createElement('calcite-block');
    block.heading = statConfig.label;
    block.open = true;
    
    const card = document.createElement('calcite-card');
    const chip = document.createElement('calcite-chip');
    chip.kind = statConfig.color;
    chip.scale = 'l';
    chip.icon = statConfig.icon;
    chip.value = '0';
    chip.id = `stat-${statConfig.id}`;
    
    card.appendChild(chip);
    block.appendChild(card);
    
    // Query layer and update count
    updateStatCount(statConfig, map, chip);
    
    // Auto-refresh
    setInterval(() => {
        updateStatCount(statConfig, map, chip);
    }, clientConfig.refreshInterval);
    
    return block;
}

async function updateStatCount(statConfig, map, chipElement) {
    const layer = map.findLayerById(statConfig.query.layerId);
    if (!layer) return;
    
    try {
        const query = layer.createQuery();
        query.where = statConfig.query.where || '1=1';
        
        if (statConfig.query.aggregate === 'sum') {
            query.outStatistics = [{
                statisticType: 'sum',
                onStatisticField: statConfig.query.field,
                outStatisticFieldName: 'total'
            }];
            const result = await layer.queryFeatures(query);
            const total = result.features[0]?.attributes?.total || 0;
            chipElement.value = total.toLocaleString();
        } else {
            const result = await layer.queryFeatureCount(query);
            chipElement.value = result.toLocaleString();
        }
    } catch (error) {
        console.error('Failed to update stat:', error);
    }
}

function renderLegendPanel(panelConfig, mapContext) {
    const { view } = mapContext;
    
    const panel = document.createElement('calcite-panel');
    panel.id = panelConfig.id;
    panel.slot = panelConfig.position;
    panel.heading = panelConfig.component.title;
    panel.width = panelConfig.width;
    if (panelConfig.open) panel.setAttribute('open', '');
    
    // Use ArcGIS Legend widget inside Calcite panel
    import('@arcgis/core/widgets/Legend').then(({ default: Legend }) => {
        const legendDiv = document.createElement('div');
        legendDiv.style.padding = '10px';
        panel.appendChild(legendDiv);
        
        new Legend({
            view: view,
            container: legendDiv,
            layerInfos: panelConfig.component.layerIds?.map(id => ({
                layer: view.map.findLayerById(id)
            }))
        });
    });
    
    return panel;
}

function renderCustomComponent(componentConfig, clientConfig) {
    if (componentConfig.type === 'calcite-notice') {
        const notice = document.createElement('calcite-notice');
        notice.id = componentConfig.id;
        notice.kind = componentConfig.props.kind;
        notice.icon = componentConfig.props.icon;
        notice.open = componentConfig.props.open;
        notice.closable = componentConfig.props.closable;
        
        notice.innerHTML = `
            <div slot="title">${componentConfig.content.title}</div>
            <div slot="message">${componentConfig.content.message}</div>
        `;
        
        // Position on page
        const container = document.getElementById('notices-container');
        if (container) container.appendChild(notice);
    }
}
```

### 6. HTML Structure

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading...</title>
    
    <!-- Calcite Components -->
    <script type="module" src="https://js.arcgis.com/calcite-components/2.x/calcite.esm.js"></script>
    <link rel="stylesheet" href="https://js.arcgis.com/calcite-components/2.x/calcite.css">
    
    <!-- ArcGIS Maps SDK -->
    <link rel="stylesheet" href="https://js.arcgis.com/4.31/esri/themes/light/main.css">
    
    <!-- Application -->
    <link rel="stylesheet" href="./styles.css">
</head>
<body>
    <!-- Calcite Shell (application frame) -->
    <calcite-shell>
        <!-- Header (rendered dynamically) -->
        <div id="app-header" slot="header"></div>
        
        <!-- Notices container -->
        <div id="notices-container" slot="alerts"></div>
        
        <!-- Panels (rendered dynamically) -->
        
        <!-- Map container -->
        <div id="map-container"></div>
    </calcite-shell>
    
    <script type="module" src="./main.js"></script>
</body>
</html>
```

### 7. Deployment Strategy

Same as the Mapbox application:

1. **Single Build**: One production build
2. **Multiple Deployments**: Deploy to different domains or paths
3. **URL Resolution**: Config resolves client based on URL
4. **Environment Variables**: Store API keys in `.env`:
   ```
   VITE_ARCGIS_API_KEY=your-key
   VITE_CLIENT1_FEATURE_SERVICE=https://...
   VITE_CLIENT2_FEATURE_SERVICE=https://...
   ```

---

## Benefits and Trade-offs

### Benefits

✅ **Single Codebase**
- One repository to maintain
- Unified bug fixes and features
- Easier testing and CI/CD

✅ **Easy Client Onboarding**
- Add new client = Add config object
- No code duplication
- Faster deployment for new clients

✅ **Flexible Customization**
- Each client gets unique branding
- Different data sources per client
- Custom UI components per client

✅ **Maintainability**
- Centralized logic
- Consistent patterns
- Easier refactoring

✅ **Cost Efficiency**
- Single build process
- Shared hosting infrastructure
- Reduced development time

### Trade-offs

⚠️ **Configuration Complexity**
- Large config file can become unwieldy
- Need good documentation
- Validation becomes important

⚠️ **Build Size**
- All client assets in one build (can mitigate with lazy loading)
- Larger initial bundle

⚠️ **Testing Overhead**
- Must test all client configurations
- More QA scenarios

⚠️ **Limited Client Isolation**
- All clients on same code version
- Breaking changes affect all clients
- Can't A/B test per client easily

### Mitigation Strategies

1. **Config Validation**: Add schema validation for config
2. **Lazy Loading**: Load client assets on-demand
3. **Feature Flags**: Add per-client feature toggles
4. **Versioning**: Support multiple config versions
5. **Testing**: Automated tests for each client config

---

## Conclusion

The **configuration-driven multi-tenant architecture** used in this Mapbox outage map application is highly applicable to ArcGIS + Calcite UI projects. The key principles are:

1. **Centralized Configuration**: One config file defines all client variations
2. **URL-Based Resolution**: Automatically detect which client to serve
3. **Dynamic UI Rendering**: Create UI components from configuration
4. **Theme Abstraction**: Apply client branding programmatically
5. **Flexible Data Sources**: Map different schemas per client

This pattern enables **rapid client onboarding**, **consistent maintenance**, and **flexible customization** while maintaining a **single codebase**. The ArcGIS implementation would follow the same patterns but leverage **Calcite Components** for UI and **ArcGIS Maps SDK** for mapping.

---

## Additional Resources

- **This Application**: `/Users/scotthubbert/Developer/fiberOMS/public-outage-map/mapbox-js/`
- **Config File**: `config.js`
- **UI Components**: `ui-components.js`
- **Theme Module**: `theme.js`
- **Deployment Guide**: `DEPLOYMENT.md`

---

*Document created: 2025-01-20*
*Application Version: 1.0.0*

