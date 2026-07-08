import type { Document, DocumentType, DocumentStatus } from '../../domain/index.js'

export interface CreateDocumentInput {
  tenantId: string
  type: DocumentType
  storageKey: string
  status: DocumentStatus
}

export interface DocumentRepository {
  create(data: CreateDocumentInput): Promise<Document>
  findById(id: string): Promise<Document | null>
  findByTenantId(tenantId: string): Promise<Document[]>
  updateStatus(id: string, status: DocumentStatus): Promise<Document>
}
