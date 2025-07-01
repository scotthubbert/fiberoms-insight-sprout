# Feature: Subscriber Visualization and Popup Actions

**Date**: 2024-12-19  
**Author**: Development Team  
**Status**: Active  
**Version**: 1.0

## Overview

### Purpose

Provides visual representation of FiberOMS subscribers on an interactive map with clustered offline subscribers and individual online subscribers, along with popup actions for copying subscriber information and getting directions.

### User Impact

Field technicians and service managers can quickly identify subscriber concentrations, individual subscriber locations, and access critical subscriber information with one-click copying functionality.

## User Experience

### User Stories

- As a field technician, I want to see offline subscribers clustered together so that I can identify service outage areas
- As a service manager, I want to see individual online subscribers so that I can analyze service disruption patterns
- As a user, I want to copy subscriber information quickly so that I can share it with other systems or reports
- As a field worker, I want to get directions to a subscriber location so that I can navigate there efficiently

### User Interface

- **Offline Subscribers**: Displayed as clustered points with count badges showing number of subscribers in each cluster
- **Online Subscribers**: Displayed as individual green points across the map
- **Popup**: Shows subscriber details with "Copy Info" and "Get Directions" action buttons
- **Layer Ordering**: Offline subscribers appear above online subscribers for better visibility

### User Flows

1. **Viewing Clusters**: User sees clustered offline subscriber points, clicks to zoom and see individual points
2. **Accessing Details**: User clicks on any subscriber point to open popup with subscriber information
3. **Copying Information**: User clicks "Copy Info" button to copy subscriber details to clipboard
4. **Getting Directions**: User clicks "Get Directions" to open navigation to subscriber location

## Technical Implementation

### Architecture Overview

The feature uses a service-oriented architecture with dedicated services for layer management, popup management, and map control, following SOLID principles.

### Key Components

#### LayerManager

- **File**: `src/services/LayerManager.js`
- **Purpose**: Manages creation and configuration of subscriber layers with clustering
- **Key Methods**:
  - `createSubscriberLayers()` - Creates both online and offline subscriber layers
  - `addLayer()` - Adds layers to map with proper z-ordering
- **Dependencies**: Supabase data service, layer configurations

#### PopupManager

- **File**: `src/services/PopupManager.js`
- **Purpose**: Handles popup display and action button functionality
- **Key Methods**:
  - `setupPopupHandlers()` - Configures popup event listeners
  - `handleTriggerAction()` - Processes popup button clicks
- **Dependencies**: MapController for map view access

#### Layer Configuration

- **File**: `src/config/layerConfigs.js`
- **Purpose**: Defines layer styling and clustering configurations
- **Key Methods**:
  - `createOfflineClusterConfig()` - Configures clustering for offline subscribers
  - `createOfflineSubscriberConfig()` - Defines offline subscriber styling
  - `createOnlineSubscriberConfig()` - Defines online subscriber styling

### Data Flow

1. **Data Loading**: Supabase service fetches subscriber data (227 offline, 23,917 online)
2. **Layer Creation**: LayerManager creates GeoJSON layers with appropriate configurations
3. **Clustering**: ArcGIS JS API applies clustering to offline subscribers based on configuration
4. **Rendering**: Layers are added to map with proper z-order (offline z-order: 100, online z-order: 0)
5. **Interaction**: User clicks trigger popup display via PopupManager
6. **Actions**: Button clicks in popup trigger copy-to-clipboard or navigation actions

## Dependencies

### External Libraries

- ArcGIS JS API 4.32 - Mapping, clustering, and GeoJSON layer support
- Supabase JS - Database connectivity for subscriber data

### Internal Services

- DataService - Provides cached subscriber data from Supabase
- MapController - Manages map instance and view
- LayerManager - Creates and manages map layers
- PopupManager - Handles popup interactions

## Configuration

### Layer Settings

```javascript
// Offline subscribers with clustering
{
  type: "cluster",
  clusterRadius: "100px",
  clusterMinSize: "24px",
  clusterMaxSize: "60px",
  labelingInfo: [/* cluster count labels */]
}

// Z-order configuration
offline: { zOrder: 100 }  // Above other layers
online: { zOrder: 0 }     // Base layer
```

### Popup Template

```javascript
{
  title: "Subscriber Information",
  content: [/* subscriber details */],
  actions: [
    { title: "Copy Info", id: "copy-info", className: "esri-icon-copy" },
    { title: "Get Directions", id: "get-directions", className: "esri-icon-directions" }
  ]
}
```

## Testing

### Manual Testing

1. **Clustering Verification**:

   - Verify offline subscribers show as clusters at zoom levels 1-15
   - Verify clusters break apart at higher zoom levels
   - Verify cluster counts match expected subscriber numbers

2. **Layer Ordering**:

   - Verify offline subscriber clusters appear above online subscriber points
   - Test at various zoom levels and map positions

3. **Popup Functionality**:
   - Click various subscriber points to verify popup display
   - Test "Copy Info" button for clipboard functionality
   - Test "Get Directions" button for navigation integration

## Performance Considerations

### Metrics

- Load time: ~2-3 seconds for 24,144 total subscribers
- Memory usage: Clustering reduces DOM nodes significantly
- Network requests: Single cached request to Supabase

### Optimization Notes

- Offline subscribers use clustering to reduce rendering overhead
- Online subscribers remain individual for service disruption analysis
- Blob URLs used for GeoJSON layer sources to avoid direct object assignment issues

## Maintenance

### Known Issues

- Popup action event handlers may need adjustment if ArcGIS JS API popup template system changes
- Clustering configuration may need tuning based on user feedback

### Future Improvements

- Add subscriber status filtering options
- Implement real-time subscriber status updates
- Add bulk subscriber information export functionality

### Monitoring

- Monitor popup action success rates
- Track clustering performance with larger datasets
- Monitor clipboard API compatibility across browsers

## Related Documentation

- [SOLID Refactoring Summary](../../REFACTORING_SUMMARY.md)
- [Supabase Integration](../../POINTS_DATA.md)
- [Service Architecture](../../design/service-architecture.md)

## Change Log

### 1.1 - 2024-12-19

- **Fix**: Updated popup action icons to use correct Calcite Design System icon names
  - Changed 'copy' to 'duplicate' for Copy Info button
  - Changed 'navigation-arrow' to 'pin-tear' for Get Directions button
  - Updated error feedback icon to use 'x' instead of invalid icon name
  - Fixed mobile UI 'warning' icon to 'notice-triangle' for fiber outages
- **Fix**: Added explicit field definitions to GeoJSONLayers to prevent field type inference warnings
  - Defined schema for all subscriber fields (customer_name, address, etc.)
  - Eliminated console warnings about dropped fields during layer loading

### 1.0 - 2024-12-19

- Initial implementation with clustering and popup actions
- Integrated with SOLID refactored architecture
- Added z-order layer management
- Implemented copy-to-clipboard functionality
