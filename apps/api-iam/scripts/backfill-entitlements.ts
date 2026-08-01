// a2: idempotent backfill from the pre-entitlements model into Entitlement /
// TenantProductSubscription. See design "Backfill scope" (owner decision #6,
// apply-signoff #1672 — live-join interpretation):
//   1. TenantModuleOverride(enabled: true)  → Entitlement(source: override, kind: grant)
//   2. TenantModuleOverride(enabled: false) → Entitlement(source: override, kind: revoke) (a3, owner-confirmed #1675)
//   3. Tenant.planId                        → TenantProductSubscription
// Plan-derived access is NEVER materialized here — it stays a live join
// (TenantProductSubscription → Plan → PlanModule), resolved in a3.
import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { DEFAULT_PRODUCT_ID } from '../src/domain/index.js'

export type BackfillStats = {
  overridesMigrated: number
  revokesMigrated: number
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
  let revokesMigrated = 0

  for (const override of overrides) {
    // a3 (owner-confirmed #1675): a disabled override is now a negative
    // entitlement (kind: revoke) — it suppresses plan-derived access for
    // this (tenant, module) instead of being unrepresented.
    const kind = override.enabled ? 'grant' : 'revoke'

    await prisma.entitlement.upsert({
      where: {
        tenantId_productId_moduleId_source: {
          tenantId: override.tenantId,
          productId: DEFAULT_PRODUCT_ID,
          moduleId: override.moduleId,
          source: 'override',
        },
      },
      update: { kind, reason: override.reason, createdBy: override.createdBy },
      create: {
        tenantId: override.tenantId,
        productId: DEFAULT_PRODUCT_ID,
        moduleId: override.moduleId,
        source: 'override',
        kind,
        reason: override.reason,
        createdBy: override.createdBy,
      },
    })

    if (override.enabled) overridesMigrated++
    else revokesMigrated++
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

  return { overridesMigrated, revokesMigrated, subscriptionsMigrated }
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
