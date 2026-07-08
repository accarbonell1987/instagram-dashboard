import { createHash } from 'crypto'
import { nanoid } from 'nanoid'
import type { PrismaClient } from '../generated/prisma/client.js'
import type {
  InvitationRepository,
  UserRepository,
  RefreshTokenRepository,
  TenantRepository,
} from '../repositories/index.js'
import type { InvitationStatus, RawInvitationRow } from '../repositories/invitation/types.js'
import type { TokenService } from './token.service.js'
import type { PasswordService } from './password.service.js'
import type { EmailAdapter } from '../adapters/index.js'
import { invitationTemplate } from '../adapters/email/templates/index.js'
import type { Config } from '../config.js'
import type { Session, Invitation, UserRole } from '../domain/index.js'
import { ConflictError, GoneError, NotFoundError, ValidationError } from '../errors.js'
import type { Logger } from '../lib/logger.js'

export type InvitationServiceDeps = {
  invitationRepo: InvitationRepository
  userRepo: UserRepository
  refreshTokenRepo: RefreshTokenRepository
  tenantRepo: TenantRepository
  tokenService: TokenService
  passwordService: PasswordService
  emailAdapter?: EmailAdapter | undefined
  config: Config
  prisma: PrismaClient
  logger: Logger
}

export type InvitationPreview = {
  email: string
  role: Invitation['role']
  expiresAt: Date
  status: 'pending'
  tenantName: string
  inviterName?: string | undefined
}

export type CreateInvitationResult = {
  id: string
  email: string
  role: UserRole
  expiresAt: Date
}

export type InvitationListItem = RawInvitationRow & {
  status: InvitationStatus
}

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

const DEFAULT_INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

function computeStatus(row: RawInvitationRow): InvitationStatus {
  if (row.revokedAt !== undefined) return 'revoked'
  if (row.usedAt !== undefined) return 'accepted'
  if (row.expiresAt < new Date()) return 'expired'
  return 'pending'
}

