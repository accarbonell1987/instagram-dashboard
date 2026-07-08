import { describe, it, expect } from 'vitest'
import { withTenant, slugToSchemaName, SCHEMA_NAME_REGEX } from './with-tenant.js'
import { ValidationError, InternalError } from '../errors.js'

describe('withTenant — slug validation', () => {
  it('rejects slug shorter than 3 chars', async () => {
    const prisma = {} as Parameters<typeof withTenant>[0]
    await expect(withTenant(prisma, 'ab', async () => null)).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects slug with uppercase letters', async () => {
    const prisma = {} as Parameters<typeof withTenant>[0]
    await expect(withTenant(prisma, 'My-Slug', async () => null)).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects slug with semicolon (SQL injection attempt)', async () => {
    const prisma = {} as Parameters<typeof withTenant>[0]
    await expect(withTenant(prisma, 'abc;DROP', async () => null)).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects slug with single quote (SQL injection attempt)', async () => {
    const prisma = {} as Parameters<typeof withTenant>[0]
    await expect(withTenant(prisma, "abc'or", async () => null)).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects reserved slug "www"', async () => {
    const prisma = {} as Parameters<typeof withTenant>[0]
    await expect(withTenant(prisma, 'www', async () => null)).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects reserved slug "admin"', async () => {
    const prisma = {} as Parameters<typeof withTenant>[0]
    await expect(withTenant(prisma, 'admin', async () => null)).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects reserved slug "__system__"', async () => {
    const prisma = {} as Parameters<typeof withTenant>[0]
    await expect(withTenant(prisma, '__system__', async () => null)).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('slugToSchemaName', () => {
  it('converts hyphens to underscores and prepends tenant_', () => {
    expect(slugToSchemaName('my-tenant')).toBe('tenant_my_tenant')
  })

  it('handles slug with no hyphens', () => {
    expect(slugToSchemaName('acme')).toBe('tenant_acme')
  })

  it('handles multiple hyphens', () => {
    expect(slugToSchemaName('a-b-c')).toBe('tenant_a_b_c')
  })
})

describe('SCHEMA_NAME_REGEX', () => {
  it('accepts valid schema names', () => {
    expect(SCHEMA_NAME_REGEX.test('tenant_acme')).toBe(true)
    expect(SCHEMA_NAME_REGEX.test('tenant_my_company')).toBe(true)
    expect(SCHEMA_NAME_REGEX.test('tenant_abc123')).toBe(true)
  })

  it('rejects names without tenant_ prefix', () => {
    expect(SCHEMA_NAME_REGEX.test('public')).toBe(false)
    expect(SCHEMA_NAME_REGEX.test('acme')).toBe(false)
  })

  it('rejects names with uppercase', () => {
    expect(SCHEMA_NAME_REGEX.test('tenant_Acme')).toBe(false)
  })
})
