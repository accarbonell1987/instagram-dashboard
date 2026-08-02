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
