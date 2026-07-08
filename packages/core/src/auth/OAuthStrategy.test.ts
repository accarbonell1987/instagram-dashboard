import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OAuthStrategy } from './OAuthStrategy';
import type { OAuthConfig } from './types';

const TEST_CONFIG: OAuthConfig = {
  url: 'https://auth.test.com/token',
  clientId: 'test-client',
  clientSecret: 'test-secret',
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

describe('OAuthStrategy', () => {
  let mockFetch: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch = createMockFetch({
      access_token: 'oauth-access-token',
      refresh_token: 'oauth-refresh-token',
      expires_in: 7200,
    });
  });

  describe('requestToken', () => {
    it('sends client_credentials grant type', async () => {
      const strategy = new OAuthStrategy(TEST_CONFIG, mockFetch);
      await strategy.requestToken();

      expect(mockFetch).toHaveBeenCalledOnce();
      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const [url, options] = call as [
        string,
        { method: string; headers: Record<string, string>; body: string },
      ];
      expect(url).toBe('https://auth.test.com/token');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      const body = new URLSearchParams(options.body);
      expect(body.get('grant_type')).toBe('client_credentials');
      expect(body.get('client_id')).toBe('test-client');
      expect(body.get('client_secret')).toBe('test-secret');
    });

    it('returns parsed token response', async () => {
      const strategy = new OAuthStrategy(TEST_CONFIG, mockFetch);
      const result = await strategy.requestToken();

      expect(result).toEqual({
        accessToken: 'oauth-access-token',
        refreshToken: 'oauth-refresh-token',
        expiresIn: 7200,
      });
    });

    it('defaults expiresIn to 3600 when not present', async () => {
      const fetchWithoutExpiry = createMockFetch({
        access_token: 'token',
        refresh_token: 'refresh',
      });
      const strategy = new OAuthStrategy(TEST_CONFIG, fetchWithoutExpiry);
      const result = await strategy.requestToken();

      expect(result.expiresIn).toBe(3600);
    });

    it('defaults refreshToken to empty string when not present', async () => {
      const fetchWithoutRefresh = createMockFetch({
        access_token: 'token',
        expires_in: 3600,
      });
      const strategy = new OAuthStrategy(TEST_CONFIG, fetchWithoutRefresh);
      const result = await strategy.requestToken();

      expect(result.refreshToken).toBe('');
    });

    it('throws when response is not ok', async () => {
      const failingFetch = createMockFetch({}, 401);
      const strategy = new OAuthStrategy(TEST_CONFIG, failingFetch);

      await expect(strategy.requestToken()).rejects.toThrow(
        'OAuth token request failed with status 401'
      );
    });
  });

  describe('refreshToken', () => {
    it('sends refresh_token grant type with current refresh token', async () => {
      const strategy = new OAuthStrategy(TEST_CONFIG, mockFetch);
      await strategy.refreshToken('my-refresh-token');

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const [, options] = call as [
        string,
        { method: string; headers: Record<string, string>; body: string },
      ];
      const body = new URLSearchParams(options.body);
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('my-refresh-token');
      expect(body.get('client_id')).toBe('test-client');
      expect(body.get('client_secret')).toBe('test-secret');
    });

    it('returns parsed token response', async () => {
      const strategy = new OAuthStrategy(TEST_CONFIG, mockFetch);
      const result = await strategy.refreshToken('my-refresh-token');

      expect(result).toEqual({
        accessToken: 'oauth-access-token',
        refreshToken: 'oauth-refresh-token',
        expiresIn: 7200,
      });
    });

    it('throws when response is not ok', async () => {
      const failingFetch = createMockFetch({}, 400);
      const strategy = new OAuthStrategy(TEST_CONFIG, failingFetch);

      await expect(strategy.refreshToken('bad-token')).rejects.toThrow(
        'OAuth token request failed with status 400'
      );
    });
  });
});
