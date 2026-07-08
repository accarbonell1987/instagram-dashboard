import type { PrismaClient } from '@core/database';

import type { CreateRoleInput, Role, UpdateRoleInput } from '../../domain/role.js';
import type { FilterParams, PaginatedResponse, Repository } from '../repository.interface.js';

interface PrismaRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(prismaRole: PrismaRole): Role {
  return {
    id: prismaRole.id,
    name: prismaRole.name,
    description: prismaRole.description ?? undefined,
    permissions: prismaRole.permissions,
    createdAt: prismaRole.createdAt,
    updatedAt: prismaRole.updatedAt,
  };
}

export class RolePrismaRepository implements Repository<Role, CreateRoleInput, UpdateRoleInput> {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Role[]> {
    const roles = await this.prisma.role.findMany();
    return roles.map(toDomain);
  }

  async findById(id: string): Promise<Role | null> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    return role ? toDomain(role) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const role = await this.prisma.role.findUnique({ where: { name } });
    return role ? toDomain(role) : null;
  }

  async create(data: CreateRoleInput): Promise<Role> {
    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        permissions: data.permissions,
      },
    });
    return toDomain(role);
  }

  async update(id: string, data: UpdateRoleInput): Promise<Role | null> {
    try {
      const role = await this.prisma.role.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.permissions !== undefined && {
            permissions: data.permissions,
          }),
        },
      });
      return toDomain(role);
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.role.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async filter(params: FilterParams): Promise<PaginatedResponse<Role>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const whereClause = params.search
      ? {
          OR: [
            {
              name: { contains: params.search, mode: 'insensitive' as const },
            },
            {
              description: {
                contains: params.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : undefined;

    const orderByClause = params.sortBy
      ? ({ [params.sortBy]: params.sortOrder ?? 'asc' } as Record<string, 'asc' | 'desc'>)
      : { createdAt: 'desc' as const };

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        ...(whereClause !== undefined && { where: whereClause }),
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: orderByClause,
      }),
      this.prisma.role.count(whereClause !== undefined ? { where: whereClause } : undefined),
    ]);

    return { data: roles.map(toDomain), total, page, pageSize };
  }
}
