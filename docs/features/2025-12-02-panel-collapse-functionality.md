# Panel Collapse Functionality Implementation Guide

**Date:** December 2, 2025  
**Feature:** Collapsible Shell Panel with State Persistence  
**Framework:** Calcite Design System + Vite

## Overview

This document describes the implementation of a collapsible side panel for Calcite Shell applications. The feature allows users to collapse the main content panel while keeping the action bar accessible, with state persistence via localStorage.

## Architecture

The collapse functionality consists of three parts:

1. **HTML** - The collapse toggle button in the panel header
2. **JavaScript** - State management and toggle logic
3. **CSS** - Smooth transitions and visual feedback

---

## Part 1: HTML Structure

### Shell Panel with Action Bar

```html
<!-- Side Panel - Desktop Only -->
<calcite-shell-panel slot="panel-start" id="shell-panel-start" position="start" display-mode="dock"
  width-scale="m" class="desktop-only">
  
  <!-- Action Bar (navigation icons) -->
  <calcite-action-bar slot="action-bar">
    <calcite-action-group>
      <calcite-action id="layers-action" text="Subscribers" icon="users" active></calcite-action>
      <calcite-action id="osp-action" text="OSP" icon="utility-network"></calcite-action>
      <calcite-action id="vehicles-action" text="Vehicles" icon="car"></calcite-action>
    </calcite-action-group>
    <calcite-action-group>
      <calcite-action id="tools-action" text="Tools" icon="wrench"></calcite-action>
    </calcite-action-group>
    <calcite-action id="info-action" text="Info" icon="information" slot="bottom-actions"></calcite-action>
  </calcite-action-bar>

  <!-- Main Panel Content -->
  <calcite-panel heading="Panel Title" id="panel-content">
    
    <!-- COLLAPSE BUTTON - This is the key element -->
    <calcite-action 
      slot="header-actions-end" 
      id="panel-collapse-toggle" 
      icon="chevrons-left"
      text="Collapse panel" 
      title="Collapse panel">
    </calcite-action>

    <!-- Your panel content here -->
    <div id="panel-body-content">
      <!-- Content sections -->
    </div>

  </calcite-panel>
</calcite-shell-panel>
```

### Key HTML Elements

| Element | ID | Purpose |
|---------|-----|---------|
| `calcite-shell-panel` | `shell-panel-start` | The collapsible container |
| `calcite-action` | `panel-collapse-toggle` | The toggle button (uses `slot="header-actions-end"`) |
| `calcite-panel` | `panel-content` | The main content panel |
| `calcite-action-bar` | - | Navigation icons (remains visible when collapsed) |

---

## Part 2: JavaScript Implementation

### Class Structure

Add these properties to your panel manager class:

```javascript
export class LayerPanel {
    constructor() {
        // DOM References
        this.shellPanel = document.getElementById('shell-panel-start');
        this.panel = document.getElementById('panel-content');
        this.panelCollapseToggle = document.getElementById('panel-collapse-toggle');

        // State
        this.isPanelCollapsed = false;

        this.init();
    }

    async init() {
        // Wait for Calcite components to be defined
        await customElements.whenDefined('calcite-shell-panel');
        
        // Set up the collapse functionality
        this.setupPanelCollapse();
        
        // Other initialization...
    }
}
```

### Setup Method

```javascript
setupPanelCollapse() {
    if (!this.panelCollapseToggle || !this.shellPanel) {
        console.warn('Panel collapse toggle or shell panel not found');
        return;
    }

    // Get the action bar
    const actionBar = this.shellPanel.querySelector('calcite-action-bar');

    // Restore collapsed state from localStorage (default to expanded)
    const savedState = localStorage.getItem('panel-collapsed');
    this.isPanelCollapsed = savedState === 'true';
    
    // Force action bar to always be expanded (CSS hides its built-in collapse button)
    if (actionBar) {
        actionBar.expanded = true;
    }
    
    // Apply the saved panel state
    this.shellPanel.collapsed = this.isPanelCollapsed;
    
    // Set initial button state based on saved state
    if (this.isPanelCollapsed) {
        this.panelCollapseToggle.icon = 'chevrons-right';
        this.panelCollapseToggle.text = 'Expand panel';
        this.panelCollapseToggle.title = 'Expand panel';
    } else {
        this.panelCollapseToggle.icon = 'chevrons-left';
        this.panelCollapseToggle.text = 'Collapse panel';
        this.panelCollapseToggle.title = 'Collapse panel';
    }

    // Set up click handler for collapse toggle
    this.panelCollapseToggle.addEventListener('click', () => {
        this.togglePanelCollapse();
    });

    console.log('Panel collapse functionality initialized with localStorage support');
}
```

### Toggle Method

