import type { Plan } from './plans.service';

import { getIdempotencyKey, resetIdempotencyKey } from '@/lib/api/idempotency';
import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftRepresentative {
  email: string;
  fullName: string;
  phone: string;
}

export interface DraftCompany {
  legalName: string;
  ruc: string;
  address: string;
  city: string;
  country: string;
}

export interface DraftPayment {
  paymentId: string;
  status: NonNullable<components['schemas']['DraftPayment']['status']>;
  method: components['schemas']['PaymentMethodKind'] | null;
  bancardProcessId: string | null;
  instruction: components['schemas']['BankTransferPaymentInstruction'] | null;
}

export interface DraftState {
  id: string;
  currentStep: string;
  status: string;
  productId?: string | null;
  plan: Plan | null;
  representative: DraftRepresentative | null;
  otpVerified: boolean;
  company: DraftCompany | null;
  payment: DraftPayment | null;
  version: number;
  expiresAt: string;
}

export type PaymentInstruction = components['schemas']['PaymentInstruction'];

export interface CreateDraftInput {
  planId?: string | undefined;
  productId?: string | undefined;
  signal?: AbortSignal | undefined;
}

export interface PatchDraftInput {
  planId?: string | undefined;
  productId?: string | undefined;
  representative?: DraftRepresentative | undefined;
  company?: DraftCompany | undefined;
  version: number;
}

