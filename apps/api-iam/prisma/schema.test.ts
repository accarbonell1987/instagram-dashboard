import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const schemaPath = fileURLToPath(new URL('./schema.prisma', import.meta.url))
const schema = readFileSync(schemaPath, 'utf-8')

describe('schema.prisma — platform-productization PR1 (a1 + c1 schema)', () => {
  it('defines the EntitlementSource enum with plan|override|trial|admin', () => {
    const enumMatch = schema.match(/enum EntitlementSource \{([\s\S]*?)\}/)
    expect(enumMatch).not.toBeNull()
    const body = enumMatch![1]
    expect(body).toMatch(/\bplan\b/)
    expect(body).toMatch(/\boverride\b/)
    expect(body).toMatch(/\btrial\b/)
    expect(body).toMatch(/\badmin\b/)
  })

  it('defines Product as a top-level entity', () => {
    expect(schema).toMatch(/model Product \{/)
    expect(schema).toMatch(/@@map\("products"\)/)
  })

  it('keys Plan to Product (nullable, additive-migration friendly)', () => {
    const planMatch = schema.match(/model Plan \{([\s\S]*?)\n\}/)
    expect(planMatch).not.toBeNull()
    expect(planMatch![1]).toMatch(/productId\s+String\?\s+@map\("product_id"\)/)
  })

  it('keys Module to Product (nullable, additive-migration friendly)', () => {
    const moduleMatch = schema.match(/model Module \{([\s\S]*?)\n\}/)
    expect(moduleMatch).not.toBeNull()
    expect(moduleMatch![1]).toMatch(/productId\s+String\?\s+@map\("product_id"\)/)
  })

  it('defines TenantProductSubscription as the billing-boundary anchor', () => {
    const match = schema.match(/model TenantProductSubscription \{([\s\S]*?)\n\}/)
    expect(match).not.toBeNull()
    const body = match![1]
    expect(body).toMatch(/tenantId\s+String/)
    expect(body).toMatch(/productId\s+String/)
    expect(body).toMatch(/planId\s+String/)
    expect(schema).toMatch(/@@unique\(\[tenantId, productId\]\)\s*\n\s*@@map\("tenant_product_subscriptions"\)/)
  })

  it('defines Entitlement with source, nullable expiresAt, and tenant+product+module keys', () => {
    const match = schema.match(/model Entitlement \{([\s\S]*?)\n\}/)
    expect(match).not.toBeNull()
    const body = match![1]
    expect(body).toMatch(/tenantId\s+String/)
    expect(body).toMatch(/productId\s+String/)
    expect(body).toMatch(/moduleId\s+String\?/)
    expect(body).toMatch(/source\s+EntitlementSource/)
    expect(body).toMatch(/expiresAt\s+DateTime\?/)
    expect(schema).toMatch(/@@unique\(\[tenantId, productId, moduleId, source\]\)/)
  })

  it('never materializes plan-derived entitlements — Entitlement has no "plan" join fields beyond productId', () => {
    // Guards owner decision: plan-derived access is resolved live via
    // TenantProductSubscription → Plan → PlanModule, not stored as Entitlement rows.
    const match = schema.match(/model Entitlement \{([\s\S]*?)\n\}/)
    expect(match![1]).not.toMatch(/planId/)
  })

  it('defines ProductRole and UserProductRole with uniqueness on [productId, key]', () => {
    expect(schema).toMatch(/model ProductRole \{/)
    expect(schema).toMatch(/@@unique\(\[productId, key\]\)/)
    expect(schema).toMatch(/model UserProductRole \{/)
    expect(schema).toMatch(/@@id\(\[userId, productRoleId\]\)/)
  })
})
