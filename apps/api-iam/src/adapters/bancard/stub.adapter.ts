import { nanoid } from 'nanoid'
import type { BancardAdapter, BancardInitiateParams, BancardInitiateResult } from './types.js'

export class StubBancardAdapter implements BancardAdapter {
  async initiatePayment(params: BancardInitiateParams): Promise<BancardInitiateResult> {
    const processId = 'stub_' + nanoid()
    return {
      processId,
      redirectUrl: `http://localhost:8080/__stub/bancard/approve?process_id=${processId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }
  }
}
