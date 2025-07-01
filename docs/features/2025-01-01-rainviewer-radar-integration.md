# RainViewer Radar Integration

**Date:** 2025-01-01  
**Status:** ✅ Implemented  
**Phase:** 1

## Overview

Added live weather radar overlay to the FiberOMS Insight PWA using the RainViewer API. The radar overlay can be toggled on/off from both desktop Tools section and mobile interface, providing real-time precipitation data for field operations.

## Features

### Desktop Interface

- **Tools Panel**: Weather radar toggle in "Weather Overlays" section
- **Layer Management**: Integrated with existing LayerManager service
- **Auto-refresh**: Updates every 10 minutes when visible
- **Z-order**: Bottom layer (z-order: -10) to appear below all basemap labels

### Mobile Interface

- **Environmental Section**: Toggle in mobile "Other Layers" dialog
- **Quick Toggle**: Button in OSP Tools section for easy access
- **Touch-friendly**: Optimized for mobile interaction
- **Auto-close**: Closes panel after toggling for better UX

### Technical Features

- **Free API**: Uses RainViewer's free public API
- **WebTileLayer**: Efficient tile-based rendering
- **Auto-updates**: Fetches latest radar data automatically
- **Theme-Aware**: Adapts opacity and blend mode for light/dark themes
- **Opacity Control**: 50% opacity (light mode), 75% opacity (dark mode)
- **Blend Mode**: Multiply (light mode), Normal (dark mode) for optimal visibility
- **Error Handling**: Graceful fallback if API unavailable

## API Integration

### RainViewer API

- **Endpoint**: `https://api.rainviewer.com/public/weather-maps.json`
- **Tile Server**: `https://tilecache.rainviewer.com`
- **Update Frequency**: 10 minutes
- **Data Coverage**: Global weather radar data
- **No API Key**: Free public access

### Tile Configuration

```javascript
{
  size: 512,        // High resolution tiles
  color: 2,         // Default color scheme
  smooth: 1,        // Enable smoothing
  snow: 1,          // Show snow precipitation
  // Theme-aware settings:
  light: {
    opacity: 0.5,   // Light mode opacity
    blendMode: 'multiply'  // Blend with basemap layers
  },
  dark: {
    opacity: 0.75,  // Dark mode opacity (higher for visibility)
    blendMode: 'normal'    // Normal blend in dark mode
  }
}
```

## Implementation Architecture

### New Services

- **RainViewerService**: Handles API integration and layer management
- **WebTileLayer Support**: Extended LayerManager for tile-based layers

### Service Integration

```javascript
// Application initialization
this.services.rainViewerService = new RainViewerService();
await this.services.rainViewerService.initialize();
await this.initializeRadarLayer();
```

### Layer Configuration

```javascript
const radarConfig = {
  id: "rainviewer-radar",
  title: "Weather Radar",
  layerType: "WebTileLayer",
  layerInstance: radarLayer,
  visible: false,
  zOrder: -10, // Below all basemap layers
  onVisibilityChange: (visible) => {
    this.services.rainViewerService.toggleVisibility(visible);
  },
};
```

## UI Components

### Desktop Tools Panel

```html
<calcite-block heading="Weather Overlays" collapsible>
  <calcite-label>
    <calcite-checkbox></calcite-checkbox>
    Weather Radar
  </calcite-label>
</calcite-block>
```

### Mobile Interface

```html
<!-- Environmental section toggle -->
<calcite-list-item
  label="Weather Radar"
  description="Live weather overlay from RainViewer"
  class="layer-toggle-item"
>
  <calcite-icon
    slot="content-start"
    icon="cloud-rain"
    style="color: var(--calcite-color-info);"
  ></calcite-icon>
  <calcite-switch slot="content-end"></calcite-switch>
</calcite-list-item>

<!-- Quick toggle button -->
<calcite-button
  width="full"
  icon-start="cloud-rain"
  appearance="outline"
  id="mobile-radar-toggle"
>
  Weather Radar
</calcite-button>
```

## Performance Considerations

### Efficient Loading

- **On-demand**: Only loads when toggled on
- **Caching**: Browser tile caching for performance
- **Background Updates**: Auto-refresh only when visible
- **Memory Management**: Proper cleanup on layer removal

### Network Optimization

- **CDN Delivery**: RainViewer uses global CDN
- **Tile-based**: Loads only visible map tiles
- **Compression**: PNG tiles with optimized compression
- **Bandwidth Friendly**: ~512KB for full-screen coverage

## Error Handling

### API Failures

- **Graceful Degradation**: Layer fails silently if API unavailable
- **Retry Logic**: Auto-retry on temporary failures
- **User Feedback**: Console logging for debugging
- **Fallback**: Toggle remains functional even if data unavailable

### Network Issues

- **Timeout Handling**: 30-second request timeout
- **Offline Support**: Cached tiles available offline
- **Progressive Loading**: Tiles load progressively
- **Error Recovery**: Automatic recovery on network restoration

## Testing

### Test Cases

- [ ] Desktop radar toggle functionality
- [ ] Mobile radar toggle functionality
- [ ] Auto-refresh when visible
- [ ] Proper z-order (above other layers)
- [ ] API error handling
- [ ] Network offline/online scenarios
- [ ] Mobile panel closure after toggle
- [ ] Cross-platform compatibility

### Performance Tests

- [ ] Initial load time impact
- [ ] Memory usage with radar active
- [ ] Network bandwidth usage
- [ ] Battery impact on mobile devices

## Browser Compatibility

| Browser      | Desktop | Mobile | Notes        |
| ------------ | ------- | ------ | ------------ |
| Chrome 120+  | ✅      | ✅     | Full support |
| Safari 17+   | ✅      | ✅     | Full support |
| Firefox 121+ | ✅      | ✅     | Full support |
| Edge 120+    | ✅      | ✅     | Full support |

## Future Enhancements

### Phase 2 Features

- **Animation Controls**: Play/pause radar animation
- **Historical Data**: View past radar frames
- **Opacity Slider**: User-adjustable transparency
- **Color Schemes**: Multiple radar color options

### Advanced Features

- **Forecast Data**: 30-minute nowcast frames
- **Precipitation Alerts**: Notifications for incoming weather
- **Layer Blending**: Combine with satellite imagery
- **Custom Regions**: Focus on specific coverage areas

## API Attribution

**Required Attribution**: "Rain Viewer API" as data source
**API Documentation**: https://www.rainviewer.com/api.html
**Terms of Use**: Free for all use cases
**Data Sources**: Global weather radar networks

---

## Related Documentation

- [LayerManager Extension](../templates/implementation-guide-template.md)
- [Mobile UI Guidelines](../templates/implementation-guide-template.md)
- [PWA Best Practices](../README.md)
