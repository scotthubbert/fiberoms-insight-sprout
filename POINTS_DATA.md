try this, and also remove the zoom to flag for these points.

Based on my analysis of the FiberOMS Insight codebase, here's how I would tell myself to implement offline points from Supabase in another ArcGIS + Calcite UI project:

## Implementation Guide: Offline Points from Supabase

### 1. **Start with Data Configuration**

Create a centralized configuration file (`src/utils/dataConfig.js`):

```javascript
export const tableConfigs = {
  subscribers: {
    tableName: "subscribers", // Your Supabase table name
    geometryType: "point",
    fields: {
      longitude: "longitude",
      latitude: "latitude",
      status: "status",
      name: "name",
      // Add your specific fields
    },
    filters: {
      offline: { status: "Offline" },
      online: { status: "Online" },
      default: {},
    },
    symbols: {
      offline: {
        type: "simple-marker",
        style: "circle",
        color: [255, 0, 0, 0.8], // Red for offline
        size: 8,
        outline: { color: [255, 255, 255], width: 2 },
      },
      online: {
        type: "simple-marker",
        style: "circle",
        color: [0, 255, 0, 0.8], // Green for online
        size: 8,
        outline: { color: [255, 255, 255], width: 2 },
      },
    },
    realTimeEnabled: true,
    refreshInterval: 300000, // 5 minutes fallback
  },
};
```

### 2. **Create the Data Service**

Build a service to handle Supabase queries (`src/utils/dataService.js`):

```javascript
import { supabase } from "./supabase.js";
import { getTableConfig } from "./dataConfig.js";

export class DataService {
  static async fetchData(tableName, options = {}) {
    const { columns = "*", filters = {}, limit } = options;

    const tableConfig = getTableConfig(tableName);
    if (!tableConfig) {
      throw new Error(`No configuration found for table: ${tableName}`);
    }

    let query = supabase.from(tableConfig.tableName).select(columns);

    // Apply filters
    const filterToApply =
      typeof filters === "string" ? tableConfig.filters[filters] : filters;

    if (filterToApply) {
      Object.entries(filterToApply).forEach(([column, value]) => {
        query = query.eq(column, value);
      });
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }
}
```

### 3. **Build the Data Layer Component**

Create a Web Component for managing the layer (`src/components/DataLayer.js`):

```javascript
import { FeatureLayer } from "@arcgis/core/layers/FeatureLayer";
import { DataService } from "../utils/dataService.js";
import { getTableConfig } from "../utils/dataConfig.js";

export class DataLayer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.layer = null;
    this.mapView = null;
    this.config = null;
    this.featureCache = new Map();
  }

  static get observedAttributes() {
    return ["table", "filter", "visible"];
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                .status { padding: 8px; margin: 4px 0; border-radius: 4px; }
                .loading { background: var(--calcite-color-status-info); color: white; }
                .success { background: var(--calcite-color-status-success); color: white; }
                .error { background: var(--calcite-color-status-danger); color: white; }
            </style>
            <div class="status" id="status"></div>
        `;
  }

  async configure(config) {
    this.config = config;
    await this.loadData();
  }

  async loadData() {
    try {
      this.showStatus("loading", "Loading data...");

      // Fetch data from Supabase
      const records = await DataService.fetchData(
        this.config.tableName,
        this.config.queryOptions
      );

      if (records.length > 0) {
        // Create ArcGIS FeatureLayer
        this.layer = this.createFeatureLayer(records);
        this.initializeFeatureCache(records);

        // Add to map
        if (this.mapView) {
          this.addToMap();
        }

        this.showStatus("success", `Loaded ${records.length} features`);
        this.dispatchDataLoadedEvent(records);
      } else {
        this.showStatus("success", "No data found");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      this.showStatus("error", `Error: ${error.message}`);
    }
  }

  createFeatureLayer(records) {
    // Filter valid coordinates
    const validRecords = records.filter((record) => {
      const lng = record[this.config.longitudeField];
      const lat = record[this.config.latitudeField];
      return lng != null && lat != null && !isNaN(lng) && !isNaN(lat);
    });

    if (validRecords.length === 0) {
      throw new Error("No valid coordinates found");
    }

    // Convert to ArcGIS features
    const features = validRecords.map((record, index) => ({
      geometry: {
        type: "point",
        longitude: parseFloat(record[this.config.longitudeField]),
        latitude: parseFloat(record[this.config.latitudeField]),
      },
      attributes: {
        ObjectID: index + 1,
        ...record,
      },
    }));

    // Get symbol from config
    const tableConfig = getTableConfig(this.config.tableName);
    const filterKey = this.config.queryOptions?.filters || "default";
    const symbolKey = this.getSymbolKeyFromFilter(filterKey);
    const symbol = tableConfig.symbols[symbolKey];

    // Create popup template
    const popupTemplate = this.createPopupTemplate();

    return new FeatureLayer({
      title: this.config.title,
      source: features,
      fields: this.createFieldsFromRecords(validRecords[0]),
      popupTemplate,
      renderer: {
        type: "simple",
        symbol,
      },
    });
  }

  getSymbolKeyFromFilter(filterKey) {
    // Map filter keys to symbol keys
    const symbolMap = {
      offline: "offline",
      online: "online",
      default: "default",
    };
    return symbolMap[filterKey] || "default";
  }

  createPopupTemplate() {
    return {
      title: "{name}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "status", label: "Status" },
            { fieldName: "name", label: "Name" },
            // Add your specific fields
          ],
        },
      ],
    };
  }

  createFieldsFromRecords(record) {
    const fields = [{ name: "ObjectID", type: "oid" }];

    Object.keys(record).forEach((key) => {
      const value = record[key];
      let fieldType = "string";

      if (typeof value === "number") {
        fieldType = Number.isInteger(value) ? "integer" : "double";
      } else if (value instanceof Date) {
        fieldType = "date";
      }

      fields.push({
        name: key,
        alias: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        type: fieldType,
      });
    });

    return fields;
  }

  initializeFeatureCache(records) {
    this.featureCache.clear();
    if (this.layer && this.layer.source && this.layer.source.items) {
      this.layer.source.items.forEach((feature, index) => {
        const record = records[index];
        if (record && record.id) {
          this.featureCache.set(record.id, feature);
        }
      });
    }
  }

  addToMap() {
    if (this.layer && this.mapView && this.mapView.map) {
      this.mapView.map.add(this.layer);
    }
  }

  setMapView(mapView) {
    this.mapView = mapView;
    if (this.layer) {
      this.addToMap();
    }
  }

  showStatus(type, message) {
    const statusEl = this.shadowRoot.getElementById("status");
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  dispatchDataLoadedEvent(records) {
    this.dispatchEvent(
      new CustomEvent("dataLoaded", {
        detail: {
          layer: this.layer,
          features: records,
          count: records.length,
          source: "supabase",
        },
        bubbles: true,
      })
    );
  }

  getLayer() {
    return this.layer;
  }
}

