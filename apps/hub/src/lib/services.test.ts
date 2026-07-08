import { describe, expect, it, beforeEach } from 'vitest';

import { setAccessToken, clearAccessToken } from '../modules/iam/identity/session/token';

import { coreServices, store, tokenProviderBridge } from './services';

describe('createHubServices (composition root smoke test)', () => {
  it('coreServices is defined and has createService', () => {
    expect(coreServices).toBeDefined();
    expect(typeof coreServices.createService).toBe('function');
  });

  it('coreServices has httpClient (AxiosInstance)', () => {
    expect(coreServices.httpClient).toBeDefined();
  });

  it('store is defined with initialize method', () => {
    const state = store.getState();
    expect(typeof state.initialize).toBe('function');
    expect(state.initialized).toBe(false);
  });

  it('createService returns an object with CRUD methods', () => {
    interface Plan {
      id: string;
      name: string;
    }
    const plansService = coreServices.createService<Plan>('/plans');
    expect(typeof plansService.getAll).toBe('function');
    expect(typeof plansService.getById).toBe('function');
    expect(typeof plansService.create).toBe('function');
    expect(typeof plansService.update).toBe('function');
    expect(typeof plansService.remove).toBe('function');
  });
});

// ─── Phase 3: tokenProviderBridge smoke tests ───────────

describe('tokenProviderBridge (Phase 3)', () => {
  beforeEach(() => {
    clearAccessToken();
  });

  it('getAccessToken() returns null when no token is set', async () => {
    const token = await tokenProviderBridge.getAccessToken();
    expect(token).toBeNull();
  });

  it('getAccessToken() returns the raw token after setAccessToken', async () => {
    setAccessToken({ raw: 'test-access-token', expiresAt: Date.now() + 900_000 });
    const token = await tokenProviderBridge.getAccessToken();
    expect(token).toBe('test-access-token');
  });

  it('getAccessToken() returns null for an expired token', async () => {
    setAccessToken({ raw: 'expired-token', expiresAt: Date.now() - 1000 });
    const token = await tokenProviderBridge.getAccessToken();
    expect(token).toBeNull();
  });

  it('isExpired() reflects tokenHolder state', () => {
    clearAccessToken();
    expect(tokenProviderBridge.isExpired()).toBe(true);

    setAccessToken({ raw: 'tok', expiresAt: Date.now() + 900_000 });
    expect(tokenProviderBridge.isExpired()).toBe(false);
  });

  it('clear() removes the token from tokenHolder', () => {
    setAccessToken({ raw: 'tok', expiresAt: Date.now() + 900_000 });
    tokenProviderBridge.clear();
    expect(tokenProviderBridge.isExpired()).toBe(true);
  });
});

describe('Spring RFC 7807 error normalizer', () => {
  it('coreServices.httpClient has response interceptors registered', () => {
    const handlers = (coreServices.httpClient.interceptors.response as unknown as { handlers: unknown[] }).handlers;
    expect(handlers.filter(Boolean).length).toBeGreaterThanOrEqual(1);
  });
});
