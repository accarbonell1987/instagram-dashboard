import { describe, it, expect } from 'vitest'
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  GoneError,
  ValidationError,
  RateLimitError,
  InternalError,
  toProblemDetails,
} from './errors.js'

describe('AppError subclasses — status codes', () => {
  it('UnauthorizedError has status 401', () => {
    expect(new UnauthorizedError('auth.invalid').status).toBe(401)
  })

  it('ForbiddenError has status 403', () => {
    expect(new ForbiddenError('auth.forbidden').status).toBe(403)
  })

  it('NotFoundError has status 404', () => {
    expect(new NotFoundError('resource.not_found').status).toBe(404)
  })

  it('ConflictError has status 409', () => {
    expect(new ConflictError('resource.conflict').status).toBe(409)
  })

  it('GoneError has status 410', () => {
    expect(new GoneError('resource.gone').status).toBe(410)
  })

  it('ValidationError has status 422', () => {
    expect(new ValidationError('validation.failed').status).toBe(422)
  })

  it('RateLimitError has status 429', () => {
    expect(new RateLimitError('rate.exceeded', 30).status).toBe(429)
  })

  it('InternalError has status 500', () => {
    expect(new InternalError('internal.unknown').status).toBe(500)
  })
})

describe('toProblemDetails', () => {
  it('produces correct type URI and instance', () => {
    const error = new UnauthorizedError('auth.invalid_credentials', 'Bad credentials')
    const pd = toProblemDetails(error, 'req-1')
    expect(pd.type).toBe('https://corehub.com/errors/auth/invalid_credentials')
    expect(pd.instance).toBe('req-1')
    expect(pd.status).toBe(401)
    expect(pd.title).toBe('No autorizado')
    expect(pd.detail).toBe('Bad credentials')
    expect(pd.code).toBe('auth.invalid_credentials')
  })

  it('RateLimitError spreads retryAfter into top-level', () => {
    const error = new RateLimitError('rate.otp', 60, 'Too many attempts')
    const pd = toProblemDetails(error, 'req-2')
    expect(pd['retryAfter']).toBe(60)
  })

  it('ValidationError includes errors array', () => {
    const errors = [{ field: 'email', code: 'invalid_format', message: 'Not a valid email' }]
    const error = new ValidationError('validation.failed', 'Invalid input', errors)
    const pd = toProblemDetails(error, 'req-3')
    expect((pd as unknown as { errors: unknown[] }).errors).toEqual(errors)
  })

  it('error without detail omits detail field', () => {
    const error = new NotFoundError('resource.not_found')
    const pd = toProblemDetails(error, 'req-4')
    expect('detail' in pd).toBe(false)
  })
})
