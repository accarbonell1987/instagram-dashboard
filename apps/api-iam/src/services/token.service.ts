import { SignJWT, jwtVerify } from 'jose'
import { nanoid } from 'nanoid'
import type { KeyProvider } from '../adapters/index.js'
import type { Config } from '../config.js'
import type { OtpPurpose, UserRole } from '../domain/index.js'
import { GoneError, UnauthorizedError, ValidationError } from '../errors.js'

export type TokenServiceDeps = {
  keyProvider: KeyProvider
  config: Config
}

export type AccessTokenClaims = {
  sub: string
  tenant_id: string
  tenant_uuid: string
  tenant_slug: string
  role: UserRole
  jti: string
  kid: string
  user_status?: string | undefined
}

export type AccessTokenResult = {
  accessToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export type OtpVerificationTokenPayload = {
  sub: string
  purpose: OtpPurpose
  otpId: string
}

export function createTokenService(deps: TokenServiceDeps) {
  const { keyProvider, config } = deps

  async function signAccessToken(claims: {
    sub: string
    email: string
    name: string
    tenantId: string
    tenantUuid: string
    role: UserRole
    phone?: string | undefined
    user_status: string
  }): Promise<AccessTokenResult> {
    const { privateKey, kid } = await keyProvider.getSigningKey()
    const now = Math.floor(Date.now() / 1000)
    const accessToken = await new SignJWT({
      email: claims.email,
      name: claims.name,
      tenant_id: claims.tenantId,
      tenant_uuid: claims.tenantUuid,
      // tenant_slug is the same as tenant_id (both are the short slug).
      // Emitted explicitly so hub's buildSessionFromToken can read it
      // without falling back to tenant_id, enabling future divergence.
      tenant_slug: claims.tenantId,
      role: claims.role,
      user_status: claims.user_status,
      ...(claims.phone !== undefined ? { phone: claims.phone } : {}),
      jti: nanoid(),
      kid,
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setSubject(claims.sub)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(config.JWT_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + config.JWT_ACCESS_TOKEN_TTL_SECONDS)
      .sign(privateKey)

    return {
      accessToken,
      expiresIn: config.JWT_ACCESS_TOKEN_TTL_SECONDS,
      tokenType: 'Bearer',
    }
  }

  async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const keys = await keyProvider.getVerifyingKeys()
    let lastError: unknown

    for (const { publicKey } of keys) {
      try {
        const { payload } = await jwtVerify(token, publicKey, {
          issuer: config.JWT_ISSUER,
          audience: config.JWT_AUDIENCE,
        })
        return payload as unknown as AccessTokenClaims
      } catch (error) {
        lastError = error
      }
    }

    const err = lastError as { code?: string }
    if (err?.code === 'ERR_JWT_EXPIRED') {
      throw new UnauthorizedError('auth.token_expired')
    }
    throw new UnauthorizedError('auth.token_invalid')
  }

  function signRefreshTokenRaw(): string {
    return nanoid(64)
  }

  async function verifyOtpVerificationToken(
    token: string,
  ): Promise<OtpVerificationTokenPayload> {
    const keys = await keyProvider.getVerifyingKeys()
    let lastError: unknown

    for (const { publicKey } of keys) {
      try {
        const { payload } = await jwtVerify(token, publicKey, {
          audience: config.JWT_OTP_VERIFICATION_AUDIENCE,
        })
        return {
          sub: payload.sub as string,
          purpose: payload['purpose'] as OtpPurpose,
          otpId: payload['otpId'] as string,
        }
      } catch (error) {
        lastError = error
      }
    }

    const err = lastError as { code?: string }
    if (err?.code === 'ERR_JWT_EXPIRED') {
      throw new GoneError('auth.verification_token_expired')
    }
    throw new ValidationError('auth.verification_token_invalid')
  }

  async function getJwks() {
    return keyProvider.getJwks()
  }

  return {
    signAccessToken,
    verifyAccessToken,
    signRefreshTokenRaw,
    verifyOtpVerificationToken,
    getJwks,
  }
}

export type TokenService = ReturnType<typeof createTokenService>
