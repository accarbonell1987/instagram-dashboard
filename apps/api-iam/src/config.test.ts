import { describe, it, expect } from 'vitest'
import { parseConfig } from './config.js'

const minimalValid = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_PRIVATE_KEY_PATH: './keys/private.pem',
  JWT_PUBLIC_KEY_PATH: './keys/public.pem',
  JWT_ACTIVE_KID: 'key-2026-01',
  BANCARD_WEBHOOK_SECRET: 'dev-webhook-secret-long-enough',
}

describe('parseConfig', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseConfig({})).toThrow('Configuration validation failed')
  })

  it('throws when BANCARD_WEBHOOK_SECRET is missing', () => {
    const { BANCARD_WEBHOOK_SECRET: _omitted, ...rest } = minimalValid
    expect(() => parseConfig(rest)).toThrow('Configuration validation failed')
  })

  it('returns frozen object with defaults when minimal valid env provided', () => {
    const config = parseConfig(minimalValid)
    expect(Object.isFrozen(config)).toBe(true)
    expect(config.PORT).toBe(8080)
    expect(config.NODE_ENV).toBe('development')
    expect(config.JWT_ISSUER).toBe('https://iam.corehub.com')
    expect(config.PDF_PROVIDER).toBe('stub')
    expect(config.STORAGE_PROVIDER).toBe('stub')
  })

  it('splits CORS_ALLOWED_ORIGINS on comma', () => {
    const config = parseConfig({
      ...minimalValid,
      CORS_ALLOWED_ORIGINS: 'http://localhost:3001,http://localhost:3002',
    })
    expect(config.CORS_ALLOWED_ORIGINS).toEqual([
      'http://localhost:3001',
      'http://localhost:3002',
    ])
  })

  it('trims whitespace in CORS_ALLOWED_ORIGINS entries', () => {
    const config = parseConfig({
      ...minimalValid,
      CORS_ALLOWED_ORIGINS: 'http://a.com , http://b.com',
    })
    expect(config.CORS_ALLOWED_ORIGINS).toEqual(['http://a.com', 'http://b.com'])
  })

  it('throws when OTP_EMAIL_PROVIDER=resend but RESEND_API_KEY missing', () => {
    expect(() =>
      parseConfig({ ...minimalValid, OTP_EMAIL_PROVIDER: 'resend' })
    ).toThrow('Configuration validation failed')
  })

  it('throws when JWT_PREVIOUS_PUBLIC_KEY_PATH set but JWT_PREVIOUS_KID missing', () => {
    expect(() =>
      parseConfig({ ...minimalValid, JWT_PREVIOUS_PUBLIC_KEY_PATH: './keys/old.pem' })
    ).toThrow('Configuration validation failed')
  })

  it('accepts JWT_PREVIOUS_PUBLIC_KEY_PATH when JWT_PREVIOUS_KID provided', () => {
    const config = parseConfig({
      ...minimalValid,
      JWT_PREVIOUS_PUBLIC_KEY_PATH: './keys/old.pem',
      JWT_PREVIOUS_KID: 'key-2025-12',
    })
    expect(config.JWT_PREVIOUS_KID).toBe('key-2025-12')
  })

  it('coerces PORT from string to number', () => {
    const config = parseConfig({ ...minimalValid, PORT: '9000' })
    expect(config.PORT).toBe(9000)
  })
})
