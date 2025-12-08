# Mouse Click Capture - RDP Compatibility Review

## Overview

This document reviews the application's mouse click capture functionality and identifies potential issues when running over Remote Desktop Protocol (RDP) sessions.

## Current Click Capture Mechanisms

### 1. PostHog Autocapture (Primary Analytics)

**Location:** `src/services/AnalyticsService.js`

```27:29:src/services/AnalyticsService.js
      autocapture: true, // Automatically track clicks, form submissions, etc.
      capture_pageview: true, // Track page views
      capture_pageleave: true, // Track when users leave
```

**How it works:**
- PostHog automatically attaches event listeners to DOM elements
- Uses standard DOM `click` events
- Captures clicks, form submissions, and other interactions

**RDP Concerns:**
- ✅ **Generally Compatible**: DOM events work normally over RDP
- ⚠️ **Potential Issues**:
  - Network latency may cause event timing delays
  - Rapid clicks might be missed if RDP connection is slow
  - Event batching/throttling could drop events during high latency

### 2. Capture Phase Listeners (PopupManager)

**Location:** `src/services/PopupManager.js`

```309:309:src/services/PopupManager.js
                clone.addEventListener('click', clickHandler, true);
```

**How it works:**
- Uses capture phase (`true` parameter) to intercept clicks before they bubble
- Attached to popup action buttons dynamically
- Prevents default behavior and stops propagation

**RDP Concerns:**
- ⚠️ **Timing Sensitivity**: Capture phase listeners are more sensitive to event timing
- ⚠️ **Event Ordering**: RDP latency could affect event propagation order
- ⚠️ **Race Conditions**: Dynamic attachment during popup rendering could miss clicks if RDP delays DOM updates

### 3. Pointer Events (HoverHighlightService)

**Location:** `src/services/HoverHighlightService.js`

```84:101:src/services/HoverHighlightService.js
        this.hoverHandler = this.view.on('pointer-move', (event) => {
            // Throttle hover events to improve performance
            if (throttleTimeout) {
                clearTimeout(throttleTimeout);
            }
            throttleTimeout = setTimeout(() => {
                this.handlePointerMove(event);
            }, 16); // ~60fps throttling
        });

        // Handle pointer leave (clear highlight)
        this.leaveHandler = this.view.on('pointer-leave', () => {
            if (throttleTimeout) {
                clearTimeout(throttleTimeout);
                throttleTimeout = null;
            }
            this.clearHighlight();
        });
```

**How it works:**
- Uses ArcGIS map view `pointer-move` and `pointer-leave` events
- Throttled to ~60fps (16ms intervals)
- Performs hit testing on map features

**RDP Concerns:**
- ⚠️ **High Risk**: Pointer events are more sensitive to network latency
- ⚠️ **Throttling Issues**: 16ms throttling may be too aggressive for RDP (could drop events)
- ⚠️ **Hit Test Delays**: Network latency + hit test API calls could cause noticeable lag
- ⚠️ **Event Loss**: Rapid pointer movements over RDP might miss events entirely

### 4. Standard Click Handlers (Throughout Application)

**Locations:** Multiple files (Application.js, LayerPanel.js, etc.)

**How it works:**
- Standard `addEventListener('click', handler)` patterns
- No capture phase, normal event bubbling

**RDP Concerns:**
- ✅ **Low Risk**: Standard DOM events work reliably over RDP
- ⚠️ **Minor**: Potential for slight delays, but generally functional

## Identified RDP-Specific Issues

### 1. **Event Timing and Latency**

**Problem:**
- RDP introduces network latency (typically 50-200ms+ depending on connection)
- Mouse events may arrive out of order or with delays
- Rapid clicks might be batched or dropped

**Affected Areas:**
- PostHog autocapture (could miss rapid clicks)
- PopupManager capture phase listeners (timing-sensitive)
- Measurement tool activation (rapid button clicks)

**Evidence in Code:**
```730:732:src/core/Application.js
                    // Bug 17 fix: Use unique activation ID to prevent race conditions with rapid clicks
                    const activationId = Date.now() + Math.random();
                    this._distanceToolActivationId = activationId;
```

The code already handles rapid clicks, but RDP latency could exacerbate race conditions.

### 2. **Pointer Event Reliability**

**Problem:**
- `pointer-move` events are continuous and high-frequency
- RDP may not transmit all pointer events efficiently
- Throttling at 16ms may be too aggressive for RDP scenarios

**Affected Areas:**
- HoverHighlightService (fiber cable highlighting)
- Map interaction responsiveness

**Recommendation:**
Consider adaptive throttling based on connection quality or user agent detection.

### 3. **Dynamic DOM Attachment**

