import type { UserRole } from '../domain/index.js'
import type { Logger } from '../lib/logger.js'

export interface AuthUser {
  sub: string
  tenantId: string
  tenantUuid: string
  role: UserRole
  status: string
  jti: string
  kid: string
}

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string
    user: AuthUser
    rawBody: string
    idempotencyReset: boolean
    logger: Logger
  }
}
