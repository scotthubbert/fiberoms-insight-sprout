// AnalyticsService.js - PostHog analytics integration
// Handles user behavior tracking, click analytics, and feature usage

let posthog = null;
let isInitialized = false;

/**
 * Initialize PostHog analytics
 * @returns {Promise<boolean>} True if successfully initialized
 */
export async function initAnalytics() {
  try {
    const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
    const enabled = import.meta.env.VITE_POSTHOG_ENABLED === 'true';
    
    if (!enabled || !posthogKey) {
      console.log('📊 PostHog analytics disabled or not configured');
      return false;
    }

    const posthogModule = await import('posthog-js');
    posthog = posthogModule.default;

    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only', // Only create profiles for identified users (matches official docs)
      autocapture: true, // Automatically track clicks, form submissions, etc.
      capture_pageview: true, // Track page views
      capture_pageleave: true, // Track when users leave
      loaded: (posthog) => {
        if (import.meta.env.DEV) {
          console.log('✅ PostHog analytics initialized');
        }
      },
      // Privacy settings
      respect_dnt: true, // Respect Do Not Track
      // Session replay (optional, can be enabled separately)
      session_recording: {
        recordCrossOriginIframes: false,
        maskAllInputs: true, // Mask sensitive input fields
        maskTextSelector: '[data-mask]', // Allow manual masking
      }
    });

    isInitialized = true;
    return true;
  } catch (error) {
    console.warn('⚠️ PostHog initialization failed:', error);
    return false;
  }
}

/**
 * Track a custom event
 * @param {string} eventName - Name of the event
 * @param {object} properties - Event properties
 */
export function trackEvent(eventName, properties = {}) {
  if (!isInitialized || !posthog) return;
  
  try {
    posthog.capture(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
      environment: import.meta.env.MODE
    });
  } catch (error) {
    console.warn('Failed to track event:', error);
  }
}

/**
 * Track a user click/interaction
 * @param {string} elementName - Name/ID of the clicked element
 * @param {object} context - Additional context
 */
export function trackClick(elementName, context = {}) {
  trackEvent('user_click', {
    element: elementName,
    ...context
  });
}

/**
 * Track feature usage
 * @param {string} featureName - Name of the feature
 * @param {object} properties - Feature usage properties
 */
export function trackFeatureUsage(featureName, properties = {}) {
  trackEvent('feature_used', {
    feature: featureName,
    ...properties
  });
}

/**
 * Identify the current user
 * @param {string} userId - User ID from auth system
 * @param {object} traits - User traits (email, name, etc.)
 */
export function identifyUser(userId, traits = {}) {
  if (!isInitialized || !posthog) return;
  
  try {
    posthog.identify(userId, {
      ...traits,
      environment: import.meta.env.MODE
    });
  } catch (error) {
    console.warn('Failed to identify user:', error);
  }
}

/**
 * Reset user identification (on sign out)
 */
export function resetUser() {
  if (!isInitialized || !posthog) return;
  
  try {
    posthog.reset();
  } catch (error) {
    console.warn('Failed to reset user:', error);
  }
}

/**
 * Track page view
 * @param {string} pageName - Name of the page/view
 * @param {object} properties - Additional properties
 */
export function trackPageView(pageName, properties = {}) {
  if (!isInitialized || !posthog) return;
  
  try {
    posthog.capture('$pageview', {
      page_name: pageName,
      ...properties
    });
  } catch (error) {
    console.warn('Failed to track page view:', error);
  }
}

/**
 * Track search events
 * @param {string} query - Search query
 * @param {number} resultCount - Number of results
 * @param {object} context - Additional context
 */
export function trackSearch(query, resultCount, context = {}) {
  trackEvent('search_performed', {
    query_length: query.length,
    result_count: resultCount,
    has_results: resultCount > 0,
    ...context
  });
}

/**
 * Track layer toggle events
 * @param {string} layerName - Name of the layer
 * @param {boolean} enabled - Whether layer is enabled
 * @param {object} context - Additional context
 */
export function trackLayerToggle(layerName, enabled, context = {}) {
  trackEvent('layer_toggled', {
    layer_name: layerName,
    enabled,
    ...context
  });
}

/**
 * Track export events
 * @param {string} exportType - Type of export (csv, json, etc.)
 * @param {object} properties - Export properties (itemCount, etc.)
 */
export function trackExport(exportType, properties = {}) {
  trackEvent('export_performed', {
    export_type: exportType,
    ...properties
  });
}

/**
 * Check if analytics is initialized
 * @returns {boolean}
 */
export function isAnalyticsReady() {
  return isInitialized && posthog !== null;
}

