import type { Payment, PaymentStatus } from '../../domain/index.js'

export interface CreatePaymentInput {
  draftId: string
  bancardProcessId: string
  amount: number
  currency: string
  status: PaymentStatus
}

export interface PaymentRepository {
  create(data: CreatePaymentInput): Promise<Payment>
  findByDraftId(draftId: string): Promise<Payment | null>
  findByBancardProcessId(processId: string): Promise<Payment | null>
  updateStatus(id: string, status: PaymentStatus, confirmedAt?: Date | undefined): Promise<Payment>
  cancelPendingByDraftId(draftId: string): Promise<void>
}
