import type { PrismaClient } from '../../generated/prisma/client.js'
import type { Invitation } from '../../domain/index.js'
import type { InvitationRepository, CreateInvitationInput, RawInvitationRow } from './types.js'

// Prisma generated type for the Invitation model (includes revokedAt natively after db:generate)
type InvitationRaw = {
  id: string
  email: string
  tenantId: string
  inviterUserId: string | null
  role: string
  tokenHash: string
  usedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date
  createdAt: Date
}

function mapInvitation(raw: InvitationRaw): Invitation {
  return {
    id: raw.id,
    email: raw.email,
    tenantId: raw.tenantId,
    inviterUserId: raw.inviterUserId ?? undefined,
    role: raw.role as Invitation['role'],
    tokenHash: raw.tokenHash,
    usedAt: raw.usedAt ?? undefined,
    revokedAt: raw.revokedAt ?? undefined,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
  }
}

export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const raw = await this.prisma.invitation.findUnique({ where: { tokenHash } })
    return raw ? mapInvitation(raw as InvitationRaw) : null
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.invitation.update({
      where: { id },
      data: { usedAt: new Date() },
    })
  }

  async create(data: CreateInvitationInput): Promise<Invitation> {
    const raw = await this.prisma.invitation.create({
      data: {
        email: data.email,
        tenantId: data.tenantId,
        inviterUserId: data.inviterUserId,
        role: data.role,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    })
    return mapInvitation(raw as InvitationRaw)
  }

  async listByTenant(tenantId: string): Promise<RawInvitationRow[]> {
    const rows = await this.prisma.invitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role as RawInvitationRow['role'],
      tenantId: row.tenantId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      usedAt: (row as InvitationRaw).usedAt ?? undefined,
      revokedAt: (row as InvitationRaw).revokedAt ?? undefined,
    }))
  }

  async findPendingByEmail(email: string, tenantId: string): Promise<Invitation | null> {
    const raw = await this.prisma.invitation.findFirst({
      where: {
        email,
        tenantId,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    return raw ? mapInvitation(raw as InvitationRaw) : null
  }

  async findById(id: string, tenantId: string): Promise<Invitation | null> {
    const raw = await this.prisma.invitation.findFirst({
      where: { id, tenantId },
    })
    return raw ? mapInvitation(raw as InvitationRaw) : null
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.invitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }
}
