import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '../../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { createModuleRepository } from './module.repository.js'

// PR7 (b1.5, owner decision #1679/1): product-scoped entitlements
// (moduleId: null) — the resolver expansion and the null-moduleId grant
// path both need real-Postgres coverage (a null compound-unique member
// can't be meaningfully exercised against a mocked Prisma client). Own
// throwaway database (PR7_TEST_DATABASE_URL), gated/skipped when unset —
// never touches the shared dev DATABASE_URL / corehub_iam.
const connectionString = process.env['PR7_TEST_DATABASE_URL']

describe.skipIf(!connectionString)('ModuleRepository — product-scoped entitlements (integration, PR7/b1.5)', () => {
  let prisma: PrismaClient
  const productId = 'pr7-product'
  const moduleAId = 'pr7-mod-a'
  const moduleBId = 'pr7-mod-b'
  let tenantId: string

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString as string }) })

    await prisma.product.upsert({
      where: { id: productId },
      update: {},
      create: { id: productId, name: 'PR7 Product' },
    })
    await prisma.module.upsert({
      where: { id: moduleAId },
      update: { productId },
      create: { id: moduleAId, name: 'PR7 Module A', defaultUrl: '/pr7-a', productId },
    })
    await prisma.module.upsert({
      where: { id: moduleBId },
      update: { productId },
      create: { id: moduleBId, name: 'PR7 Module B', defaultUrl: '/pr7-b', productId },
    })
    await prisma.plan.upsert({
      where: { id: 'pr7-plan' },
      update: {},
      create: { id: 'pr7-plan', name: 'PR7 Plan', price: 0, currency: 'PYG', billingInterval: 'monthly', maxUsers: 5 },
    })
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'pr7-tenant' },
      update: {},
      create: {
        slug: 'pr7-tenant',
        name: 'PR7 Tenant',
        schemaName: 'tenant_pr7_tenant',
        planId: 'pr7-plan',
        status: 'active',
      },
    })
    tenantId = tenant.id
  })

  afterAll(async () => {
    await prisma.entitlement.deleteMany({ where: { productId } })
    await prisma.tenant.deleteMany({ where: { slug: 'pr7-tenant' } })
    await prisma.plan.deleteMany({ where: { id: 'pr7-plan' } })
    await prisma.module.deleteMany({ where: { productId } })
    await prisma.product.deleteMany({ where: { id: productId } })
    await prisma.$disconnect()
  })

  it('grantTrial with moduleId null creates a product-scoped trial entitlement (moduleId: null)', async () => {
    const repo = createModuleRepository(prisma)
    const expiresAt = new Date(Date.now() + 86_400_000)

    await repo.grantTrial(tenantId, productId, null, expiresAt, undefined, 'pr7 test')

    const entitlement = await prisma.entitlement.findFirst({
      where: { tenantId, productId, moduleId: null, source: 'trial' },
    })
    expect(entitlement).not.toBeNull()
    expect(entitlement?.kind).toBe('grant')
  })

  it('re-granting the same product-scoped trial renews it instead of duplicating the row', async () => {
    const repo = createModuleRepository(prisma)
    const expiresAt = new Date(Date.now() + 2 * 86_400_000)

    await repo.grantTrial(tenantId, productId, null, expiresAt)

    const rows = await prisma.entitlement.findMany({ where: { tenantId, productId, moduleId: null, source: 'trial' } })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.expiresAt?.getTime()).toBe(expiresAt.getTime())
  })

  it('resolver: the product-level grant enables every module of the product', async () => {
    const repo = createModuleRepository(prisma)

    const effective = await repo.resolveEffectiveModules(tenantId, productId)

    expect(effective.map((m) => m.id).sort()).toEqual([moduleAId, moduleBId])
    expect(effective.every((m) => m.source === 'trial')).toBe(true)
  })

  it('resolver: a module-level revoke still removes just that module (precedence)', async () => {
    await prisma.entitlement.create({
      data: { tenantId, productId, moduleId: moduleAId, source: 'admin', kind: 'revoke' },
    })

    const repo = createModuleRepository(prisma)
    const effective = await repo.resolveEffectiveModules(tenantId, productId)

    expect(effective.map((m) => m.id)).toEqual([moduleBId])

    await prisma.entitlement.deleteMany({ where: { tenantId, productId, moduleId: moduleAId, source: 'admin' } })
  })

  it('resolver: a product-level revoke removes every module of the product', async () => {
    await prisma.entitlement.create({
      data: { tenantId, productId, moduleId: null, source: 'admin', kind: 'revoke' },
    })

    const repo = createModuleRepository(prisma)
    const effective = await repo.resolveEffectiveModules(tenantId, productId)

    expect(effective).toEqual([])

    await prisma.entitlement.deleteMany({ where: { tenantId, productId, moduleId: null, source: 'admin' } })
  })
})
