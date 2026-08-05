export type BankAccount = {
  bankName: string
  accountNumber: string
  accountHolder: string
  ruc: string
}

export type PaymentInitiateParams = {
  amount: number
  currency: string
  draftId: string
  returnUrl: string
  description: string
}

export type PaymentInitiateResult =
  | { kind: 'redirect'; externalRef: string; url: string; expiresAt: Date }
  | { kind: 'bank_transfer'; externalRef: string; reference: string; accounts: BankAccount[] }

export interface PaymentMethodAdapter {
  initiate(params: PaymentInitiateParams): Promise<PaymentInitiateResult>
}
