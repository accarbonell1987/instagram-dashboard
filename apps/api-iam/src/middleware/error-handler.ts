import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import {
  AppError,
  InternalError,
  RateLimitError,
  ValidationError,
  toProblemDetails,
} from '../errors.js'
import type { Logger } from '../lib/logger.js'

export function createErrorHandler(logger: Logger) {
  return (err: Error, c: Context) => {
    const requestId = c.var.requestId ?? 'unknown'

    if (err instanceof AppError) {
      const body = toProblemDetails(err, requestId)

      // Add Retry-After header for rate-limit errors (Bug 4)
      if (err instanceof RateLimitError) {
        const retryAfter = (err.meta?.['retryAfter'] as number | undefined) ?? 60
        c.header('Retry-After', String(retryAfter))
      }

      return c.json(body, err.status as ContentfulStatusCode)
    }

    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        code: e.code,
        message: e.message,
      }))
      const validationError = new ValidationError('validation.error', 'Validation failed', errors)
      const body = toProblemDetails(validationError, requestId)
      return c.json({ ...body, errors }, 422 as ContentfulStatusCode)
    }

    logger.error(
      {
        category: 'system',
        event: 'unhandled_error',
        err,
        requestId: c.var.requestId,
      },
      'unhandled_error',
    )
    const internalError = new InternalError('internal.server_error', err.message)
    const body = toProblemDetails(internalError, requestId)
    return c.json(body, 500 as ContentfulStatusCode)
  }
}
