import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { ZodError, z } from 'zod'
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from '../errors.js'
import { requestId } from './request-id.js'
import { createErrorHandler } from './error-handler.js'
import { silentLogger } from '../test-helpers/logger.js'

type JsonBody = Record<string, unknown>

function buildApp(routeHandler: (app: Hono) => void) {
  const app = new Hono()
  app.use('*', requestId)
  routeHandler(app)
  app.onError(createErrorHandler(silentLogger))
  return app
}

describe('createErrorHandler', () => {
  it('maps AppError to the correct HTTP status and problem+json body', async () => {
    const app = buildApp((a) => {
      a.get('/test', () => {
        throw new UnauthorizedError('auth.invalid_credentials')
      })
    })

    const response = await app.request('/test')
    expect(response.status).toBe(401)
    const body = (await response.json()) as JsonBody
    expect(body['status']).toBe(401)
    expect(body['code']).toBe('auth.invalid_credentials')
    expect(body['instance']).toBeTruthy()
  })

  it('maps AppError with field errors (ValidationError) to 422 with errors array', async () => {
    const app = buildApp((a) => {
      a.get('/test', () => {
        throw new ValidationError('validation.failed', 'Bad data', [
          { field: 'email', code: 'invalid_string', message: 'Invalid email' },
        ])
      })
    })

    const response = await app.request('/test')
    expect(response.status).toBe(422)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('validation.failed')
    expect(Array.isArray(body['errors'])).toBe(true)
    const errors = body['errors'] as Array<{ field: string }>
    expect(errors[0]?.field).toBe('email')
  })

  it('maps ZodError to 422 with errors array per field', async () => {
    const schema = z.object({ email: z.string().email() })
    let zodErr: ZodError | null = null
    try {
      schema.parse({ email: 'not-an-email' })
    } catch (err) {
      zodErr = err as ZodError
    }

    const app = buildApp((a) => {
      a.get('/test', () => {
        throw zodErr!
      })
    })

    const response = await app.request('/test')
    expect(response.status).toBe(422)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('validation.error')
    expect(Array.isArray(body['errors'])).toBe(true)
  })

  it('maps unknown errors to 500', async () => {
    const app = buildApp((a) => {
      a.get('/test', () => {
        throw new Error('Something exploded')
      })
    })

    const response = await app.request('/test')
    expect(response.status).toBe(500)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('internal.server_error')
  })

  it('maps NotFoundError (AppError subclass) to 404', async () => {
    const app = buildApp((a) => {
      a.get('/test', () => {
        throw new NotFoundError('resource.not_found')
      })
    })

    const response = await app.request('/test')
    expect(response.status).toBe(404)
    const body = (await response.json()) as JsonBody
    expect(body['status']).toBe(404)
  })

  it('sets Retry-After header and retryAfter in body for RateLimitError', async () => {
    const retryAfterSeconds = 120
    const app = buildApp((a) => {
      a.get('/test', () => {
        throw new RateLimitError('rate.limit_exceeded', retryAfterSeconds)
      })
    })

    const response = await app.request('/test')
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe(String(retryAfterSeconds))
    const body = (await response.json()) as JsonBody
    expect(body['retryAfter']).toBe(retryAfterSeconds)
  })
})
