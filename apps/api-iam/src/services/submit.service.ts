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
import { activationTemplate } from '../adapters/email/templates/index.js'
import type { TokenService } from './token.service.js'
import type { Config } from '../config.js'
import type { Tenant } from '../domain/index.js'
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
    emailAdapter,
    tokenService,
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
    let rawActivationToken: string
    let ownerEmail: string = ''
    let ownerName: string = ''

    try {
      // NOTE: PDFs are generated synchronously inside the transaction per ADR-5.
      // This is architecturally impure (I/O inside DB tx) but required for atomic rollback:
      // if PDF generation fails, tenant/user are NOT created. The tradeoff is acceptable
      // because @react-pdf/renderer renders simple docs in p95 ≤ 800ms.
      // If p95 > 2s in production, switch to async + documents.status='pending' flow.
      ;({ tenantId, tenantSlug, userId, invoiceDocumentId, contractDocumentId, refreshTokenRaw, rawActivationToken } =
        await prisma.$transaction(async (tx) => {
          // ── Step 1: Lock the draft row ─────────────────────────────────
          const draft = await draftRepo.findByIdForUpdate(draftId, tx)

          // ── Step 2: Validate draft state ───────────────────────────────
          if (draft.status !== 'payment_confirmed') {
            throw new ConflictError(
              'onboarding.draft_not_submittable',
              `Draft must be in payment_confirmed status, got: ${draft.status}`,
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

          const planId = draft.planId ?? 'starter'
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
          rawActivationToken = nanoid(32)
          const activationTokenHash = hashToken(rawActivationToken)
          const activationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

          const user = await tx.user.create({
            data: {
              tenantId: tenant.id,
              email: repEmail,
              fullName: repFullName ?? null,
              role: 'TenantAdmin',
              status: 'pending_first_login',
              passwordHash: null,
              activationTokenHash,
              activationTokenExpiresAt: activationTokenExpiry,
              activationTokenUsed: false,
            },
          })

          // ── Step 8: UPDATE tenant status = active ──────────────────────
          await tx.tenant.update({
            where: { id: tenant.id },
            data: { status: 'active' },
          })

          // ── Step 9: UPDATE draft status = completed ────────────────────
          await tx.onboardingDraft.update({
            where: { id: draftId },
            data: {
              status: 'completed',
              tenantId: tenant.id,
            },
          })

          // ── Step 10: Generate PDFs (sync, inside tx per ADR-5) ─────────
          const pdfData = {
            tenantName: companyName,
            planId,
            tenantId: tenant.id,
            repEmail,
            date: new Date().toISOString(),
            ...draft.data,
          }

          const [invoiceBuffer, contractBuffer] = await Promise.all([
            pdfAdapter.generate({ type: 'invoice', data: pdfData }),
            pdfAdapter.generate({ type: 'contract', data: pdfData }),
          ])

          // ── Step 11: Upload PDFs ───────────────────────────────────────
          // Document.id is @db.Uuid — must be a valid UUID, not nanoid
          const invoiceId = crypto.randomUUID()
          const contractId = crypto.randomUUID()
          const txInvoiceStorageKey = `tenants/${tenant.id}/documents/${invoiceId}.pdf`
          const txContractStorageKey = `tenants/${tenant.id}/documents/${contractId}.pdf`

          await Promise.all([
            storageAdapter.upload({
              key: txInvoiceStorageKey,
              buffer: invoiceBuffer,
              contentType: 'application/pdf',
            }),
            storageAdapter.upload({
              key: txContractStorageKey,
              buffer: contractBuffer,
              contentType: 'application/pdf',
            }),
          ])

          // ── Step 12: INSERT document rows ──────────────────────────────
          await Promise.all([
            tx.document.create({
              data: {
                id: invoiceId,
                tenantId: tenant.id,
                type: 'invoice',
                storageKey: txInvoiceStorageKey,
                status: 'ready',
              },
            }),
            tx.document.create({
              data: {
                id: contractId,
                tenantId: tenant.id,
                type: 'contract',
                storageKey: txContractStorageKey,
                status: 'ready',
              },
            }),
          ])

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
            rawActivationToken,
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

    // ── Send activation email (best-effort, outside transaction) ──────
    const activationUrl = `${config.HUB_BASE_URL}/first-login?token=${rawActivationToken}`
    const { subject: activationSubject, html: activationHtml } = activationTemplate({
      tenantName: ownerName,
      activationUrl,
    })
    try {
      await emailAdapter.send({
        to: repEmail,
        subject: activationSubject,
        html: activationHtml,
      })
    } catch (emailError) {
      log.warn({ category: 'auth', event: 'activation_email_failed', tenantId, err: emailError },
        'Activation email send failed — user can activate via first-login flow')
    }

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
