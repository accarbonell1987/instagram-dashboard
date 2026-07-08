import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { UnauthorizedError, ForbiddenError } from '../errors.js';
import { config } from '../config.js';

export interface TenantContext {
  userId: string;
  tenantId: string;       // UUID
  tenantSlug: string;     // slug
  role: string;
}

interface AccessTokenClaims extends JWTPayload {
  sub: string;
  tenant_id: string;
  tenant_uuid: string;
  tenant_slug?: string;
  role: string;
  user_status?: string;
  jti: string;
  kid: string;
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(`${config.IAM_JWKS_URL}/.well-known/jwks.json`));
  }
  return _jwks;
}

export async function verifyAccessToken(token: string): Promise<TenantContext> {
  try {
    const jwks = getJWKS();
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.IAM_JWT_ISSUER,
    });

    const claims = payload as unknown as AccessTokenClaims;

    return {
      userId: claims.sub,
      tenantId: claims.tenant_uuid,
      tenantSlug: claims.tenant_slug ?? claims.tenant_id,
      role: claims.role,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'JWTExpired') {
      throw new UnauthorizedError('Token has expired');
    }
    throw new UnauthorizedError('Invalid access token');
  }
}

export function requireTenantContext(ctx: TenantContext | null): TenantContext {
  if (!ctx) {
    throw new ForbiddenError('Tenant context is required for this operation');
  }
  return ctx;
}
