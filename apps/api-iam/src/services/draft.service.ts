import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import type { OnboardingDraftRepository, PlanRepository, UserRepository } from '../repositories/index.js';
import type { EmailAdapter } from '../adapters/index.js';
import type { OtpService } from './otp.service.js';
import type { Config } from '../config.js';
import type { OnboardingDraft, DraftStatus, DraftStep } from '../domain/index.js';
import type { Logger } from '../lib/logger.js';
import { ConflictError, GoneError, ValidationError } from '../errors.js';

export type DraftServiceDeps = {
  draftRepo: OnboardingDraftRepository;
  otpService: OtpService;
  emailAdapter: EmailAdapter;
  planRepo: PlanRepository;
  userRepo: UserRepository;
  config: Config;
  prisma: PrismaClient;
  logger: Logger;
};

export type DraftUpdateInput = {
  version: number;
  step: DraftStep;
  plan?: Record<string, unknown> | undefined;
  representative?:
    | { email?: string | undefined; fullName?: string | undefined; phone?: string | undefined }
    | undefined;
  company?: Record<string, unknown> | undefined;
  payment?: Record<string, unknown> | undefined;
  summary?: Record<string, unknown> | undefined;
};

// Valid step transitions per server-authoritative state machine (spec domain 2)
const ALLOWED_TRANSITIONS: ReadonlyMap<DraftStep, ReadonlySet<DraftStep>> = new Map([
  ['plan', new Set<DraftStep>(['plan', 'representative'])],
  ['representative', new Set<DraftStep>(['representative', 'otp'])],
  // otp_verified status enables moving forward to company or payment from the otp step
  ['otp', new Set<DraftStep>(['otp', 'company', 'payment'])],
  ['company', new Set<DraftStep>(['company', 'payment'])],
  ['payment', new Set<DraftStep>(['payment', 'summary'])],
  ['summary', new Set<DraftStep>(['summary'])],
]);

// Mapping from draft status to the allowed "incoming" step transitions
const STATUS_ALLOWED_STEPS: ReadonlyMap<DraftStatus, ReadonlySet<DraftStep>> = new Map([
  ['draft', new Set<DraftStep>(['plan', 'representative'])],
  ['otp_pending', new Set<DraftStep>(['otp', 'representative'])],
  ['otp_verified', new Set<DraftStep>(['company', 'payment'])],
  ['payment_pending', new Set<DraftStep>(['payment', 'company'])],
  ['payment_confirmed', new Set<DraftStep>(['summary', 'payment'])],
]);

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function isStepTransitionAllowed(currentStep: DraftStep, requestedStep: DraftStep): boolean {
  return ALLOWED_TRANSITIONS.get(currentStep)?.has(requestedStep) ?? false;
}

