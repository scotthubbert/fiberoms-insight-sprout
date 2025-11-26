# Calcite Components Usage Analysis

**Date**: 2025-01-22  
**Purpose**: Identify which Calcite Components are actually used vs imported to optimize bundle size

## Summary

**Total Components Imported**: 29  
**Components Actually Used**: 27  
**Potentially Unused**: 2

## Component Usage Breakdown

### ✅ Core Components (Always Loaded) - 18 components

| Component | Imported | Used in HTML | Used in JS | Status |
|-----------|----------|--------------|------------|--------|
| `calcite-shell` | ✅ | ✅ | ✅ | **USED** |
| `calcite-navigation` | ✅ | ✅ | ✅ | **USED** |
| `calcite-navigation-logo` | ✅ | ❌ | ❌ | **⚠️ UNUSED** |
| `calcite-button` | ✅ | ✅ | ✅ | **USED** |
| `calcite-icon` | ✅ | ✅ | ✅ | **USED** |
| `calcite-loader` | ✅ | ✅ | ✅ | **USED** |
| `calcite-chip` | ✅ | ✅ | ✅ | **USED** |
| `calcite-block` | ✅ | ✅ | ✅ | **USED** |
| `calcite-input` | ✅ | ✅ | ✅ | **USED** |
| `calcite-switch` | ✅ | ✅ | ✅ | **USED** |
| `calcite-notice` | ✅ | ✅ | ✅ | **USED** |
| `calcite-alert` | ✅ | ❌ | ❌ | **⚠️ UNUSED** |
| `calcite-list` | ✅ | ✅ | ✅ | **USED** |
| `calcite-list-item` | ✅ | ✅ | ✅ | **USED** |
| `calcite-autocomplete` | ✅ | ✅ | ✅ | **USED** |
| `calcite-autocomplete-item` | ✅ | ✅ | ✅ | **USED** |
| `calcite-segmented-control` | ✅ | ✅ | ✅ | **USED** |
| `calcite-segmented-control-item` | ✅ | ✅ | ✅ | **USED** |

### ✅ Desktop Components (Lazy Loaded) - 9 components

| Component | Imported | Used in HTML | Used in JS | Status |
|-----------|----------|--------------|------------|--------|
| `calcite-shell-panel` | ✅ | ✅ | ✅ | **USED** |
| `calcite-panel` | ✅ | ✅ | ✅ | **USED** |
| `calcite-action` | ✅ | ✅ | ✅ | **USED** |
| `calcite-action-bar` | ✅ | ✅ | ✅ | **USED** |
| `calcite-action-group` | ✅ | ✅ | ✅ | **USED** |
| `calcite-checkbox` | ✅ | ✅ | ✅ | **USED** |
| `calcite-label` | ✅ | ❌ | ✅ (closest) | **USED** (JS only) |
| `calcite-card` | ✅ | ✅ | ✅ | **USED** |
| `calcite-select` | ✅ | ✅ | ✅ | **USED** |
| `calcite-option` | ✅ | ✅ | ✅ | **USED** |

### ✅ Lazy Loaded Components - 1 component

| Component | Imported | Used in HTML | Used in JS | Status |
|-----------|----------|--------------|------------|--------|
| `calcite-dialog` | ✅ (lazy) | ✅ | ✅ | **USED** |

## ⚠️ Potentially Unused Components

### 1. `calcite-navigation-logo`
- **Imported**: Yes (line 77 in main.js)
- **Used in HTML**: No
- **Used in JS**: No
- **CSS References**: Yes (styled in style.css)
- **Recommendation**: **REMOVE** - Not used anywhere, CSS can be removed too

### 2. `calcite-alert`
- **Imported**: Yes (line 86 in main.js)
- **Used in HTML**: No
- **Used in JS**: No
- **Note**: `calcite-notice` is used instead for alerts/notifications
- **Recommendation**: **REMOVE** - `calcite-notice` serves the same purpose

## Optimization Recommendations

### Immediate Actions

1. **Remove unused imports**:
   ```javascript
   // Remove these lines from src/main.js:
   import('@esri/calcite-components/dist/components/calcite-navigation-logo'),  // Line 77
   import('@esri/calcite-components/dist/components/calcite-alert'),            // Line 86
   ```

2. **Remove unused CSS** (if any):
   - Check `src/style.css` for `calcite-navigation-logo` styles (lines 118-119, 742-743)
   - These can be removed if component is not used

### Expected Bundle Size Reduction

- `calcite-navigation-logo`: ~2-5KB
- `calcite-alert`: ~3-7KB
- **Total potential savings**: ~5-12KB (minimal, but every byte counts)

### Additional Notes

- `calcite-label` is used via `closest('calcite-label')` in JS, so keep it
- All other components are actively used
- Current lazy loading strategy for `calcite-dialog` is good
- Desktop components are properly lazy-loaded

## Current Import Strategy Assessment

✅ **Good practices already in place**:
- Individual component imports (enables tree-shaking)
- Lazy loading for `calcite-dialog`
- Desktop components loaded on-demand
- Vite chunks all Calcite into `vendor_calcite` bundle

## Next Steps

1. Remove unused component imports
2. Remove unused CSS
3. Rebuild and verify bundle size reduction
4. Test application to ensure no broken functionality

