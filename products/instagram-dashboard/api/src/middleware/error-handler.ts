import { EntitlementsLookupError } from '@core/entitlements';
import type { ErrorHandler } from 'hono';

import { AppError } from '../errors.js';

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
      error.statusCode as Parameters<typeof c.json>[1],
    );
  }

  // Mirrors the AppError branch above (always shows the real message,
  // regardless of NODE_ENV) — matches the InternalError behavior this
  // replaced when the module-access lookup moved into @core/entitlements.
  if (error instanceof EntitlementsLookupError) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      500,
    );
  }

  const isDevelopment = process.env['NODE_ENV'] !== 'production';
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        ...(isDevelopment && error instanceof Error
          ? { details: error.message }
          : {}),
      },
    },
    500,
  );
};
