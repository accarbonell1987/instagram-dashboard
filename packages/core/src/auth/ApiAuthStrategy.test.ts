import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ApiAuthStrategy } from './ApiAuthStrategy';
import type { ApiAuthConfig } from './types';

const TEST_CONFIG: ApiAuthConfig = {
  loginUrl: 'https://api.test.com/auth/login',
  refreshUrl: 'https://api.test.com/auth/refresh',
  credentials: {
    email: 'user@test.com',
    password: 'secret123',
  },
};

function createMockFetch(responseBody: Record<string, unknown>, status = 200) {
  return vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(responseBody),
    })
  );
}

describe('ApiAuthStrategy', () => {
  let mockFetch: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch = createMockFetch({
      accessToken: 'api-access-token',
      refreshToken: 'api-refresh-token',
      expiresIn: 1800,
    });
  });

  describe('requestToken', () => {
    it('sends credentials as JSON to login URL', async () => {
      const strategy = new ApiAuthStrategy(TEST_CONFIG, mockFetch);
      await strategy.requestToken();

      expect(mockFetch).toHaveBeenCalledOnce();
      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const [url, options] = call as [
        string,
        { method: string; headers: Record<string, string>; body: string },
      ];
      expect(url).toBe('https://api.test.com/auth/login');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body) as { email: string; password: string };
      expect(body.email).toBe('user@test.com');
      expect(body.password).toBe('secret123');
    });

    it('returns parsed token response with camelCase keys', async () => {
      const strategy = new ApiAuthStrategy(TEST_CONFIG, mockFetch);
      const result = await strategy.requestToken();

      expect(result).toEqual({
        accessToken: 'api-access-token',
        refreshToken: 'api-refresh-token',
        expiresIn: 1800,
      });
    });

    it('handles snake_case response keys', async () => {
      const snakeFetch = createMockFetch({
        access_token: 'snake-access',
        refresh_token: 'snake-refresh',
        expires_in: 900,
      });
      const strategy = new ApiAuthStrategy(TEST_CONFIG, snakeFetch);
      const result = await strategy.requestToken();

      expect(result).toEqual({
        accessToken: 'snake-access',
        refreshToken: 'snake-refresh',
        expiresIn: 900,
      });
    });

    it('defaults expiresIn to 3600 when not present', async () => {
      const fetchWithoutExpiry = createMockFetch({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      const strategy = new ApiAuthStrategy(TEST_CONFIG, fetchWithoutExpiry);
      const result = await strategy.requestToken();

      expect(result.expiresIn).toBe(3600);
    });

    it('throws when response is not ok', async () => {
      const failingFetch = createMockFetch({}, 401);
      const strategy = new ApiAuthStrategy(TEST_CONFIG, failingFetch);

      await expect(strategy.requestToken()).rejects.toThrow('Login request failed with status 401');
    });
  });

  describe('refreshToken', () => {
    it('sends refresh token as JSON to refresh URL', async () => {
      const strategy = new ApiAuthStrategy(TEST_CONFIG, mockFetch);
      await strategy.refreshToken('current-refresh-token');

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const [url, options] = call as [
        string,
        { method: string; headers: Record<string, string>; body: string },
      ];
      expect(url).toBe('https://api.test.com/auth/refresh');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body) as { refreshToken: string };
      expect(body.refreshToken).toBe('current-refresh-token');
    });

    it('returns parsed token response', async () => {
      const strategy = new ApiAuthStrategy(TEST_CONFIG, mockFetch);
      const result = await strategy.refreshToken('current-refresh-token');

      expect(result).toEqual({
        accessToken: 'api-access-token',
        refreshToken: 'api-refresh-token',
        expiresIn: 1800,
      });
    });

    it('throws when response is not ok', async () => {
      const failingFetch = createMockFetch({}, 403);
      const strategy = new ApiAuthStrategy(TEST_CONFIG, failingFetch);

      await expect(strategy.refreshToken('bad-token')).rejects.toThrow(
        'Refresh request failed with status 403'
      );
    });
  });
});
