import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ITokenProvider } from '../../auth/types';

import { createAuthInterceptor } from './authInterceptor';

function createMockTokenProvider(accessToken: string | null = 'test-token'): ITokenProvider {
  return {
    getAccessToken: vi.fn().mockResolvedValue(accessToken),
    refreshToken: vi.fn().mockResolvedValue(null),
    isExpired: vi.fn().mockReturnValue(false),
    clear: vi.fn(),
  };
}

function createMockConfig(): InternalAxiosRequestConfig {
  return {
    headers: new AxiosHeaders(),
    url: '/test',
    method: 'get',
  } as InternalAxiosRequestConfig;
}

describe('authInterceptor', () => {
  let tokenProvider: ITokenProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    tokenProvider = createMockTokenProvider();
  });

  it('adds Authorization header when token is available', async () => {
    const interceptor = createAuthInterceptor(tokenProvider);
    const config = createMockConfig();

    const result = await interceptor(config);

    expect(result.headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('does not add Authorization header when token is null', async () => {
    const noTokenProvider = createMockTokenProvider(null);
    const interceptor = createAuthInterceptor(noTokenProvider);
    const config = createMockConfig();

    const result = await interceptor(config);

    expect(result.headers.has('Authorization')).toBe(false);
  });

  it('calls getAccessToken on each request', async () => {
    const interceptor = createAuthInterceptor(tokenProvider);

    await interceptor(createMockConfig());
    await interceptor(createMockConfig());

    expect(vi.mocked(tokenProvider.getAccessToken)).toHaveBeenCalledTimes(2);
  });

  it('preserves existing config properties', async () => {
    const interceptor = createAuthInterceptor(tokenProvider);
    const config = createMockConfig();
    config.url = '/api/users';
    config.method = 'post';
    config.headers.set('Content-Type', 'application/json');

    const result = await interceptor(config);

    expect(result.url).toBe('/api/users');
    expect(result.method).toBe('post');
    expect(result.headers.get('Content-Type')).toBe('application/json');
    expect(result.headers.get('Authorization')).toBe('Bearer test-token');
  });
});
