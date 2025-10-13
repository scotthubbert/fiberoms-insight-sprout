# CalciteUI Shell-Panel Architecture Fix

## Problem Summary

The current implementation violates CalciteUI's architecture by trying to place multiple `calcite-panel` components inside a single `calcite-shell-panel` and toggling their visibility. This is causing the panel to show section names instead of content.

## Root Cause

CalciteUI's `calcite-shell-panel` is designed to contain **ONE** `calcite-panel` component, not multiple. The framework expects dynamic content to be managed within that single panel, not by switching between multiple panel elements.

## Correct Architecture Pattern

### Option 1: Single Panel with Dynamic Content (Recommended)

```html
<calcite-shell-panel slot="panel-start" id="layers-panel">
  <calcite-action-bar slot="action-bar">
    <calcite-action id="layers-action" text="Layers" icon="layer" active></calcite-action>
    <calcite-action id="osp-action" text="OSP" icon="utility-network"></calcite-action>
    <!-- other actions -->
  </calcite-action-bar>
  
  <!-- SINGLE panel with dynamic heading and content -->
  <calcite-panel heading="Layers" id="main-panel">
    <div id="dynamic-content">
      <!-- Content is dynamically inserted here based on active action -->
    </div>
  </calcite-panel>
</calcite-shell-panel>
```

JavaScript would then:
1. Keep all content templates in memory or as template strings
2. Update the panel heading when action is clicked
3. Replace the content inside `#dynamic-content`

### Option 2: Flow Items Pattern

```html
<calcite-shell-panel slot="panel-start" id="layers-panel">
  <calcite-action-bar slot="action-bar">
    <!-- actions -->
  </calcite-action-bar>
  
  <calcite-panel>
    <calcite-flow id="panel-flow">
      <calcite-flow-item heading="Layers" id="layers-flow-item">
        <!-- Layers content -->
      </calcite-flow-item>
      <!-- Only one flow-item visible at a time -->
    </calcite-flow>
  </calcite-panel>
</calcite-shell-panel>
```

### Option 3: Multiple Shell-Panels (Complex)

Create separate shell-panels for each major section and toggle the shell-panels themselves, not the panels within them. This is more complex and typically used for start/end panel combinations.

## Why Current Approach Fails

1. **Framework Fighting**: Using `hidden` and `display: none` on multiple panels fights against CalciteUI's internal state management
2. **Component Lifecycle**: Multiple panels in one shell-panel disrupts the component's lifecycle and rendering
3. **Accessibility**: Screen readers and keyboard navigation expect a single panel structure

## Implementation Steps

1. **Refactor HTML**: Change to single `calcite-panel` structure
2. **Update JavaScript**: 
   - Store content templates/elements
   - Update panel heading dynamically
   - Swap content within the single panel
3. **Remove Anti-Patterns**:
   - Remove multiple `calcite-panel` elements
   - Remove `hidden` attribute toggling
   - Remove direct `style.display` manipulation

## Benefits of Correct Pattern

1. **Framework Alignment**: Works with CalciteUI, not against it
2. **Performance**: Single panel updates are more efficient than hiding/showing multiple panels
3. **Maintainability**: Follows documented patterns, easier to debug
4. **Future-Proof**: Won't break with CalciteUI updates

## Code Example

```javascript
class LayerPanel {
  constructor() {
    this.panel = document.getElementById('main-panel');
    this.content = document.getElementById('dynamic-content');
    this.contentTemplates = {
      layers: this.createLayersContent(),
      osp: this.createOSPContent(),
      vehicles: this.createVehiclesContent()
      // etc.
    };
  }
  
  showPanel(panelName) {
    // Update heading
    this.panel.heading = this.getPanelHeading(panelName);
    
    // Clear and replace content
    this.content.innerHTML = '';
    this.content.appendChild(this.contentTemplates[panelName]);
    
    // Update active action
    this.updateActiveAction(panelName);
  }
}
```

This follows CalciteUI's architecture and will resolve the display issues.