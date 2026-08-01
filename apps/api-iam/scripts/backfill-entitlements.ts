// a2: idempotent backfill from the pre-entitlements model into Entitlement /
// TenantProductSubscription. See design "Backfill scope" (owner decision #6,
// apply-signoff #1672 — live-join interpretation):
//   1. TenantModuleOverride(enabled: true) → Entitlement(source: override)
//   2. Tenant.planId                       → TenantProductSubscription
// Plan-derived access is NEVER materialized here — it stays a live join
// (TenantProductSubscription → Plan → PlanModule), resolved in a3.
import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { DEFAULT_PRODUCT_ID } from '../src/domain/index.js'

export type BackfillStats = {
  overridesMigrated: number
  overridesSkipped: number
  subscriptionsMigrated: number
}

export async function backfillEntitlements(prisma: PrismaClient): Promise<BackfillStats> {
  // Bootstrap the only Product today (design "Backfill scope" pins this id) —
  // Entitlement/TenantProductSubscription both FK to Product.
  await prisma.product.upsert({
    where: { id: DEFAULT_PRODUCT_ID },
    update: {},
    create: { id: DEFAULT_PRODUCT_ID, name: 'Instagram Dashboard' },
  })

  const overrides = await prisma.tenantModuleOverride.findMany()
  let overridesMigrated = 0
  let overridesSkipped = 0

  for (const override of overrides) {
    // Entitlement is grant-only (presence = access); a disabled override
    // suppresses access instead of granting it and has no Entitlement shape
    // — leave it represented by TenantModuleOverride alone.
    if (!override.enabled) {
      overridesSkipped++
      continue
    }

    await prisma.entitlement.upsert({
      where: {
        tenantId_productId_moduleId_source: {
          tenantId: override.tenantId,
          productId: DEFAULT_PRODUCT_ID,
          moduleId: override.moduleId,
          source: 'override',
        },
      },
      update: { reason: override.reason, createdBy: override.createdBy },
      create: {
        tenantId: override.tenantId,
        productId: DEFAULT_PRODUCT_ID,
        moduleId: override.moduleId,
        source: 'override',
        reason: override.reason,
        createdBy: override.createdBy,
      },
    })
    overridesMigrated++
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true, planId: true } })
  let subscriptionsMigrated = 0

  for (const tenant of tenants) {
    await prisma.tenantProductSubscription.upsert({
      where: { tenantId_productId: { tenantId: tenant.id, productId: DEFAULT_PRODUCT_ID } },
      update: { planId: tenant.planId },
      create: { tenantId: tenant.id, productId: DEFAULT_PRODUCT_ID, planId: tenant.planId },
    })
    subscriptionsMigrated++
  }

  return { overridesMigrated, overridesSkipped, subscriptionsMigrated }
}

async function main() {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) throw new Error('DATABASE_URL is required')

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  const stats = await backfillEntitlements(prisma)
  console.log('Backfill complete:', stats)
  await prisma.$disconnect()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
}
