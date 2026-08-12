import type { PrismaClient } from '../../generated/prisma/client.js'
import type { ProductRole, UserProductRole } from '../../domain/index.js'
import { ConflictError } from '../../errors.js'

/**
 * A role plus how many modules it actually opens. Zero is the dangerous case:
 * assigning such a role to someone takes the product away from them, because
 * the resolver intersects the plan's modules with the role's. The count is
 * what lets a screen warn about that before it happens.
 */
export type ProductRoleWithModuleCount = ProductRole & { moduleCount: number }

export type ProductRoleRepository = {
  findAllByProduct(productId: string): Promise<ProductRole[]>
  findAllByProducts(productIds: string[]): Promise<ProductRoleWithModuleCount[]>
  findById(id: string): Promise<ProductRole | null>
  create(data: { productId: string; key: string; name: string }): Promise<ProductRole>
  update(id: string, data: Partial<{ name: string }>): Promise<ProductRole>
  delete(id: string): Promise<void>
  assignToUser(userId: string, productRoleId: string, assignedBy?: string): Promise<UserProductRole>
  unassignFromUser(userId: string, productRoleId: string): Promise<void>
  listByUser(userId: string): Promise<UserProductRole[]>
  // The team screen shows every member's access at once. One query for the
  // whole list, not one per row.
  listRolesByUsers(userIds: string[]): Promise<{ userId: string; role: ProductRole }[]>
  // Replaces a user's roles across the given products in one transaction, and
  // touches nothing outside them — a tenant may only rewrite the access it
  // administers.
  replaceUserRoles(
    userId: string,
    withinProductIds: string[],
    productRoleIds: string[],
    assignedBy?: string,
  ): Promise<void>
  // c2 (8.1, PR9): (productId, roleKey) pairs for the JWT `product_roles`
  // claim — productId doubles as the product key (Product.id is the slug).
  listRoleKeysByUser(userId: string): Promise<{ productId: string; roleKey: string }[]>
  getRoleModules(roleId: string): Promise<string[]>
  setRoleModules(roleId: string, moduleIds: string[]): Promise<void>
}

export function createProductRoleRepository(prisma: PrismaClient): ProductRoleRepository {
  return {
    async findAllByProduct(productId) {
      const rows = await prisma.productRole.findMany({ where: { productId }, orderBy: { key: 'asc' } })
      return rows.map(toProductRole)
    },

    async findAllByProducts(productIds) {
      if (productIds.length === 0) return []
      const rows = await prisma.productRole.findMany({
        where: { productId: { in: productIds } },
        orderBy: [{ productId: 'asc' }, { key: 'asc' }],
        include: { _count: { select: { moduleAccess: true } } },
      })
      return rows.map((row) => ({ ...toProductRole(row), moduleCount: row._count.moduleAccess }))
    },

    async findById(id) {
      const row = await prisma.productRole.findUnique({ where: { id } })
      return row ? toProductRole(row) : null
    },

    async create(data) {
      try {
        const row = await prisma.productRole.create({ data })
        return toProductRole(row)
      } catch (error: unknown) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictError('product-roles.duplicate', `Role '${data.key}' already exists for this product`)
        }
        throw error
      }
    },

    async update(id, data) {
      const row = await prisma.productRole.update({ where: { id }, data })
      return toProductRole(row)
    },

    async delete(id) {
      await prisma.productRole.delete({ where: { id } })
    },

    async assignToUser(userId, productRoleId, assignedBy) {
      const row = await prisma.userProductRole.upsert({
        where: { userId_productRoleId: { userId, productRoleId } },
        create: { userId, productRoleId, assignedBy: assignedBy ?? null },
        update: { assignedBy: assignedBy ?? null },
      })
      return toUserProductRole(row)
    },

    async unassignFromUser(userId, productRoleId) {
      await prisma.userProductRole.delete({
        where: { userId_productRoleId: { userId, productRoleId } },
      })
    },

    async listByUser(userId) {
      const rows = await prisma.userProductRole.findMany({ where: { userId } })
      return rows.map(toUserProductRole)
    },

    async listRolesByUsers(userIds) {
      if (userIds.length === 0) return []
      const rows = await prisma.userProductRole.findMany({
        where: { userId: { in: userIds } },
        include: { productRole: true },
        orderBy: { createdAt: 'asc' },
      })
      return rows.map((row) => ({ userId: row.userId, role: toProductRole(row.productRole) }))
    },

    async replaceUserRoles(userId, withinProductIds, productRoleIds, assignedBy) {
      await prisma.$transaction([
        // Scoped to the caller's products on purpose: clearing every row would
        // let one tenant's screen wipe access granted under a product it does
        // not administer.
        prisma.userProductRole.deleteMany({
          where: { userId, productRole: { productId: { in: withinProductIds } } },
        }),
        ...productRoleIds.map((productRoleId) =>
          prisma.userProductRole.create({
            data: { userId, productRoleId, assignedBy: assignedBy ?? null },
          }),
        ),
      ])
    },

    async listRoleKeysByUser(userId) {
      const rows = await prisma.userProductRole.findMany({
        where: { userId },
        include: { productRole: true },
      })
      return rows.map((row) => ({ productId: row.productRole.productId, roleKey: row.productRole.key }))
    },

    async getRoleModules(roleId) {
      const rows = await prisma.roleModuleAccess.findMany({
        where: { productRoleId: roleId },
        select: { moduleId: true },
      })
      return rows.map((r) => r.moduleId)
    },

    async setRoleModules(roleId, moduleIds) {
      await prisma.$transaction([
        prisma.roleModuleAccess.deleteMany({ where: { productRoleId: roleId } }),
        ...moduleIds.map((moduleId) =>
          prisma.roleModuleAccess.create({ data: { productRoleId: roleId, moduleId } })
        ),
      ])
    },
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002'
}

function toProductRole(row: { id: string; productId: string; key: string; name: string; createdAt: Date; updatedAt: Date }): ProductRole {
  return { id: row.id, productId: row.productId, key: row.key, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

function toUserProductRole(row: { userId: string; productRoleId: string; assignedBy: string | null; createdAt: Date }): UserProductRole {
  return { userId: row.userId, productRoleId: row.productRoleId, assignedBy: row.assignedBy ?? undefined, createdAt: row.createdAt }
}
