# Popup Improvements for Splice Closure and Splitter Layers

## Summary

Updated the popup templates for Splice Closure and Splitter layers to use the correct field names from the actual GeoJSON data sources and improve the user experience.

## Changes Made

### 1. **Splitter Layer Popup (`createSplitterPopup`)**

**Before:**

```javascript
title: "Splitter: {STRUCTURE_}";
fieldInfos: [
  { fieldName: "STRUCTURE_", label: "Structure ID" },
  { fieldName: "EQUIP_FRAB", label: "Equipment FRAB" },
  { fieldName: "OUTPUTPORT", label: "Output Port Count" },
];
```

**After:**

```javascript
title: "Splitter: {STRUCTURE_}";
fieldInfos: [
  { fieldName: "STRUCTURE_", label: "Structure ID" },
  { fieldName: "CLLI", label: "CLLI Code" }, // NEW - Added CLLI field
  { fieldName: "EQUIP_FRAB", label: "Equipment FRAB" },
  { fieldName: "OUTPUTPORT", label: "Output Port Count" },
];
```

### 2. **Closure Layer Popup (`createClosurePopup`)**

**Before:**

```javascript
title: "Closure: {Name}"; // PROBLEM: 'Name' field doesn't exist in data
fieldInfos: [
  { fieldName: "Name", label: "Closure Name" }, // PROBLEM: Wrong field name
  { fieldName: "Type", label: "Closure Type" }, // PROBLEM: Wrong field name
  { fieldName: "Status", label: "Status" }, // PROBLEM: Wrong field name
  { fieldName: "Location", label: "Location" }, // PROBLEM: Wrong field name
];
```

**After:**

```javascript
title: "Closure: {STRUCTURE_}"; // FIXED: Use actual field from data
fieldInfos: [
  { fieldName: "STRUCTURE_", label: "Structure ID" }, // FIXED: Use actual field
  { fieldName: "CLLI", label: "CLLI Code" }, // FIXED: Use actual field
];
```

### 3. **Field Definitions Updated**

**Splitter Fields:**

- Added `CLLI` field definition
- Maintained existing `STRUCTURE_`, `EQUIP_FRAB`, `OUTPUTPORT` fields

**Closure Fields:**

- Replaced incorrect field names with actual data fields
- Now uses `STRUCTURE_` and `CLLI` fields

## Data Source Structure

Based on the closure overlay GeoJSON data:

```json
{
  "type": "Feature",
  "properties": {
    "CLLI": "FAYC2W88",
    "STRUCTURE_": "FAY-C2W-88-SK"
  },
  "geometry": { ... }
}
```

## Benefits

1. **Fixed Broken Popups**: Closure popups now show actual data instead of undefined values
2. **Improved Information**: Added CLLI codes to both layers for better identification
3. **Consistent Naming**: Both layers now use consistent field names and labels
4. **Better User Experience**: Popups now display meaningful information for field technicians

## Testing

To test the changes:

1. Enable the Splitters layer in the layer panel
2. Click on a splitter point on the map
3. Verify the popup shows:

   - Structure ID (from STRUCTURE\_ field)
   - CLLI Code (from CLLI field)
   - Equipment FRAB
   - Output Port Count

4. Enable the Closures layer in the layer panel
5. Click on a closure point on the map
6. Verify the popup shows:
   - Structure ID (from STRUCTURE\_ field)
   - CLLI Code (from CLLI field)

## Files Modified

- `src/config/layerConfigs.js`: Updated popup templates and field definitions

## Data URLs

- **Closures**: `https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/closure-overlay.geojson`
- **Splitters**: `https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/splitter-overlay.geojson`
