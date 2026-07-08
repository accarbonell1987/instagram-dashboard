import { AxiosError, AxiosHeaders, type AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ITokenProvider } from '../../auth/types';
import { ServiceError } from '../../errors/ServiceError';

import { createErrorInterceptor } from './errorInterceptor';

function createMockTokenProvider(
  refreshedToken: string | null = 'refreshed-token'
): ITokenProvider {
  return {
    getAccessToken: vi.fn().mockResolvedValue('current-token'),
    refreshToken: vi.fn().mockResolvedValue(refreshedToken),
    isExpired: vi.fn().mockReturnValue(false),
    clear: vi.fn(),
  };
}

function createMockAxiosInstance() {
  return {
    request: vi.fn().mockResolvedValue({ data: 'retried-data' }),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  } as unknown as AxiosInstance;
}

function createAxiosError(status: number, config?: Record<string, unknown>): AxiosError {
  const headers = new AxiosHeaders();
  const error = new AxiosError(
    `Request failed with status ${String(status)}`,
    'ERR_BAD_REQUEST',
    {
      url: '/api/test',
      method: 'get',
      headers,
      ...(config ?? {}),
    } as AxiosError['config'],
    undefined,
    {
      status,
      statusText: `Error ${String(status)}`,
      data: {},
      headers: {},
      config: { headers },
    } as AxiosError['response']
  );
  return error;
}

describe('errorInterceptor', () => {
  let tokenProvider: ITokenProvider;
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    vi.restoreAllMocks();
    tokenProvider = createMockTokenProvider();
    axiosInstance = createMockAxiosInstance();
  });

  it('converts AxiosError to ServiceError', async () => {
    const interceptor = createErrorInterceptor(axiosInstance, tokenProvider);
    const axiosError = createAxiosError(500);

    await expect(interceptor(axiosError)).rejects.toThrow(ServiceError);
  });

  it('preserves status and endpoint in ServiceError', async () => {
    const interceptor = createErrorInterceptor(axiosInstance, tokenProvider);
    const axiosError = createAxiosError(404);

    try {
      await interceptor(axiosError);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      const serviceError = error as ServiceError;
      expect(serviceError.status).toBe(404);
      expect(serviceError.endpoint).toBe('/api/test');
    }
  });

  it('rethrows non-AxiosError as-is', async () => {
    const interceptor = createErrorInterceptor(axiosInstance, tokenProvider);
    const genericError = new TypeError('Something broke');

    await expect(interceptor(genericError)).rejects.toThrow(TypeError);
    await expect(interceptor(genericError)).rejects.toThrow('Something broke');
  });

  // ─── 401 + auto refresh ────────────────────────────────

  describe('401 auto refresh', () => {
    it('refreshes token and retries on 401', async () => {
      const interceptor = createErrorInterceptor(axiosInstance, tokenProvider);
      const axiosError = createAxiosError(401);

      const result = await interceptor(axiosError);

      expect(vi.mocked(tokenProvider.refreshToken)).toHaveBeenCalledOnce();
      expect(vi.mocked(axiosInstance.request)).toHaveBeenCalledOnce();
      expect(result).toEqual({ data: 'retried-data' });
    });

    it('sets new token in retry config headers', async () => {
      const interceptor = createErrorInterceptor(axiosInstance, tokenProvider);
      const axiosError = createAxiosError(401);

      await interceptor(axiosError);

      const calls = vi.mocked(axiosInstance.request).mock.calls;
      expect(calls[0]).toBeDefined();
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected axiosInstance.request to have been called');
      const retryConfig = firstCall[0];
      const retryHeaders = retryConfig.headers as AxiosHeaders;
      expect(retryHeaders.get('Authorization')).toBe('Bearer refreshed-token');
    });

    it('throws ServiceError when refresh returns null', async () => {
      const noRefreshProvider = createMockTokenProvider(null);
      const interceptor = createErrorInterceptor(axiosInstance, noRefreshProvider);
      const axiosError = createAxiosError(401);

      await expect(interceptor(axiosError)).rejects.toThrow(ServiceError);
      expect(vi.mocked(noRefreshProvider.refreshToken)).toHaveBeenCalledOnce();
      expect(vi.mocked(axiosInstance.request)).not.toHaveBeenCalled();
    });

    it('throws ServiceError when refresh itself throws', async () => {
      const failingProvider = createMockTokenProvider();
      vi.mocked(failingProvider.refreshToken).mockRejectedValue(new Error('Refresh failed'));

      const interceptor = createErrorInterceptor(axiosInstance, failingProvider);
      const axiosError = createAxiosError(401);

      await expect(interceptor(axiosError)).rejects.toThrow(ServiceError);
      expect(vi.mocked(axiosInstance.request)).not.toHaveBeenCalled();
    });

    it('throws ServiceError when retry request fails', async () => {
      vi.mocked(axiosInstance.request).mockRejectedValue(createAxiosError(403));
      const interceptor = createErrorInterceptor(axiosInstance, tokenProvider);
      const axiosError = createAxiosError(401);

      await expect(interceptor(axiosError)).rejects.toThrow();
    });

    it('does not attempt refresh for non-401 errors', async () => {
      const interceptor = createErrorInterceptor(axiosInstance, tokenProvider);
      const axiosError = createAxiosError(403);

      await expect(interceptor(axiosError)).rejects.toThrow(ServiceError);
      expect(vi.mocked(tokenProvider.refreshToken)).not.toHaveBeenCalled();
      expect(vi.mocked(axiosInstance.request)).not.toHaveBeenCalled();
    });
  });
});
