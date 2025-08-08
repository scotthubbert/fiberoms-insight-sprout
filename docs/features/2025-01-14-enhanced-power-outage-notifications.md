# Enhanced Power Outage Notifications

**Date:** 2025-01-14  
**Status:** Implemented  
**Component:** PowerOutageStatsComponent

## Overview

Enhanced the power outage notification system to provide more specific, actionable notifications that only trigger for meaningful changes (new outages or resolved outages), rather than any data refresh.

## Key Improvements

### 1. Individual Outage Tracking

- **Before:** Only tracked total outage counts per company
- **After:** Tracks individual outages by `outage_id` using Set collections
- **Benefit:** Can detect specific outage additions/removals, not just count changes

### 2. Specific Notification Content

- **Before:** Generic "Power outage data updated: APCo +1, Tombigbee -1"
- **After:** Detailed notifications with outage specifics:
  - Single new outage: "New Alabama Power outage: 150 customers affected in Downtown Birmingham"
  - Multiple new outages: "3 new Alabama Power outages affecting 425 customers"
  - Resolved outages: "Alabama Power outage resolved"
  - Mixed changes: Separate notifications for new and resolved

### 3. Smart Notification Triggers

- **Before:** Notified on any count change (including data refreshes)
- **After:** Only notifies when:
  - New outages are detected (`outage_id` not in previous set)
  - Outages are resolved (`outage_id` removed from current set)
  - No notification for simple data refreshes without actual changes

### 4. Enhanced UI Feedback

- **Notification Types:**
  - ⚠️ Warning (orange): New outages detected
  - ✅ Success (green): Outages resolved
  - ℹ️ Info (blue): Mixed changes
- **Extended Display:** 8 seconds (vs 5 seconds) for more detailed messages
- **Better Icons:** Lightning bolt icon for power-related notifications

## Technical Implementation

### Data Structure Changes

```javascript
// Added to constructor
this.lastKnownOutages = {
  apco: new Set(),
  tombigbee: new Set(),
};
```

### New Methods

1. **`checkAndNotifyOutageChanges()`** - Compares outage sets and triggers notifications
2. **`showSpecificOutageNotification()`** - Creates detailed notifications with outage info

### Backward Compatibility

- Original `showUpdateToast()` method preserved but deprecated
- Existing notification container and styling maintained
- No breaking changes to existing functionality

## Usage Examples

### New Single Outage

```
Title: New Power Outage
Message: New Alabama Power outage: 150 customers affected in Downtown Birmingham
Type: Warning (orange)
```

### Multiple New Outages

```
Title: New Power Outage
Message: 3 new Alabama Power outages affecting 425 customers
Type: Warning (orange)
```

### Resolved Outage

```
Title: Power Outage Resolved
Message: Alabama Power outage resolved
Type: Success (green)
```

### Mixed Changes

```
Title: Power Outage Updates
Message: New Tombigbee Electric outage: 200 customers affected in Fayette County. Alabama Power outage resolved
Type: Warning (orange, prioritizing new outage)
```

## Testing

A test script (`test_power_outage_notifications.js`) demonstrates all notification scenarios:

```javascript
// Manual testing
testOutageNotifications();

// Test scenarios included:
// 1. Single new outage
// 2. Multiple new outages
// 3. Resolved outage
// 4. Mixed changes
```

## Benefits

1. **Reduced Noise:** No notifications for routine data refreshes
2. **Actionable Information:** Users know exactly what changed and where
3. **Better Prioritization:** Warning for new outages, success for resolutions
4. **Detailed Context:** Customer counts, areas affected, company names
5. **Professional UX:** Appropriate notification timing and styling

## Configuration

No configuration required - the system automatically:

- Tracks outages by `outage_id` field
- Handles both APCo and Tombigbee data formats
- Works with existing polling and manual refresh systems
- Maintains state across component updates

## Performance Impact

- **Memory:** Minimal - only stores outage ID sets
- **Processing:** Efficient Set operations for change detection
- **Network:** No additional API calls
- **UI:** Same notification system, just smarter triggering

## Future Enhancements

Potential improvements:

1. **Severity-based notifications:** Different styling for major vs minor outages
2. **Geographic filtering:** Only notify for outages in user's area of interest
3. **Sound notifications:** Optional audio alerts for critical outages
4. **Notification history:** Log of recent outage changes
5. **Push notifications:** PWA push notifications for offline users

## Maintenance Notes

- Monitor `outage_id` field consistency across data sources
- Ensure Set operations handle null/undefined IDs gracefully
- Test notification behavior during rapid outage changes
- Verify memory usage with large numbers of tracked outages
