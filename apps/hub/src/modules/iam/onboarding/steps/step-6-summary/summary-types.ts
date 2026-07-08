// ─── Types ────────────────────────────────────────────────────────────────────

export interface SummaryDocuments {
  invoiceUrl: string;
  contractUrl: string;
  invoiceId?: string | undefined;
  contractId?: string | undefined;
}

export interface StepSummaryProps {
  draftId: string;
  documents?: SummaryDocuments | undefined;
}
