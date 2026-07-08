import type { Invitation, UserRole } from '../../domain/index.js'

export interface CreateInvitationInput {
  email: string
  tenantId: string
  inviterUserId: string
  role: 'TenantAdmin' | 'User'
  tokenHash: string
  expiresAt: Date
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface RawInvitationRow {
  id: string
  email: string
  role: UserRole
  tenantId: string
  createdAt: Date
  expiresAt: Date
  usedAt: Date | undefined
  revokedAt: Date | undefined
}

export interface InvitationRepository {
  findByTokenHash(tokenHash: string): Promise<Invitation | null>
  markUsed(id: string): Promise<void>
  create(data: CreateInvitationInput): Promise<Invitation>
  listByTenant(tenantId: string): Promise<RawInvitationRow[]>
  findPendingByEmail(email: string, tenantId: string): Promise<Invitation | null>
  findById(id: string, tenantId: string): Promise<Invitation | null>
  revokeById(id: string): Promise<void>
}
