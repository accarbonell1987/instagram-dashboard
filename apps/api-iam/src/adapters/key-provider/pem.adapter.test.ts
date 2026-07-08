import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}))

vi.mock('jose', () => ({
  importPKCS8: vi.fn(),
  importSPKI: vi.fn(),
  exportJWK: vi.fn(),
}))

const minimalConfig = {
  JWT_PRIVATE_KEY_PATH: './keys/private.pem',
  JWT_PUBLIC_KEY_PATH: './keys/public.pem',
  JWT_ACTIVE_KID: 'key-2026-01',
  JWT_PREVIOUS_PUBLIC_KEY_PATH: undefined,
  JWT_PREVIOUS_KID: undefined,
}

describe('PemKeyProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('getSigningKey reads private key from configured path', async () => {
    const { readFileSync } = await import('node:fs')
    const { importPKCS8 } = await import('jose')
    const mockKey = { type: 'private' } as unknown as import('jose').KeyLike
    vi.mocked(readFileSync).mockReturnValue('-----BEGIN PRIVATE KEY-----\n...')
    vi.mocked(importPKCS8).mockResolvedValue(mockKey)

    const { PemKeyProvider } = await import('./pem.adapter.js')
    const provider = new PemKeyProvider(minimalConfig as never)
    const result = await provider.getSigningKey()

    expect(readFileSync).toHaveBeenCalledWith('./keys/private.pem', 'utf-8')
    expect(result.kid).toBe('key-2026-01')
    expect(result.privateKey).toBe(mockKey)
  })

  it('getSigningKey caches key on second call', async () => {
    const { readFileSync } = await import('node:fs')
    const { importPKCS8 } = await import('jose')
    const mockKey = { type: 'private' } as unknown as import('jose').KeyLike
    vi.mocked(readFileSync).mockReturnValue('-----BEGIN PRIVATE KEY-----\n...')
    vi.mocked(importPKCS8).mockResolvedValue(mockKey)

    const { PemKeyProvider } = await import('./pem.adapter.js')
    const provider = new PemKeyProvider(minimalConfig as never)
    await provider.getSigningKey()
    await provider.getSigningKey()

    expect(readFileSync).toHaveBeenCalledTimes(1)
    expect(importPKCS8).toHaveBeenCalledTimes(1)
  })

  it('getVerifyingKeys returns active key only when no previous key configured', async () => {
    const { readFileSync } = await import('node:fs')
    const { importSPKI } = await import('jose')
    const mockKey = { type: 'public' } as unknown as import('jose').KeyLike
    vi.mocked(readFileSync).mockReturnValue('-----BEGIN PUBLIC KEY-----\n...')
    vi.mocked(importSPKI).mockResolvedValue(mockKey)

    const { PemKeyProvider } = await import('./pem.adapter.js')
    const provider = new PemKeyProvider(minimalConfig as never)
    const keys = await provider.getVerifyingKeys()

    expect(keys).toHaveLength(1)
    expect(keys[0]!.kid).toBe('key-2026-01')
  })

  it('getVerifyingKeys returns both keys when previous key configured', async () => {
    const { readFileSync } = await import('node:fs')
    const { importSPKI } = await import('jose')
    const activeKey = { type: 'active' } as unknown as import('jose').KeyLike
    const prevKey = { type: 'previous' } as unknown as import('jose').KeyLike
    vi.mocked(readFileSync).mockReturnValueOnce('active pem').mockReturnValueOnce('prev pem')
    vi.mocked(importSPKI).mockResolvedValueOnce(activeKey).mockResolvedValueOnce(prevKey)

    const config = {
      ...minimalConfig,
      JWT_PREVIOUS_PUBLIC_KEY_PATH: './keys/old.pem',
      JWT_PREVIOUS_KID: 'key-2025-12',
    }
    const { PemKeyProvider } = await import('./pem.adapter.js')
    const provider = new PemKeyProvider(config as never)
    const keys = await provider.getVerifyingKeys()

    expect(keys).toHaveLength(2)
    expect(keys[0]!.kid).toBe('key-2026-01')
    expect(keys[1]!.kid).toBe('key-2025-12')
  })

  it('getJwks returns JWK array with use=sig, alg=RS256, kid', async () => {
    const { readFileSync } = await import('node:fs')
    const { importSPKI, exportJWK } = await import('jose')
    const mockKey = { type: 'public' } as unknown as import('jose').KeyLike
    vi.mocked(readFileSync).mockReturnValue('public pem')
    vi.mocked(importSPKI).mockResolvedValue(mockKey)
    vi.mocked(exportJWK).mockResolvedValue({ kty: 'RSA', n: 'abc', e: 'AQAB' })

    const { PemKeyProvider } = await import('./pem.adapter.js')
    const provider = new PemKeyProvider(minimalConfig as never)
    const jwks = await provider.getJwks()

    expect(jwks.keys).toHaveLength(1)
    expect(jwks.keys[0]!.use).toBe('sig')
    expect(jwks.keys[0]!.alg).toBe('RS256')
    expect(jwks.keys[0]!.kid).toBe('key-2026-01')
    expect(jwks.keys[0]!.kty).toBe('RSA')
  })
})