```javascript
togglePanelCollapse() {
    this.isPanelCollapsed = !this.isPanelCollapsed;
    
    // Toggle the collapsed attribute on the shell panel
    this.shellPanel.collapsed = this.isPanelCollapsed;

    // Update the button icon and text
    if (this.isPanelCollapsed) {
        this.panelCollapseToggle.icon = 'chevrons-right';
        this.panelCollapseToggle.text = 'Expand panel';
        this.panelCollapseToggle.title = 'Expand panel';
    } else {
        this.panelCollapseToggle.icon = 'chevrons-left';
        this.panelCollapseToggle.text = 'Collapse panel';
        this.panelCollapseToggle.title = 'Collapse panel';
    }

    // Save state to localStorage
    localStorage.setItem('panel-collapsed', this.isPanelCollapsed.toString());

    // Optional: Track usage for analytics
    // trackFeatureUsage('panel-collapse', { collapsed: this.isPanelCollapsed });
    
    console.log(`Panel ${this.isPanelCollapsed ? 'collapsed' : 'expanded'}`);
}
```

---

## Part 3: CSS Styling

Add these styles to your CSS file:

```css
/* ============================================
   Panel Collapse Functionality
   ============================================ */

/* Smooth transition for panel collapse/expand */
calcite-shell-panel {
  transition: width var(--calcite-animation-timing) ease-in-out;
}

/* Style the panel collapse toggle button */
#panel-collapse-toggle {
  opacity: 0.8;
  transition: opacity var(--calcite-animation-timing) ease-in-out;
}

#panel-collapse-toggle:hover {
  opacity: 1;
}

/* When panel is collapsed, ensure the action bar is still accessible */
calcite-shell-panel[collapsed] calcite-action-bar {
  display: flex;
}

/* Highlight action bar icons when panel is collapsed to show they're clickable */
calcite-shell-panel[collapsed] calcite-action-bar calcite-action {
  opacity: 1;
  transition: opacity var(--calcite-animation-timing) ease-in-out,
              transform var(--calcite-animation-timing) ease-in-out;
}

calcite-shell-panel[collapsed] calcite-action-bar calcite-action:hover {
  transform: scale(1.1);
  background-color: var(--calcite-color-foreground-2);
}

/* Smooth icon transition for collapse button */
#panel-collapse-toggle calcite-icon {
  transition: transform var(--calcite-animation-timing) ease-in-out;
}

/* Add subtle animation when panel state changes */
calcite-shell-panel[collapsed] {
  box-shadow: var(--calcite-shadow-1);
}

/* IMPORTANT: Hide the action-bar's built-in expand/collapse button */
calcite-action-bar::part(expand-toggle) {
  display: none !important;
}
```

---

## Behavior Summary

### When Expanded (default)
- Full panel content is visible
- Collapse button shows `chevrons-left` icon
- Button text: "Collapse panel"

### When Collapsed
- Only the action bar is visible
- Collapse button shows `chevrons-right` icon  
- Button text: "Expand panel"
- Action bar icons get hover effects
- Shell panel gets subtle shadow

### State Persistence
- State is saved to `localStorage` with key `panel-collapsed`
- On page load, the saved state is restored
- Default state is expanded (`false`)

---

## Implementation Checklist

- [ ] Add `id="shell-panel-start"` to your `calcite-shell-panel`
- [ ] Add `id="panel-content"` to your `calcite-panel`
- [ ] Add the collapse toggle button with `id="panel-collapse-toggle"` and `slot="header-actions-end"`
- [ ] Add the CSS for transitions and collapsed state styling
- [ ] Add `isPanelCollapsed = false` to your class state
- [ ] Add `setupPanelCollapse()` method
- [ ] Add `togglePanelCollapse()` method
- [ ] Call `setupPanelCollapse()` in your `init()` after `await customElements.whenDefined('calcite-shell-panel')`

---

## Optional: Expand on Action Click

If you want clicking an action bar item to automatically expand the panel when collapsed:

```javascript
setupActionBarNavigation() {
    this.actions?.forEach(action => {
        action.addEventListener('click', (event) => {
            // Auto-expand panel when clicking an action while collapsed
            if (this.isPanelCollapsed) {
                this.togglePanelCollapse();
            }
            
            // Handle navigation logic...
        });
    });
}
```

---

## LocalStorage Debugging

You can use this simple HTML page to check/clear the localStorage value:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Check localStorage</title>
</head>
<body>
  <h2>LocalStorage Check</h2>
  <div id="output"></div>
  <script>
    const output = document.getElementById('output');
    const collapsed = localStorage.getItem('panel-collapsed');
    output.innerHTML = `
      <p>panel-collapsed value: <strong>${collapsed}</strong></p>
      <button onclick="localStorage.removeItem('panel-collapsed'); alert('Cleared!'); location.reload();">Clear Value</button>
    `;
  </script>
</body>
</html>
```

---

## Dependencies

- **Calcite Design System** (version 2.x or 3.x)
- Required Calcite components:
  - `calcite-shell`
  - `calcite-shell-panel`
  - `calcite-panel`
  - `calcite-action`
  - `calcite-action-bar`

---

## Related Documentation

- [Calcite Shell Panel](https://developers.arcgis.com/calcite-design-system/components/shell-panel/)
- [Calcite Action](https://developers.arcgis.com/calcite-design-system/components/action/)
- [Calcite Panel](https://developers.arcgis.com/calcite-design-system/components/panel/)




