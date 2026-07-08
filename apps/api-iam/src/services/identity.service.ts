import type { PrismaClient } from '../generated/prisma/client.js'
import type { TenantRepository, UserRepository, RefreshTokenRepository } from '../repositories/index.js'
import type { Tenant } from '../domain/index.js'
import type { TokenService } from './token.service.js'
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from '../errors.js'

export type MemberListItem = {
  id: string
  email: string
  fullName: string | undefined
  role: string
  status: string
  createdAt: Date
}

export type IdentityServiceDeps = {
  tenantRepo: TenantRepository
  userRepo: UserRepository
  refreshTokenRepo: RefreshTokenRepository
  tokenService: TokenService
  prisma: PrismaClient
}

export function createIdentityService(deps: IdentityServiceDeps) {
  const { tenantRepo, userRepo, refreshTokenRepo, tokenService, prisma } = deps

  async function getCurrentTenant(tenantUuid: string): Promise<Tenant> {
    return tenantRepo.findByUuid(tenantUuid)
  }

  async function getMembers(params: {
    tenantUuid: string
    requesterRole: string
  }): Promise<{ items: MemberListItem[] }> {
    const { tenantUuid, requesterRole } = params

    if (requesterRole !== 'TenantAdmin' && requesterRole !== 'SuperAdmin') {
      throw new ForbiddenError('identity.members.forbidden')
    }

    const users = await userRepo.listByTenant(tenantUuid)

    return {
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
    }
  }

  async function deleteMember(params: {
    targetUserId: string
    tenantUuid: string
    requesterRole: string
    requesterUserId: string
  }): Promise<void> {
    if (params.requesterRole !== 'TenantAdmin' && params.requesterRole !== 'SuperAdmin') {
      throw new ForbiddenError('identity.members.forbidden')
    }
    if (params.targetUserId === params.requesterUserId) {
      throw new ForbiddenError('identity.members.cannot_delete_self')
    }
    const target = await userRepo.findByIdInTenant(params.targetUserId, params.tenantUuid)
    if (target === null) {
      throw new NotFoundError('identity.member_not_found')
    }
    if (target.role === 'TenantAdmin') {
      const adminCount = await userRepo.countActiveAdmins(params.tenantUuid)
      if (adminCount <= 1) {
        throw new ConflictError('identity.members.last_admin')
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: params.targetUserId }, data: { deletedAt: new Date() } })
      await refreshTokenRepo.invalidateAllForUser(params.targetUserId, tx)
    })
  }

  async function updateTenant(params: {
    tenantUuid: string
    name: string
    requesterRole: string
  }): Promise<void> {
    if (params.requesterRole !== 'TenantAdmin' && params.requesterRole !== 'SuperAdmin') {
      throw new ForbiddenError('identity.tenant.forbidden')
    }
    if (params.name.trim().length < 1) {
      throw new ValidationError('identity.tenant.name_required')
    }
    await tenantRepo.updateName(params.tenantUuid, params.name.trim())
  }

  async function updateMemberStatus(params: {
    targetUserId: string
    tenantUuid: string
    status: 'active' | 'suspended'
    requesterRole: string
    requesterUserId: string
  }): Promise<void> {
    if (params.requesterRole !== 'TenantAdmin' && params.requesterRole !== 'SuperAdmin') {
      throw new ForbiddenError('identity.members.forbidden')
    }
    if (params.targetUserId === params.requesterUserId) {
      throw new ForbiddenError('identity.members.cannot_modify_self')
    }
    const target = await userRepo.findByIdInTenant(params.targetUserId, params.tenantUuid)
    if (target === null) {
      throw new NotFoundError('identity.member_not_found')
    }
    if (params.status === 'suspended' && target.role === 'TenantAdmin') {
      const adminCount = await userRepo.countActiveAdmins(params.tenantUuid)
      if (adminCount <= 1) {
        throw new ConflictError('identity.members.last_admin')
      }
    }
    await userRepo.updateStatus(params.targetUserId, params.status)
  }

  async function updateCurrentUser(
    userId: string,
    data: { fullName: string; phone: string },
  ): Promise<{ user: { id: string; email: string; fullName: string; phone: string }; accessToken: string }> {
    const updatedUser = await userRepo.updateProfile(userId, data)

    // Fetch tenant to get slug (used as tenantId claim in JWT, same pattern as acceptInvitation)
    const tenant = await tenantRepo.findByUuid(updatedUser.tenantId)

    const tokenResult = await tokenService.signAccessToken({
      sub: updatedUser.id,
      email: updatedUser.email,
      name: data.fullName,
      tenantId: tenant.slug,
      tenantUuid: tenant.id,
      role: updatedUser.role,
      phone: data.phone,
      user_status: updatedUser.status,
    })

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: data.fullName,
        phone: data.phone,
      },
      accessToken: tokenResult.accessToken,
    }
  }

  return { getCurrentTenant, getMembers, deleteMember, updateTenant, updateMemberStatus, updateCurrentUser }
}

export type IdentityService = ReturnType<typeof createIdentityService>
