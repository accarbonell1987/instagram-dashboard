import { describe, it, expect } from 'vitest';
import { QuotaExceededError } from './errors.js';
import { AppError } from './errors.js';

describe('QuotaExceededError', () => {
  it('extends AppError', () => {
    const error = new QuotaExceededError('deepseek_tokens', 100000, '2026-07-01T00:00:00.000Z');
    expect(error).toBeInstanceOf(AppError);
  });

  it('has statusCode 429', () => {
    const error = new QuotaExceededError('deepseek_tokens', 100000, '2026-07-01T00:00:00.000Z');
    expect(error.statusCode).toBe(429);
  });

  it('has code QUOTA_EXCEEDED', () => {
    const error = new QuotaExceededError('deepseek_tokens', 100000, '2026-07-01T00:00:00.000Z');
    expect(error.code).toBe('QUOTA_EXCEEDED');
  });

  it('includes resourceType, limit, and resetsAt in message', () => {
    const error = new QuotaExceededError('fal_images', 50, '2026-08-01T00:00:00.000Z');
    expect(error.message).toContain('fal_images');
    expect(error.message).toContain('50');
    expect(error.message).toContain('2026-08-01T00:00:00.000Z');
  });

  it('includes resourceType, used, limit, and resetsAt in details', () => {
    const error = new QuotaExceededError('chat_sessions', 30, '2026-09-01T00:00:00.000Z');
    expect(error.details).toEqual({
      resourceType: 'chat_sessions',
      used: 30,
      limit: 30,
      resetsAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('is distinguishable from other 429 errors (RateLimitError) by code', () => {
    const quotaError = new QuotaExceededError('deepseek_tokens', 5000, '2026-07-01T00:00:00.000Z');
    expect(quotaError.code).toBe('QUOTA_EXCEEDED');
    expect(quotaError.statusCode).toBe(429);
  });
});
