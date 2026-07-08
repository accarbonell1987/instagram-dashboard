import "dotenv/config";
import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseConfig } from '../config.js'
import { createAdapters } from '../adapters/index.js'
import { createRepositories } from '../repositories/index.js'
import {
  createTokenService,
  createOtpService,
  createPasswordService,
  createAuthService,
  createFirstLoginService,
  createDraftService,
  createPaymentService,
  createSubmitService,
  createWebhookService,
  createInvitationService,
  createBillingService,
  createPlanService,
  createIdentityService,
  createPlanChangeService,
  createModuleService,
  createAdminTenantService,
  createQuizService,
  createQuizAttemptService,
} from '../services/index.js'
import { requestId } from '../middleware/request-id.js'
import { createErrorHandler } from '../middleware/error-handler.js'
import { createAuthGuard } from '../middleware/auth-guard.js'
import { createIdempotencyMiddleware } from '../middleware/idempotency.js'
import { registerRoutes } from '../routes/index.js'
import { silentLogger } from '../test-helpers/logger.js'
import type { Services } from '../routes/index.js'

export type TestApp = {
  app: OpenAPIHono
  prisma: PrismaClient
}

export type AppFetchOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

export async function appFetch(
  app: OpenAPIHono,
  path: string,
  options: AppFetchOptions = {}
): Promise<Response> {
  const { method = 'GET', body, headers = {} } = options
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }
  const init: RequestInit = {
    method,
    headers: requestHeaders,
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return app.fetch(new Request(`http://localhost${path}`, init))
}

export async function createTestApp(): Promise<TestApp> {
  // Force stub providers and OTP code — overrides whatever is in process.env
  const testEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    OTP_EMAIL_PROVIDER: 'stub',
    OTP_STUB_CODE: '123456',
    BANCARD_PROVIDER: 'stub',
    PDF_PROVIDER: 'stub',
    STORAGE_PROVIDER: 'stub',
    EMAIL_PROVIDER: 'stub',
  }

  const config = parseConfig(testEnv)
  const databaseUrl = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL']!

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  const logger = silentLogger

  const adapters = createAdapters(config, logger)
  const repos = createRepositories(prisma)

  const tokenService = createTokenService({ keyProvider: adapters.keyProvider, config })

  const otpService = createOtpService({
    otpCodeRepo: repos.otpCodeRepo,
    userRepo: repos.userRepo,
    otpAdapter: adapters.otpAdapter,
    rateLimiter: adapters.rateLimiter,
    config,
    logger,
  })

  const passwordService = createPasswordService({
    userRepo: repos.userRepo,
    passwordResetTokenRepo: repos.passwordResetTokenRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    emailAdapter: adapters.emailAdapter,
    tokenService,
    rateLimiter: adapters.rateLimiter,
    config,
    logger,
  })

  const authService = createAuthService({
    userRepo: repos.userRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    deviceTrustRepo: repos.deviceTrustRepo,
    tenantRepo: repos.tenantRepo,
    otpCodeRepo: repos.otpCodeRepo,
    otpService,
    tokenService,
    keyProvider: adapters.keyProvider,
    config,
    prisma,
    logger,
  })

  const firstLoginService = createFirstLoginService({
    userRepo: repos.userRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    tenantRepo: repos.tenantRepo,
    otpService,
    tokenService,
    passwordService,
    config,
    logger,
  })

  const draftService = createDraftService({
    draftRepo: repos.draftRepo,
    otpService,
    emailAdapter: adapters.emailAdapter,
    planRepo: repos.planRepo,
    userRepo: repos.userRepo,
    config,
    prisma,
    logger,
  })

  const paymentService = createPaymentService({
    paymentRepo: repos.paymentRepo,
    draftRepo: repos.draftRepo,
    bancardAdapter: adapters.bancardAdapter,
    config,
  })

  const submitService = createSubmitService({
    draftRepo: repos.draftRepo,
    tenantRepo: repos.tenantRepo,
    userRepo: repos.userRepo,
    documentRepo: repos.documentRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    paymentRepo: repos.paymentRepo,
    pdfAdapter: adapters.pdfAdapter,
    storageAdapter: adapters.storageAdapter,
    emailAdapter: adapters.emailAdapter,
    tokenService,
    prisma,
    config,
    logger,
  })

  const webhookService = createWebhookService({
    webhookEventRepo: repos.webhookEventRepo,
    paymentRepo: repos.paymentRepo,
    draftRepo: repos.draftRepo,
    prisma,
    config,
  })

  const invitationService = createInvitationService({
    invitationRepo: repos.invitationRepo,
    userRepo: repos.userRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    tenantRepo: repos.tenantRepo,
    tokenService,
    passwordService,
    emailAdapter: adapters.emailAdapter,
    config,
    prisma,
    logger,
  })

  const billingService = createBillingService({
    documentRepo: repos.documentRepo,
    storageAdapter: adapters.storageAdapter,
  })

  const planService = createPlanService({ planRepo: repos.planRepo })

  const identityService = createIdentityService({
    tenantRepo: repos.tenantRepo,
    userRepo: repos.userRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    tokenService,
    prisma,
  })

  const planChangeService = createPlanChangeService({
    planChangeRepo: repos.planChangeRepo,
    tenantRepo: repos.tenantRepo,
    planRepo: repos.planRepo,
    userRepo: repos.userRepo,
    emailAdapter: adapters.emailAdapter,
    config,
    prisma,
    logger,
  })

  const moduleService = createModuleService({
    moduleRepository: repos.moduleRepository,
    tenantRepository: repos.tenantRepo,
    logger,
  })

  const adminTenantService = createAdminTenantService({
    tenantRepo: repos.tenantRepo,
    userRepo: repos.userRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    prisma,
  })

  const quizService = createQuizService({
    quizRepository: repos.quizRepository,
    logger,
  })

  const quizAttemptService = createQuizAttemptService({
    attemptRepository: repos.quizAttemptRepository,
    quizRepository: repos.quizRepository,
    logger,
  })

  const services: Services = {
    authService,
    otpService,
    firstLoginService,
    passwordService,
    planService,
    identityService,
    billingService,
    invitationService,
    draftService,
    paymentService,
    submitService,
    webhookService,
    planChangeService,
    moduleService,
    adminTenantService,
    quizService,
    quizAttemptService,
  }

  const app = new OpenAPIHono()

  app.use(
    '*',
    cors({
      origin: (origin) => (config.CORS_ALLOWED_ORIGINS.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    })
  )
  app.use('*', requestId)
  app.onError(createErrorHandler(logger))

  const authGuard = createAuthGuard(tokenService)
  const idempotency = createIdempotencyMiddleware(repos.idempotencyRepo, prisma)

  registerRoutes(app, services, {
    authGuard,
    idempotency,
    keyProvider: adapters.keyProvider,
    config,
    planRepo: repos.planRepo,
    paymentRepo: repos.paymentRepo,
    draftRepo: repos.draftRepo,
    prisma,
  })

  return { app, prisma }
}
