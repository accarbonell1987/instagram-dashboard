// ─── Services ─────────────────────────────────────────────────────────────────
export { listPlans, getPlan } from './services/plans.service';
export type { Plan, ListPlansResult } from './services/plans.service';

export {
  createDraft,
  getDraft,
  patchDraft,
  requestResumeLink,
  consumeResumeToken,
  initiatePayment,
  getPaymentStatus,
  submitDraft,
} from './services/draft.service';
export type {
  DraftState,
  DraftRepresentative,
  DraftCompany,
  DraftPayment,
  PatchDraftInput,
  SubmitDraftResult,
} from './services/draft.service';

// ─── State machine ────────────────────────────────────────────────────────────
export {
  STEPS,
  nextStep,
  prevStep,
  isStepReachable,
  deriveCurrentStep,
} from './state/wizard-machine';
export type { Step } from './state/wizard-machine';

// ─── Context ──────────────────────────────────────────────────────────────────
export { DraftProvider, useDraftContext } from './context/draft-context';
export type { DraftContextValue } from './context/draft-context';

// ─── Components ───────────────────────────────────────────────────────────────
export { PlanChip } from './components/plan-chip';
export type { PlanChipProps } from './components/plan-chip';

export { Stepper } from './components/stepper';
export type { StepperProps } from './components/stepper';

// ─── Steps ────────────────────────────────────────────────────────────────────
export { StepPlanSelection } from './steps/step-1-plan-selection';
export { StepRepresentativeEmail } from './steps/step-2-representative';
export { StepOtpVerification } from './steps/step-3-otp';
export { StepCompanyData } from './steps/step-4-company';
export { StepPayment } from './steps/step-5-payment';
export { StepSummary } from './steps/step-6-summary';
