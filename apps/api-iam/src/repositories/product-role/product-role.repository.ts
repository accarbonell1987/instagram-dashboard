import type { PrismaClient } from '../../generated/prisma/client.js'
import type { ProductRole, UserProductRole } from '../../domain/index.js'
import { ConflictError } from '../../errors.js'

export type ProductRoleRepository = {
  findAllByProduct(productId: string): Promise<ProductRole[]>
  findById(id: string): Promise<ProductRole | null>
  create(data: { productId: string; key: string; name: string }): Promise<ProductRole>
  update(id: string, data: Partial<{ name: string }>): Promise<ProductRole>
  delete(id: string): Promise<void>
  assignToUser(userId: string, productRoleId: string, assignedBy?: string): Promise<UserProductRole>
  unassignFromUser(userId: string, productRoleId: string): Promise<void>
  listByUser(userId: string): Promise<UserProductRole[]>
}

export function createProductRoleRepository(prisma: PrismaClient): ProductRoleRepository {
  return {
    async findAllByProduct(productId) {
      const rows = await prisma.productRole.findMany({ where: { productId }, orderBy: { key: 'asc' } })
      return rows.map(toProductRole)
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
