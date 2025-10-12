import { vi } from 'vitest';

if (!globalThis.URL) {
  globalThis.URL = {};
}

if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}

if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = vi.fn();
}

// Stub MutationObserver to avoid jsdom Node checks from ArcGIS internals
if (!globalThis.MutationObserver) {
  globalThis.MutationObserver = class {
    observe() { }
    disconnect() { }
    takeRecords() { return []; }
  };
}


