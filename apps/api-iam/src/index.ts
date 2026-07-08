import "dotenv/config";
import { serve } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseConfig } from './config.js';
import { createLogger } from './lib/logger.js';
import { createAccessLogMiddleware } from './middleware/access-log.middleware.js';
import { createAdapters } from './adapters/index.js';
import { createRepositories } from './repositories/index.js';
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
} from './services/index.js';
import { requestId } from './middleware/request-id.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createAuthGuard } from './middleware/auth-guard.js';
import { createIdempotencyMiddleware } from './middleware/idempotency.js';
import { registerRoutes } from './routes/index.js';
import { startBackgroundJobs } from './jobs/background-jobs.js';
import type { Services } from './routes/index.js';

async function main(): Promise<void> {
  const config = parseConfig();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
  });

  const rootLogger = await createLogger({
    level: config.LOG_LEVEL,
    toConsole: config.LOG_TO_CONSOLE,
    filePath: config.LOG_FILE_PATH,
    format: config.LOG_FORMAT,
    serviceName: 'api-iam',
    environment: config.NODE_ENV,
  });

  const adapters = createAdapters(config, rootLogger);
  const repos = createRepositories(prisma);

  const tokenService = createTokenService({
    keyProvider: adapters.keyProvider,
    config,
  });

  const otpService = createOtpService({
    otpCodeRepo: repos.otpCodeRepo,
    userRepo: repos.userRepo,
    otpAdapter: adapters.otpAdapter,
    rateLimiter: adapters.rateLimiter,
    config,
    logger: rootLogger,
  });

  const passwordService = createPasswordService({
    userRepo: repos.userRepo,
    passwordResetTokenRepo: repos.passwordResetTokenRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    emailAdapter: adapters.emailAdapter,
    tokenService,
    rateLimiter: adapters.rateLimiter,
    config,
    logger: rootLogger,
  });

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
    logger: rootLogger,
  });

  const firstLoginService = createFirstLoginService({
    userRepo: repos.userRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    tenantRepo: repos.tenantRepo,
    otpService,
    tokenService,
    passwordService,
    config,
    logger: rootLogger,
  });

  const draftService = createDraftService({
    draftRepo: repos.draftRepo,
    otpService,
    emailAdapter: adapters.emailAdapter,
    planRepo: repos.planRepo,
    userRepo: repos.userRepo,
    config,
    prisma,
    logger: rootLogger,
  });

  const paymentService = createPaymentService({
    paymentRepo: repos.paymentRepo,
    draftRepo: repos.draftRepo,
    bancardAdapter: adapters.bancardAdapter,
    config,
  });

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
    logger: rootLogger,
  });

  const webhookService = createWebhookService({
    webhookEventRepo: repos.webhookEventRepo,
    paymentRepo: repos.paymentRepo,
    draftRepo: repos.draftRepo,
    prisma,
    config,
  });

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
    logger: rootLogger,
  });

  const billingService = createBillingService({
    documentRepo: repos.documentRepo,
    storageAdapter: adapters.storageAdapter,
  });

  const planService = createPlanService({
    planRepo: repos.planRepo,
  });

  const identityService = createIdentityService({
    tenantRepo: repos.tenantRepo,
    userRepo: repos.userRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    tokenService,
    prisma,
  });

  const planChangeService = createPlanChangeService({
    planChangeRepo: repos.planChangeRepo,
    tenantRepo: repos.tenantRepo,
    planRepo: repos.planRepo,
    userRepo: repos.userRepo,
    emailAdapter: adapters.emailAdapter,
    config,
    prisma,
    logger: rootLogger,
  });

  const moduleService = createModuleService({
    moduleRepository: repos.moduleRepository,
    tenantRepository: repos.tenantRepo,
    logger: rootLogger,
  });

  const adminTenantService = createAdminTenantService({
    tenantRepo: repos.tenantRepo,
    userRepo: repos.userRepo,
    refreshTokenRepo: repos.refreshTokenRepo,
    prisma,
  });

  const quizService = createQuizService({
    quizRepository: repos.quizRepository,
    logger: rootLogger,
  });

  const quizAttemptService = createQuizAttemptService({
    attemptRepository: repos.quizAttemptRepository,
    quizRepository: repos.quizRepository,
    logger: rootLogger,
  });

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
  };

  const app = new OpenAPIHono();

  app.use(
    '*',
    cors({
      origin: (origin) => (config.CORS_ALLOWED_ORIGINS.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    })
  );
  app.use('*', requestId);
  app.use('*', createAccessLogMiddleware(rootLogger));
  app.onError(createErrorHandler(rootLogger));

  const authGuard = createAuthGuard(tokenService);
  const idempotency = createIdempotencyMiddleware(repos.idempotencyRepo, prisma);

  registerRoutes(app, services, {
    authGuard,
    idempotency,
    keyProvider: adapters.keyProvider,
    config,
    planRepo: repos.planRepo,
    planQuotaRepo: repos.planQuotaRepo,
    paymentRepo: repos.paymentRepo,
    draftRepo: repos.draftRepo,
    prisma,
  });

  startBackgroundJobs(repos, rootLogger);

  const server = serve({ fetch: app.fetch, port: config.PORT });

  rootLogger.info({ category: 'system', event: 'service_started', port: config.PORT, env: config.NODE_ENV }, 'service_started');

  async function shutdown(signal: string): Promise<void> {
    rootLogger.info({ category: 'system', event: 'service_stopping', signal }, 'service_stopping');
    server.close();
    await prisma.$disconnect();
    await Promise.race([
      new Promise<void>((resolve) => { rootLogger.flush(() => { resolve() }) }),
      new Promise<void>((resolve) => { setTimeout(resolve, 2000) }),
    ]);
    process.exit(0);
  }

  process.on('SIGTERM', () => { void shutdown('SIGTERM') });
  process.on('SIGINT', () => { void shutdown('SIGINT') });
}

main().catch(console.error);
