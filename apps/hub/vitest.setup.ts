import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/lib/mocks/server.js';
import { applyScenario } from './src/lib/mocks/seed.js';

// Polyfill ResizeObserver — not available in jsdom but required by input-otp
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Suppress post-teardown errors from input-otp lingering setTimeouts.
// The library schedules a setTimeout to sync state that fires after jsdom
// tears down, crashing on `window is not defined`. The tests themselves
// pass — this is purely cosmetic but breaks CI exit code.
process.on('uncaughtException', (err) => {
  if (err instanceof ReferenceError && /window is not defined/.test(err.message)) {
    return;
  }
  throw err;
});

// Start MSW server once for the entire test suite
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

// Reset handlers and reseed happy after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
  applyScenario('happy');
});

// Close server after all tests
afterAll(() => server.close());
