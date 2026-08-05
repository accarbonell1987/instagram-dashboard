import { createHash } from 'crypto'
import { nanoid } from 'nanoid'
import type { PrismaClient } from '../generated/prisma/client.js'
import type {
  OnboardingDraftRepository,
  TenantRepository,
  UserRepository,
  DocumentRepository,
  RefreshTokenRepository,
  PaymentRepository,
} from '../repositories/index.js'
import type { EmailAdapter, PdfAdapter, StorageAdapter } from '../adapters/index.js'
import type { TokenService } from './token.service.js'
import type { SettlementService } from './settlement.service.js'
import type { Config } from '../config.js'
import type { Tenant } from '../domain/index.js'
import { DEFAULT_PRODUCT_ID } from '../domain/index.js'
import { purgeAnalyticsEntitlementsCache } from '../lib/entitlements-purge.js'
import { slugToSchemaName } from '../db/with-tenant.js'
import { runTenantMigrations } from '../db/migration-runner.js'
import { ConflictError, InternalError } from '../errors.js'
import type { Logger } from '../lib/logger.js'

export type SubmitServiceDeps = {
  draftRepo: OnboardingDraftRepository
  tenantRepo: TenantRepository
  userRepo: UserRepository
  documentRepo: DocumentRepository
  refreshTokenRepo: RefreshTokenRepository
  paymentRepo: PaymentRepository
  pdfAdapter: PdfAdapter
  storageAdapter: StorageAdapter
  emailAdapter: EmailAdapter
  tokenService: TokenService
  settlementService: SettlementService
  prisma: PrismaClient
  config: Config
  logger: Logger
}

