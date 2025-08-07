# Geographic Configuration Guide

This guide explains how to configure the FiberOMS Insight application for different geographic service areas.

## Overview

The application uses a centralized configuration system in `src/config/searchConfig.js` to define:

- Search widget bounds for local result preferences
- Map view constraints and initial positioning
- Service area-specific settings

## Quick Setup for New Deployments

### 1. Update the Service Area Configuration

Edit `src/config/searchConfig.js`:

```javascript
// Change this line to match your deployment
const CURRENT_SERVICE_AREA = "your_area_key";
```

### 2. Add Your Service Area

Add a new configuration object to the `SERVICE_AREAS` object:

```javascript
your_area_key: {
  name: 'Your Service Area Name',
  region: 'State/Province, Country',
  bounds: {
    xmin: -longitude_west,   // Western boundary
    ymin: latitude_south,    // Southern boundary
    xmax: -longitude_east,   // Eastern boundary
    ymax: latitude_north,    // Northern boundary
    spatialReference: { wkid: 4326 } // Always use WGS84
  },
  center: {
    latitude: center_lat,    // Geographic center latitude
    longitude: center_lng    // Geographic center longitude
  },
  searchSettings: {
    maxResults: 8,
    minCharacters: 3,
    includeDefaultSources: true,
    searchAllEnabled: false,
    placeholder: 'Search addresses, places...'
  }
}
```

## Configuration Examples

### Regional Deployment (Alabama Power Company)

```javascript
alabama_apco: {
  name: 'Alabama Power Company Service Area',
  region: 'Alabama, USA',
  bounds: {
    xmin: -88.3319638467807,
    ymin: 33.440523708494564,
    xmax: -87.35488507018964,
    ymax: 34.73445506886154,
    spatialReference: { wkid: 4326 }
  },
  center: {
    latitude: 34.087489,
    longitude: -87.843374
  },
  searchSettings: {
    maxResults: 8,
    minCharacters: 3,
    includeDefaultSources: true,
    searchAllEnabled: false,
          placeholder: 'Search addresses, places...'
  }
}
```

### Global Deployment (No Geographic Constraints)

```javascript
global: {
  name: 'Global Search (No Geographic Constraints)',
  region: 'Worldwide',
  bounds: null, // No bounds restriction
  center: {
    latitude: 39.8283, // Center of continental US
    longitude: -98.5795
  },
  searchSettings: {
    maxResults: 6,
    minCharacters: 3,
    includeDefaultSources: true,
    searchAllEnabled: true,
    placeholder: 'Search addresses, places worldwide...'
  }
}
```

## How to Find Geographic Bounds

### Method 1: Using Online Tools

1. Go to [bboxfinder.com](http://bboxfinder.com)
2. Draw a rectangle around your service area
3. Copy the coordinates in the format: `[west, south, east, north]`
4. Convert to the configuration format:
   - `xmin` = west longitude
   - `ymin` = south latitude
   - `xmax` = east longitude
   - `ymax` = north latitude

### Method 2: Using ArcGIS Online

1. Open [ArcGIS Online Map Viewer](https://www.arcgis.com/home/webmap/viewer.html)
2. Navigate to your service area
3. Use the Measure tool to get coordinates
4. Note the extent coordinates

### Method 3: Using Google Earth

1. Open Google Earth
2. Navigate to your service area
3. Note the coordinates displayed in the bottom right
4. Identify the southwest and northeast corners

## Configuration Properties Explained

### `bounds` Object

- **Purpose**: Defines the geographic extent for search results and map constraints
- **Format**: `{ xmin, ymin, xmax, ymax, spatialReference }`
- **Units**: Decimal degrees (WGS84)
- **Set to `null`**: For global deployments with no geographic constraints

### `center` Object

- **Purpose**: Defines the initial map center and home button location
- **Format**: `{ latitude, longitude }`
- **Usage**: Used for initial positioning and fallback centering

### `searchSettings` Object

- **`maxResults`**: Maximum number of search results to display
- **`minCharacters`**: Minimum characters before search triggers
- **`includeDefaultSources`**: Whether to include ArcGIS default search sources
- **`searchAllEnabled`**: Whether to allow searching beyond geographic bounds
- **`placeholder`**: Placeholder text for the search widget

## Testing Your Configuration

After updating the configuration:

1. **Search Widget Testing**:

   - Search for common place names (should show local results first)
   - Search for addresses within your service area
   - Verify placeholder text appears correctly

2. **Map Bounds Testing**:

   - Verify the map initializes within your defined bounds
   - Test that navigation is constrained to your service area
   - Check that the home button returns to your defined extent

3. **Console Verification**:
   - Open browser developer tools
   - Look for configuration confirmation messages:
     - `✅ Search widget configured with [Area Name] bounds for local results preference`
     - `✅ Map constrained to [Area Name]`

## Deployment Checklist

- [ ] Updated `CURRENT_SERVICE_AREA` constant
- [ ] Added/verified service area configuration object
- [ ] Tested search widget with local queries
- [ ] Verified map bounds and constraints
- [ ] Confirmed home button behavior
- [ ] Updated placeholder text for search widget
- [ ] Tested on different screen sizes/devices

## Troubleshooting

### Search Results Not Local

- Verify `bounds` coordinates are correct
- Check that `searchAllEnabled` is set to `false`
- Ensure `includeDefaultSources` is `true`

### Map Not Constrained to Area

- Verify bounds coordinates are in correct format
- Check console for error messages
- Ensure `spatialReference` is set to `{ wkid: 4326 }`

### Home Button Not Working

- Verify service area configuration is valid
- Check that center coordinates are within bounds
- Look for console errors during home button configuration

## Advanced Configuration

### Custom Search Sources

You can add custom search sources by modifying the search widget configuration in `main.js`:

```javascript
// Add custom search sources after widget initialization
if (searchWidget.widget) {
  // Add your custom search source here
}
```

### Multiple Service Areas

For applications serving multiple regions, you can:

1. Add multiple service area configurations
2. Implement dynamic switching based on user selection
3. Use URL parameters to determine the active service area

## Support

For additional configuration assistance:

1. Check the browser console for error messages
2. Verify all coordinates are in decimal degrees
3. Test with a simple rectangular bounds first
4. Refer to [ArcGIS Search Widget documentation](https://developers.arcgis.com/javascript/latest/api-reference/esri-widgets-Search.html)