export interface SubmitDraftResult {
  tenantId: string;
  accessToken: string;
  documents: {
    // Bug 9 fix: backend now returns document IDs for on-demand signed URL generation
    invoiceId: string;
    contractId: string;
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function createDraft(
  input: CreateDraftInput = {}
): Promise<{ draftId: string; currentStep: string }> {
  const body: Record<string, unknown> = {};
  if (input.planId !== undefined) body['planId'] = input.planId;
  if (input.productId !== undefined) body['productId'] = input.productId;

  // Stable idempotency key scoped to the plan (or a generic scope when no plan).
  // getIdempotencyKey persists to localStorage so the key survives React Strict Mode
  // double-mounts and re-renders — the server sees the same UUID both times and
  // returns the existing draft instead of creating a second one.
  const scope =
    input.planId !== undefined ? `draft:create:${input.planId}` : 'draft:create:no-plan';
  const idempotencyKey = getIdempotencyKey(scope);

  const draft = await apiFetchWithInterceptors<DraftState>('/onboarding/draft', {
    method: 'POST',
    body,
    idempotencyKey,
    ...(input.signal !== undefined && { signal: input.signal }),
  });

  return { draftId: draft.id, currentStep: draft.currentStep };
}

export function resetCreateDraftKey(planId?: string): void {
  const scope = planId !== undefined ? `draft:create:${planId}` : 'draft:create:no-plan';
  resetIdempotencyKey(scope);
}

export function resetDraftStepKey(draftId: string, stepName: string): void {
  const scope = `draft:${draftId}:step:${stepName}`;
  resetIdempotencyKey(scope);
}

export async function getDraft(draftId: string): Promise<DraftState> {
  return apiFetchWithInterceptors<DraftState>(`/onboarding/draft/${draftId}`, {
    method: 'GET',
  });
}

export async function patchDraft(
  draftId: string,
  stepName: string,
  partial: PatchDraftInput
): Promise<DraftState> {
  const scope = `draft:${draftId}:step:${stepName}`;
  // Always reset before generating a new key for data steps.
  // The payload can change between calls (user edits the form), so reusing
  // a stored key would hit 422 idempotency.key_reused on the server.
  // A fresh key per submit is safe: the UI already prevents double-submit
  // via isSubmitting state from React Hook Form.
  resetIdempotencyKey(scope);
  const idempotencyKey = getIdempotencyKey(scope);

  const body: Record<string, unknown> = {
    step: stepName,
    version: partial.version,
  };

  if (partial.planId !== undefined) body['plan'] = { id: partial.planId };
  if (partial.productId !== undefined) body['productId'] = partial.productId;
  if (partial.representative !== undefined) body['representative'] = partial.representative;
  if (partial.company !== undefined) body['company'] = partial.company;

  const result = await apiFetchWithInterceptors<DraftState>(`/onboarding/draft/${draftId}`, {
    method: 'PATCH',
    body,
    idempotencyKey,
  });

  return result;
}

export async function requestResumeLink(draftId: string): Promise<{ sent: true }> {
  // The backend ignores any email in the body — it uses the draft's stored representativeEmail.
  return apiFetchWithInterceptors<{ sent: true }>(`/onboarding/draft/${draftId}/resume-link`, {
    method: 'POST',
    body: {},
  });
}

export async function consumeResumeToken(token: string): Promise<{ draftId: string }> {
  return apiFetchWithInterceptors<{ draftId: string }>(`/onboarding/draft/resume/${token}`, {
    method: 'GET',
  });
}

export async function initiatePayment(
  draftId: string,
  attempt: number,
  method?: components['schemas']['PaymentMethodKind']
): Promise<components['schemas']['PaymentInitiateResponse']> {
  const scope = `draft:${draftId}:payment:v${String(attempt)}`;

  if (attempt > 1) {
    resetIdempotencyKey(scope);
  }

  const idempotencyKey = getIdempotencyKey(scope);

  return apiFetchWithInterceptors<components['schemas']['PaymentInitiateResponse']>(
    `/onboarding/draft/${draftId}/payment/initiate`,
    {
      method: 'POST',
      body: method !== undefined ? { method } : {},
      idempotencyKey,
    }
  );
}

export async function listPaymentMethods(): Promise<
  components['schemas']['PaymentMethodOption'][]
> {
  const result = await apiFetchWithInterceptors<
    components['schemas']['PaymentMethodOptionListResponse']
  >('/payment-methods', { method: 'GET' });
  return result.items;
}

export async function getPaymentStatus(
  draftId: string
): Promise<components['schemas']['PaymentStatus']> {
  return apiFetchWithInterceptors<components['schemas']['PaymentStatus']>(
    `/onboarding/draft/${draftId}/payment/status`,
    { method: 'GET' }
  );
}

export async function recoverDraft(draftId: string, step: 'company'): Promise<DraftState> {
  return apiFetchWithInterceptors<DraftState>(`/onboarding/draft/${draftId}/recover`, {
    method: 'PATCH',
    body: { step },
  });
}

export async function submitDraft(draftId: string, version: number): Promise<SubmitDraftResult> {
  const scope = `draft:${draftId}:submit`;
  const idempotencyKey = getIdempotencyKey(scope);

  const result = await apiFetchWithInterceptors<{
    tenantId: string;
    tenant?: { name?: string | null } | null;
    accessToken: string;
    expiresIn: number;
    documents: { invoiceId: string; contractId: string };
  }>(`/onboarding/draft/${draftId}/submit`, {
    method: 'POST',
    body: { version },
    idempotencyKey,
  });

  // After successful submission, we deliberately do NOT create an authenticated
  // session. The newly created user account has status 'pending_first_login' and
  // the user MUST activate their account via email (first-login flow) before
  // accessing the platform. We invalidate the tokens immediately so the
  // hub_session cookie set by the backend does not create a bypass.
  void invalidateSubmitTokens(result.accessToken);

  return {
    tenantId: result.tenantId,
    accessToken: result.accessToken,
    documents: {
      invoiceId: result.documents.invoiceId,
      contractId: result.documents.contractId,
    },
  };
}

/**
 * Best-effort token invalidation after draft submission.
 *
 * The /onboarding/draft/{id}/submit endpoint returns tokens for the newly created
 * user. Since the user is in 'pending_first_login' status, these tokens must not
 * be usable to access protected routes. We call POST /auth/logout with the
 * access token to invalidate the session server-side (clear hub_session cookie,
 * revoke refresh tokens).
 *
 * Uses a direct fetch (not apiFetchWithInterceptors) because the token holder
 * singleton is intentionally left empty — we pass the access token explicitly.
 */
async function invalidateSubmitTokens(accessToken: string): Promise<void> {
  const apiBaseUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

  try {
    await fetch(`${apiBaseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });
  } catch {
    // Best-effort — if the logout call fails (network error, etc.), the
    // RequireAuth guard still prevents access because no session was set.
  }
}