**Problem:**
- PopupManager attaches listeners dynamically with `setTimeout` delays
- RDP latency could cause DOM updates to arrive after listeners are attached
- Race conditions between popup rendering and listener attachment

**Evidence in Code:**
```86:89:src/services/PopupManager.js
                    // Small delay to ensure popup DOM is fully rendered
                    setTimeout(() => {
                        if (!this.view) return;
                        this.attachPopupActionListeners();
                    }, 100);
```

100ms delay might not be sufficient if RDP adds additional latency.

### 4. **Event Propagation Order**

**Problem:**
- Capture phase listeners depend on event propagation order
- RDP latency could affect the order events are processed
- `preventDefault()` and `stopPropagation()` might execute at wrong times

**Evidence in Code:**
```291:293:src/services/PopupManager.js
                const clickHandler = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
```

## Recommendations

### 1. **Add RDP Detection and Adaptive Behavior**

```javascript
// Detect RDP session
function isRDPSession() {
  // Check for RDP indicators
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('rdp') || 
         userAgent.includes('remote') ||
         window.screen.width !== window.screen.availWidth ||
         // Check for RDP-specific environment variables (if available)
         navigator.plugins.length === 0; // RDP often has no plugins
}

// Adaptive throttling for pointer events
const throttleDelay = isRDPSession() ? 50 : 16; // Slower for RDP
```

### 2. **Increase Popup Listener Attachment Delay**

```javascript
// In PopupManager.js
const attachmentDelay = isRDPSession() ? 300 : 100; // Longer delay for RDP
setTimeout(() => {
    if (!this.view) return;
    this.attachPopupActionListeners();
}, attachmentDelay);
```

### 3. **Add Event Debouncing for Rapid Clicks**

```javascript
// Debounce rapid clicks to handle RDP latency
function debounceClick(handler, delay = 300) {
  let timeoutId;
  return function(event) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => handler(event), delay);
  };
}
```

### 4. **Implement Fallback Click Detection**

```javascript
// Use both click and mousedown events for redundancy
element.addEventListener('click', handler);
element.addEventListener('mousedown', handler); // Fallback for RDP
```

### 5. **Add Connection Quality Monitoring**

```javascript
// Monitor for connection quality issues
let lastEventTime = Date.now();
document.addEventListener('click', () => {
  const now = Date.now();
  const delay = now - lastEventTime;
  if (delay > 500) {
    console.warn('High click latency detected:', delay, 'ms');
    // Could trigger adaptive behavior
  }
  lastEventTime = now;
});
```

### 6. **PostHog Configuration Adjustments**

Consider adjusting PostHog settings for RDP:

```javascript
posthog.init(posthogKey, {
  // ... existing config
  autocapture: true,
  // Add batching for RDP scenarios
  batch_size: isRDPSession() ? 50 : 10, // Batch more events for RDP
  batch_flush_interval_ms: isRDPSession() ? 5000 : 1000, // Longer flush interval
});
```

### 7. **Add Retry Logic for Critical Clicks**

```javascript
// Retry mechanism for critical actions
async function captureClickWithRetry(elementName, context, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await trackClick(elementName, context);
      return; // Success
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
}
```

## Testing Recommendations

1. **Test in Real RDP Environment**
   - Test with Windows RDP client
   - Test with different network conditions (high latency, packet loss)
   - Test with various RDP client versions

2. **Simulate RDP Conditions**
   - Add artificial latency to events
   - Test with throttled network connections
   - Test rapid click scenarios

3. **Monitor Event Loss**
   - Add logging to track missed events
   - Compare local vs RDP event counts
   - Monitor PostHog event capture rates

4. **Performance Metrics**
   - Measure click-to-action latency
   - Track pointer event frequency
   - Monitor hit test response times

## Priority Issues

### High Priority
1. **HoverHighlightService pointer events** - Most likely to fail over RDP
2. **PopupManager capture phase listeners** - Timing-sensitive, could miss clicks

### Medium Priority
3. **PostHog autocapture** - May miss rapid clicks, but generally functional
4. **Measurement tool activation** - Already has race condition handling, but RDP could exacerbate

### Low Priority
5. **Standard click handlers** - Should work fine, minor latency acceptable

## Conclusion

The application's mouse click capture should **generally work** over RDP, but there are **specific areas of concern**:

1. **Pointer events** (hover highlighting) are most at risk
2. **Capture phase listeners** may have timing issues
3. **Rapid clicks** might be missed during high latency periods

**Recommended Actions:**
- Implement RDP detection
- Add adaptive throttling for pointer events
- Increase popup listener attachment delays
- Add event debouncing for rapid clicks
- Test thoroughly in RDP environments

The good news is that most click handlers use standard DOM events which are generally reliable over RDP, but the pointer-based interactions and timing-sensitive code should be hardened for RDP scenarios.

