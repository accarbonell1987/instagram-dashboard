import type { components } from '@/lib/api/types';

// ─── Bank-transfer instruction persistence ─────────────────────────────────────
//
// The reference + bank accounts only ever come back once, in the initiate
// response — GET /onboarding/draft/{id} never carries them (DraftPayment is a
// status projection, not the instruction). Persisted client-side so the summary
// step (and a page reload) can still show them; many customers close the tab
// before actually transferring. localStorage (not sessionStorage) so it
// survives the days-long wait for a bank transfer to settle.

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
