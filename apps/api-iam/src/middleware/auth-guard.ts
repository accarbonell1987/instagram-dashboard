import { createMiddleware } from 'hono/factory'
import type { TokenService } from '../services/token.service.js'
import { UnauthorizedError } from '../errors.js'

export function createAuthGuard(tokenService: TokenService) {
  return createMiddleware(async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('auth.unauthorized')
    }
    const token = authHeader.slice(7)
    const claims = await tokenService.verifyAccessToken(token)
    c.set('user', {
      sub: claims.sub,
      tenantId: claims.tenant_id,
      tenantUuid: claims.tenant_uuid,
      role: claims.role,
      status: claims.user_status ?? 'active',
      jti: claims.jti,
      kid: claims.kid,
    })
    await next()
  })
}
