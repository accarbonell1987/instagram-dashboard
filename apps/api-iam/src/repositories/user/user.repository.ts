import type { PrismaClient } from '../../generated/prisma/client.js';
import { NotFoundError } from '../../errors.js';
import type { User, UserStatus } from '../../domain/index.js';
import type { CreateUserInput, UserRepository } from './types.js';

function mapUser(raw: {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string | null;
  role: string;
  fullName: string | null;
  phone: string | null;
  picture: string | null;
  status: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  activationTokenHash: string | null;
  activationTokenExpiresAt: Date | null;
  activationTokenUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): User {
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    email: raw.email,
    passwordHash: raw.passwordHash ?? undefined,
    role: raw.role as User['role'],
    fullName: raw.fullName ?? undefined,
    phone: raw.phone ?? undefined,
    picture: raw.picture ?? undefined,
    status: raw.status as User['status'],
    failedLoginAttempts: raw.failedLoginAttempts,
    lockedUntil: raw.lockedUntil ?? undefined,
    activationTokenHash: raw.activationTokenHash ?? undefined,
    activationTokenExpiresAt: raw.activationTokenExpiresAt ?? undefined,
    activationTokenUsed: raw.activationTokenUsed,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    deletedAt: raw.deletedAt ?? undefined,
  };
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    return raw ? mapUser(raw) : null;
  }

  async findByEmailGlobal(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findFirst({ where: { email } });
    return raw ? mapUser(raw) : null;
  }

  async findById(id: string): Promise<User> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    if (!raw) throw new NotFoundError('auth.user_not_found');
    return mapUser(raw);
  }

  async findByActivationTokenHash(hash: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({
      where: { activationTokenHash: hash },
    });
    return raw ? mapUser(raw) : null;
  }

  async create(data: CreateUserInput): Promise<User> {
    const raw = await this.prisma.user.create({
      data: {
        tenantId: data.tenantId,
        email: data.email,
        passwordHash: data.passwordHash ?? null,
        role: data.role,
        status: data.status,
      },
    });
    return mapUser(raw);
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const raw = await this.prisma.user.update({ where: { id }, data: { status } });
    return mapUser(raw);
  }

  async updateProfile(id: string, data: { fullName: string; phone: string }): Promise<User> {
    const raw = await this.prisma.user.update({
      where: { id },
      data: { fullName: data.fullName, phone: data.phone },
    });
    return mapUser(raw);
  }

  async incrementFailedAttempts(id: string): Promise<{ failedLoginAttempts: number }> {
    const raw = await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    return { failedLoginAttempts: raw.failedLoginAttempts };
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async setLockedUntil(id: string, lockedUntil: Date): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lockedUntil } });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapUser);
  }

  async findByIdInTenant(id: string, tenantId: string): Promise<User | null> {
    const raw = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return raw ? mapUser(raw) : null;
  }

  async countActiveAdmins(tenantId: string): Promise<number> {
    return this.prisma.user.count({
      where: { tenantId, role: 'TenantAdmin', status: 'active', deletedAt: null },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async setActivationTokenUsed(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { activationTokenUsed: true },
    });
  }

  async findActiveUserIdsByTenant(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }
}
