import { InternalError } from '../../errors.js'
import type { BancardAdapter, BancardInitiateParams, BancardInitiateResult } from './types.js'

export class RealBancardAdapter implements BancardAdapter {
  async initiatePayment(_params: BancardInitiateParams): Promise<BancardInitiateResult> {
    throw new InternalError('bancard.not_implemented', 'Bancard real adapter not implemented')
  }
}
