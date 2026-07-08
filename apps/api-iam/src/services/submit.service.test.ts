import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OnboardingDraft, Tenant } from '../domain/index.js'
import { ConflictError, InternalError } from '../errors.js'
import { createSubmitService } from './submit.service.js'
import { silentLogger } from '../test-helpers/logger.js'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    id: 'draft-1',
    status: 'payment_confirmed',
    currentStep: 'summary',
    version: 5,
    planId: 'professional',
    data: {
      // Bug 1 fix: hub sends legalName (not name), and slug is derived from it
      company: { slug: 'acme', legalName: 'ACME Corp' },
      representative: { email: 'ana@acme.com', fullName: 'Ana Pérez' },
    },
    representativeEmail: 'ana@acme.com',
    resumeTokenHash: undefined,
    resumeTokenExpiresAt: undefined,
    resumeTokenUsed: false,
    tenantId: undefined,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant-uuid-1',
    slug: 'acme',
    name: 'ACME Corp',
    schemaName: 'tenant_acme',
    planId: 'professional',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeConfig() {
  return {
    RESERVED_TENANT_SLUGS: ['www', 'api', 'app', 'admin', 'hub'],
    JWT_REFRESH_TOKEN_TTL_SECONDS: 604800,
    JWT_ACCESS_TOKEN_TTL_SECONDS: 900,
    HUB_BASE_URL: 'http://localhost:3001',
  }
}

