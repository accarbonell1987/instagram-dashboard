import type { PrismaClient } from '../../generated/prisma/client.js'

/**
 * A screen a product contributes to the tenant's settings area.
 *
 * `path` is relative to the product's `defaultUrl` — the hub resolves the two
 * together so the per-product env override used in development still applies.
 */
export type ProductAdminSection = {
  id: string
  productId: string
  moduleId: string | null
  key: string
  label: string
  description: string | null
  path: string
  visibleToRole: string
  displayOrder: number
}

export type ProductAdminSectionRepository = {
  findActiveByProducts(productIds: string[]): Promise<ProductAdminSection[]>
}

export function createProductAdminSectionRepository(
  prisma: PrismaClient,
): ProductAdminSectionRepository {
  return {
    async findActiveByProducts(productIds) {
      if (productIds.length === 0) return []
      const rows = await prisma.productAdminSection.findMany({
        where: { productId: { in: productIds }, active: true },
        orderBy: [{ productId: 'asc' }, { displayOrder: 'asc' }, { key: 'asc' }],
      })
      return rows.map((row) => ({
        id: row.id,
        productId: row.productId,
        moduleId: row.moduleId,
        key: row.key,
        label: row.label,
        description: row.description,
        path: row.path,
        visibleToRole: row.visibleToRole,
        displayOrder: row.displayOrder,
      }))
    },
  }
}
