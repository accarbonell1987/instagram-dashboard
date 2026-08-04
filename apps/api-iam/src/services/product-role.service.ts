import type { Logger } from 'pino'
import type { ProductRoleRepository } from '../repositories/product-role/index.js'
import type { UserRepository } from '../repositories/user/index.js'
import type { ProductRole, UserProductRole } from '../domain/index.js'
import { NotFoundError } from '../errors.js'

export type ProductRoleServiceDeps = {
  productRoleRepository: ProductRoleRepository
  userRepo: UserRepository
  logger: Logger
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
}

export function createProductRoleService(deps: ProductRoleServiceDeps): ProductRoleService {
  const { productRoleRepository, userRepo, logger } = deps
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
  }
}
