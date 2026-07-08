import type { DraftState } from '../services/draft.service';

// ─── Step types ───────────────────────────────────────────────────────────────

export type Step = 'plan' | 'representative' | 'otp' | 'company' | 'payment' | 'summary';

export const STEPS: readonly Step[] = [
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
export function deriveCurrentStep(draft: DraftState): Step {
  if (draft.plan === null) return 'plan';
  if (draft.representative === null) return 'representative';
  if (!draft.otpVerified) return 'otp';
  if (draft.company === null) return 'company';
  if (
    draft.payment === null ||
    draft.payment.status === 'pending' ||
    draft.payment.status === 'declined' ||
    draft.payment.status === 'cancelled' ||
    draft.payment.status === 'timeout'
  ) return 'payment';
  return 'summary';
}
