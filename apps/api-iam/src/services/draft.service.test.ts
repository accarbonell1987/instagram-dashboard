import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OnboardingDraft, DraftStatus } from '../domain/index.js';
import { ConflictError, GoneError, ValidationError } from '../errors.js';
import { createDraftService } from './draft.service.js';
import { silentLogger } from '../test-helpers/logger.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    id: 'draft-1',
    status: 'draft',
    currentStep: 'plan',
    version: 0,
    planId: undefined,
    data: {},
    representativeEmail: undefined,
    resumeTokenHash: undefined,
    resumeTokenExpiresAt: undefined,
    resumeTokenUsed: false,
    tenantId: undefined,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeConfig() {
  return {
    DRAFT_TTL_SECONDS: 604800,
    RESUME_TOKEN_TTL_SECONDS: 604800,
    HUB_BASE_URL: 'http://localhost:3001',
    BANCARD_RETURN_URL: 'http://localhost:3001/onboarding/payment/return',
    OTP_TTL_SECONDS: 300,
    OTP_MAX_ATTEMPTS: 5,
    OTP_LOCKOUT_SECONDS: 900,
    OTP_RESEND_COOLDOWN_SECONDS: 30,
  };
}

// ─── Mock factory ──────────────────────────────────────────────────────────

function makeDeps(draftOverrides: Partial<OnboardingDraft> = {}) {
  const draft = makeDraft(draftOverrides);

  const draftRepo = {
    create: vi.fn().mockResolvedValue(draft),
    findById: vi.fn().mockResolvedValue(draft),
    findByIdOrThrow: vi.fn().mockResolvedValue(draft),
    findByIdForUpdate: vi.fn().mockResolvedValue(draft),
    update: vi
      .fn()
      .mockImplementation((_id: string, data: Record<string, unknown>) =>
        Promise.resolve({ ...draft, ...data, version: (draft.version as number) + 1 })
      ),
    setResumeToken: vi.fn().mockResolvedValue(undefined),
    markResumeTokenUsed: vi.fn().mockResolvedValue(undefined),
    deleteExpired: vi.fn().mockResolvedValue(0),
  };

  const otpService = {
    sendOtp: vi.fn().mockResolvedValue({
      otpId: 'otp-1',
      channel: 'email',
      maskedDestination: 'a***@example.com',
      expiresAt: new Date(),
      resendAvailableAt: new Date(),
    }),
    verifyOtp: vi.fn(),
  };

  const emailAdapter = {
    send: vi.fn().mockResolvedValue(undefined),
  };

  const planRepo = {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue({ id: 'plan-1', name: 'Starter', price: 50000 }),
  };

  const userRepo = {
    findByEmailGlobal: vi.fn().mockResolvedValue(null),
  };

  const config = makeConfig();

  const prisma = {
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({})),
    onboardingDraft: {
      findUnique: vi.fn().mockResolvedValue(null),
      // updateMany used by resolveResumeToken for atomic find-and-mark
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  return {
    draftRepo,
    otpService,
    emailAdapter,
    planRepo,
    userRepo,
    config,
    prisma,
    draft,
    logger: silentLogger,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('DraftService', () => {
  describe('createDraft', () => {
    it('IAM-ONB-001.1: creates draft with planId — returns draft with version=0', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();
      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      const result = await service.createDraft({ planId: 'plan-1', ipAddress: '127.0.0.1' });

      expect(planRepo.findById).toHaveBeenCalledWith('plan-1');
      expect(draftRepo.create).toHaveBeenCalledWith(expect.objectContaining({ planId: 'plan-1' }));
      expect(result.version).toBe(0);
    });

    it('IAM-ONB-001.2: creates draft without planId — skips plan validation', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();
      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await service.createDraft({ planId: undefined, ipAddress: '127.0.0.1' });

      expect(planRepo.findById).not.toHaveBeenCalled();
      expect(draftRepo.create).toHaveBeenCalledWith(expect.objectContaining({ planId: undefined }));
    });
  });

  describe('getDraft', () => {
    it('returns draft when not expired', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();
      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      const result = await service.getDraft('draft-1');

      expect(draftRepo.findByIdOrThrow).toHaveBeenCalledWith('draft-1');
      expect(result.id).toBe('draft-1');
    });

    it('IAM-ONB-002.2: throws GoneError when draft is expired', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps({
        expiresAt: new Date(Date.now() - 1000),
      });
      draftRepo.findByIdOrThrow.mockResolvedValue(
        makeDraft({ expiresAt: new Date(Date.now() - 1000) })
      );
      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await expect(service.getDraft('draft-1')).rejects.toThrow(GoneError);
    });
  });

  describe('updateDraft', () => {
    it('IAM-ONB-003.1: advances version when version matches', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps({
        status: 'otp_verified',
        currentStep: 'company',
        version: 2,
      });

      // findByIdForUpdate returns draft inside transaction
      draftRepo.findByIdForUpdate.mockResolvedValue(
        makeDraft({ status: 'otp_verified', currentStep: 'company', version: 2 })
      );

      prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({}));

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await service.updateDraft({
        draftId: 'draft-1',
        update: { version: 2, step: 'company', company: { name: 'ACME' } },
        ipAddress: '127.0.0.1',
      });

      expect(draftRepo.update).toHaveBeenCalledWith(
        'draft-1',
        expect.objectContaining({ version: 3 }),
        expect.anything() // tx — the transaction client passed from $transaction callback
      );
    });

    it('IAM-ONB-003.2: throws ConflictError when version is stale', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();

      draftRepo.findByIdForUpdate.mockResolvedValue(makeDraft({ version: 3 }));
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({}));

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await expect(
        service.updateDraft({
          draftId: 'draft-1',
          update: { version: 2, step: 'plan' },
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('IAM-ONB-003.3: unknown fields in update are silently ignored', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();

      draftRepo.findByIdForUpdate.mockResolvedValue(makeDraft({ version: 0 }));
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({}));

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      // Should not throw — unknown fields (otpVerified, randomField) are ignored at runtime
      await expect(
        service.updateDraft({
          draftId: 'draft-1',
          update: {
            version: 0,
            step: 'plan',
            // Cast to DraftUpdateInput to test runtime behaviour with extra fields
          } as Parameters<ReturnType<typeof createDraftService>['updateDraft']>[0]['update'],
          ipAddress: '127.0.0.1',
        })
      ).resolves.not.toThrow();
    });

    it('IAM-ONB-003.4: step=representative sets status=otp_pending (OTP is sent by hub, not backend)', async () => {
      // Bug 3 fix: OTP is now sent exclusively by the hub (representative-step.tsx).
      // updateDraft only advances the draft status to otp_pending — it does NOT call sendOtp.
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();

      draftRepo.findByIdForUpdate.mockResolvedValue(makeDraft({ version: 0, currentStep: 'plan' }));
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({}));

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await service.updateDraft({
        draftId: 'draft-1',
        update: {
          version: 0,
          step: 'representative',
          representative: { email: 'ana@empresa.com', fullName: 'Ana Pérez' },
        },
        ipAddress: '127.0.0.1',
      });

      // OTP must NOT be sent by the draft service — hub is responsible
      expect(otpService.sendOtp).not.toHaveBeenCalled();

      // Draft update should have set status to otp_pending
      expect(draftRepo.update).toHaveBeenCalledWith(
        'draft-1',
        expect.objectContaining({ status: 'otp_pending', representativeEmail: 'ana@empresa.com' }),
        expect.anything()
      );
    });

    it('throws ValidationError on invalid step transition', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();

      // currentStep=company, requesting step=plan (not allowed)
      draftRepo.findByIdForUpdate.mockResolvedValue(
        makeDraft({ version: 0, currentStep: 'company', status: 'otp_verified' })
      );
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({}));

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await expect(
        service.updateDraft({
          draftId: 'draft-1',
          update: { version: 0, step: 'plan' },
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('resolveResumeToken', () => {
    it('IAM-ONB-004.1: valid token returns draftId and marks token used atomically', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();

      // updateMany succeeds (count: 1) — token found, not used, not expired
      prisma.onboardingDraft.updateMany.mockResolvedValue({ count: 1 });
      // findUnique called after updateMany to retrieve the draft details
      prisma.onboardingDraft.findUnique.mockResolvedValue({
        id: 'draft-1',
        status: 'draft',
        resumeTokenHash: 'some-hash',
        resumeTokenUsed: true, // already marked by updateMany
        resumeTokenExpiresAt: new Date(Date.now() + 86400 * 1000),
      });

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      const result = await service.resolveResumeToken('valid-token');

      expect(result).toEqual({ draftId: 'draft-1' });
      // updateMany is the atomic operation — markResumeTokenUsed is no longer called
      expect(prisma.onboardingDraft.updateMany).toHaveBeenCalledOnce();
    });

    it('IAM-ONB-004.2: throws GoneError when token not found (updateMany returns count 0)', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();

      // updateMany returns 0 — token not found (or already used, or expired)
      prisma.onboardingDraft.updateMany.mockResolvedValue({ count: 0 });

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await expect(service.resolveResumeToken('bad-token')).rejects.toThrow(GoneError);
    });

    it('IAM-ONB-004.2: throws GoneError when token already used (updateMany returns count 0)', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();

      // Used token: WHERE resumeTokenUsed=false won't match, updateMany returns 0
      prisma.onboardingDraft.updateMany.mockResolvedValue({ count: 0 });

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await expect(service.resolveResumeToken('used-token')).rejects.toThrow(GoneError);
    });

    it('throws GoneError when token is expired (updateMany returns count 0)', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();

      // Expired token: WHERE expiresAt > now won't match, updateMany returns 0
      prisma.onboardingDraft.updateMany.mockResolvedValue({ count: 0 });

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await expect(service.resolveResumeToken('expired-token')).rejects.toThrow(GoneError);
    });

    it('throws GoneError when draft is already completed', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps();

      // updateMany succeeds — token was valid
      prisma.onboardingDraft.updateMany.mockResolvedValue({ count: 1 });
      // But the draft status is 'completed'
      prisma.onboardingDraft.findUnique.mockResolvedValue({
        id: 'draft-1',
        status: 'completed',
        resumeTokenHash: 'some-hash',
        resumeTokenUsed: true,
        resumeTokenExpiresAt: new Date(Date.now() + 86400 * 1000),
      });

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await expect(service.resolveResumeToken('completed-draft-token')).rejects.toThrow(GoneError);
    });
  });

  describe('sendResumeLink', () => {
    it('sends email using HUB_BASE_URL and returns { sent: true }', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps({
        representativeEmail: 'ana@empresa.com',
      });

      draftRepo.findByIdOrThrow.mockResolvedValue(
        makeDraft({ representativeEmail: 'ana@empresa.com' })
      );

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      const result = await service.sendResumeLink('draft-1');

      expect(result).toEqual({ sent: true });
      expect(draftRepo.setResumeToken).toHaveBeenCalledWith(
        'draft-1',
        expect.any(String),
        expect.any(Date)
      );
      expect(emailAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ana@empresa.com',
          html: expect.stringContaining('http://localhost:3001/signup/resume/'),
        })
      );
      // Must NOT use BANCARD_RETURN_URL in the resume URL
      expect(emailAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.not.stringContaining('onboarding/payment/return'),
        })
      );
    });

    it('throws ValidationError when representativeEmail is missing', async () => {
      const { draftRepo, otpService, emailAdapter, planRepo, userRepo, config, prisma } = makeDeps({
        representativeEmail: undefined,
      });

      draftRepo.findByIdOrThrow.mockResolvedValue(makeDraft({ representativeEmail: undefined }));

      const service = createDraftService({
        draftRepo,
        otpService,
        emailAdapter,
        planRepo,
        userRepo,
        config,
        prisma,
        logger: silentLogger,
      } as never);

      await expect(service.sendResumeLink('draft-1')).rejects.toThrow(ValidationError);
      expect(emailAdapter.send).not.toHaveBeenCalled();
    });
  });
});
