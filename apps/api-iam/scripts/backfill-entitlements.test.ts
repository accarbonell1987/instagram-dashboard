import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { createModuleRepository } from '../src/repositories/module/module.repository.js'
import { DEFAULT_PRODUCT_ID } from '../src/domain/index.js'
import { backfillEntitlements } from './backfill-entitlements.js'

// Integration test against a real (throwaway) Postgres — see .claude/apply
// instructions: the "effective access unchanged" assertion (spec "Backfill
// preserves access") must be real, not stubbed away. Uses a dedicated env
// var (not DATABASE_URL, which .env points at the shared dev DB) so this
// suite only runs, and only ever touches a disposable database, when
// explicitly opted into; it is skipped otherwise.
const connectionString = process.env['BACKFILL_TEST_DATABASE_URL']

describe.skipIf(!connectionString)('backfillEntitlements (integration)', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString as string }) })

    await prisma.plan.upsert({
      where: { id: 'backfill-plan' },
      update: {},
      create: {
        id: 'backfill-plan',
        name: 'Backfill Plan',
        price: 0,
        currency: 'PYG',
        billingInterval: 'monthly',
        maxUsers: 5,
      },
    })

    await prisma.module.upsert({
      where: { id: 'backfill-module' },
      update: {},
      create: { id: 'backfill-module', name: 'Backfill Module', defaultUrl: '/backfill' },
    })

    await prisma.planModule.upsert({
      where: { planId_moduleId: { planId: 'backfill-plan', moduleId: 'backfill-module' } },
      update: {},
      create: { planId: 'backfill-plan', moduleId: 'backfill-module' },
    })

    await prisma.tenant.upsert({
      where: { slug: 'backfill-tenant' },
      update: { planId: 'backfill-plan' },
      create: {
        slug: 'backfill-tenant',
        name: 'Backfill Tenant',
        schemaName: 'tenant_backfill_tenant',
        planId: 'backfill-plan',
        status: 'active',
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('migrates enabled TenantModuleOverride rows into Entitlement(source: override)', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'backfill-tenant' } })
    await prisma.tenantModuleOverride.upsert({
      where: { tenantId_moduleId: { tenantId: tenant.id, moduleId: 'backfill-module' } },
      update: { enabled: true },
      create: { tenantId: tenant.id, moduleId: 'backfill-module', enabled: true },
    })

    const stats = await backfillEntitlements(prisma)
    expect(stats.overridesMigrated).toBeGreaterThanOrEqual(1)

    const entitlement = await prisma.entitlement.findUnique({
      where: {
        tenantId_productId_moduleId_source: {
          tenantId: tenant.id,
          productId: DEFAULT_PRODUCT_ID,
          moduleId: 'backfill-module',
          source: 'override',
        },
      },
    })
    expect(entitlement).not.toBeNull()
  })

  it('migrates Tenant.planId into a TenantProductSubscription row', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'backfill-tenant' } })

    await backfillEntitlements(prisma)

    const subscription = await prisma.tenantProductSubscription.findUnique({
      where: { tenantId_productId: { tenantId: tenant.id, productId: DEFAULT_PRODUCT_ID } },
    })
    expect(subscription).not.toBeNull()
    expect(subscription?.planId).toBe('backfill-plan')
  })

  it('is idempotent — running twice does not duplicate rows', async () => {
    await backfillEntitlements(prisma)
    const entitlementsBefore = await prisma.entitlement.count()
    const subscriptionsBefore = await prisma.tenantProductSubscription.count()

    await backfillEntitlements(prisma)

    expect(await prisma.entitlement.count()).toBe(entitlementsBefore)
    expect(await prisma.tenantProductSubscription.count()).toBe(subscriptionsBefore)
  })

  it('preserves effective module access before and after backfill (spec: Backfill preserves access)', async () => {
    const moduleRepo = createModuleRepository(prisma)
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'backfill-tenant' } })

    const before = await moduleRepo.findEffectiveForTenant(tenant.planId, tenant.id)

    await backfillEntitlements(prisma)

    const after = await moduleRepo.findEffectiveForTenant(tenant.planId, tenant.id)

    expect(after).toEqual(before)
  })
})
