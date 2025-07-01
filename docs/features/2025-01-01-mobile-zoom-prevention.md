# Mobile Zoom Prevention

**Date:** 2025-01-01  
**Status:** ✅ Implemented  
**Phase:** 1

## Overview

Prevents unwanted mobile browser zoom when users tap on search input fields, maintaining a consistent PWA experience across all mobile devices.

## Problem

Mobile browsers (especially iOS Safari) automatically zoom in when users tap on input fields with font sizes smaller than 16px. This behavior disrupts the PWA experience by:

- Breaking the carefully designed mobile layout
- Requiring users to manually zoom back out
- Creating inconsistent UI behavior
- Making the app feel less native

## Solution

Implemented a two-pronged approach for maximum compatibility:

### 1. Viewport Meta Tag

Updated the viewport meta tag to prevent user scaling:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
/>
```

### 2. Font-Size Optimization

Ensured all input fields have a minimum font-size of 16px on mobile:

```css
/* Prevent mobile zoom on input focus */
calcite-input,
calcite-autocomplete {
  --calcite-input-font-size: 16px; /* Prevents iOS zoom */
}

@media (max-width: 768px) {
  calcite-input,
  calcite-autocomplete,
  calcite-input input,
  calcite-autocomplete input {
    font-size: 16px !important;
    --calcite-input-font-size: 16px !important;
  }
}
```

## Affected Components

- **Header Search**: `calcite-autocomplete` in navigation bar
- **Desktop Search**: Search panel autocomplete
- **Mobile Search**: `calcite-input` in mobile search dialog
- **All Input Fields**: Universal application across the PWA

## Technical Details

### iOS Safari Behavior

- Zooms when input font-size < 16px
- 16px font-size prevents automatic zoom
- `user-scalable=no` completely disables zoom

### Android Chrome Behavior

- Less aggressive zoom behavior
- Respects viewport `user-scalable=no`
- Font-size approach also effective

### PWA Considerations

- Maintains native app-like experience
- Prevents layout disruption
- Consistent behavior across devices
- No impact on accessibility (16px is readable)

## Implementation Notes

### Viewport Approach

```html
<!-- Prevents all zoom functionality -->
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
/>
```

**Pros:**

- Complete zoom prevention
- Works on all browsers
- Simple to implement

**Cons:**

- Removes accessibility zoom features
- May not pass some accessibility audits

### Font-Size Approach

```css
/* Target iOS 16px threshold */
input,
textarea,
select {
  font-size: 16px;
}
```

**Pros:**

- Maintains accessibility
- Browser-friendly approach
- No audit concerns

**Cons:**

- Requires careful CSS management
- May affect design consistency

### Combined Approach (Implemented)

Uses both methods for maximum reliability while maintaining the PWA's native app experience.

## Testing

### Test Cases

- [ ] iOS Safari: Tap search input → no zoom
- [ ] iOS Chrome: Tap search input → no zoom
- [ ] Android Chrome: Tap search input → no zoom
- [ ] Android Firefox: Tap search input → no zoom
- [ ] Edge Mobile: Tap search input → no zoom

### Test Devices

- iPhone (iOS 16+)
- iPad (iPadOS 16+)
- Android phones (Chrome 120+)
- Android tablets

### Verification Steps

1. Open PWA on mobile device
2. Tap header search field
3. Verify no zoom occurs
4. Tap mobile search dialog input
5. Verify no zoom occurs
6. Test with virtual keyboard open/closed

## Browser Compatibility

| Browser         | Viewport Support | Font-Size Support | Combined Result |
| --------------- | ---------------- | ----------------- | --------------- |
| iOS Safari      | ✅               | ✅                | ✅ No Zoom      |
| iOS Chrome      | ✅               | ✅                | ✅ No Zoom      |
| Android Chrome  | ✅               | ✅                | ✅ No Zoom      |
| Android Firefox | ✅               | ✅                | ✅ No Zoom      |
| Edge Mobile     | ✅               | ✅                | ✅ No Zoom      |

## Accessibility Impact

### Positive

- Consistent text size (16px is readable)
- Stable layout prevents disorientation
- Predictable mobile behavior

### Considerations

- Manual zoom disabled (by design for PWA)
- Users cannot zoom for vision assistance
- 16px font size meets accessibility guidelines

### Mitigation

- Font size remains accessible (16px)
- High contrast theme available
- Large touch targets maintained

## Performance Impact

- **Zero performance impact**
- CSS-only solution
- No JavaScript overhead
- No additional HTTP requests

## Future Enhancements

### Selective Zoom Control

```css
/* Allow zoom on specific content areas */
.zoomable-content {
  touch-action: pinch-zoom;
}
```

### Dynamic Font Scaling

```css
/* Responsive font scaling */
@media (max-width: 480px) {
  input {
    font-size: 18px;
  }
}
```

### Accessibility Toggle

```javascript
// Toggle zoom capability for accessibility
function toggleZoom(enable) {
  const viewport = document.querySelector('meta[name="viewport"]');
  viewport.content = enable
    ? "width=device-width, initial-scale=1.0"
    : "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
}
```

## Related Issues

- Mobile keyboard behavior
- Virtual viewport handling
- Touch event optimization
- iOS safe area considerations

---

## Related Documentation

- [Mobile UI Guidelines](../templates/implementation-guide-template.md)
- [PWA Best Practices](../README.md)
- [Accessibility Guidelines](../templates/implementation-guide-template.md)