export function createInvitationService(deps: InvitationServiceDeps) {
  const {
    invitationRepo,
    userRepo,
    refreshTokenRepo,
    tenantRepo,
    tokenService,
    passwordService,
    emailAdapter,
    config,
    prisma,
    logger,
  } = deps

  const log = logger.child({ component: 'invitation' })

  async function getInvitation(
    token: string,
  ): Promise<{ preview: InvitationPreview; invitation: Invitation }> {
    const tokenHash = sha256(token)
    const invitation = await invitationRepo.findByTokenHash(tokenHash)

    if (!invitation) {
      throw new NotFoundError('invitations.not_found')
    }

    if (invitation.usedAt !== undefined) {
      throw new ConflictError('invitations.already_used')
    }

    if (invitation.expiresAt < new Date()) {
      throw new GoneError('invitations.expired')
    }

    return {
      preview: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        status: 'pending',
        tenantName: '', // resolved by getInvitationPreview; empty here for internal use
      },
      invitation,
    }
  }

  async function getInvitationPreview(token: string): Promise<InvitationPreview> {
    const { preview, invitation } = await getInvitation(token)

    // Resolve tenantName from DB — best-effort, falls back to empty string
    let tenantName = ''
    try {
      const tenant = await tenantRepo.findByUuid(invitation.tenantId)
      tenantName = tenant?.name ?? ''
    } catch {
      // tenant not found — return empty string rather than failing
    }

    // Bug 1: Resolve inviterName from inviterUserId — best-effort
    let inviterName: string | undefined
    if (invitation.inviterUserId !== undefined) {
      try {
        const inviter = await userRepo.findById(invitation.inviterUserId)
        inviterName = inviter.fullName ?? inviter.email
      } catch {
        // inviter not found — leave inviterName undefined
      }
    }

    return { ...preview, tenantName, inviterName }
  }

  async function acceptInvitation(params: {
    token: string
    password: string
    deviceId?: string | undefined
  }): Promise<{ session: Session; refreshTokenRaw: string }> {
    const { token, password } = params

    const { invitation } = await getInvitation(token)

    passwordService.validatePasswordPolicy(password)

    // Bug 5: Fetch tenant BEFORE transaction to fail early if not found
    const tenant = await tenantRepo.findByUuid(invitation.tenantId)

    const passwordHash = await passwordService.hashPassword(password)

    const rawRefreshToken = tokenService.signRefreshTokenRaw()
    const rtHash = sha256(rawRefreshToken)
    const tokenExpiresAt = new Date(Date.now() + config.JWT_REFRESH_TOKEN_TTL_SECONDS * 1000)
    const familyId = nanoid()

    let createdUserId: string = ''

    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      })

      const createdUser = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          tenantId: invitation.tenantId,
          role: invitation.role,
          status: 'active',
        },
      })

      createdUserId = createdUser.id

      await tx.refreshToken.create({
        data: {
          userId: createdUserId,
          tokenHash: rtHash,
          familyId,
          expiresAt: tokenExpiresAt,
        },
      })
    })

    // Bug 4: Use tenant.slug as tenantId claim, tenant.id (UUID) as tenantUuid
    const tokenResult = await tokenService.signAccessToken({
      sub: createdUserId,
      email: invitation.email,
      name: invitation.email,
      tenantId: tenant.slug,
      tenantUuid: tenant.id,
      role: invitation.role,
      user_status: 'active',
    })

    // Bug 2: Include role at root level of session
    const session: Session = {
      accessToken: tokenResult.accessToken,
      expiresIn: tokenResult.expiresIn,
      tokenType: 'Bearer',
      role: invitation.role,
      user: {
        id: createdUserId,
        email: invitation.email,
        fullName: '',
        picture: undefined,
        role: invitation.role,
        status: 'active',
      },
      tenant: {
        id: tenant.slug,
        slug: tenant.slug,
        name: tenant.name,
        planId: tenant.planId,
        status: tenant.status,
      },
    }

    log.info({
      category: 'auth',
      event: 'invitation_accepted',
      userId: createdUserId,
      tenantId: invitation.tenantId,
      role: invitation.role,
    })

    return { session, refreshTokenRaw: rawRefreshToken }
  }

  // ── Admin methods ──────────────────────────────────────────────────────

  async function createInvitation(params: {
    tenantUuid: string
    inviterUserId: string
    email: string
    role: 'TenantAdmin' | 'User'
  }): Promise<CreateInvitationResult> {
    const { tenantUuid, inviterUserId, email, role } = params

    // Check if email belongs to active user in tenant
    const existingUser = await userRepo.findByEmailGlobal(email)
    if (existingUser !== null && existingUser.tenantId === tenantUuid) {
      throw new ConflictError('invitation.active_user_exists')
    }

    // Check for pending invitation
    const existingInvitation = await invitationRepo.findPendingByEmail(email, tenantUuid)
    if (existingInvitation !== null) {
      throw new ConflictError('invitation.pending_exists')
    }

    const rawToken = nanoid(32)
    const tokenHash = sha256(rawToken)

    const invitationTtl = DEFAULT_INVITATION_TTL_SECONDS
    const expiresAt = new Date(Date.now() + invitationTtl * 1000)

    const invitation = await invitationRepo.create({
      email,
      tenantId: tenantUuid,
      inviterUserId,
      role,
      tokenHash,
      expiresAt,
    })

    // Resolve tenant name for email — best-effort
    let tenantName = tenantUuid
    try {
      const tenant = await tenantRepo.findByUuid(tenantUuid)
      tenantName = tenant?.name ?? tenantUuid
    } catch {
      // tenant not found — fall back to tenantUuid
    }

    // Send invitation email — best-effort
    if (emailAdapter !== undefined) {
      const inviteUrl = `${config.HUB_BASE_URL}/invite/${rawToken}`
      const { subject, html } = invitationTemplate({
        tenantName,
        inviteUrl,
        expiresInDays: 7,
      })
      try {
        await emailAdapter.send({ to: email, subject, html })
      } catch {
        // email send failure is non-fatal
      }
    }

    log.info({
      category: 'auth',
      event: 'invitation_created',
      tenantId: tenantUuid,
      inviterUserId,
      email,
      role,
    })

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    }
  }

  async function listInvitations(params: {
    tenantUuid: string
    statusFilter?: InvitationStatus | undefined
  }): Promise<InvitationListItem[]> {
    const { tenantUuid, statusFilter } = params

    const rows = await invitationRepo.listByTenant(tenantUuid)

    const items: InvitationListItem[] = rows.map((row) => ({
      ...row,
      status: computeStatus(row),
    }))

    if (statusFilter !== undefined) {
      return items.filter((item) => item.status === statusFilter)
    }

    return items
  }

  async function revokeInvitation(params: { id: string; tenantUuid: string }): Promise<void> {
    const { id, tenantUuid } = params

    const invitation = await invitationRepo.findById(id, tenantUuid)
    if (invitation === null) {
      throw new NotFoundError('invitation.not_found')
    }

    if (invitation.usedAt !== undefined) {
      throw new ValidationError('invitation.already_accepted')
    }

    if (invitation.revokedAt !== undefined) {
      throw new ValidationError('invitation.already_revoked')
    }

    await invitationRepo.revokeById(id)

    log.info({
      category: 'auth',
      event: 'invitation_revoked',
      tenantId: tenantUuid,
      invitationId: id,
    })
  }

  return {
    getInvitation: getInvitationPreview,
    acceptInvitation,
    createInvitation,
    listInvitations,
    revokeInvitation,
  }
}

export type InvitationService = ReturnType<typeof createInvitationService>
