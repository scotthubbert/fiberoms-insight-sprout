// SentryService.js - optional Sentry integration (env-gated)

let isInitialized = false;

export async function initSentryIfEnabled() {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    const enabled = import.meta.env.VITE_SENTRY_ENABLED === 'true';
    if (!enabled || !dsn) return false;

    const Sentry = await import('@sentry/browser');
    const Tracing = await import('@sentry/tracing');

    Sentry.init({
      dsn,
      integrations: [new Tracing.BrowserTracing()],
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
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
    const Sentry = await import('@sentry/browser');
    Sentry.captureException(error, { extra: context });
  } catch {}
}


