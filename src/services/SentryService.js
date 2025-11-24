// SentryService.js - optional Sentry integration (env-gated)

let isInitialized = false;
let Sentry = null;

export async function initSentryIfEnabled() {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    const enabled = import.meta.env.VITE_SENTRY_ENABLED === 'true';
    if (!enabled || !dsn) return false;

    const SentryModule = await import('@sentry/browser');
    const Tracing = await import('@sentry/tracing');
    Sentry = SentryModule;

    Sentry.init({
      dsn,
      integrations: [
        new Tracing.BrowserTracing(),
        // Enable Session Replay for click tracking (requires paid plan)
        ...(import.meta.env.VITE_SENTRY_REPLAY_ENABLED === 'true' 
          ? [new Sentry.Replay({
              maskAllText: false,
              blockAllMedia: false,
            })]
          : [])
      ],
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE || '0.1'),
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE
    });

    isInitialized = true;
    return true;
  } catch (error) {
    console.warn('Sentry initialization failed:', error);
    return false;
  }
}

export async function captureError(error, context = {}) {
  if (!isInitialized) return;
  try {
    if (!Sentry) Sentry = await import('@sentry/browser');
    Sentry.captureException(error, { extra: context });
  } catch {}
}

/**
 * Track a user click or interaction event
 * NOTE: These events count toward your Sentry error quota
 * For better analytics, consider using a dedicated analytics tool like PostHog
 * 
 * @param {string} elementName - Name/ID of the clicked element (e.g., 'export-csv-button')
 * @param {object} context - Additional context (e.g., { section: 'dashboard', layerName: 'subscribers' })
 */
export async function trackClick(elementName, context = {}) {
  if (!isInitialized) return;
  try {
    if (!Sentry) Sentry = await import('@sentry/browser');
    
    // Use tags for searchable metadata (tags are indexed, extra is not)
    Sentry.captureEvent({
      message: `User Click: ${elementName}`,
      level: 'info',
      tags: {
        event_type: 'user_click',
        element: elementName,
        section: context.section || 'unknown',
        ...(context.layerName && { layer: context.layerName }),
        ...(context.action && { action: context.action })
      },
      extra: {
        ...context,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.warn('Failed to track click:', error);
  }
}

/**
 * Track a custom analytics event
 * @param {string} eventName - Name of the event (e.g., 'layer_toggled', 'search_performed')
 * @param {object} properties - Event properties
 */
export async function trackEvent(eventName, properties = {}) {
  if (!isInitialized) return;
  try {
    if (!Sentry) Sentry = await import('@sentry/browser');
    
    Sentry.captureEvent({
      message: `Event: ${eventName}`,
      level: 'info',
      tags: {
        event_type: 'analytics',
        event_name: eventName,
        ...Object.entries(properties).reduce((acc, [key, value]) => {
          // Convert properties to tags (only strings/numbers work as tags)
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            acc[key] = String(value);
          }
          return acc;
        }, {})
      },
      extra: {
        ...properties,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.warn('Failed to track event:', error);
  }
}

/**
 * Identify the current user for better session tracking
 * @param {string} userId - User ID from your auth system
 * @param {object} traits - User traits (email, name, etc.)
 */
export async function identifyUser(userId, traits = {}) {
  if (!isInitialized) return;
  try {
    if (!Sentry) Sentry = await import('@sentry/browser');
    Sentry.setUser({
      id: userId,
      ...traits
    });
  } catch (error) {
    console.warn('Failed to identify user:', error);
  }
}


