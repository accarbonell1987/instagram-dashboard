import type { PrismaClient } from '@core/database';

import type { CreateUserInput, UpdateUserInput, User } from '../../domain/user.js';
import type { FilterParams, PaginatedResponse, Repository } from '../repository.interface.js';

interface PrismaUser {
  id: string;
  email: string;
  name: string | null;
  partyId: string;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(prismaUser: PrismaUser): User {
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    name: prismaUser.name ?? undefined,
    partyId: prismaUser.partyId,
    createdAt: prismaUser.createdAt,
    updatedAt: prismaUser.updatedAt,
  };
}

export class UserPrismaRepository implements Repository<User, CreateUserInput, UpdateUserInput> {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany();
    return users.map(toDomain);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toDomain(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? toDomain(user) : null;
  }

  async create(data: CreateUserInput): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name ?? null,
        partyId: data.partyId,
      },
    });
    return toDomain(user);
  }

  async update(id: string, data: UpdateUserInput): Promise<User | null> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.email !== undefined && { email: data.email }),
          ...(data.name !== undefined && { name: data.name }),
        },
      });
      return toDomain(user);
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async filter(params: FilterParams): Promise<PaginatedResponse<User>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const whereClause = params.search
      ? {
          OR: [
            {
              email: { contains: params.search, mode: 'insensitive' as const },
            },
            {
              name: { contains: params.search, mode: 'insensitive' as const },
            },
          ],
        }
      : undefined;

    const orderByClause = params.sortBy
      ? ({ [params.sortBy]: params.sortOrder ?? 'asc' } as Record<string, 'asc' | 'desc'>)
      : { createdAt: 'desc' as const };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        ...(whereClause !== undefined && { where: whereClause }),
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: orderByClause,
      }),
      this.prisma.user.count(whereClause !== undefined ? { where: whereClause } : undefined),
    ]);

    return { data: users.map(toDomain), total, page, pageSize };
  }
}
