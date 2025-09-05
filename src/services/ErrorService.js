// ErrorService.js - centralized error reporting and user notifications

export class ErrorService {
  constructor() {
    this.subscribers = new Set();
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify(event) {
    this.subscribers.forEach((fn) => {
      try { fn(event); } catch {}
    });
  }

  report(error, context = {}) {
    const payload = { error, context, time: new Date().toISOString() };
    // Console logging in dev; noop or send to backend in prod
    if (import.meta.env.DEV) {
      console.error('ErrorService.report', payload);
    }
    this.notify({ type: 'error', ...payload });
  }

  warn(message, context = {}) {
    const payload = { message, context, time: new Date().toISOString() };
    if (import.meta.env.DEV) {
      console.warn('ErrorService.warn', payload);
    }
    this.notify({ type: 'warn', ...payload });
  }

  info(message, context = {}) {
    const payload = { message, context, time: new Date().toISOString() };
    if (import.meta.env.DEV) {
      console.log('ErrorService.info', payload);
    }
    this.notify({ type: 'info', ...payload });
  }
}

export const errorService = new ErrorService();


