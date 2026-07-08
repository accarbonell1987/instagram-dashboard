import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Token } from './Token';
import type { AuthStrategy, TokenResponse, TokenStorage } from './types';

function createMockStorage(): TokenStorage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
  };
}

function createMockStrategy(response?: Partial<TokenResponse>): AuthStrategy {
  const defaultResponse: TokenResponse = {
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresIn: 3600,
    ...response,
  };
  return {
    requestToken: vi.fn().mockImplementation(() => Promise.resolve({ ...defaultResponse })),
    refreshToken: vi.fn().mockImplementation(() => Promise.resolve({ ...defaultResponse })),
  };
}

describe('Token', () => {
  let storage: TokenStorage;
  let mockStrategy: AuthStrategy;

  beforeEach(() => {
    vi.restoreAllMocks();
    storage = createMockStorage();
    mockStrategy = createMockStrategy();
  });

  // ─── getAccessToken ────────────────────────────────────

  describe('getAccessToken', () => {
    it('returns stored token when not expired', async () => {
      const futureTimestamp = String(Date.now() + 600_000); // 10 min from now
      storage.setItem('auth_access_token', 'stored-token');
      storage.setItem('auth_expires_at', futureTimestamp);

      const token = new Token(mockStrategy, storage);
      const result = await token.getAccessToken();

      expect(result).toBe('stored-token');
      expect(vi.mocked(mockStrategy.requestToken)).not.toHaveBeenCalled();
      expect(vi.mocked(mockStrategy.refreshToken)).not.toHaveBeenCalled();
    });

    it('requests new token via strategy when no token stored', async () => {
      const token = new Token(mockStrategy, storage);
      const result = await token.getAccessToken();

      expect(result).toBe('new-access-token');
      expect(vi.mocked(mockStrategy.requestToken)).toHaveBeenCalledOnce();
    });

    it('stores token response after successful request', async () => {
      const token = new Token(mockStrategy, storage);
      await token.getAccessToken();

      expect(vi.mocked(storage.setItem)).toHaveBeenCalledWith(
        'auth_access_token',
        'new-access-token'
      );
      expect(vi.mocked(storage.setItem)).toHaveBeenCalledWith(
        'auth_refresh_token',
        'new-refresh-token'
      );
      // expiresAt should be set to a future timestamp
      const expiresAtCall = vi
        .mocked(storage.setItem)
        .mock.calls.find(([key]) => key === 'auth_expires_at');
      expect(expiresAtCall).toBeDefined();
      if (expiresAtCall) {
        const expiresAtValue = Number(expiresAtCall[1]);
        expect(expiresAtValue).toBeGreaterThan(Date.now());
      }
    });

    it('refreshes when token is expired but refresh token exists', async () => {
      const expiredTimestamp = String(Date.now() - 60_000); // 1 min ago
      storage.setItem('auth_access_token', 'expired-token');
      storage.setItem('auth_refresh_token', 'valid-refresh-token');
      storage.setItem('auth_expires_at', expiredTimestamp);

      const token = new Token(mockStrategy, storage);
      const result = await token.getAccessToken();

      expect(result).toBe('new-access-token');
      expect(vi.mocked(mockStrategy.refreshToken)).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('returns null when strategy.requestToken fails and no refresh token', async () => {
      const failingStrategy = createMockStrategy();
      vi.mocked(failingStrategy.requestToken).mockRejectedValue(new Error('Network error'));

      const token = new Token(failingStrategy, storage);
      const result = await token.getAccessToken();

      expect(result).toBeNull();
    });
  });

  // ─── refreshToken ──────────────────────────────────────

  describe('refreshToken', () => {
    it('delegates to strategy.refreshToken with stored refresh token', async () => {
      storage.setItem('auth_refresh_token', 'my-refresh-token');

      const token = new Token(mockStrategy, storage);
      await token.refreshToken();

      expect(vi.mocked(mockStrategy.refreshToken)).toHaveBeenCalledWith('my-refresh-token');
    });

    it('clears storage when refresh fails', async () => {
      storage.setItem('auth_refresh_token', 'invalid-token');
      const failingStrategy = createMockStrategy();
      vi.mocked(failingStrategy.refreshToken).mockRejectedValue(new Error('Invalid refresh token'));

      const token = new Token(failingStrategy, storage);
      const result = await token.refreshToken();

      expect(result).toBeNull();
      expect(vi.mocked(storage.removeItem)).toHaveBeenCalledWith('auth_access_token');
      expect(vi.mocked(storage.removeItem)).toHaveBeenCalledWith('auth_refresh_token');
      expect(vi.mocked(storage.removeItem)).toHaveBeenCalledWith('auth_expires_at');
    });

    it('returns null when no refresh token in storage', async () => {
      const token = new Token(mockStrategy, storage);
      const result = await token.refreshToken();

      expect(result).toBeNull();
      expect(vi.mocked(mockStrategy.refreshToken)).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent refresh calls', async () => {
      storage.setItem('auth_refresh_token', 'my-refresh-token');
      // Simular latencia en la petición
      const slowStrategy = createMockStrategy();
      vi.mocked(slowStrategy.refreshToken).mockImplementation(
        () =>
          new Promise<TokenResponse>((resolve) => {
            setTimeout(() => {
              resolve({
                accessToken: 'refreshed-token',
                refreshToken: 'new-refresh',
                expiresIn: 3600,
              });
            }, 50);
          })
      );

      const token = new Token(slowStrategy, storage);

      // Lanzar 3 refresh concurrentes
      const [result1, result2, result3] = await Promise.all([
        token.refreshToken(),
        token.refreshToken(),
        token.refreshToken(),
      ]);

      // Solo una llamada real a la estrategia
      expect(vi.mocked(slowStrategy.refreshToken)).toHaveBeenCalledOnce();
      // Todas reciben el mismo resultado
      expect(result1).toBe('refreshed-token');
      expect(result2).toBe('refreshed-token');
      expect(result3).toBe('refreshed-token');
    });
  });

  // ─── isExpired ─────────────────────────────────────────

  describe('isExpired', () => {
    it('returns true when no expiresAt in storage', () => {
      const token = new Token(mockStrategy, storage);

      expect(token.isExpired()).toBe(true);
    });

    it('returns false when token expires in the future (beyond buffer)', () => {
      const futureTimestamp = String(Date.now() + 120_000); // 2 min from now
      storage.setItem('auth_expires_at', futureTimestamp);

      const token = new Token(mockStrategy, storage);

      expect(token.isExpired()).toBe(false);
    });

    it('returns true when token expires within 30 second buffer', () => {
      const nearFuture = String(Date.now() + 20_000); // 20 sec from now (within 30s buffer)
      storage.setItem('auth_expires_at', nearFuture);

      const token = new Token(mockStrategy, storage);

      expect(token.isExpired()).toBe(true);
    });

    it('returns true when token already expired', () => {
      const pastTimestamp = String(Date.now() - 60_000); // 1 min ago
      storage.setItem('auth_expires_at', pastTimestamp);

      const token = new Token(mockStrategy, storage);

      expect(token.isExpired()).toBe(true);
    });
  });

  // ─── clear ─────────────────────────────────────────────

  describe('clear', () => {
    it('removes all token keys from storage', () => {
      storage.setItem('auth_access_token', 'token');
      storage.setItem('auth_refresh_token', 'refresh');
      storage.setItem('auth_expires_at', '123456');

      const token = new Token(mockStrategy, storage);
      token.clear();

      expect(vi.mocked(storage.removeItem)).toHaveBeenCalledWith('auth_access_token');
      expect(vi.mocked(storage.removeItem)).toHaveBeenCalledWith('auth_refresh_token');
      expect(vi.mocked(storage.removeItem)).toHaveBeenCalledWith('auth_expires_at');
    });
  });

  // ─── Custom storage prefix ─────────────────────────────

  describe('custom storage prefix', () => {
    it('uses custom prefix for storage keys', async () => {
      const token = new Token(mockStrategy, storage, 'myapp');
      await token.getAccessToken();

      expect(vi.mocked(storage.setItem)).toHaveBeenCalledWith(
        'myapp_access_token',
        'new-access-token'
      );
      expect(vi.mocked(storage.setItem)).toHaveBeenCalledWith(
        'myapp_refresh_token',
        'new-refresh-token'
      );
    });
  });
});