function makeTxClient(draftStatus = 'payment_confirmed' as OnboardingDraft['status']) {
  return {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    tenant: {
      // Bug 1 fix: add findUnique mock for slug uniqueness check
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'tenant-uuid-1',
        slug: 'acme',
        name: 'ACME Corp',
        schemaName: 'tenant_acme',
        planId: 'professional',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      create: vi.fn().mockResolvedValue({
        id: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
        email: 'ana@acme.com',
        role: 'TenantAdmin',
        status: 'pending_first_login',
        passwordHash: null,
        fullName: 'Ana Pérez',
        picture: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    onboardingDraft: {
      update: vi.fn().mockResolvedValue({}),
    },
    document: {
      create: vi.fn().mockResolvedValue({}),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

function makeDeps(draftStatus = 'payment_confirmed' as OnboardingDraft['status']) {
  const draft = makeDraft({ status: draftStatus })
  const tx = makeTxClient(draftStatus)

  const draftRepo = {
    findByIdForUpdate: vi.fn().mockResolvedValue(draft),
    update: vi.fn(),
    findByIdOrThrow: vi.fn().mockResolvedValue(draft),
    findById: vi.fn().mockResolvedValue(draft),
    findByRuc: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    setResumeToken: vi.fn(),
    markResumeTokenUsed: vi.fn(),
    deleteExpired: vi.fn(),
  }

  const tenantRepo = {
    findByUuid: vi.fn().mockResolvedValue(makeTenant()),
    findBySlug: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(makeTenant()),
    updateStatus: vi.fn(),
  }

  const userRepo = {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findByEmailGlobal: vi.fn().mockResolvedValue(null),
    findById: vi.fn(),
    updateStatus: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    resetFailedAttempts: vi.fn(),
    setLockedUntil: vi.fn(),
    setPasswordHash: vi.fn(),
  }

  const documentRepo = {
    create: vi.fn().mockResolvedValue({ id: 'doc-1', tenantId: 'tenant-uuid-1', type: 'invoice', storageKey: 'key', status: 'ready', createdAt: new Date(), updatedAt: new Date() }),
    findById: vi.fn(),
    findByTenantId: vi.fn(),
    updateStatus: vi.fn(),
  }

  const refreshTokenRepo = {
    create: vi.fn(),
    findByHash: vi.fn(),
    findByHashForUpdate: vi.fn(),
    markUsedByHash: vi.fn(),
    invalidateFamily: vi.fn(),
    findActiveByUserId: vi.fn(),
  }

  const paymentRepo = {
    create: vi.fn(),
    findByDraftId: vi.fn(),
    findByBancardProcessId: vi.fn(),
    updateStatus: vi.fn(),
    cancelPendingByDraftId: vi.fn(),
  }

  const pdfAdapter = {
    generate: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  }

  const storageAdapter = {
    upload: vi.fn().mockResolvedValue(undefined),
    signedUrl: vi.fn()
      .mockResolvedValueOnce('https://storage/invoice.pdf?sig=abc')
      .mockResolvedValueOnce('https://storage/contract.pdf?sig=xyz'),
  }

  const tokenService = {
    signAccessToken: vi.fn().mockResolvedValue({
      accessToken: 'eyJhbGciOiJSUzI1NiJ9.test',
      expiresIn: 900,
      tokenType: 'Bearer',
    }),
    signRefreshTokenRaw: vi.fn().mockReturnValue('raw-refresh-token-64chars'),
    verifyAccessToken: vi.fn(),
    verifyOtpVerificationToken: vi.fn(),
    getJwks: vi.fn(),
  }

  const emailAdapter = {
    send: vi.fn().mockResolvedValue(undefined),
  }

  const config = makeConfig()

  const prisma = {
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  }

  return { draftRepo, tenantRepo, userRepo, documentRepo, refreshTokenRepo, paymentRepo, pdfAdapter, storageAdapter, emailAdapter, tokenService, config, prisma, logger: silentLogger, tx }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SubmitService', () => {
  describe('submit', () => {
    it('IAM-ONB-008.1: happy path — runs full provisioning and returns SubmitResponse', async () => {
      const deps = makeDeps('payment_confirmed')
      const service = createSubmitService(deps as never)

      const result = await service.submit({ draftId: 'draft-1', version: 5 })

      // Transaction should have run
      expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1)

      // Schema created
      expect(deps.tx.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE SCHEMA'),
      )

      // Tenant created
      expect(deps.tx.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'acme', status: 'pending' }) }),
      )

      // User created
      expect(deps.tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'ana@acme.com',
            role: 'TenantAdmin',
            status: 'pending_first_login',
          }),
        }),
      )

      // Tenant activated
      expect(deps.tx.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'active' } }),
      )

      // Draft completed
      expect(deps.tx.onboardingDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
      )

      // PDFs generated (2 — invoice + contract)
      expect(deps.pdfAdapter.generate).toHaveBeenCalledTimes(2)

      // Files uploaded
      expect(deps.storageAdapter.upload).toHaveBeenCalledTimes(2)

      // Documents inserted in tx
      expect(deps.tx.document.create).toHaveBeenCalledTimes(2)

      // Refresh token inserted in tx
      expect(deps.tx.refreshToken.create).toHaveBeenCalledTimes(1)

      // Bug 9 fix: signed URLs are no longer generated at submit time (hub fetches on demand)
      expect(deps.storageAdapter.signedUrl).not.toHaveBeenCalled()

      // Access token signed
      expect(deps.tokenService.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'TenantAdmin' }),
      )

      // Response shape — now returns document IDs, not URLs
      expect(result).toMatchObject({
        tenantId: 'tenant-uuid-1',
        accessToken: expect.any(String),
        expiresIn: 900,
        tokenType: 'Bearer',
        documents: {
          invoiceId: expect.any(String),
          contractId: expect.any(String),
        },
      })
    })

    it('IAM-ONB-008.3: throws ConflictError when draft status is not payment_confirmed', async () => {
      const deps = makeDeps('otp_verified')
      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 5 })).rejects.toThrow(ConflictError)
    })

    it('throws ConflictError on version mismatch', async () => {
      const deps = makeDeps('payment_confirmed')
      // Draft has version 5, but we submit with version 3
      deps.draftRepo.findByIdForUpdate.mockResolvedValue(makeDraft({ version: 5 }))
      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 3 })).rejects.toThrow(ConflictError)
    })

    it('IAM-ONB-008.4: unexpected errors propagate as InternalError (full rollback by Prisma)', async () => {
      const deps = makeDeps('payment_confirmed')

      // Make PDF generation fail — simulates mid-transaction failure
      deps.pdfAdapter.generate.mockRejectedValue(new Error('PDF engine crash'))

      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 5 })).rejects.toThrow(InternalError)
    })

    it('throws ConflictError when email already exists (pre-transaction check)', async () => {
      const deps = makeDeps('payment_confirmed')
      // Mock an existing user with the same email
      deps.userRepo.findByEmailGlobal.mockResolvedValue({
        id: 'existing-user',
        tenantId: 'other-tenant',
        email: 'ana@acme.com',
        role: 'TenantAdmin',
        status: 'active',
        fullName: 'Ana Pérez',
        picture: null,
        passwordHash: undefined,
        failedLoginAttempts: 0,
        lockedUntil: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 5 }))
        .rejects.toThrow(ConflictError)

      // Verify the transaction was NOT called (pre-check prevents it)
      expect(deps.prisma.$transaction).not.toHaveBeenCalled()
    })

    it('throws ConflictError when RUC already exists (pre-transaction check)', async () => {
      const deps = makeDeps('payment_confirmed')
      // Draft has RUC in company data
      deps.draftRepo.findByIdOrThrow.mockResolvedValue(
        makeDraft({
          data: {
            company: { ruc: '123456789', slug: 'acme', legalName: 'ACME Corp' },
            representative: { email: 'ana@acme.com', fullName: 'Ana Pérez' },
          },
        }),
      )
      // RUC is already taken by another draft
      deps.draftRepo.findByRuc.mockResolvedValue(makeDraft({ id: 'other-draft' }))
      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 5 }))
        .rejects.toThrow(ConflictError)

      // Verify findByRuc was called with the correct RUC
      expect(deps.draftRepo.findByRuc).toHaveBeenCalledWith('123456789', 'draft-1');
    })

    it('converts Prisma P2002 duplicate-key to ConflictError', async () => {
      const deps = makeDeps('payment_confirmed')
      // Pre-checks pass — email not found, no RUC in data
      deps.userRepo.findByEmailGlobal.mockResolvedValue(null)
      deps.draftRepo.findByRuc.mockResolvedValue(null)
      // Transaction throws P2002 (race condition fallback)
      deps.prisma.$transaction.mockRejectedValue({ code: 'P2002' })
      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 5 }))
        .rejects.toThrow(ConflictError)
    })

    it('sends activation email with tokenized URL on successful submit', async () => {
      const deps = makeDeps('payment_confirmed')
      deps.userRepo.findByEmailGlobal.mockResolvedValue(null)
      deps.draftRepo.findByRuc.mockResolvedValue(null)
      const service = createSubmitService(deps as never)

      await service.submit({ draftId: 'draft-1', version: 5 })

      expect(deps.emailAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ana@acme.com',
          subject: 'Tu empresa ha sido activada',
          html: expect.stringContaining('/first-login?token='),
        }),
      )
      // Verify email uses branded template (contains Corehub branding in html)
      expect(deps.emailAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Corehub'),
        }),
      )
      // Verify email does NOT contain the old broken URL
      expect(deps.emailAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.not.stringContaining('/login?first-login=true'),
        }),
      )
    })

    it('activation email failure logs warning but does not throw', async () => {
      const deps = makeDeps('payment_confirmed')
      deps.userRepo.findByEmailGlobal.mockResolvedValue(null)
      deps.draftRepo.findByRuc.mockResolvedValue(null)
      deps.emailAdapter.send.mockRejectedValue(new Error('SMTP connection refused'))
      const service = createSubmitService(deps as never)

      // Should NOT throw — submit succeeds despite email failure
      const result = await service.submit({ draftId: 'draft-1', version: 5 })

      expect(result).toMatchObject({
        tenantId: expect.any(String),
        accessToken: expect.any(String),
      })
    })

    it('stores activation token hash on User during transaction', async () => {
      const deps = makeDeps('payment_confirmed')
      deps.userRepo.findByEmailGlobal.mockResolvedValue(null)
      deps.draftRepo.findByRuc.mockResolvedValue(null)
      const service = createSubmitService(deps as never)

      await service.submit({ draftId: 'draft-1', version: 5 })

      expect(deps.tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activationTokenHash: expect.any(String),
            activationTokenExpiresAt: expect.any(Date),
            activationTokenUsed: false,
          }),
        }),
      )
    })
  })
})
