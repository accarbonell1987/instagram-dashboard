import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ITokenProvider } from '../auth/types';
import { ServiceError } from '../errors/ServiceError';

import { createHttpClient, type HttpClientConfig } from './createHttpClient';

// Mock de servidor usando vi.fn sobre axios adapter
function createMockTokenProvider(accessToken: string | null = 'test-token'): ITokenProvider {
  return {
    getAccessToken: vi.fn().mockResolvedValue(accessToken),
    refreshToken: vi.fn().mockResolvedValue(null),
    isExpired: vi.fn().mockReturnValue(false),
    clear: vi.fn(),
  };
}

const BASE_CONFIG: HttpClientConfig = {
  baseUrl: 'https://api.test.com',
  tokenProvider: createMockTokenProvider(),
};

describe('createHttpClient', () => {
  let tokenProvider: ITokenProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    tokenProvider = createMockTokenProvider();
  });

  it('returns an Axios instance', () => {
    const client = createHttpClient({ ...BASE_CONFIG, tokenProvider });

    // AxiosInstance tiene métodos get, post, etc.
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.request).toBe('function');
  });

  it('sets baseURL from config', () => {
    const client = createHttpClient({ ...BASE_CONFIG, tokenProvider });

    expect(client.defaults.baseURL).toBe('https://api.test.com');
  });

  it('sets default timeout of 30 seconds', () => {
    const client = createHttpClient({ ...BASE_CONFIG, tokenProvider });

    expect(client.defaults.timeout).toBe(30_000);
  });

  it('allows custom timeout', () => {
    const client = createHttpClient({
      ...BASE_CONFIG,
      tokenProvider,
      timeout: 10_000,
    });

    expect(client.defaults.timeout).toBe(10_000);
  });

  it('sets Content-Type header by default', () => {
    const client = createHttpClient({ ...BASE_CONFIG, tokenProvider });

    expect(client.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('merges custom headers', () => {
    const client = createHttpClient({
      ...BASE_CONFIG,
      tokenProvider,
      headers: { 'X-Custom': 'value' },
    });

    expect(client.defaults.headers['X-Custom']).toBe('value');
    expect(client.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('registers request interceptor (auth)', () => {
    const client = createHttpClient({ ...BASE_CONFIG, tokenProvider });

    // Axios internals: interceptors.request.handlers tiene los interceptores
    const requestHandlers = (client.interceptors.request as unknown as { handlers: unknown[] })
      .handlers;
    expect(requestHandlers.length).toBe(1);
  });

  it('registers response interceptors (unwrap envelope + error)', () => {
    const client = createHttpClient({ ...BASE_CONFIG, tokenProvider });

    const responseHandlers = (client.interceptors.response as unknown as { handlers: unknown[] })
      .handlers;
    expect(responseHandlers.length).toBe(2); // unwrap envelope + error handler
  });

  // ─── Integration: interceptors wired correctly ─────────

  describe('integration', () => {
    it('injects Authorization header via auth interceptor', async () => {
      const client = createHttpClient({ ...BASE_CONFIG, tokenProvider });

      // Usamos adapter mock para capturar la request sin hacer HTTP real
      let capturedHeaders: Record<string, string> = {};
      client.defaults.adapter = (config) => {
        capturedHeaders = config.headers as unknown as Record<string, string>;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      };

      await client.get('/test');

      expect(vi.mocked(tokenProvider.getAccessToken)).toHaveBeenCalledOnce();
      expect(capturedHeaders['Authorization']).toBe('Bearer test-token');
    });

    it('does not inject Authorization when token is null', async () => {
      const noTokenProvider = createMockTokenProvider(null);
      const client = createHttpClient({ ...BASE_CONFIG, tokenProvider: noTokenProvider });

      let capturedHeaders: Record<string, string> = {};
      client.defaults.adapter = (config) => {
        capturedHeaders = config.headers as unknown as Record<string, string>;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      };

      await client.get('/test');

      expect(capturedHeaders['Authorization']).toBeUndefined();
    });

    it('converts HTTP errors to ServiceError via error interceptor', async () => {
      const client = createHttpClient({ ...BASE_CONFIG, tokenProvider });

      client.defaults.adapter = () => {
        throw Object.assign(new Error('Not Found'), {
          isAxiosError: true,
          response: { status: 404, statusText: 'Not Found', data: {}, headers: {} },
          config: { url: '/missing', headers: {} },
          code: 'ERR_BAD_REQUEST',
          toJSON: () => ({}),
        });
      };

      try {
        await client.get('/missing');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        const serviceError = error as ServiceError;
        expect(serviceError.status).toBe(404);
      }
    });
  });
});
