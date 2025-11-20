# Business Internet Filter Feature

**Date:** January 2025  
**Status:** Implemented

## Overview

Added a toggle in the Map Layers section to filter and display only Business Internet subscribers, both online and offline.

## Implementation

### UI Component

- **Location:** Map Layers section in the side panel
- **Element:** Calcite switch toggle labeled "Business Internet Only"
- **Icon:** Organization icon (building/company) in purple (#9333ea) to match business subscriber markers
- **Description:** "Filter to show only business subscribers"

### Technical Approach

The implementation uses **definition expressions** on existing subscriber layers rather than creating separate layers. This approach:

1. **Efficient:** No additional data loading or layer management
2. **Maintains functionality:** All existing features work (clustering, popups, interactions)
3. **Simple:** Single filter applies to both online and offline layers simultaneously
4. **Performant:** ArcGIS GeoJSONLayer handles definition expressions efficiently

### Code Changes

#### `index.html`
- Added new list item with switch control in Map Layers block (after Online/Offline toggles)
- Desktop ID: `business-internet-filter-switch`
- Mobile ID: `mobile-business-internet-filter-switch`
- Icon: `organization` (Calcite icon) with `status-icon-business` class and inline purple styling

#### `src/core/Application.js`
- Added event listeners in `setupLayerToggleHandlers()` method for both desktop and mobile switches
- Implemented `toggleBusinessInternetFilter(enabled)` method that:
  - Retrieves both online and offline subscriber layers
  - Applies/removes definition expression: `service_type = 'BUSINESS INTERNET'`
  - Shows user notification confirming filter state
  - Logs filter application for debugging
- Added synchronization logic to keep desktop and mobile switches in sync

#### `src/style.css`
- Added `.status-icon-business` class with purple color (#9333ea) for consistent styling

### Definition Expression

```javascript
"service_type = 'BUSINESS INTERNET'"
```

This SQL-like expression filters the layer features on the client side to show only records where the `service_type` field exactly matches 'BUSINESS INTERNET'.

## User Experience

1. Toggle is off by default (shows all subscriber types)
2. When enabled:
   - Only Business Internet subscribers are displayed
   - Purple markers remain (both online and offline states)
   - Clustering still works
   - Popups and interactions unchanged
   - Notification: "Now showing Business Internet subscribers only"
3. When disabled:
   - All subscriber types are displayed
   - Notification: "Showing all subscriber types"

## Benefits

- **Quick Analysis:** Isolate business customers for targeted review
- **Status Monitoring:** See business customer online/offline status at a glance
- **No Performance Impact:** Filter is applied client-side, no additional data queries
- **Flexible:** Can be toggled on/off while other layer controls work independently

## Technical Notes

### Why Definition Expression vs Separate Layers?

**Considered Approaches:**
1. ✅ **Definition Expression (Implemented):** Filter existing layers
2. ❌ **Separate Layers:** Create dedicated business-only layers
3. ❌ **Renderer Modification:** Hide features via renderer

**Selected Approach Advantages:**
- No duplication of data in memory
- No additional layer management complexity
- No impact on layer loading/initialization
- Works seamlessly with existing clustering and rendering
- Single source of truth for subscriber data

### Data Schema

The filter relies on the `service_type` field in the subscriber data:
- Field: `service_type`
- Type: `string`
- Values: 
  - `'BUSINESS INTERNET'` - Business customers (purple markers)
  - `'RESIDENTIAL INTERNET'` - Residential customers (green/red markers)
  - Others possible but not currently filtered

### Compatibility

- Works with both online and offline subscriber layers
- Compatible with clustering (clusters update to reflect filtered data)
- Works with all zoom levels and visibility settings
- Maintains all popup actions and interactions

## Testing

To test the feature:
1. Open the application
2. Navigate to Map Layers panel
3. Enable "Offline Subscribers" or "Online Subscribers" (or both)
4. Toggle "Business Internet Only" on
5. Verify only purple markers are visible
6. Toggle "Business Internet Only" off
7. Verify all markers (green/red/purple) are visible
8. Test with clustering at various zoom levels
9. Test popup interactions on filtered markers

## Bug Fixes

### Bug 1: Filter Persistence During Updates (Fixed)

**Issue:** When subscriber data was refreshed/updated, the Business Internet filter was being reset even when the toggle remained ON.

**Root Cause:** The `LayerManager.updateGeoJSONLayer()` method was recreating layers without preserving the `definitionExpression` property.

**Solution:** Modified both `updateGeoJSONLayer()` and `updateGraphicsLayer()` methods to:
1. Capture the `definitionExpression` from the old layer before removal
2. Restore the `definitionExpression` to the new layer after recreation
3. Log the restoration for debugging purposes

**Code Changes:**
- `src/services/LayerManager.js` - Added definition expression preservation in layer update methods

**Result:** The Business Internet filter now persists correctly through all data updates, maintaining the filtered view even when subscriber data is refreshed.

### Bug 2: Lazy-Loaded Online Layer Filter Application (Fixed)

**Issue:** If a user enabled the Business Internet filter before ever toggling on the Online Subscribers layer (which is lazy-loaded), the filter would not be applied to the online layer when it was eventually loaded. The method would silently skip the undefined layer, causing the filter to fail without user notification.

**Root Cause:** The `toggleBusinessInternetFilter()` method only attempted to apply the filter to layers that already existed. The online subscribers layer is lazy-loaded on first use, so enabling the filter before loading the layer would have no effect on that layer.

**Solution:** 
1. Added `businessFilterEnabled` property to track the filter state
2. Modified `toggleBusinessInternetFilter()` to store the filter state and provide informative logging when the online layer isn't loaded yet
3. Modified `_performOnlineLayerLoad()` to check the `businessFilterEnabled` state and automatically apply the filter to the newly created online layer

**Code Changes:**
- `src/core/Application.js` (constructor): Added `businessFilterEnabled` state tracking
- `src/core/Application.js` (`toggleBusinessInternetFilter`): Store filter state and improve logging
- `src/core/Application.js` (`_performOnlineLayerLoad`): Apply filter to newly loaded layer if enabled

**Result:** The Business Internet filter now works correctly regardless of when the online subscribers layer is loaded, ensuring consistent filtering behavior.

### Bug 3: Production Cache Headers (Fixed)

**Issue:** Cache-control meta tags with comment "(Development)" were present in `index.html`, but they applied to both development AND production since there's only one HTML file. These no-cache headers would prevent browser caching in production, significantly degrading performance.

**Root Cause:** Meta tags in HTML apply globally and cannot be conditionally applied based on environment without server-side rendering or build-time transformation.

**Solution:** Removed the cache-control meta tags from `index.html` since:
1. Development cache-clearing is handled by the automatic service worker cleanup in `src/main.js`
2. The Vite dev server already has cache-busting headers configured in `vite.config.js`
3. Production needs proper caching for performance

**Code Changes:**
- `index.html` - Removed cache-control meta tags (lines 12-15)

**Result:** Production builds now properly cache resources for optimal performance, while development still has aggressive cache-clearing through JavaScript-based service worker cleanup.

### Bug 4: Mobile UX - Missing layer-toggle-item Class (Fixed)

**Issue:** The mobile "Business Internet Only" list item was missing the `class="layer-toggle-item"` attribute that all other mobile layer toggle items have. This caused inconsistent UX where clicking on the item text worked for all other toggles, but clicking on the business filter item text did nothing - users had to click the switch itself.

**Root Cause:** When the mobile toggle was added, the standard `layer-toggle-item` class was omitted, breaking the established interaction pattern used by all other mobile layer controls.

**Solution:** Added `class="layer-toggle-item"` to the mobile Business Internet Only list item.

**Code Changes:**
- `index.html` (line 544): Added `class="layer-toggle-item"` to mobile business filter list item
- `src/core/Application.js` (`getLayerIdFromElement`): Added recognition for business filter switch IDs to return special identifier
- `src/core/Application.js` (`handleLayerToggle`): Added early return for business filter to prevent conflict with dedicated handler

**Result:** Mobile users can now tap anywhere on the "Business Internet Only" row to toggle the filter, matching the behavior of all other layer toggles. The business filter switches are properly recognized and handled by their dedicated handler without conflicting with the generic layer toggle logic.

### Bug 5: Double Execution and Inconsistent Event Handling (Fixed)

**Issue:** The mobile "Business Internet Only" list item was missing the `class="layer-toggle-item"` attribute that all other mobile layer toggle items have. This caused inconsistent UX where clicking on the item text worked for all other toggles, but clicking on the business filter item text did nothing - users had to click the switch itself.

**Root Cause:** When the mobile toggle was added, the standard `layer-toggle-item` class was omitted, breaking the established interaction pattern used by all other mobile layer controls.

**Solution:** Added `class="layer-toggle-item"` to the mobile Business Internet Only list item.

**Code Changes:**
- `index.html` (line 544): Added `class="layer-toggle-item"` to mobile business filter list item
- `src/core/Application.js` (`getLayerIdFromElement`): Added recognition for business filter switch IDs to return special identifier
- `src/core/Application.js` (`handleLayerToggle`): Added early return for business filter to prevent conflict with dedicated handler

**Result:** Mobile users can now tap anywhere on the "Business Internet Only" row to toggle the filter, matching the behavior of all other layer toggles. The business filter switches are properly recognized and handled by their dedicated handler without conflicting with the generic layer toggle logic.

### Bug 5: Double Execution and Inconsistent Event Handling (Fixed)

**Issue:** Two related problems:
1. **Mobile double execution:** Clicking the mobile list item triggered `toggleBusinessInternetFilter()` twice - once from the manual call in the click handler and once from the `calciteSwitchChange` event (Calcite components fire events on programmatic `.checked` changes)
2. **Desktop no execution:** The desktop business filter switch had no event handler registered in `setupLayerSwitches()` where other desktop subscriber switches are handled, causing inconsistent behavior

**Root Cause:** 
- The mobile switch had redundant handlers: list item click handler + calciteSwitchChange listener
- The desktop switch was only handled in `setupLayerToggleHandlers()` while other desktop switches were in `setupLayerSwitches()`, creating architectural inconsistency
- No re-entrancy guard to prevent sync loops when programmatic changes trigger events

**Solution:**
1. Removed manual `toggleBusinessInternetFilter()` call from list item click handler - let calciteSwitchChange handle it
2. Moved desktop switch handler to `setupLayerSwitches()` for consistency with other desktop subscriber switches  
3. Added `_syncingBusinessFilter` instance property as re-entrancy guard
4. Implemented guard in both desktop and mobile calciteSwitchChange handlers to prevent recursive loops during sync

**Code Changes:**
- `src/core/Application.js` (constructor): Added `_syncingBusinessFilter` re-entrancy guard property
- `src/core/Application.js` (`setupLayerToggleHandlers`): Removed manual call, simplified mobile handler
- `src/core/Application.js` (`setupLayerSwitches`): Added desktop business filter switch with sync logic and guard
- `src/core/Application.js` (list item click handler): Removed special business filter handling since calciteSwitchChange handles it

**Result:** Both desktop and mobile business filter switches work correctly with single execution, proper synchronization, and no recursive loops. Event handling is now consistent with the architecture pattern used for other subscriber switches.

## Future Enhancements

Possible improvements:
- Add filter for Residential Internet only
- Multi-select service type filter
- Persist filter state in localStorage (survives page refreshes)
- Add filter indicator to map display
- Include business count in notification
- Add keyboard shortcut to toggle filter