customElements.define("data-layer", DataLayer);
```

### 4. **Add Real-time Updates (Optional)**

For real-time functionality, create a real-time service:

```javascript
// src/utils/realtimeService.js
import { supabase } from "./supabase.js";

export class RealtimeService {
  constructor() {
    this.subscriptions = new Map();
  }

  subscribe(tableName, channelName, callback, options = {}) {
    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          filter: options.filter,
        },
        callback
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  unsubscribe(channelName) {
    const subscription = this.subscriptions.get(channelName);
    if (subscription) {
      supabase.removeChannel(subscription);
      this.subscriptions.delete(channelName);
    }
  }
}

export const realtimeService = new RealtimeService();
```

### 5. **Use in Your Main App**

Integrate into your main application:

```javascript
// src/main.js
import { MapView } from "@arcgis/core/views/MapView";
import { Map } from "@arcgis/core/Map";
import { DataLayer } from "./components/DataLayer.js";

class App {
  constructor() {
    this.mapView = null;
    this.dataLayers = new Map();
    this.init();
  }

  async init() {
    // Initialize ArcGIS Map
    const map = new Map({
      basemap: "streets-vector",
    });

    this.mapView = new MapView({
      container: "viewDiv",
      map: map,
      zoom: 10,
      center: [-87.123, 33.456], // Your center coordinates
    });

    // Wait for map to load
    await this.mapView.when();

    // Create offline subscribers layer
    this.createOfflineLayer();
  }

  createOfflineLayer() {
    const offlineLayer = document.createElement("data-layer");
    offlineLayer.setAttribute("id", "subscribers-offline");

    // Configure the layer
    offlineLayer.configure({
      tableName: "subscribers",
      title: "Offline Subscribers",
      longitudeField: "longitude",
      latitudeField: "latitude",
      queryOptions: {
        filters: "offline",
      },
    });

    // Set map view
    offlineLayer.setMapView(this.mapView);

    // Listen for data loaded events
    offlineLayer.addEventListener("dataLoaded", (event) => {
      console.log(`Loaded ${event.detail.count} offline subscribers`);
      this.updateOfflineCount(event.detail.count);
    });

    // Add to DOM
    document.body.appendChild(offlineLayer);
    this.dataLayers.set("offline", offlineLayer);
  }

  updateOfflineCount(count) {
    // Update your UI with the count
    const countElement = document.getElementById("offline-count");
    if (countElement) {
      countElement.textContent = count;
    }
  }
}

// Initialize app
new App();
```

### 6. **Add to Your HTML**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Your ArcGIS App</title>
    <link
      rel="stylesheet"
      href="https://js.arcgis.com/4.32/esri/themes/light/main.css"
    />
    <link
      rel="stylesheet"
      href="https://esri.github.io/calcite-components/assets/calcite.css"
    />
    <script
      type="module"
      src="https://esri.github.io/calcite-components/assets/calcite.esm.js"
    ></script>
    <script type="module" src="https://js.arcgis.com/4.32/"></script>
  </head>
  <body>
    <calcite-shell>
      <calcite-shell-panel slot="panel-start">
        <calcite-panel heading="Layers">
          <calcite-switch id="offline-toggle" scale="m">
            Offline Subscribers
          </calcite-switch>
          <div>Offline Count: <span id="offline-count">0</span></div>
        </calcite-panel>
      </calcite-shell-panel>

      <div id="viewDiv" style="height: 100vh;"></div>
    </calcite-shell>

    <script type="module" src="src/main.js"></script>
  </body>
</html>
```

### 7. **Key Implementation Notes**

1. **Follow the Configuration Pattern**: Use centralized configs for easy maintenance
2. **Use Web Components**: Leverage native browser APIs for modularity
3. **Implement Feature Caching**: Essential for real-time updates
4. **Handle Coordinate Validation**: Always filter invalid coordinates
5. **Use Calcite Design System**: For consistent UI components
6. **Add Error Handling**: Comprehensive error handling for production
7. **Optimize for Mobile**: Consider device limitations and connection speeds

This approach gives you a solid foundation that you can extend with additional features like clustering, advanced filtering, or real-time updates as needed.

Also, follow our rules.
