import { ServiceError } from '@core/core/errors';
import { describe, expect, it } from 'vitest';


import { ApiError, AuthError, RateLimitError, ValidationError } from './errors';

describe('ApiError', () => {
  it('extends ServiceError', () => {
    const error = new ApiError('Something went wrong', 500, null, '/api/test');
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('exposes problem and traceId', () => {
    const problem = { type: 'about:blank', title: 'Internal Server Error', status: 500 };
    const error = new ApiError(
      'Something went wrong',
      500,
      null,
      '/api/test',
      undefined,
      problem,
      'trace-abc'
    );
    expect(error.problem).toEqual(problem);
    expect(error.traceId).toBe('trace-abc');
  });
});

describe('ValidationError', () => {
  it('extends ApiError and ServiceError', () => {
    const error = new ValidationError('Validation failed', '/api/test', []);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('carries errors array', () => {
    const validationErrors = [
      { field: 'email', code: 'invalid_format', message: 'Must be a valid email' },
      { field: 'name', code: 'required', message: 'Required' },
    ];
    const error = new ValidationError('Validation failed', '/api/test', validationErrors);
    expect(error.errors).toEqual(validationErrors);
    expect(error.status).toBe(422);
  });

  it('has isUnprocessable = true', () => {
    const error = new ValidationError('Validation failed', '/api/test', []);
    expect(error.isUnprocessable).toBe(true);
  });
});

describe('RateLimitError', () => {
  it('extends ApiError and ServiceError', () => {
    const error = new RateLimitError('Rate limited', '/api/test', 60);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toBeInstanceOf(RateLimitError);
  });

  it('parses numeric Retry-After header (seconds)', () => {
    const error = RateLimitError.fromRetryAfterHeader('Too many requests', '/api/test', '60');
    expect(error.retryAfterSeconds).toBe(60);
  });

  it('parses HTTP-date Retry-After header', () => {
    const futureDate = new Date(Date.now() + 90_000);
    const error = RateLimitError.fromRetryAfterHeader(
      'Too many requests',
      '/api/test',
      futureDate.toUTCString()
    );
    expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(89);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(91);
  });

  it('has status 429', () => {
    const error = new RateLimitError('Rate limited', '/api/test', 30);
    expect(error.status).toBe(429);
  });
});

describe('AuthError', () => {
  it('extends ApiError and ServiceError', () => {
    const error = new AuthError('Unauthorized', '/api/auth/login', 'invalid_credentials');
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toBeInstanceOf(AuthError);
  });

  it('has status 401', () => {
    const error = new AuthError('Unauthorized', '/api/auth/login', 'invalid_credentials');
    expect(error.status).toBe(401);
    expect(error.isUnauthorized).toBe(true);
  });

  it('discriminates reason correctly', () => {
    const reasons = [
      'invalid_credentials',
      'account_locked',
      'session_expired',
      'tenant_mismatch',
    ] as const;
    for (const reason of reasons) {
      const error = new AuthError('Auth failed', '/api/auth/login', reason);
      expect(error.reason).toBe(reason);
    }
  });
});
