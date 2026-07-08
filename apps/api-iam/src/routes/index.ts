import type { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import type { MiddlewareHandler } from 'hono';
import type {
  AuthService,
  OtpService,
  FirstLoginService,
  PlanService,
  IdentityService,
  BillingService,
  InvitationService,
  DraftService,
  PaymentService,
  SubmitService,
  WebhookService,
  PasswordService,
  PlanChangeService,
  ModuleService,
  AdminTenantService,
  QuizService,
  QuizAttemptService,
} from '../services/index.js';
import type { KeyProvider } from '../adapters/index.js';
import type { PlanRepository, PaymentRepository, OnboardingDraftRepository, PlanQuotaRepository } from '../repositories/index.js';
import type { Config } from '../config.js';
import type { PrismaClient } from '../generated/prisma/client.js';

import { createHealthRouter } from './health/index.js';
import { createWellKnownRouter } from './well-known/index.js';
import { createPlansRouter } from './plans/index.js';
import { createAuthRouter } from './auth/index.js';
import { createOnboardingRouter } from './onboarding/index.js';
import { createWebhooksRouter } from './webhooks/index.js';
import { createIdentityRouter } from './identity/index.js';
import { createPlanChangeRouter } from './plan-change/index.js';
import { createBillingRouter } from './billing/index.js';
import { createInvitationsRouter } from './invitations/index.js';
import { createTenantModulesRouter, createAdminModulesRouter } from './modules/index.js';
import { createAdminPlansRouter } from './admin/plans.js';
import { createAdminTenantsRouter } from './admin/tenants.js';
import { createAdminQuizzesRouter } from './admin/quizzes.js';
import { createTenantQuizzesRouter } from './tenant/quizzes.js';
import { createStubBancardRouter } from './stub/index.js';
import { createDevStorageRouter } from './dev-storage/index.js';
import { createInternalRouter } from './internal/index.js';

export type Services = {
  authService: AuthService;
  otpService: OtpService;
  firstLoginService: FirstLoginService;
  passwordService: PasswordService;
  planService: PlanService;
  identityService: IdentityService;
  billingService: BillingService;
  invitationService: InvitationService;
  draftService: DraftService;
  paymentService: PaymentService;
  submitService: SubmitService;
  webhookService: WebhookService;
  planChangeService: PlanChangeService;
  moduleService: ModuleService;
  adminTenantService: AdminTenantService;
  quizService: QuizService;
  quizAttemptService: QuizAttemptService;
};

export type RouteDeps = {
  authGuard: MiddlewareHandler;
  idempotency: MiddlewareHandler;
  keyProvider: KeyProvider;
  config: Config;
  planRepo: PlanRepository;
  planQuotaRepo: PlanQuotaRepository;
  paymentRepo: PaymentRepository;
  draftRepo: OnboardingDraftRepository;
  prisma: PrismaClient;
};

export function registerRoutes(app: OpenAPIHono, services: Services, deps: RouteDeps): void {
  const { authGuard, idempotency, keyProvider, config, planRepo, planQuotaRepo, paymentRepo, draftRepo, prisma } = deps;

  const healthRouter = createHealthRouter();
  const wellKnownRouter = createWellKnownRouter(keyProvider);
  const plansRouter = createPlansRouter(services.planService, planQuotaRepo);
  const authRouter = createAuthRouter(
    services.authService,
    services.otpService,
    services.firstLoginService,
    services.passwordService,
    keyProvider,
    config,
    idempotency,
    authGuard,
    draftRepo,
    prisma
  );
  const onboardingRouter = createOnboardingRouter(
    services.draftService,
    services.paymentService,
    services.submitService,
    idempotency,
    authGuard,
    config,
    planRepo,
    paymentRepo
  );
  // Webhooks: no authGuard, no global idempotency — uses internal idempotency
  const webhooksRouter = createWebhooksRouter(services.webhookService);
  const identityRouter = createIdentityRouter(services.identityService, authGuard, idempotency);
  const planChangeRouter = createPlanChangeRouter(services.planChangeService, authGuard);
  const billingRouter = createBillingRouter(services.billingService, authGuard);
  const invitationsRouter = createInvitationsRouter(
    services.invitationService,
    idempotency,
    config,
    authGuard,
  );
  const tenantModulesRouter = createTenantModulesRouter(services.moduleService, authGuard);
  const adminModulesRouter = createAdminModulesRouter(services.moduleService, authGuard, idempotency);
  const adminPlansRouter = createAdminPlansRouter(services.planService, planQuotaRepo, authGuard, idempotency);
  const adminTenantsRouter = createAdminTenantsRouter(services.adminTenantService, authGuard, idempotency);
  const adminQuizzesRouter = createAdminQuizzesRouter(services.quizService, services.quizAttemptService, authGuard, idempotency, prisma);
  const tenantQuizzesRouter = createTenantQuizzesRouter(services.quizService, services.quizAttemptService, authGuard);
  const internalRouter = createInternalRouter(prisma);

  app.route('/', healthRouter);
  app.route('/', wellKnownRouter);
  app.route('/', plansRouter);
  app.route('/', authRouter);
  app.route('/', onboardingRouter);
  app.route('/', webhooksRouter);
  app.route('/', identityRouter);
  app.route('/', planChangeRouter);
  app.route('/', billingRouter);
  app.route('/', invitationsRouter);
  app.route('/', tenantModulesRouter);
  app.route('/', adminModulesRouter);
  app.route('/', adminPlansRouter);
  app.route('/', adminTenantsRouter);
  app.route('/', adminQuizzesRouter);
  app.route('/', tenantQuizzesRouter);

  if (config.BANCARD_PROVIDER === 'stub') {
    const stubBancardRouter = createStubBancardRouter(services.webhookService, paymentRepo, config);
    app.route('/', stubBancardRouter);
  }

  if (config.STORAGE_PROVIDER === 'stub') {
    const devStorageRouter = createDevStorageRouter(config.STORAGE_STUB_DIR);
    app.route('/', devStorageRouter);
  }

  // Internal service-to-service routes (no public OpenAPI docs)
  app.route('/', internalRouter);

  // Swagger UI
  app.get('/docs', swaggerUI({ url: '/openapi.json' }));

  // Auto-generate OpenAPI spec
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Corehub IAM API',
      version: '1.1.0',
    },
    servers: [{ url: 'http://localhost:8080' }],
  });
}
