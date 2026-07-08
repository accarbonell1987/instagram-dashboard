export interface BancardInitiateParams {
  amount: number
  currency: string
  draftId: string
  returnUrl: string
  description: string
}

export interface BancardInitiateResult {
  processId: string
  redirectUrl: string
  expiresAt: Date
}

export interface BancardAdapter {
  initiatePayment(params: BancardInitiateParams): Promise<BancardInitiateResult>
}
