// Calcite Icon Fallback Utility
// Handles icon loading failures gracefully

export function setupCalciteIconFallback() {
  // Track failed icon attempts to avoid infinite loops
  const failedIcons = new Set();
  
  // Listen for Calcite icon errors
  document.addEventListener('calciteIconError', (event) => {
    const iconName = event.detail?.icon;
    if (iconName && !failedIcons.has(iconName)) {
      console.warn(`Icon "${iconName}" failed to load, attempting fallback`);
      failedIcons.add(iconName);
      
      // Try alternative icon names
      const alternativeIcons = {
        'utility-network': 'link-chart',
        'utilityNetwork': 'link-chart',
        'linkChart': 'link',
        'exclamationMarkTriangle': 'warning',
        'arrowRight': 'chevron-right',
        'magnifyingGlassPlus': 'zoom-in-fixed',
        'compassNorthCircle': 'compass',
        'chevronsRight': 'chevron-right'
      };
      
      // If there's an alternative, try to update the icon
      if (alternativeIcons[iconName]) {
        const iconElement = event.target;
        if (iconElement) {
          iconElement.setAttribute('icon', alternativeIcons[iconName]);
        }
      }
    }
  });
  
  // Also handle generic icon loading errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const errorMessage = args[0]?.toString() || '';
    if (errorMessage.includes('icon failed to load')) {
      // Extract icon name from error message
      const match = errorMessage.match(/calcite\s+(\S+)\s+.*icon failed to load/);
      if (match && match[1]) {
        const iconName = match[1];
        console.warn(`Detected icon loading error for: ${iconName}`);
        // Trigger custom event for handling
        document.dispatchEvent(new CustomEvent('calciteIconError', {
          detail: { icon: iconName }
        }));
      }
    }
    // Call original console.error
    originalConsoleError.apply(console, args);
  };
}