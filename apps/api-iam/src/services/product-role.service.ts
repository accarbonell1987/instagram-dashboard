import type { Logger } from 'pino'
import type {
  ProductRoleRepository,
  ProductRoleWithModuleCount,
} from '../repositories/product-role/index.js'
import type { ModuleRepository } from '../repositories/module/index.js'
import type { UserRepository } from '../repositories/user/index.js'
import type { ProductRole, UserProductRole } from '../domain/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js'

export type ProductRoleServiceDeps = {
  productRoleRepository: ProductRoleRepository
  moduleRepository: ModuleRepository
  userRepo: UserRepository
  logger: Logger
}

/** The roles a tenant may hand out, grouped by the product that defines them. */
export type TenantProductRoles = {
  productId: string
  productName: string
  roles: ProductRoleWithModuleCount[]
}

export type ProductRoleService = {
  listByProduct(productId: string): Promise<ProductRole[]>
  create(data: { productId: string; key: string; name: string }): Promise<ProductRole>
  update(id: string, data: Partial<{ name: string }>): Promise<ProductRole>
  remove(id: string): Promise<void>
  assignToUser(userId: string, productRoleId: string, assignedBy?: string): Promise<UserProductRole>
  unassignFromUser(userId: string, productRoleId: string): Promise<void>
  listByUser(userId: string): Promise<UserProductRole[]>
  getRoleModules(roleId: string): Promise<string[]>
  setRoleModules(roleId: string, moduleIds: string[]): Promise<void>
  // ── Tenant-scoped: a TenantAdmin administering their own organisation ──
  listRolesForTenant(tenantUuid: string): Promise<TenantProductRoles[]>
  listRolesForMembers(userIds: string[]): Promise<Map<string, ProductRole[]>>
  setMemberRoles(params: {
    tenantUuid: string
    memberId: string
    productRoleIds: string[]
    requesterRole: string
    assignedBy: string
  }): Promise<void>
}

export function createProductRoleService(deps: ProductRoleServiceDeps): ProductRoleService {
  const { productRoleRepository, moduleRepository, userRepo, logger } = deps
  const log = logger.child({ component: 'product-role-service' })

  return {
    async listByProduct(productId) {
      return productRoleRepository.findAllByProduct(productId)
    },

    async create(data) {
      log.info({ productId: data.productId, key: data.key }, 'creating product role')
      return productRoleRepository.create(data)
    },

    async update(id, data) {
      const existing = await productRoleRepository.findById(id)
      if (!existing) throw new NotFoundError('product-roles.not_found', `Product role '${id}' not found`)
      log.info({ id }, 'updating product role')
      return productRoleRepository.update(id, data)
    },

    async remove(id) {
      const existing = await productRoleRepository.findById(id)
      if (!existing) throw new NotFoundError('product-roles.not_found', `Product role '${id}' not found`)
      log.info({ id }, 'removing product role')
      await productRoleRepository.delete(id)
    },

    async assignToUser(userId, productRoleId, assignedBy) {
      const role = await productRoleRepository.findById(productRoleId)
      if (!role) throw new NotFoundError('product-roles.not_found', `Product role '${productRoleId}' not found`)
      await userRepo.findById(userId)
      log.info({ userId, productRoleId }, 'assigning product role')
      return productRoleRepository.assignToUser(userId, productRoleId, assignedBy)
    },

    async unassignFromUser(userId, productRoleId) {
      log.info({ userId, productRoleId }, 'unassigning product role')
      await productRoleRepository.unassignFromUser(userId, productRoleId)
    },

    async listByUser(userId) {
      return productRoleRepository.listByUser(userId)
    },

    async getRoleModules(roleId) {
      return productRoleRepository.getRoleModules(roleId)
    },

    async setRoleModules(roleId, moduleIds) {
      await productRoleRepository.setRoleModules(roleId, moduleIds)
    },

    // ── Tenant-scoped ────────────────────────────────────────────────────────

    async listRolesForTenant(tenantUuid) {
      const products = await moduleRepository.findAvailableProducts(tenantUuid)
      const roles = await productRoleRepository.findAllByProducts(products.map((p) => p.id))
      return products.map((product) => ({
        productId: product.id,
        productName: product.name,
        roles: roles.filter((role) => role.productId === product.id),
      }))
    },

    async listRolesForMembers(userIds) {
      const rows = await productRoleRepository.listRolesByUsers(userIds)
      const byUser = new Map<string, ProductRole[]>()
      for (const { userId, role } of rows) {
        const list = byUser.get(userId) ?? []
        list.push(role)
        byUser.set(userId, list)
      }
      return byUser
    },

    async setMemberRoles({ tenantUuid, memberId, productRoleIds, requesterRole, assignedBy }) {
      if (requesterRole !== 'TenantAdmin' && requesterRole !== 'SuperAdmin') {
        throw new ForbiddenError('product-roles.forbidden', 'TenantAdmin role required')
      }

      // 404, not 403: a member of another tenant must be indistinguishable from
      // one that does not exist.
      const member = await userRepo.findByIdInTenant(memberId, tenantUuid)
      if (!member) {
        throw new NotFoundError('identity.member_not_found', `Member '${memberId}' not found`)
      }

      const products = await moduleRepository.findAvailableProducts(tenantUuid)
      const productIds = products.map((product) => product.id)
      const available = await productRoleRepository.findAllByProducts(productIds)
      const byId = new Map(available.map((role) => [role.id, role]))

      const chosen = productRoleIds.map((id) => byId.get(id))
      if (chosen.some((role) => role === undefined)) {
        throw new ValidationError(
          'product-roles.not_available',
          'One of the roles does not belong to a product this tenant has contracted',
        )
      }

      // One role per product. Two roles in the same product would union their
      // modules, which no screen can show and nobody asked for.
      const seenProducts = new Set<string>()
      for (const role of chosen) {
        if (role === undefined) continue
        if (seenProducts.has(role.productId)) {
          throw new ValidationError(
            'product-roles.duplicate_product',
            `More than one role given for product '${role.productId}'`,
          )
        }
        seenProducts.add(role.productId)
      }

      log.info({ tenantUuid, memberId, count: productRoleIds.length }, 'setting member roles')
      await productRoleRepository.replaceUserRoles(memberId, productIds, productRoleIds, assignedBy)
    },
  }
}
