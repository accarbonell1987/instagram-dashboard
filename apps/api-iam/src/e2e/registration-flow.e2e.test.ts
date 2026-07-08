import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { createHmac } from 'node:crypto'
import { createTestApp, appFetch } from './test-app.js'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { PrismaClient } from '../generated/prisma/client.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function idempotencyKey(): string {
  return crypto.randomUUID()
}

function buildBancardSignature(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex')
}

function uniqueSlug(): string {
  return `test-co-${Date.now()}-${Math.floor(Math.random() * 9999)}`
}

// ── Plans seed ───────────────────────────────────────────────────────────────

async function ensurePlansExist(prisma: PrismaClient): Promise<void> {
  const count = await prisma.plan.count()
  if (count > 0) return

  await prisma.plan.createMany({
    data: [
      {
        id: 'starter',
        name: 'Starter',
        description: 'Para equipos pequeños.',
        price: 0,
        currency: 'PYG',
        billingInterval: 'monthly',
        maxUsers: 5,
        features: ['Hasta 5 usuarios'],
        popular: false,
        active: true,
      },
      {
        id: 'professional',
        name: 'Professional',
        description: 'Para equipos en crecimiento.',
        price: 350000,
        currency: 'PYG',
        billingInterval: 'monthly',
        maxUsers: 25,
        features: ['Hasta 25 usuarios'],
        popular: true,
        active: true,
      },
    ],
  })
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanTestData(prisma: PrismaClient): Promise<void> {
  // Delete in dependency order (children first, parents last)
  await prisma.document.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.deviceTrust.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.webhookEvent.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.idempotencyRecord.deleteMany()
  await prisma.otpCode.deleteMany()
  await prisma.onboardingDraft.deleteMany()
  await prisma.invitation.deleteMany({ where: { tenant: { slug: { not: '__system__' } } } })
  await prisma.user.deleteMany({ where: { tenant: { slug: { not: '__system__' } } } })
  await prisma.tenant.deleteMany({ where: { slug: { not: '__system__' } } })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('tenant registration flow (e2e)', () => {
  let app: OpenAPIHono
  let prisma: PrismaClient

  // Bancard webhook secret from .env / test defaults
  const webhookSecret =
    process.env['BANCARD_WEBHOOK_SECRET'] ?? 'dev-webhook-secret-long-enough'

  beforeAll(async () => {
    const testApp = await createTestApp()
    app = testApp.app
    prisma = testApp.prisma

    // Verify connectivity
    await prisma.$queryRaw`SELECT 1`

    await ensurePlansExist(prisma)
  }, 30_000)

  beforeEach(async () => {
    await cleanTestData(prisma)
  }, 15_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ── Test 1: Happy path ──────────────────────────────────────────────────────

  it('completes the full tenant registration flow', async () => {
    const repEmail = `rep+${Date.now()}@example.com`
    const tenantSlug = uniqueSlug()

    // Step 1: Create draft
    const createDraftRes = await appFetch(app, '/onboarding/draft', {
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(createDraftRes.status).toBe(201)
    const draft = await createDraftRes.json() as {
      id: string
      version: number
      currentStep: string
      status: string
    }
    expect(draft.id).toBeTruthy()
    expect(draft.currentStep).toBe('plan')
    expect(draft.status).toBe('draft')

    const draftId = draft.id
    let version = draft.version

    // Step 2: Set plan
    const setPlanRes = await appFetch(app, `/onboarding/draft/${draftId}`, {
      method: 'PATCH',
      body: {
        step: 'plan',
        version,
        plan: { id: 'starter', name: 'Starter', price: 0, currency: 'PYG' },
      },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(setPlanRes.status).toBe(200)
    const afterPlan = await setPlanRes.json() as { version: number; plan: { id: string } }
    expect(afterPlan.plan?.id).toBe('starter')
    version = afterPlan.version

    // Step 3: Set representative (triggers OTP send + status → otp_pending)
    const setRepRes = await appFetch(app, `/onboarding/draft/${draftId}`, {
      method: 'PATCH',
      body: {
        step: 'representative',
        version,
        representative: { email: repEmail, fullName: 'Juan Pérez', phone: '+595971000000' },
      },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(setRepRes.status).toBe(200)
    const afterRep = await setRepRes.json() as { version: number; status: string }
    expect(afterRep.status).toBe('otp_pending')
    version = afterRep.version

    // Step 4: Send OTP
    const sendOtpRes = await appFetch(app, '/auth/otp/send', {
      method: 'POST',
      body: { channel: 'email', purpose: 'signup-rep', identifier: repEmail },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(sendOtpRes.status).toBe(200)
    const otpSent = await sendOtpRes.json() as { otpId: string; expiresAt: string }
    expect(otpSent.otpId).toBeTruthy()

    const otpId = otpSent.otpId

    // Step 5: Verify OTP with stub code 123456
    const verifyOtpRes = await appFetch(app, '/auth/otp/verify', {
      method: 'POST',
      body: { otpId, code: '123456' },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(verifyOtpRes.status).toBe(200)
    const otpVerified = await verifyOtpRes.json() as {
      otpVerificationToken: string
      expiresAt: string
    }
    // signup-rep flow returns empty token — draft status is what matters
    expect(otpVerified.expiresAt).toBeTruthy()

    // Step 6: Advance draft to otp step (acknowledge OTP verification)
    // After verifyOtp for signup-rep, the draft is already otp_verified in the DB.
    // We still send the PATCH to advance currentStep so the flow state machine is consistent.
    const setOtpStepRes = await appFetch(app, `/onboarding/draft/${draftId}`, {
      method: 'PATCH',
      body: { step: 'otp', version },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(setOtpStepRes.status).toBe(200)
    const afterOtp = await setOtpStepRes.json() as { version: number; status: string; otpVerified: boolean }
    // Draft status is set to otp_verified by signupRepService.verifyOtp
    expect(afterOtp.otpVerified).toBe(true)
    version = afterOtp.version

    // Step 7: Set company data
    // Bug 1 fix: submit.service now reads company.legalName (not the old company.name)
    // and derives slug from legalName when no explicit slug is provided.
    const setCompanyRes = await appFetch(app, `/onboarding/draft/${draftId}`, {
      method: 'PATCH',
      body: {
        step: 'company',
        version,
        company: {
          slug: tenantSlug,
          legalName: 'Test Company S.R.L.',
          ruc: '80012345-1',
          address: 'Av. España 1234',
          city: 'Asunción',
          country: 'PY',
        },
      },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(setCompanyRes.status).toBe(200)
    const afterCompany = await setCompanyRes.json() as { version: number }
    version = afterCompany.version

    // Step 8: Initiate payment
    const initiatePaymentRes = await appFetch(
      app,
      `/onboarding/draft/${draftId}/payment/initiate`,
      {
        method: 'POST',
        body: {},
        headers: { 'Idempotency-Key': idempotencyKey() },
      }
    )
    expect(initiatePaymentRes.status).toBe(200)
    const paymentInit = await initiatePaymentRes.json() as {
      paymentId: string
      redirectUrl: string
      expiresAt: string
    }
    expect(paymentInit.paymentId).toBeTruthy()
    expect(paymentInit.redirectUrl).toContain('stub')

    // Extract bancardProcessId from the stub redirect URL
    // StubBancardAdapter generates: http://...?process_id=stub_<nanoid>
    const processIdMatch = paymentInit.redirectUrl.match(/process_id=([^&]+)/)
    expect(processIdMatch).toBeTruthy()
    const processId = processIdMatch![1]

    // Get updated draft version after payment initiation
    const getDraftRes = await appFetch(app, `/onboarding/draft/${draftId}`)
    const draftAfterPayment = await getDraftRes.json() as { version: number }
    version = draftAfterPayment.version

    // Step 9: Simulate Bancard webhook confirming payment
    const webhookPayload = {
      process_id: processId,
      status: 'approved',
      response_code: '00',
      response_description: 'Approved',
      amount: '0',
      currency: 'PYG',
    }
    const rawBody = JSON.stringify(webhookPayload)
    const signature = buildBancardSignature(webhookSecret, rawBody)

    const webhookRes = await appFetch(app, '/webhooks/bancard', {
      method: 'POST',
      body: webhookPayload,
      headers: { 'X-Bancard-Signature': signature },
    })
    expect(webhookRes.status).toBe(200)
    const webhookBody = await webhookRes.json() as { received: boolean }
    expect(webhookBody.received).toBe(true)

    // Verify draft status is now payment_confirmed
    const draftAfterWebhook = await appFetch(app, `/onboarding/draft/${draftId}`)
    const draftState = await draftAfterWebhook.json() as { status: string; version: number }
    expect(draftState.status).toBe('payment_confirmed')
    version = draftState.version

    // Step 10: Submit — provisions tenant and issues access token
    const submitRes = await appFetch(app, `/onboarding/draft/${draftId}/submit`, {
      method: 'POST',
      body: { version },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(submitRes.status).toBe(200)
    const submitBody = await submitRes.json() as {
      tenantId: string
      tenant: { id: string; slug: string; name: string }
      accessToken: string
      expiresIn: number
      // Bug 9 fix: backend now returns document IDs, not pre-signed URLs
      documents: { invoiceId: string; contractId: string }
    }

    expect(submitBody.tenantId).toBeTruthy()
    expect(submitBody.tenant.slug).toBe(tenantSlug)
    // Bug 1 fix: company name is now derived from legalName (not the old `name` field)
    expect(submitBody.tenant.name).toBe('Test Company S.R.L.')
    expect(submitBody.accessToken).toBeTruthy()
    expect(typeof submitBody.expiresIn).toBe('number')
    // Bug 9 fix: document IDs returned (not pre-signed URLs)
    expect(submitBody.documents.invoiceId).toBeTruthy()
    expect(submitBody.documents.contractId).toBeTruthy()
  }, 60_000)

  // ── Test 2: Invalid OTP code ────────────────────────────────────────────────

  it('returns 422 with auth.otp_invalid when the OTP code is wrong', async () => {
    const repEmail = `rep+invalid+${Date.now()}@example.com`

    // Create draft and set representative to get an OTP issued
    const createRes = await appFetch(app, '/onboarding/draft', {
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(createRes.status).toBe(201)
    const draft = await createRes.json() as { id: string; version: number }

    // Advance to representative step to trigger OTP
    await appFetch(app, `/onboarding/draft/${draft.id}`, {
      method: 'PATCH',
      body: {
        step: 'representative',
        version: draft.version,
        representative: { email: repEmail, fullName: 'Ana García' },
      },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })

    // Send OTP explicitly
    const sendOtpRes = await appFetch(app, '/auth/otp/send', {
      method: 'POST',
      body: { channel: 'email', purpose: 'signup-rep', identifier: repEmail },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(sendOtpRes.status).toBe(200)
    const { otpId } = await sendOtpRes.json() as { otpId: string }

    // Attempt verification with wrong code
    const verifyRes = await appFetch(app, '/auth/otp/verify', {
      method: 'POST',
      body: { otpId, code: '000000' },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(verifyRes.status).toBe(422)
    const errorBody = await verifyRes.json() as { code: string }
    expect(errorBody.code).toBe('auth.otp_invalid')
  }, 30_000)

  // ── Test 3: Submit without payment confirmation ─────────────────────────────

  it('returns 409 when submitting a draft that has not received payment confirmation', async () => {
    const repEmail = `rep+nopay+${Date.now()}@example.com`
    const tenantSlug = uniqueSlug()

    // Create draft
    const createRes = await appFetch(app, '/onboarding/draft', {
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    const draftData = await createRes.json() as { id: string; version: number }
    const draftId = draftData.id
    let version = draftData.version

    // Set plan
    const planRes = await appFetch(app, `/onboarding/draft/${draftId}`, {
      method: 'PATCH',
      body: { step: 'plan', version, plan: { id: 'starter' } },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    version = (await planRes.json() as { version: number }).version

    // Set representative (issues OTP automatically)
    const repRes = await appFetch(app, `/onboarding/draft/${draftId}`, {
      method: 'PATCH',
      body: {
        step: 'representative',
        version,
        representative: { email: repEmail, fullName: 'Carlos López' },
      },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    version = (await repRes.json() as { version: number }).version

    // Verify OTP with the stub code
    const sendOtpRes = await appFetch(app, '/auth/otp/send', {
      method: 'POST',
      body: { channel: 'email', purpose: 'signup-rep', identifier: repEmail },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    const { otpId } = await sendOtpRes.json() as { otpId: string }

    await appFetch(app, '/auth/otp/verify', {
      method: 'POST',
      body: { otpId, code: '123456' },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })

    // Advance to otp step
    const otpStepRes = await appFetch(app, `/onboarding/draft/${draftId}`, {
      method: 'PATCH',
      body: { step: 'otp', version },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    version = (await otpStepRes.json() as { version: number }).version

    // Set company
    const companyRes = await appFetch(app, `/onboarding/draft/${draftId}`, {
      method: 'PATCH',
      body: {
        step: 'company',
        version,
        company: { name: 'No Pay Corp', slug: tenantSlug, legalName: 'No Pay Corp SA' },
      },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    version = (await companyRes.json() as { version: number }).version

    // Initiate payment but do NOT send the webhook to confirm it
    await appFetch(app, `/onboarding/draft/${draftId}/payment/initiate`, {
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': idempotencyKey() },
    })

    // Get current version after payment initiation
    const latestDraft = await appFetch(app, `/onboarding/draft/${draftId}`)
    version = (await latestDraft.json() as { version: number }).version

    // Attempt submit — should fail because status is payment_pending, not payment_confirmed
    const submitRes = await appFetch(app, `/onboarding/draft/${draftId}/submit`, {
      method: 'POST',
      body: { version },
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    expect(submitRes.status).toBe(409)
    const errorBody = await submitRes.json() as { code: string }
    expect(errorBody.code).toBe('onboarding.draft_not_submittable')
  }, 30_000)
})
