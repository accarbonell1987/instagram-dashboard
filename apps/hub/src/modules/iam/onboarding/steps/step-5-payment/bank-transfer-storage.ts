import type { components } from '@/lib/api/types';

// ─── Bank-transfer instruction persistence ─────────────────────────────────────
//
// The backend is now the source of truth: GET /onboarding/draft/{id} carries
// the reference + bank accounts for an unsettled bank-transfer payment
// (DraftPayment.instruction). This client-side copy is only a same-device
// fallback — e.g. offline right after initiate, or a draft cached before this
// field existed. localStorage (not sessionStorage) so it survives the
// days-long wait for a bank transfer to settle.

type BankTransferInstruction = components['schemas']['BankTransferPaymentInstruction'];

const STORAGE_KEY = (draftId: string) => `draft:${draftId}:payment:bank-transfer`;

export function storeBankTransferInstruction(
  draftId: string,
  instruction: BankTransferInstruction
): void {
  localStorage.setItem(STORAGE_KEY(draftId), JSON.stringify(instruction));
}

export function getBankTransferInstruction(draftId: string): BankTransferInstruction | null {
  const raw = localStorage.getItem(STORAGE_KEY(draftId));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as BankTransferInstruction;
  } catch {
    return null;
  }
}
