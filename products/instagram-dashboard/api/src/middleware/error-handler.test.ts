import { EntitlementsLookupError } from '@core/entitlements';
import { describe, it, expect, vi } from 'vitest';

import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  InstagramAPIError,
  AccountNotConnectedError,
  RateLimitError,
} from '../errors.js';

import { errorHandler } from './error-handler.js';

interface ErrorResponseBody {
  success: boolean;
  error: { code: string; message: string; details?: unknown };
}

interface JsonMock {
  (body: ErrorResponseBody, status?: number): unknown;
  mock: { calls: [ErrorResponseBody, number?][] };
}

function createMockContext() {
  return {
    json: vi.fn((body: ErrorResponseBody, status?: number) => ({
      body,
      status,
    })) as unknown as JsonMock,
    req: { method: 'GET', url: '/test' },
    res: {},
  };
}

// The mock context is structural; cast to the handler's Context param at the call site.
function runHandler(error: Error, c: ReturnType<typeof createMockContext>): void {
  void errorHandler(error, c as unknown as Parameters<typeof errorHandler>[1]);
}

// Reads the arguments of the first (or nth) c.json() call as a typed tuple.
function jsonCall(c: ReturnType<typeof createMockContext>, index = 0): [ErrorResponseBody, number?] {
  const calls = (c.json as unknown as JsonMock).mock.calls;
  return calls[index] ?? [{ success: false, error: { code: '', message: '' } }];
}

describe('errorHandler', () => {
  it('handles NotFoundError with 404 status', () => {
    const c = createMockContext();
    const error = new NotFoundError('User', '123');

    runHandler(error, c);

    const [body, status] = jsonCall(c);
    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe("User with id '123' not found");
  });

  it('handles ValidationError with 400 status', () => {
    const c = createMockContext();
    const error = new ValidationError('Invalid input');

    runHandler(error, c);

    const [body, status] = jsonCall(c);
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles UnauthorizedError with 401 status', () => {
    const c = createMockContext();
    const error = new UnauthorizedError('Missing token');

    runHandler(error, c);

    const [body, status] = jsonCall(c);
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('handles AccountNotConnectedError with 404 status', () => {
    const c = createMockContext();
    const error = new AccountNotConnectedError();

    runHandler(error, c);

    const [body, status] = jsonCall(c);
    expect(status).toBe(404);
    expect(body.error.code).toBe('ACCOUNT_NOT_CONNECTED');
  });

  it('handles InstagramAPIError with 502 status', () => {
    const c = createMockContext();
    const error = new InstagramAPIError('Graph API failed', {
      igError: 'OAuthException',
    });

    runHandler(error, c);

    const [body, status] = jsonCall(c);
    expect(status).toBe(502);
    expect(body.error.code).toBe('INSTAGRAM_API_ERROR');
    expect(body.error.message).toBe('Graph API failed');
  });

  it('handles RateLimitError with 429 status', () => {
    const c = createMockContext();
    const error = new RateLimitError(300);

    runHandler(error, c);

    const [body, status] = jsonCall(c);
    expect(status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('handles unknown errors with 500 status', () => {
    const c = createMockContext();
    const error = new Error('Something unexpected broke');

    runHandler(error, c);

    const [body, status] = jsonCall(c);
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  it('includes error details in development mode', () => {
    const c = createMockContext();
    const error = new ValidationError('Bad data', {
      field: 'email',
      issue: 'invalid format',
    });

    runHandler(error, c);

    const [body] = jsonCall(c);
    expect(body.error.details).toEqual({
      field: 'email',
      issue: 'invalid format',
    });
  });

  it('includes original error message in development mode for unknown errors', () => {
    const c = createMockContext();
    const error = new Error('Raw error details');

    runHandler(error, c);

    const [body] = jsonCall(c);
    // In test mode (NODE_ENV=test), details should be included since it's not "production"
    expect(body.error.details).toBe('Raw error details');
  });

  it('does not include error details for unknown errors in production', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const c = createMockContext();
    const error = new Error('Sensitive internal details');

    runHandler(error, c);

    const [body] = jsonCall(c);
    expect(body.error.details).toBeUndefined();
    expect(body.error.message).toBe('An unexpected error occurred');

    process.env['NODE_ENV'] = originalEnv;
  });

  it('handles EntitlementsLookupError with 500 status and the real message, regardless of NODE_ENV', () => {
    const c = createMockContext();
    const error = new EntitlementsLookupError('iam entitlements lookup failed: 500');

    runHandler(error, c);

    const [body, status] = jsonCall(c);
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('iam entitlements lookup failed: 500');
  });

  it('omits details field when error has no details', () => {
    const c = createMockContext();
    const error = new NotFoundError('Media', 'abc');

    runHandler(error, c);

    const [body] = jsonCall(c);
    expect(body.error.details).toBeUndefined();
  });
});
