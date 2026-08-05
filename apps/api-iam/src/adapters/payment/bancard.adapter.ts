import type { BancardAdapter } from '../bancard/index.js'
import type { PaymentMethodAdapter, PaymentInitiateParams, PaymentInitiateResult } from './types.js'

// Thin wrapper over the existing BancardAdapter — no behavior change, only
// reshapes its result into the registry's discriminated union.
export class BancardPaymentAdapter implements PaymentMethodAdapter {
  constructor(private readonly bancard: BancardAdapter) {}

  async initiate(params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
    const result = await this.bancard.initiatePayment(params)
    return { kind: 'redirect', url: result.redirectUrl, expiresAt: result.expiresAt }
  }
}
