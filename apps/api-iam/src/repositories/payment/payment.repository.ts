import type { PrismaClient } from '../../generated/prisma/client.js'
import { Decimal } from '@prisma/client/runtime/client'
import type { Payment, PaymentStatus } from '../../domain/index.js'
import type { CreatePaymentInput, PaymentRepository } from './types.js'

export function mapPayment(raw: {
  id: string
  draftId: string
  tenantId: string | null
  externalRef: string
  method: string
  amount: Decimal
  currency: string
  status: string
  reason: string | null
  settlementKind: string | null
  settledBy: string | null
  settledAt: Date | null
  note: string | null
  initiatedAt: Date
  confirmedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): Payment {
  return {
    id: raw.id,
    draftId: raw.draftId,
    tenantId: raw.tenantId ?? undefined,
    externalRef: raw.externalRef,
    method: raw.method as Payment['method'],
    amount: raw.amount.toNumber(),
    currency: raw.currency,
    status: raw.status as Payment['status'],
    reason: raw.reason ?? undefined,
    settlementKind: (raw.settlementKind as Payment['settlementKind']) ?? undefined,
    settledBy: raw.settledBy ?? undefined,
    settledAt: raw.settledAt ?? undefined,
    note: raw.note ?? undefined,
    initiatedAt: raw.initiatedAt,
    confirmedAt: raw.confirmedAt ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePaymentInput): Promise<Payment> {
    const raw = await this.prisma.payment.create({
      data: {
        draftId: data.draftId,
        externalRef: data.externalRef,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        ...(data.tenantId !== undefined && { tenantId: data.tenantId }),
      },
    })
    return mapPayment(raw)
  }

  async findByDraftId(draftId: string): Promise<Payment | null> {
    const raw = await this.prisma.payment.findFirst({
      where: { draftId },
      orderBy: { initiatedAt: 'desc' },
    })
    return raw ? mapPayment(raw) : null
  }

  async findByExternalRef(externalRef: string): Promise<Payment | null> {
    const raw = await this.prisma.payment.findUnique({ where: { externalRef } })
    return raw ? mapPayment(raw) : null
  }

  async listByTenant(tenantId: string): Promise<Payment[]> {
    const rows = await this.prisma.payment.findMany({
      where: { tenantId },
      orderBy: { initiatedAt: 'desc' },
    })
    return rows.map(mapPayment)
  }

  async updateStatus(id: string, status: PaymentStatus, confirmedAt?: Date): Promise<Payment> {
    const raw = await this.prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(confirmedAt !== undefined && { confirmedAt }),
      },
    })
    return mapPayment(raw)
  }

  async cancelPendingByDraftId(draftId: string): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { draftId, status: 'pending' },
      data: { status: 'cancelled' },
    })
  }
}
