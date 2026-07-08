import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from './error-handler.js';
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  InstagramAPIError,
  AccountNotConnectedError,
  RateLimitError,
} from '../errors.js';

function createMockContext() {
  return {
    json: vi.fn((body: Record<string, unknown>, status?: number) => ({
      body,
      status,
    })),
    req: { method: 'GET', url: '/test' },
    res: {},
  } as any;
}

describe('errorHandler', () => {
  it('handles NotFoundError with 404 status', () => {
    const c = createMockContext();
    const error = new NotFoundError('User', '123');

    errorHandler(error, c);

    const [[body, status]] = c.json.mock.calls;
    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe("User with id '123' not found");
  });

  it('handles ValidationError with 400 status', () => {
    const c = createMockContext();
    const error = new ValidationError('Invalid input');

    errorHandler(error, c);

    const [[body, status]] = c.json.mock.calls;
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles UnauthorizedError with 401 status', () => {
    const c = createMockContext();
    const error = new UnauthorizedError('Missing token');

    errorHandler(error, c);

    const [[body, status]] = c.json.mock.calls;
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('handles AccountNotConnectedError with 404 status', () => {
    const c = createMockContext();
    const error = new AccountNotConnectedError();

    errorHandler(error, c);

    const [[body, status]] = c.json.mock.calls;
    expect(status).toBe(404);
    expect(body.error.code).toBe('ACCOUNT_NOT_CONNECTED');
  });

  it('handles InstagramAPIError with 502 status', () => {
    const c = createMockContext();
    const error = new InstagramAPIError('Graph API failed', {
      igError: 'OAuthException',
    });

    errorHandler(error, c);

    const [[body, status]] = c.json.mock.calls;
    expect(status).toBe(502);
    expect(body.error.code).toBe('INSTAGRAM_API_ERROR');
    expect(body.error.message).toBe('Graph API failed');
  });

  it('handles RateLimitError with 429 status', () => {
    const c = createMockContext();
    const error = new RateLimitError(300);

    errorHandler(error, c);

    const [[body, status]] = c.json.mock.calls;
    expect(status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('handles unknown errors with 500 status', () => {
    const c = createMockContext();
    const error = new Error('Something unexpected broke');

    errorHandler(error, c);

    const [[body, status]] = c.json.mock.calls;
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

    errorHandler(error, c);

    const [[body]] = c.json.mock.calls;
    expect(body.error.details).toEqual({
      field: 'email',
      issue: 'invalid format',
    });
  });

  it('includes original error message in development mode for unknown errors', () => {
    const c = createMockContext();
    const error = new Error('Raw error details');

    errorHandler(error, c);

    const [[body]] = c.json.mock.calls;
    // In test mode (NODE_ENV=test), details should be included since it's not "production"
    expect(body.error.details).toBe('Raw error details');
  });

  it('does not include error details for unknown errors in production', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const c = createMockContext();
    const error = new Error('Sensitive internal details');

    errorHandler(error, c);

    const [[body]] = c.json.mock.calls;
    expect(body.error.details).toBeUndefined();
    expect(body.error.message).toBe('An unexpected error occurred');

    process.env['NODE_ENV'] = originalEnv;
  });

  it('omits details field when error has no details', () => {
    const c = createMockContext();
    const error = new NotFoundError('Media', 'abc');

    errorHandler(error, c);

    const [[body]] = c.json.mock.calls;
    expect(body.error.details).toBeUndefined();
  });
});
