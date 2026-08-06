import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OnboardingDraft, Tenant } from '../domain/index.js'
import { DEFAULT_PRODUCT_ID } from '../domain/index.js'
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

function makePaymentRow(overrides: Partial<{ id: string; status: string }> = {}) {
  return {
    id: 'payment-1',
    draftId: 'draft-1',
    status: 'approved',
    initiatedAt: new Date(),
    ...overrides,
  }
}

function makeTxClient(paymentStatus = 'approved') {
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
        status: 'pending',
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
    payment: {
      findFirst: vi.fn().mockResolvedValue(makePaymentRow({ status: paymentStatus })),
      update: vi.fn().mockResolvedValue({}),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
    },
    tenantProductSubscription: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  }
}

function makeDeps(paymentStatus = 'approved') {
  const draft = makeDraft()
  const tx = makeTxClient(paymentStatus)

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
    findByExternalRef: vi.fn(),
    listByTenant: vi.fn(),
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

  const settlementService = {
    settlePayment: vi.fn().mockResolvedValue({
      payment: makePaymentRow({ status: 'approved' }),
      alreadySettled: false,
    }),
  }

  const config = makeConfig()

  const prisma = {
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  }

  return { draftRepo, tenantRepo, userRepo, documentRepo, refreshTokenRepo, paymentRepo, pdfAdapter, storageAdapter, emailAdapter, tokenService, settlementService, config, prisma, logger: silentLogger, tx }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SubmitService', () => {
  describe('submit', () => {
    it('IAM-ONB-008.1: Bancard-approved happy path — provisions, settles inline, returns SubmitResponse (regression)', async () => {
      const deps = makeDeps('approved')
      const service = createSubmitService(deps as never)

      const result = await service.submit({ draftId: 'draft-1', version: 5 })

      // Transaction should have run
      expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1)

      // Schema created
      expect(deps.tx.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE SCHEMA'),
      )

      // Tenant created — pending, not active (activation is settlement's job)
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

      // submit.service.ts no longer flips tenant status itself
      expect(deps.tx.tenant.update).not.toHaveBeenCalled()

      // Payment.tenantId backfilled
      expect(deps.tx.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { tenantId: 'tenant-uuid-1' },
      })

      // Bancard is already approved by the time summary is reached — submit settles
      // it inline through the shared path (regression: preserves today's UX)
      expect(deps.settlementService.settlePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: 'payment-1', decision: 'approved', settlementKind: 'gateway_webhook' }),
        deps.tx,
      )

      // Draft completed
      expect(deps.tx.onboardingDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
      )

      // a2 (2.2): tenant's plan assignment stays in sync with TenantProductSubscription
      expect(deps.tx.tenantProductSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_productId: { tenantId: 'tenant-uuid-1', productId: DEFAULT_PRODUCT_ID } },
          create: expect.objectContaining({ tenantId: 'tenant-uuid-1', productId: DEFAULT_PRODUCT_ID, planId: 'professional' }),
          update: expect.objectContaining({ planId: 'professional' }),
        }),
      )

      // Only the CONTRACT PDF is generated at submit — invoice moved to settlement
      expect(deps.pdfAdapter.generate).toHaveBeenCalledTimes(1)
      expect(deps.pdfAdapter.generate).toHaveBeenCalledWith(expect.objectContaining({ type: 'contract' }))

      // Only the contract file is uploaded
      expect(deps.storageAdapter.upload).toHaveBeenCalledTimes(1)

      // Documents inserted in tx: contract (ready) + invoice (pending placeholder)
      expect(deps.tx.document.create).toHaveBeenCalledTimes(2)
      expect(deps.tx.document.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'invoice', status: 'pending', storageKey: 'pending' }) }),
      )

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

    it('invokes settlePayment.finalize only after the provisioning transaction commits', async () => {
      const deps = makeDeps('approved')
      const finalize = vi.fn().mockResolvedValue(undefined)
      deps.settlementService.settlePayment.mockResolvedValue({
        payment: makePaymentRow({ status: 'approved' }),
        alreadySettled: false,
        finalize,
      })
      deps.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txResult = await fn(deps.tx)
        // Still inside the transaction here — finalize must not have run yet.
        expect(finalize).not.toHaveBeenCalled()
        return txResult
      })
      const service = createSubmitService(deps as never)

      await service.submit({ draftId: 'draft-1', version: 5 })

      expect(finalize).toHaveBeenCalledTimes(1)
    })

    it('provisions a bank-transfer draft with a still-pending payment — tenant stays pending, no settlement, no activation email', async () => {
      const deps = makeDeps('pending')
      const service = createSubmitService(deps as never)

      const result = await service.submit({ draftId: 'draft-1', version: 5 })

      // Tenant provisioned pending — never activated at submit
      expect(deps.tx.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'pending' }) }),
      )
      expect(deps.tx.tenant.update).not.toHaveBeenCalled()

      // Still backfills tenantId so admin/billing lists can find the payment
      expect(deps.tx.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { tenantId: 'tenant-uuid-1' },
      })

      // Nothing to settle yet — bank-transfer waits for agent confirm
      expect(deps.settlementService.settlePayment).not.toHaveBeenCalled()

      // The latent bug this redesign fixes: no activation email at submit, ever
      expect(deps.emailAdapter.send).not.toHaveBeenCalled()

      // Draft still reaches completed + returns a usable SubmitResponse
      expect(result.tenantId).toBe('tenant-uuid-1')
      expect(result.documents.invoiceId).toBeTruthy()
    })

    it('throws ConflictError when the draft has no payment to submit', async () => {
      const deps = makeDeps('approved')
      deps.tx.payment.findFirst.mockResolvedValue(null)
      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 5 })).rejects.toThrow(ConflictError)
      expect(deps.settlementService.settlePayment).not.toHaveBeenCalled()
    })

    it.each(['declined', 'cancelled', 'reversed'])(
      'throws ConflictError and never provisions a tenant when the payment is %s',
      async (paymentStatus) => {
        const deps = makeDeps(paymentStatus)
        const service = createSubmitService(deps as never)

        await expect(service.submit({ draftId: 'draft-1', version: 5 })).rejects.toThrow(ConflictError)
        expect(deps.tx.tenant.create).not.toHaveBeenCalled()
        expect(deps.settlementService.settlePayment).not.toHaveBeenCalled()
      },
    )

    it.each(['pending', 'in_review', 'approved'])(
      'still provisions the tenant when the payment is %s',
      async (paymentStatus) => {
        const deps = makeDeps(paymentStatus)
        const service = createSubmitService(deps as never)

        const result = await service.submit({ draftId: 'draft-1', version: 5 })

        expect(deps.tx.tenant.create).toHaveBeenCalled()
        expect(result.tenantId).toBe('tenant-uuid-1')
      },
    )

    it('throws ConflictError on version mismatch', async () => {
      const deps = makeDeps('approved')
      // Draft has version 5, but we submit with version 3
      deps.draftRepo.findByIdForUpdate.mockResolvedValue(makeDraft({ version: 5 }))
      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 3 })).rejects.toThrow(ConflictError)
    })

    it('IAM-ONB-008.4: unexpected errors propagate as InternalError (full rollback by Prisma)', async () => {
      const deps = makeDeps('approved')

      // Make PDF generation fail — simulates mid-transaction failure
      deps.pdfAdapter.generate.mockRejectedValue(new Error('PDF engine crash'))

      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 5 })).rejects.toThrow(InternalError)
    })

    it('throws ConflictError when email already exists (pre-transaction check)', async () => {
      const deps = makeDeps('approved')
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
      const deps = makeDeps('approved')
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
      const deps = makeDeps('approved')
      // Pre-checks pass — email not found, no RUC in data
      deps.userRepo.findByEmailGlobal.mockResolvedValue(null)
      deps.draftRepo.findByRuc.mockResolvedValue(null)
      // Transaction throws P2002 (race condition fallback)
      deps.prisma.$transaction.mockRejectedValue({ code: 'P2002' })
      const service = createSubmitService(deps as never)

      await expect(service.submit({ draftId: 'draft-1', version: 5 }))
        .rejects.toThrow(ConflictError)
    })

    it('does not generate an activation token on the User row — that is settlement.service.ts\'s job now', async () => {
      const deps = makeDeps('approved')
      deps.userRepo.findByEmailGlobal.mockResolvedValue(null)
      deps.draftRepo.findByRuc.mockResolvedValue(null)
      const service = createSubmitService(deps as never)

      await service.submit({ draftId: 'draft-1', version: 5 })

      expect(deps.tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ activationTokenHash: expect.anything() }),
        }),
      )
    })
  })
})
