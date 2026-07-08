import { describe, it, expect, beforeEach } from 'vitest';

import { getActiveScenario, setActiveScenario, resetScenario } from './index';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { Reflect.deleteProperty(store, key); },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('scenario manager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset window.location search
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    });
  });

  it('defaults to happy when nothing is set', () => {
    expect(getActiveScenario()).toBe('happy');
  });

  it('reads scenario from localStorage', () => {
    setActiveScenario('otp-failure');
    expect(getActiveScenario()).toBe('otp-failure');
  });

  it('URL ?msw param overrides localStorage', () => {
    setActiveScenario('otp-failure');
    Object.defineProperty(window, 'location', {
      value: { search: '?msw=payment-cancelled' },
      writable: true,
    });
    expect(getActiveScenario()).toBe('payment-cancelled');
  });

  it('URL ?msw param persists to localStorage', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?msw=session-expired' },
      writable: true,
    });
    getActiveScenario(); // triggers persist
    // Clear URL
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    });
    expect(getActiveScenario()).toBe('session-expired');
  });

  it('ignores unknown ?msw param values', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?msw=not-a-real-scenario' },
      writable: true,
    });
    expect(getActiveScenario()).toBe('happy');
  });

  it('resetScenario returns to happy default', () => {
    setActiveScenario('payment-timeout');
    resetScenario();
    expect(getActiveScenario()).toBe('happy');
  });
});
