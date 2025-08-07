# Zoom-Based Visibility and Data Loading for MST Infrastructure

## Date: 2025-01-03

## Overview

Implementation of zoom-based visibility controls for MST Terminals, Splitters, and Closures to improve map performance and user experience.

## Implementation Details

### Zoom-Based Visibility

The following infrastructure layers now have scale-dependent visibility:

#### MST Terminals & Splitters

- **Visibility Threshold**: Zoom level 15+ (street level)
- **Min Scale**: 24,000
- **Behavior**: Hidden when zoomed out, visible when zoomed in to street level

#### Closures

- **Visibility Threshold**: Zoom level 16+ (closer street level)
- **Min Scale**: 12,000
- **Behavior**: Hidden when zoomed out, visible when zoomed in closer

### Scale Reference

- Zoom Level 13: ~1:70,000 (neighborhood level)
- Zoom Level 14: ~1:35,000 (local area)
- Zoom Level 15: ~1:24,000 (street level)
- Zoom Level 16: ~1:12,000 (block level)
- Zoom Level 17: ~1:6,000 (building level)

## Data Loading Options

### Current Implementation: Full GeoJSON Loading

Currently, the entire GeoJSON file is loaded when the layer is initialized, but features are only rendered when within the scale visibility range.

**Pros:**

- Simple implementation
- Fast rendering once loaded
- No additional server requests when panning/zooming
- Works offline after initial load

**Cons:**

- Initial load time for large datasets
- Memory usage for all features

### Option 1: View-Based Loading (Recommended for Future)

Implement dynamic loading based on the current map extent.

```javascript
// Example implementation
async loadFeaturesInView(extent, zoom) {
    if (zoom < 15) return []; // Don't load if zoomed out

    const bounds = {
        minLat: extent.ymin,
        maxLat: extent.ymax,
        minLng: extent.xmin,
        maxLng: extent.xmax
    };

    // Filter features within bounds
    return features.filter(f =>
        f.geometry.coordinates[1] >= bounds.minLat &&
        f.geometry.coordinates[1] <= bounds.maxLat &&
        f.geometry.coordinates[0] >= bounds.minLng &&
        f.geometry.coordinates[0] <= bounds.maxLng
    );
}
```

**Benefits:**

- Reduced memory usage
- Faster initial load
- Scalable for large datasets

**Requirements:**

- Backend API support for spatial queries
- Or client-side spatial indexing (e.g., using rbush)

### Option 2: Tile-Based Loading

Use vector tiles for infrastructure data.

**Benefits:**

- Industry standard for large datasets
- Built-in zoom level optimization
- Automatic view-based loading
- Excellent performance

**Requirements:**

- Vector tile server (e.g., MapBox, GeoServer)
- Data preprocessing into tiles
- More complex setup

### Option 3: Feature Service with Query

Use ArcGIS FeatureService with server-side queries.

```javascript
const layer = new FeatureLayer({
  url: "https://your-server/arcgis/rest/services/MST/FeatureServer/0",
  definitionExpression: "1=1",
  outFields: ["*"],
  minScale: 24000,
  maxScale: 0,
});

// Server automatically handles view-based queries
```

**Benefits:**

- Server handles optimization
- Built-in caching
- Supports large datasets

**Requirements:**

- ArcGIS Server or ArcGIS Online
- Feature service setup

## Performance Optimization Recommendations

### Immediate Optimizations (Implemented)

1. ✅ Scale-dependent visibility
2. ✅ Appropriate zoom thresholds
3. ✅ Optimized symbology

### Short-term Optimizations

1. **Clustering at Medium Zoom**

   - Group nearby terminals/splitters when partially zoomed
   - Show counts in clusters
   - Expand on further zoom

2. **Progressive Loading**

   - Load critical features first
   - Load additional detail as needed

3. **Client-Side Spatial Indexing**

   ```javascript
   import rbush from "rbush";

   const spatialIndex = rbush();
   spatialIndex.load(
     features.map((f) => ({
       minX: f.geometry.coordinates[0],
       minY: f.geometry.coordinates[1],
       maxX: f.geometry.coordinates[0],
       maxY: f.geometry.coordinates[1],
       feature: f,
     }))
   );
   ```

### Long-term Optimizations

1. **Vector Tile Implementation**

   - Convert GeoJSON to MVT format
   - Serve through tile server
   - Implement with VectorTileLayer

2. **Server-Side API**
   - Implement bbox queries
   - Add pagination support
   - Cache frequently accessed areas

## Current Performance Impact

### Before Optimization

- All features rendered at all zoom levels
- Potential performance issues with 1000+ features
- Cluttered map at wide zoom levels

### After Optimization

- Features only render when relevant
- Improved map readability
- Better performance at overview zoom levels
- Reduced GPU load

## Testing Checklist

- [x] MST Terminals hidden when zoomed out
- [x] MST Terminals visible at street level
- [x] Splitters follow same visibility rules
- [x] Closures visible at closer zoom
- [x] Popup functionality maintained
- [x] Labels scale appropriately
- [ ] Performance testing with large datasets
- [ ] Mobile device testing

## Future Enhancements

1. Add loading indicators for data fetching
2. Implement view-based loading when dataset grows
3. Add user preference for visibility thresholds
4. Implement smart clustering for medium zoom levels
5. Add performance metrics monitoring

## Notes

- Current implementation uses full GeoJSON loading with render-time filtering
- This is sufficient for datasets up to ~10,000 features
- Consider view-based loading for larger datasets
- Monitor performance metrics to determine when to upgrade approach
