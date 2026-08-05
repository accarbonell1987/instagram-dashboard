import type { DraftState } from '../services/draft.service';

// ─── Step types ───────────────────────────────────────────────────────────────

export type Step = 'product' | 'plan' | 'representative' | 'otp' | 'company' | 'payment' | 'summary';

export const STEPS: readonly Step[] = [
  'product',
  'plan',
  'representative',
  'otp',
  'company',
  'payment',
  'summary',
] as const;

// ─── Navigation helpers ───────────────────────────────────────────────────────

/**
 * Returns the step after `current`, or null if already at the last step.
 */
export function nextStep(current: Step): Step | null {
  const index = STEPS.indexOf(current);
  if (index < 0 || index >= STEPS.length - 1) return null;
  return STEPS[index + 1] ?? null;
}

/**
 * Returns the step before `current`, or null if at the first step or at summary
 * (summary has no back — user is done).
 */
export function prevStep(current: Step): Step | null {
  if (current === 'summary') return null;
  const index = STEPS.indexOf(current);
  if (index <= 0) return null;
  return STEPS[index - 1] ?? null;
}

// ─── Reachability gating ──────────────────────────────────────────────────────

/**
 * Returns true if the user can navigate to `target` given the current draft state.
 * Prevents skipping steps that have unmet prerequisites.
 */
export function isStepReachable(target: Step, draft: DraftState): boolean {
  switch (target) {
    case 'product':
      return true;

    case 'plan':
      return true;

    case 'representative':
      return draft.plan !== null;

    case 'otp':
      return draft.plan !== null && draft.representative !== null;

    case 'company':
      return draft.plan !== null && draft.representative !== null && draft.otpVerified;

    case 'payment':
      return (
        draft.plan !== null &&
        draft.representative !== null &&
        draft.otpVerified &&
        draft.company !== null
      );

    case 'summary':
      return (
        draft.plan !== null &&
        draft.representative !== null &&
        draft.otpVerified &&
        draft.company !== null &&
        draft.payment !== null
      );

    default:
      return false;
  }
}

// ─── Derive current step ──────────────────────────────────────────────────────

/**
 * Derives the correct wizard step from the draft state.
 * Uses gating logic (forward-only) — does NOT blindly trust `draft.currentStep`.
 */
// Statuses that mean the payment hasn't settled yet.
const UNSETTLED_STATUSES = new Set(['pending', 'in_review', 'declined', 'cancelled', 'timeout']);

export function deriveCurrentStep(draft: DraftState): Step {
  if (draft.plan === null) return 'plan';
  if (draft.representative === null) return 'representative';
  if (!draft.otpVerified) return 'otp';
  if (draft.company === null) return 'company';

  const payment = draft.payment;
  if (payment === null) return 'payment';
  if (!UNSETTLED_STATUSES.has(payment.status)) return 'summary';

  // A bank transfer sits pending/in_review for days — provisioning already
  // happens at summary, so there's nothing to block on. Bancard settles in
  // seconds, so pending still means "stay here and wait/retry". A declined
  // transfer still blocks: the customer needs to see it and retry.
  if (payment.method === 'bank_transfer' && payment.status !== 'declined') return 'summary';

  return 'payment';
}
