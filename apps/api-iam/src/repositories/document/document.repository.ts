import type { PrismaClient } from '../../generated/prisma/client.js'
import type { Document, DocumentStatus } from '../../domain/index.js'
import type { CreateDocumentInput, DocumentRepository } from './types.js'

function mapDocument(raw: {
  id: string
  tenantId: string
  type: string
  storageKey: string
  status: string
  createdAt: Date
  updatedAt: Date
}): Document {
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    type: raw.type as Document['type'],
    storageKey: raw.storageKey,
    status: raw.status as Document['status'],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateDocumentInput): Promise<Document> {
    const raw = await this.prisma.document.create({ data })
    return mapDocument(raw)
  }

  async findById(id: string): Promise<Document | null> {
    const raw = await this.prisma.document.findUnique({ where: { id } })
    return raw ? mapDocument(raw) : null
  }

  async findByTenantId(tenantId: string): Promise<Document[]> {
    const rows = await this.prisma.document.findMany({ where: { tenantId } })
    return rows.map(mapDocument)
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<Document> {
    const raw = await this.prisma.document.update({ where: { id }, data: { status } })
    return mapDocument(raw)
  }
}
