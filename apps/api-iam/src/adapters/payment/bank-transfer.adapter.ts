import { customAlphabet } from 'nanoid'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { InternalError } from '../../errors.js'
import type { BankAccount, PaymentInitiateParams, PaymentInitiateResult, PaymentMethodAdapter } from './types.js'

// Crockford-style alphabet, no ambiguous characters (0/O, 1/I/L excluded).
const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const generateReferenceCode = customAlphabet(REFERENCE_ALPHABET, 6)

export class BankTransferAdapter implements PaymentMethodAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  async initiate(_params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
    const config = await this.prisma.paymentMethodConfig.findUnique({ where: { method: 'bank_transfer' } })
    const accounts = ((config?.config as { accounts?: BankAccount[] } | undefined)?.accounts) ?? []

    // Mirrors submit.service.ts's slug-uniqueness retry loop.
    let reference = `CH-${generateReferenceCode()}`
    for (let attempt = 1; attempt <= 10; attempt++) {
      const existing = await this.prisma.payment.findUnique({ where: { externalRef: reference } })
      if (!existing) break
      if (attempt === 10) {
        throw new InternalError('payment.reference_collision', 'Could not generate a unique bank-transfer reference')
      }
      reference = `CH-${generateReferenceCode()}`
    }

    return { kind: 'bank_transfer', externalRef: reference, reference, accounts }
  }
}
