import type { PrismaClient } from '../../generated/prisma/client.js'
import type { PaymentMethod } from '../../domain/index.js'
import type { BancardAdapter } from '../bancard/index.js'
import { ConflictError } from '../../errors.js'
import { BancardPaymentAdapter } from './bancard.adapter.js'
import { BankTransferAdapter } from './bank-transfer.adapter.js'
import type { PaymentMethodAdapter } from './types.js'

export type { BankAccount, PaymentInitiateParams, PaymentInitiateResult, PaymentMethodAdapter } from './types.js'
export { BancardPaymentAdapter } from './bancard.adapter.js'
export { BankTransferAdapter } from './bank-transfer.adapter.js'

export type PaymentAdapterRegistryDeps = {
  prisma: PrismaClient
  bancardAdapter: BancardAdapter
}

export function createPaymentAdapterRegistry(deps: PaymentAdapterRegistryDeps) {
  const { prisma, bancardAdapter } = deps

  const adapters: Record<PaymentMethod, PaymentMethodAdapter> = {
    bancard: new BancardPaymentAdapter(bancardAdapter),
    bank_transfer: new BankTransferAdapter(prisma),
  }

  // `enabled` gates initiation only — settlement of an already-initiated
  // payment must succeed regardless of this flag (see settlement.service.ts).
  async function getEnabledAdapter(method: PaymentMethod): Promise<PaymentMethodAdapter> {
    const config = await prisma.paymentMethodConfig.findUnique({ where: { method } })
    if (!config?.enabled) {
      throw new ConflictError('payment.method_disabled', `Payment method "${method}" is not enabled`)
    }
    return adapters[method]
  }

  async function listEnabledMethods(): Promise<PaymentMethod[]> {
    const configs = await prisma.paymentMethodConfig.findMany({ where: { enabled: true }, select: { method: true } })
    return configs.map((c) => c.method)
  }

  return { getEnabledAdapter, listEnabledMethods }
}

export type PaymentAdapterRegistry = ReturnType<typeof createPaymentAdapterRegistry>
