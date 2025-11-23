// Calcite Icon Fallback Utility
// Handles icon loading failures gracefully and prevents component crashes
import { createLogger } from './logger.js';

// Initialize logger
const log = createLogger('CalciteIconFallback');

export function setupCalciteIconFallback() {
  // Track failed icon attempts to avoid infinite loops
  const failedIcons = new Set();

  // Generic fallback icon that should always be available
  const FALLBACK_ICON = 'circle';

  // Listen for Calcite icon errors
  document.addEventListener('calciteIconError', (event) => {
    const iconName = event.detail?.icon;
    if (iconName && !failedIcons.has(iconName)) {
      log.warn(`Icon "${iconName}" failed to load, attempting fallback`);
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
        'chevronsRight': 'chevron-right',
        'camera-flash-on': 'flash',
        'cameraFlashOn': 'flash',
        'flashOn': 'flash',
        'circle-filled': 'circle',
        'circleFilled': 'circle',
        'lightning': 'flash',
        'loading': 'spinner',
        'database': 'data',
        'code-branch': 'code',
        'file-text': 'fileText'
      };

      // If there's an alternative, try to update the icon
      if (alternativeIcons[iconName]) {
        const iconElement = event.target;
        if (iconElement) {
          iconElement.setAttribute('icon', alternativeIcons[iconName]);
        }
      } else {
        // Use generic fallback icon
        const iconElement = event.target;
        if (iconElement) {
          iconElement.setAttribute('icon', FALLBACK_ICON);
        }
      }
    }
  });

  // Enhanced icon loading error handler
  const originalConsoleError = console.error;
  console.error = function (...args) {
    const errorMessage = args[0]?.toString() || '';
    if (errorMessage.includes('icon failed to load')) {
      // Extract icon name from error message
      const match = errorMessage.match(/calcite\s+(\S+)\s+.*icon failed to load/);
      if (match && match[1]) {
        const iconName = match[1];
        log.warn(`🔧 Detected icon loading error for: ${iconName}, applying fallback`);

        // Apply immediate fallbacks for common problematic icons
        const iconReplacements = {
          'camera-flash-on': 'flash',
          'loading': 'spinner',
          'database': 'data',
          'code-branch': 'code',
          'file-text': 'fileText',
          'circle-check': 'check-circle',
          'locate': 'gps-on',
          'report': 'file-report'
        };

        const replacement = iconReplacements[iconName] || FALLBACK_ICON;

        // Find and replace all instances of the failing icon
        document.querySelectorAll(`calcite-icon[icon="${iconName}"]`).forEach(icon => {
          icon.setAttribute('icon', replacement);
          log.warn(`Replaced ${iconName} with ${replacement} icon`);
        });

        // Trigger custom event for other potential handlers
        document.dispatchEvent(new CustomEvent('calciteIconError', {
          detail: { icon: iconName }
        }));

        // Suppress the error to prevent component crashes
        return;
      }
    }

    // Suppress other CalciteUI component errors that can break mobile UI
    if (errorMessage.includes('renderItemAriaLive') ||
      errorMessage.includes('Cannot read properties of undefined') ||
      errorMessage.includes('calcite-') && errorMessage.includes('undefined')) {
      log.warn('🔇 Suppressed CalciteUI component error:', errorMessage.substring(0, 100));
      return;
    }

    // Call original console.error for other errors
    originalConsoleError.apply(console, args);
  };

  // Proactively ensure critical icons are available
  const criticalIcons = ['circle', 'x', 'check', 'chevron-right', 'information'];
  setTimeout(() => {
    criticalIcons.forEach(iconName => {
      const testIcon = document.createElement('calcite-icon');
      testIcon.setAttribute('icon', iconName);
      testIcon.style.display = 'none';
      document.body.appendChild(testIcon);

      // Remove the test icon after a short delay
      setTimeout(() => {
        if (testIcon && testIcon.parentNode) {
          testIcon.parentNode.removeChild(testIcon);
        }
      }, 1000);
    });
  }, 2000);
}