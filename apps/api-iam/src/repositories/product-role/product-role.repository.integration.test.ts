import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '../../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { createProductRoleRepository } from './product-role.repository.js'
import { ConflictError } from '../../errors.js'

// c1 (7.2, PR8): the @@unique([productId, key]) constraint needs real
// Postgres coverage — a mocked P2002 rejection only proves the repository's
// catch branch, not that the DB actually enforces the constraint. Own
// throwaway database (PR8_TEST_DATABASE_URL), gated/skipped when unset —
// never touches the shared dev DATABASE_URL / corehub_iam.
const connectionString = process.env['PR8_TEST_DATABASE_URL']

describe.skipIf(!connectionString)('ProductRoleRepository (integration, PR8/c1)', () => {
  let prisma: PrismaClient
  const productId = 'pr8-product'
  let userId: string

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString as string }) })

    await prisma.product.upsert({
      where: { id: productId },
      update: {},
      create: { id: productId, name: 'PR8 Product' },
    })
    await prisma.plan.upsert({
      where: { id: 'pr8-plan' },
      update: {},
      create: { id: 'pr8-plan', name: 'PR8 Plan', price: 0, currency: 'PYG', billingInterval: 'monthly', maxUsers: 5 },
    })
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'pr8-tenant' },
      update: {},
      create: { slug: 'pr8-tenant', name: 'PR8 Tenant', schemaName: 'tenant_pr8_tenant', planId: 'pr8-plan', status: 'active' },
    })
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'pr8-user@example.com' } },
      update: {},
      create: { tenantId: tenant.id, email: 'pr8-user@example.com', role: 'User', status: 'active' },
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.userProductRole.deleteMany({ where: { userId } })
    await prisma.productRole.deleteMany({ where: { productId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.tenant.deleteMany({ where: { slug: 'pr8-tenant' } })
    await prisma.plan.deleteMany({ where: { id: 'pr8-plan' } })
    await prisma.product.deleteMany({ where: { id: productId } })
    await prisma.$disconnect()
  })

  it('creates a role and enforces the (productId, key) uniqueness constraint with a real 409', async () => {
    const repo = createProductRoleRepository(prisma)

    const role = await repo.create({ productId, key: 'analyst', name: 'Analyst' })
    expect(role.key).toBe('analyst')

    await expect(repo.create({ productId, key: 'analyst', name: 'Duplicate Analyst' })).rejects.toBeInstanceOf(ConflictError)
  })

  it('lists roles scoped to the product', async () => {
    const repo = createProductRoleRepository(prisma)

    const roles = await repo.findAllByProduct(productId)

    expect(roles.map((r) => r.key)).toEqual(['analyst'])
  })

  it('assigns and unassigns a role to a real user, round-tripping through listByUser', async () => {
    const repo = createProductRoleRepository(prisma)
    const [role] = await repo.findAllByProduct(productId)
    expect(role).toBeDefined()

    await repo.assignToUser(userId, role!.id)
    const assigned = await repo.listByUser(userId)
    expect(assigned.map((a) => a.productRoleId)).toEqual([role!.id])

    await repo.unassignFromUser(userId, role!.id)
    const afterUnassign = await repo.listByUser(userId)
    expect(afterUnassign).toEqual([])
  })
})