export type SubmitResponse = {
  tenantId: string
  tenant: Tenant
  accessToken: string
  expiresIn: number
  tokenType: 'Bearer'
  refreshTokenRaw: string
  documents: {
    // Bug 9 fix: return document IDs so the hub can fetch fresh signed URLs on demand
    // via GET /billing/documents/{id}/signed-url, rather than using pre-signed URLs
    // that expire quickly (old TTL was 300s — insufficient for slow users).
    // invoiceId is a `status: 'pending'` placeholder until settlement generates the
    // real PDF — see settlement.service.ts. You don't invoice what hasn't been paid.
    invoiceId: string
    contractId: string
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function createSubmitService(deps: SubmitServiceDeps) {
  const {
    draftRepo,
    tenantRepo,
    pdfAdapter,
    storageAdapter,
    tokenService,
    settlementService,
    prisma,
    config,
    logger,
    userRepo,
  } = deps

  const log = logger.child({ component: 'submit' })

  async function submit(params: { draftId: string; version: number }): Promise<SubmitResponse> {
    const { draftId, version } = params

    // ── Pre-checks (outside transaction) ──────────────────────────────
    const draft = await draftRepo.findByIdOrThrow(draftId)
    const repData = draft.data['representative'] as Record<string, unknown> | undefined
    const repEmail = draft.representativeEmail ?? (repData?.['email'] as string | undefined) ?? 'admin@corehub.com'

    // Email uniqueness (MUST)
    const existingUser = await userRepo.findByEmailGlobal(repEmail)
    if (existingUser) {
      throw new ConflictError('onboarding.email_already_exists',
        `Email ${repEmail} is already registered`)
    }

    // RUC uniqueness (SHOULD)
    const companyData = draft.data['company'] as Record<string, unknown> | undefined
    const ruc = companyData?.['ruc'] as string | undefined
    if (ruc) {
      const rucDraft = await draftRepo.findByRuc(ruc, draftId)
      if (rucDraft) {
        throw new ConflictError('onboarding.ruc_already_exists',
          `RUC ${ruc} is already registered`)
      }
    }

    let tenantId: string
    let tenantSlug: string
    let userId: string
    let invoiceDocumentId: string
    let contractDocumentId: string
    let refreshTokenRaw: string
    let ownerEmail: string = ''
    let ownerName: string = ''

    try {
      // NOTE: PDFs are generated synchronously inside the transaction per ADR-5.
      // This is architecturally impure (I/O inside DB tx) but required for atomic rollback:
      // if PDF generation fails, tenant/user are NOT created. The tradeoff is acceptable
      // because @react-pdf/renderer renders simple docs in p95 ≤ 800ms.
      // If p95 > 2s in production, switch to async + documents.status='pending' flow.
      // The invoice PDF itself moved out of this transaction (see Step 10 below) —
      // ADR-5's tradeoff still stands for the contract PDF that remains here.
      ;({ tenantId, tenantSlug, userId, invoiceDocumentId, contractDocumentId, refreshTokenRaw } =
        await prisma.$transaction(async (tx) => {
          // ── Step 1: Lock the draft row ─────────────────────────────────
          const draft = await draftRepo.findByIdForUpdate(draftId, tx)

          // ── Step 2: Validate draft state ───────────────────────────────
          // Provisioning now happens as soon as the wizard reaches summary,
          // regardless of settlement state — a bank-transfer payment stays
          // `pending` and the tenant is provisioned `pending` too; activation
          // is exclusively settlement's job (see settlePayment below). The
          // only hard requirement left is that a payment was actually
          // initiated for this draft (there's nothing to backfill/settle
          // otherwise).
          const payment = await tx.payment.findFirst({
            where: { draftId },
            orderBy: { initiatedAt: 'desc' },
          })
          if (!payment) {
            throw new ConflictError(
              'onboarding.draft_not_submittable',
              'Draft has no payment to submit',
            )
          }

          if (draft.version !== version) {
            throw new ConflictError(
              'onboarding.version_conflict',
              undefined,
              {
                current: {
                  id: draft.id,
                  version: draft.version,
                  currentStep: draft.currentStep,
                  status: draft.status,
                },
              },
            )
          }

          // ── Step 3: Extract company data ───────────────────────────────
          // Bug 1 fix: hub sends `legalName` (not `name`). Derive slug from legalName when
          // no explicit slug is provided.
          const companyData = draft.data['company'] as Record<string, unknown> | undefined
          const legalName = (companyData?.['legalName'] as string | undefined) ?? 'New Company'
          const companyName = legalName

          // Derive slug: explicit > normalised legalName > fallback
          function deriveBaseSlug(name: string): string {
            return name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '') // strip diacritics
              .replace(/[^a-z0-9]+/g, '-')     // only alphanumeric
              .replace(/^-|-$/g, '')            // trim leading/trailing hyphens
              .slice(0, 50)
          }

          const baseSlug =
            (companyData?.['slug'] as string | undefined) ||
            deriveBaseSlug(legalName) ||
            `tenant-${draft.id.slice(0, 8)}`

          // Ensure slug is unique — append numeric suffix if necessary
          let slug = baseSlug
          for (let attempt = 1; attempt <= 10; attempt++) {
            const existing = await tx.tenant.findUnique({ where: { slug } })
            if (existing === null) break
            slug = `${baseSlug}-${String(attempt + 1)}`
          }

          // The wizard's product step decides which product the tenant buys;
          // DEFAULT_PRODUCT_ID is only the fallback for drafts created before
          // that step existed. Getting this wrong sends the tenant to the
          // portal with the wrong product listed.
          const productId = draft.productId ?? DEFAULT_PRODUCT_ID
          // A draft without a plan falls back to the product's default plan
          // (backoffice → Planes), not to a hardcoded id that may not exist.
          const defaultPlan =
            draft.planId === undefined
              ? await tx.plan.findFirst({
                  where: { productId, isDefault: true, active: true },
                  select: { id: true },
                })
              : null
          const planId = draft.planId ?? defaultPlan?.id ?? 'starter'
          const repData = draft.data['representative'] as Record<string, unknown> | undefined
          const repEmail = draft.representativeEmail ?? (repData?.['email'] as string | undefined) ?? 'admin@corehub.com'
          const repFullName = repData?.['fullName'] as string | undefined
          const repPhone = repData?.['phone'] as string | undefined

          // Capture for JWT claims outside the transaction
          ownerEmail = repEmail
          ownerName = repFullName ?? repEmail

          // Validate reserved slugs
          if (config.RESERVED_TENANT_SLUGS.includes(slug.toLowerCase())) {
            throw new ConflictError(
              'onboarding.invalid_slug',
              `Slug "${slug}" is reserved`,
            )
          }

          // ── Step 4: CREATE SCHEMA ──────────────────────────────────────
          const schemaName = slugToSchemaName(slug)
          await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

          // ── Step 5: Run tenant DDL migrations ──────────────────────────
          await runTenantMigrations(tx, schemaName)

          // ── Step 6: INSERT tenant (status=pending) ─────────────────────
          const tenant = await tx.tenant.create({
              data: {
                slug,
                name: companyName,
                legalName,
                ruc: (companyData?.['ruc'] as string | undefined) ?? null,
                address: (companyData?.['address'] as string | undefined) ?? null,
                city: (companyData?.['city'] as string | undefined) ?? null,
                country: (companyData?.['country'] as string | undefined) ?? 'PY',
                phone: repPhone ?? null,
                schemaName,
                planId,
                status: 'pending',
              },
          })

          // ── Step 7: INSERT TenantAdmin user ────────────────────────────
          // Activation token is no longer generated here — it's only useful once
          // the tenant is actually activated, which settlement now owns exclusively
          // (see settlePayment below / settlement.service.ts). Generating one here
          // that might never get emailed (bank-transfer stays pending) would be dead data.
          const user = await tx.user.create({
            data: {
              tenantId: tenant.id,
              email: repEmail,
              fullName: repFullName ?? null,
              role: 'TenantAdmin',
              status: 'pending_first_login',
              passwordHash: null,
            },
          })

          // Tenant stays `pending` (created that way in Step 6) — activation is
          // exclusively settlement's job now (see settlePayment call below).

          // a2 (2.2): keep TenantProductSubscription in sync with the plan
          // assignment written above — this is the only write path for
          // Tenant.planId today (see design "Backfill scope").
          await tx.tenantProductSubscription.upsert({
            where: { tenantId_productId: { tenantId: tenant.id, productId } },
            create: { tenantId: tenant.id, productId, planId },
            update: { planId },
          })

          // ── Step 9: UPDATE draft status = completed ────────────────────
          await tx.onboardingDraft.update({
            where: { id: draftId },
            data: {
              status: 'completed',
              tenantId: tenant.id,
            },
          })

          // ── Step 10: Generate the CONTRACT PDF only (sync, inside tx per ADR-5) ──
          // The contract is an agreement, not a payment document — it still generates
          // at submit. The INVOICE moves to settlement (you don't invoice what hasn't
          // been paid); a `status: 'pending'` placeholder row is created here so
          // `documents.invoiceId` in the response stays stable — settlement fills it
          // in later (see settlement.service.ts).
          const pdfData = {
            tenantName: companyName,
            planId,
            tenantId: tenant.id,
            repEmail,
            date: new Date().toISOString(),
            ...draft.data,
          }

          const contractBuffer = await pdfAdapter.generate({ type: 'contract', data: pdfData })

          // ── Step 11: Upload contract PDF ────────────────────────────────
          // Document.id is @db.Uuid — must be a valid UUID, not nanoid
          const invoiceId = crypto.randomUUID()
          const contractId = crypto.randomUUID()
          const txContractStorageKey = `tenants/${tenant.id}/documents/${contractId}.pdf`

          await storageAdapter.upload({
            key: txContractStorageKey,
            buffer: contractBuffer,
            contentType: 'application/pdf',
          })

          // ── Step 12: INSERT document rows ──────────────────────────────
          await Promise.all([
            tx.document.create({
              data: {
                id: contractId,
                tenantId: tenant.id,
                type: 'contract',
                storageKey: txContractStorageKey,
                status: 'ready',
              },
            }),
            tx.document.create({
              data: {
                id: invoiceId,
                tenantId: tenant.id,
                type: 'invoice',
                storageKey: 'pending',
                status: 'pending',
              },
            }),
          ])

          // ── Step 12b: Backfill Payment.tenantId ─────────────────────────
          // The payment was created before the tenant existed (at the payment
          // step) — link it now so admin/billing payment lists can find it
          // (see payment-mapper.ts's orphan-row gap from slice 3a).
          await tx.payment.update({
            where: { id: payment.id },
            data: { tenantId: tenant.id },
          })

          // Bancard is typically already `approved` by the time the wizard
          // reaches summary (the webhook settles it before the tenant even
          // exists) — settle it now through the shared path, which is what
          // actually activates the tenant and generates invoice/receipt/email
          // (see settlement.service.ts). Bank-transfer payments stay `pending`
          // here and settle later via agent confirm / admin activation.
          if (payment.status === 'approved') {
            await settlementService.settlePayment(
              {
                paymentId: payment.id,
                decision: 'approved',
                settlementKind: 'gateway_webhook',
                settledBy: undefined,
                note: undefined,
              },
              tx,
            )
          }

          // ── Step 13: INSERT refresh_token ──────────────────────────────
          const rawToken = tokenService.signRefreshTokenRaw()
          const tokenHash = hashToken(rawToken)
          const tokenFamilyId = nanoid()

          await tx.refreshToken.create({
            data: {
              userId: user.id,
              tokenHash,
              familyId: tokenFamilyId,
              expiresAt: new Date(Date.now() + config.JWT_REFRESH_TOKEN_TTL_SECONDS * 1000),
              parentId: null,
            },
          })

          return {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            userId: user.id,
            invoiceDocumentId: invoiceId,
            contractDocumentId: contractId,
            refreshTokenRaw: rawToken,
            tenant,
          }
        }))
    } catch (error) {
      // Re-throw ConflictError and other AppErrors directly — they're expected
      if (error instanceof ConflictError) throw error
      const { AppError } = await import('../errors.js')
      if (error instanceof AppError) throw error

      // Convert Prisma unique constraint violation to 409 (race condition fallback)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictError('onboarding.email_already_exists',
          'Email already registered (caught by DB constraint)')
      }

      // Unexpected errors become InternalError — transaction is already rolled back
      log.error({ category: 'auth', event: 'provisioning_failed', draftId, err: error })
      throw new InternalError('onboarding.provisioning_failed', String(error))
    }

    log.info({ category: 'auth', event: 'tenant_provisioned', tenantId, ownerUserId: userId })

    // a4 (subscription changes fan-out, best-effort, outside transaction):
    // the TenantProductSubscription upsert above (Step 8) is the only
    // Tenant.planId/subscription write path today — purge the product API's
    // guard cache in case an entitlement check for this tenant was already
    // (incorrectly) cached before provisioning completed.
    purgeAnalyticsEntitlementsCache(tenantId, DEFAULT_PRODUCT_ID)

    // ── Step 14: Sign access token ────────────────────────────────────────
    // Bug 9 fix: No longer generating pre-signed URLs here (old TTL was 300s — too short).
    // The response now returns document IDs so the hub can call GET /billing/documents/{id}/signed-url
    // to obtain a fresh URL on demand when the user actually clicks download.

    const { accessToken, expiresIn } = await tokenService.signAccessToken({
      sub: userId,
      email: ownerEmail,
      name: ownerName,
      tenantId: tenantSlug,
      tenantUuid: tenantId,
      role: 'TenantAdmin',
      user_status: 'pending_first_login',
    })

    // Activation email no longer sent here — it goes out from settlement.service.ts
    // only once the tenant is actually activated (never before a payment can be
    // reversed). See settlePayment() above and settlement.service.ts.

    // ── Step 15: Fetch tenant for response ────────────────────────────────
    const tenant = await tenantRepo.findByUuid(tenantId)

    return {
      tenantId,
      tenant,
      accessToken,
      expiresIn,
      tokenType: 'Bearer',
      refreshTokenRaw,
      documents: {
        invoiceId: invoiceDocumentId,
        contractId: contractDocumentId,
      },
    }
  }

  return { submit }
}

export type SubmitService = ReturnType<typeof createSubmitService>
