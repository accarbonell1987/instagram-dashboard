import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { CoreServices } from '../services/createCoreServices';

import { createServicesStore } from './createServicesStore';


function createMockCoreServices(): CoreServices {
  return {
    tokenProvider: {
      getAccessToken: vi.fn().mockResolvedValue('mock-token'),
      refreshToken: vi.fn().mockResolvedValue('refreshed-token'),
      isExpired: vi.fn().mockReturnValue(false),
      clear: vi.fn(),
    },
    httpClient: {} as CoreServices['httpClient'],
    createService: vi.fn(),
  };
}

describe('createServicesStore', () => {
  let mockServices: CoreServices;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockServices = createMockCoreServices();
  });

  // ─── Store structure ──────────────────────────────────

  describe('store structure', () => {
    it('returns store, useServices, and useServicesStore', () => {
      const result = createServicesStore();

      expect(result.store).toBeDefined();
      expect(typeof result.useServices).toBe('function');
      expect(typeof result.useServicesStore).toBe('function');
    });

    it('starts uninitialized with null services', () => {
      const { store } = createServicesStore();
      const state = store.getState();

      expect(state.services).toBeNull();
      expect(state.initialized).toBe(false);
    });
  });

  // ─── initialize / reset ───────────────────────────────

  describe('initialize and reset', () => {
    it('sets services and marks as initialized', () => {
      const { store } = createServicesStore();

      store.getState().initialize(mockServices);

      const state = store.getState();
      expect(state.services).toBe(mockServices);
      expect(state.initialized).toBe(true);
    });

    it('reset clears services and sets initialized to false', () => {
      const { store } = createServicesStore();

      store.getState().initialize(mockServices);
      store.getState().reset();

      const state = store.getState();
      expect(state.services).toBeNull();
      expect(state.initialized).toBe(false);
    });

    it('can reinitialize after reset', () => {
      const { store } = createServicesStore();
      const newServices = createMockCoreServices();

      store.getState().initialize(mockServices);
      store.getState().reset();
      store.getState().initialize(newServices);

      expect(store.getState().services).toBe(newServices);
      expect(store.getState().initialized).toBe(true);
    });
  });

  // ─── useServices hook ─────────────────────────────────

  describe('useServices', () => {
    it('returns services when initialized', () => {
      const { store, useServices } = createServicesStore();
      store.getState().initialize(mockServices);

      const { result } = renderHook(() => useServices());

      expect(result.current).toBe(mockServices);
    });

    it('throws when not initialized', () => {
      const { useServices } = createServicesStore();

      expect(() => {
        renderHook(() => useServices());
      }).toThrow('Services not initialized');
    });

    it('reacts to initialization', () => {
      const { store, useServices } = createServicesStore();
      store.getState().initialize(mockServices);

      const { result } = renderHook(() => useServices());

      expect(result.current.tokenProvider).toBe(mockServices.tokenProvider);
    });
  });

  // ─── useServicesStore hook ────────────────────────────

  describe('useServicesStore', () => {
    it('selects initialized state', () => {
      const { store, useServicesStore } = createServicesStore();

      const { result } = renderHook(() => useServicesStore((state) => state.initialized));
      expect(result.current).toBe(false);

      act(() => {
        store.getState().initialize(mockServices);
      });

      expect(result.current).toBe(true);
    });

    it('selects services state', () => {
      const { store, useServicesStore } = createServicesStore();
      store.getState().initialize(mockServices);

      const { result } = renderHook(() => useServicesStore((state) => state.services));

      expect(result.current).toBe(mockServices);
    });
  });

  // ─── Isolation ────────────────────────────────────────

  describe('isolation', () => {
    it('creates independent stores per call', () => {
      const storeA = createServicesStore();
      const storeB = createServicesStore();

      storeA.store.getState().initialize(mockServices);

      expect(storeA.store.getState().initialized).toBe(true);
      expect(storeB.store.getState().initialized).toBe(false);
    });
  });
});