export function createDraftService(deps: DraftServiceDeps) {
  const { draftRepo, emailAdapter, planRepo, userRepo, config, prisma } = deps;
  const log = deps.logger.child({ component: 'draft' });

  async function createDraft(params: {
    planId?: string | undefined;
    ipAddress: string;
  }): Promise<OnboardingDraft> {
    const { planId, ipAddress: _ipAddress } = params;

    if (planId !== undefined) {
      // Validates plan exists — throws NotFoundError if not
      await planRepo.findById(planId);
    }

    const expiresAt = new Date(Date.now() + config.DRAFT_TTL_SECONDS * 1000);
    return draftRepo.create({ planId, expiresAt });
  }

  async function getDraft(draftId: string): Promise<OnboardingDraft> {
    const draft = await draftRepo.findByIdOrThrow(draftId);
    if (draft.expiresAt < new Date()) {
      log.debug({ category: 'onboarding', event: 'draft_expired', draftId }, 'draft_expired');
      throw new GoneError('onboarding.draft_expired');
    }
    return draft;
  }

  async function updateDraft(params: {
    draftId: string;
    update: DraftUpdateInput;
    ipAddress: string;
  }): Promise<OnboardingDraft> {
    const { draftId, update } = params;

    const updatedDraft = await prisma.$transaction(async (tx) => {
      const draft = await draftRepo.findByIdForUpdate(draftId, tx);

      if (draft.expiresAt < new Date()) {
        throw new GoneError('onboarding.draft_expired');
      }

      if (update.version !== draft.version) {
        throw new ConflictError('onboarding.version_conflict', undefined, {
          current: {
            id: draft.id,
            version: draft.version,
            currentStep: draft.currentStep,
            status: draft.status,
          },
        });
      }

      const requestedStep = update.step;

      if (!isStepTransitionAllowed(draft.currentStep, requestedStep)) {
        throw new ValidationError(
          'onboarding.invalid_step_transition',
          `Cannot transition from step "${draft.currentStep}" to "${requestedStep}"`
        );
      }

      // Merge step-specific data into the existing draft.data JSON.
      // Data fields are saved when present in the update, regardless of the requestedStep
      // value — because the contract convention is that `step` is the DESTINATION step
      // (e.g., sending step:"representative" while also providing plan data advances the
      // wizard AND saves the plan in one atomic operation).
      const mergedData: Record<string, unknown> = { ...draft.data };
      if (update.plan !== undefined) {
        mergedData['plan'] = update.plan;
      }
      if (update.representative !== undefined) {
        mergedData['representative'] = update.representative;
      }
      if (update.company !== undefined) {
        mergedData['company'] = update.company;
      }
      if (update.payment !== undefined) {
        mergedData['payment'] = update.payment;
      }
      if (update.summary !== undefined) {
        mergedData['summary'] = update.summary;
      }

      let newStatus: DraftStatus = draft.status;
      let representativeEmail: string | undefined = draft.representativeEmail;

      if (requestedStep === 'representative' && update.representative?.email) {
        const existingUser = await userRepo.findByEmailGlobal(update.representative.email);
        if (existingUser) {
          throw new ConflictError(
            'onboarding.email_already_exists',
            `Email ${update.representative.email} is already registered`
          );
        }
        representativeEmail = update.representative.email;
        newStatus = 'otp_pending';
      }

      if (requestedStep === 'company' && update.company && typeof update.company['ruc'] === 'string') {
        const existingDraft = await draftRepo.findByRuc(update.company['ruc'] as string, draftId);
        if (existingDraft) {
          throw new ConflictError(
            'onboarding.ruc_already_exists',
            `RUC ${update.company['ruc'] as string} is already registered`
          );
        }
      }

      // Extract planId from plan data when present (plan.id is the canonical FK)
      const incomingPlanId =
        update.plan !== undefined && typeof update.plan['id'] === 'string'
          ? (update.plan['id'] as string)
          : undefined;

      // Pass tx so the write participates in the same transaction (row lock covers the update)
      const result = await draftRepo.update(
        draftId,
        {
          data: mergedData,
          currentStep: requestedStep,
          version: draft.version + 1,
          status: newStatus,
          representativeEmail,
          ...(incomingPlanId !== undefined && { planId: incomingPlanId }),
        },
        tx
      );

      if (requestedStep === 'summary') {
        log.info(
          { category: 'onboarding', event: 'draft_submitted', draftId, version: result.version },
          'draft_submitted'
        );
      }

      return result;
    });

    return updatedDraft;
  }

  async function resolveResumeToken(token: string): Promise<{ draftId: string }> {
    const tokenHash = hashToken(token);
    const now = new Date();

    // Atomic find-and-mark-used: updateMany with WHERE guards against race conditions.
    // If another request already used the token (or it expired), count will be 0.
    const result = await prisma.onboardingDraft.updateMany({
      where: {
        resumeTokenHash: tokenHash,
        resumeTokenUsed: false,
        OR: [{ resumeTokenExpiresAt: null }, { resumeTokenExpiresAt: { gt: now } }],
      },
      data: { resumeTokenUsed: true },
    });

    if (result.count === 0) {
      throw new GoneError('onboarding.resume_token_expired');
    }

    // Fetch the draft after marking — the WHERE above guarantees exactly one row was updated
    const raw = await prisma.onboardingDraft.findUnique({
      where: { resumeTokenHash: tokenHash },
    });

    if (!raw) {
      // Should not happen given updateMany succeeded, but guard defensively
      throw new GoneError('onboarding.resume_token_expired');
    }

    // Bug 2 fix: reject tokens for drafts that are already completed or abandoned
    if (raw.status === 'completed' || raw.status === 'abandoned') {
      throw new GoneError('onboarding.draft_already_completed');
    }

    return { draftId: raw.id };
  }

  async function recoverDraft(params: {
    draftId: string;
    step: 'company';
  }): Promise<OnboardingDraft> {
    const { draftId, step } = params;

    const draft = await draftRepo.findByIdOrThrow(draftId);

    if (draft.expiresAt < new Date()) {
      throw new GoneError('onboarding.draft_expired');
    }

    if (draft.status !== 'payment_confirmed' || draft.tenantId !== undefined) {
      throw new ConflictError(
        'onboarding.not_recoverable',
        'Draft cannot be recovered: either it has not reached payment_confirmed status or a tenant was already provisioned'
      );
    }

    const newData = { ...(draft.data as Record<string, unknown>) };

    if (step === 'company') {
      delete newData['company'];
    }

    await prisma.onboardingDraft.update({
      where: { id: draftId },
      data: { data: newData as Prisma.InputJsonValue },
    });

    return draftRepo.findByIdOrThrow(draftId);
  }

  async function sendResumeLink(draftId: string): Promise<{ sent: boolean }> {
    const draft = await getDraft(draftId);

    // Bug 4 fix: validate that a representative email exists before attempting to send
    if (!draft.representativeEmail) {
      throw new ValidationError(
        'onboarding.no_representative_email',
        'Cannot send resume link: representative email not yet provided'
      );
    }

    const plainToken = nanoid(32);
    const tokenHash = hashToken(plainToken);
    const expiresAt = new Date(Date.now() + config.RESUME_TOKEN_TTL_SECONDS * 1000);

    await draftRepo.setResumeToken(draftId, tokenHash, expiresAt);

    // Bug 3 fix: use HUB_BASE_URL instead of parsing BANCARD_RETURN_URL
    const resumeUrl = `${config.HUB_BASE_URL}/signup/resume/${plainToken}`;

    await emailAdapter.send({
      to: draft.representativeEmail,
      subject: 'Retomar tu proceso de registro en Corehub',
      html: `<p>Haz clic en el siguiente enlace para continuar tu registro: <a href="${resumeUrl}">${resumeUrl}</a></p>`,
      text: `Continúa tu registro aquí: ${resumeUrl}`,
    });

    return { sent: true };
  }

  return {
    createDraft,
    getDraft,
    updateDraft,
    resolveResumeToken,
    sendResumeLink,
    recoverDraft,
  };
}

export type DraftService = ReturnType<typeof createDraftService>;
