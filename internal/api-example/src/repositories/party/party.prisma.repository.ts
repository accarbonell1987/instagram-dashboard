import type { PrismaClient } from '@core/database';

import type { CreatePartyInput, Party, UpdatePartyInput } from '../../domain/party.js';
import type { FilterParams, PaginatedResponse, Repository } from '../repository.interface.js';

interface PrismaParty {
  id: string;
  type: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(prismaParty: PrismaParty): Party {
  return {
    id: prismaParty.id,
    type: prismaParty.type as Party['type'],
    displayName: prismaParty.displayName,
    email: prismaParty.email ?? undefined,
    phone: prismaParty.phone ?? undefined,
    createdAt: prismaParty.createdAt,
    updatedAt: prismaParty.updatedAt,
  };
}

export class PartyPrismaRepository implements Repository<
  Party,
  CreatePartyInput,
  UpdatePartyInput
> {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Party[]> {
    const parties = await this.prisma.party.findMany();
    return parties.map(toDomain);
  }

  async findById(id: string): Promise<Party | null> {
    const party = await this.prisma.party.findUnique({ where: { id } });
    return party ? toDomain(party) : null;
  }

  async findByEmail(email: string): Promise<Party | null> {
    const party = await this.prisma.party.findFirst({ where: { email } });
    return party ? toDomain(party) : null;
  }

  async create(data: CreatePartyInput): Promise<Party> {
    const party = await this.prisma.party.create({
      data: {
        type: data.type,
        displayName: data.displayName,
        email: data.email ?? null,
        phone: data.phone ?? null,
      },
    });
    return toDomain(party);
  }

  async update(id: string, data: UpdatePartyInput): Promise<Party | null> {
    try {
      const party = await this.prisma.party.update({
        where: { id },
        data: {
          ...(data.type !== undefined && { type: data.type }),
          ...(data.displayName !== undefined && {
            displayName: data.displayName,
          }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.phone !== undefined && { phone: data.phone }),
        },
      });
      return toDomain(party);
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.party.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async filter(params: FilterParams): Promise<PaginatedResponse<Party>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const whereClause = params.search
      ? {
          OR: [
            {
              displayName: {
                contains: params.search,
                mode: 'insensitive' as const,
              },
            },
            {
              email: {
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

    const [parties, total] = await Promise.all([
      this.prisma.party.findMany({
        ...(whereClause !== undefined && { where: whereClause }),
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: orderByClause,
      }),
      this.prisma.party.count(whereClause !== undefined ? { where: whereClause } : undefined),
    ]);

    return { data: parties.map(toDomain), total, page, pageSize };
  }
}
