import type { Payment, PaymentMethod, PaymentStatus } from '../../domain/index.js'

export interface CreatePaymentInput {
  draftId: string
  externalRef: string
  method: PaymentMethod
  amount: number
  currency: string
  status: PaymentStatus
  // Set for synthetic payments created by courtesy admin activation (task
  // 3.7) — every other caller creates a payment before a tenant exists.
  tenantId?: string
}

export interface PaymentRepository {
  create(data: CreatePaymentInput): Promise<Payment>
  findByDraftId(draftId: string): Promise<Payment | null>
  findByExternalRef(externalRef: string): Promise<Payment | null>
  listByTenant(tenantId: string): Promise<Payment[]>
  updateStatus(id: string, status: PaymentStatus, confirmedAt?: Date | undefined): Promise<Payment>
  cancelPendingByDraftId(draftId: string): Promise<void>
}
