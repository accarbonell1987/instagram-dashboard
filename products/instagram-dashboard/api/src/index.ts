import { join } from 'node:path';

import {
  entitlementGuard,
  createEntitlementsPurgeRoute,
  ModuleAccessService,
  createModuleAccessRoute,
} from '@core/entitlements';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { config } from './config.js';
import { ownerOf } from './domain/owner.js';
import { ConflictError } from './errors.js';
import { createRepositories } from './lib/create-repositories.js';
import { DiskImageStorage } from './lib/image/disk-image-storage.js';
import { FalAiImageProvider } from './lib/image/fal-ai-image-provider.js';
import { authGuard } from './middleware/auth-guard.js';
import { errorHandler } from './middleware/error-handler.js';
import { createAdminRoutes } from './routes/admin/admin.routes.js';
import { createAgentRoutes } from './routes/agent/agent.routes.js';
import { createAuthRoutes } from './routes/auth/auth.routes.js';
import { createCarouselRoutes } from './routes/carousels/carousels.routes.js';
import { createChatRoutes } from './routes/chat/chat.routes.js';
import { createDashboardRoutes } from './routes/dashboard/dashboard.routes.js';
import { createHealthRoutes } from './routes/health/health.routes.js';
import { createInternalRoutes } from './routes/internal/internal.routes.js';
import { createMediaRoutes } from './routes/media/media.routes.js';
import { createSuggestionsRoutes } from './routes/suggestions/suggestions.routes.js';
import { createSyncRoutes } from './routes/sync/sync.routes.js';
import { CarouselService } from './services/carousel.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { GrowthAgentService } from './services/growth-agent.service.js';
import { InsightService } from './services/insight.service.js';
import { LlmResolver } from './services/llm-resolver.service.js';
import { OAuthService } from './services/oauth.service.js';
import { ScriptGeneratorService } from './services/script-generator.service.js';
import { SuggestionService } from './services/suggestion.service.js';
import { SyncService } from './services/sync.service.js';
import { UsageTracker } from './services/usage-tracker.service.js';

// eslint-disable-next-line @typescript-eslint/require-await -- callers use bootstrap().catch(); must return a Promise
async function bootstrap() {
  // Initialize Prisma
  const prisma = new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  const publicDir = join(process.cwd(), 'public');

  // Composition root: wire dependencies
  const repos = createRepositories(prisma);
  const oauthService = new OAuthService(repos);
  const syncService = new SyncService(repos);
  const dashboardService = new DashboardService(repos);
  const insightService = new InsightService();
  // One resolver, not one client: the model and key are read from the
  // account on every call rather than fixed at boot.
  const llmResolver = new LlmResolver(repos.instagram);

  // Usage tracking (feature-flagged — no-op when ENABLE_USAGE_TRACKING=false)
  // Must be instantiated before services that depend on it
  const usageTracker = new UsageTracker(
    prisma,
    config.IAM_INTERNAL_URL,
    config.ENABLE_USAGE_TRACKING,
  );

  const moduleAccessService = new ModuleAccessService('instagram-dashboard', config.IAM_INTERNAL_URL);

  const suggestionService = new SuggestionService(repos, llmResolver, usageTracker);
  // GrowthAgentService requires suggestionService to be instantiated first
  const growthAgentService = new GrowthAgentService(repos, dashboardService, llmResolver, suggestionService, usageTracker);
  // Carousel pipeline
  const scriptGeneratorService = new ScriptGeneratorService(llmResolver, usageTracker);
  const imageProvider = new FalAiImageProvider();
  const imageStorage = new DiskImageStorage(publicDir, config.PUBLIC_BASE_URL);
  const carouselService = new CarouselService(
    repos.carousel,
    repos.instagram,
    scriptGeneratorService,
    imageProvider,
    imageStorage,
    usageTracker,
  );

  // Create Hono app
  const app = new OpenAPIHono();

  // Global middleware
  app.use('*', logger());
  app.use('*', cors({ origin: config.CORS_ORIGIN }));

  // Public routes (no auth required).
  // Pass prisma to enable the /ready endpoint (database connectivity check).
  // Cast needed because createHealthRoutes uses a relaxed $queryRaw signature.
  app.route('/health', createHealthRoutes(prisma as { $queryRaw: (...args: unknown[]) => Promise<unknown> }));

  // OAuth callback is public (Instagram redirects here without our JWT).
  // For MVP, mount all auth routes as public on the app.
  // The /login and /status routes internally use c.get('tenant') which
  // will be undefined without authGuard; they will throw descriptive errors
  // if called without a valid JWT. The /callback route reads from query
  // params and works without tenant context.
  app.route('/api/auth/instagram', createAuthRoutes(oauthService));

  // Entitlement guard (a4): fetch+cache (60s TTL, mirrors UsageTracker) +
  // fail-closed on iam downtime (owner-confirmed, apply-signoff #1672).
  // Product-level gate — no moduleId yet (no product API module is
  // per-module-gated today; growth-agent gets a stricter moduleId-scoped
  // mount once that module is promoted, per design).
  const entitlementsGuard = entitlementGuard({
    productId: 'instagram-dashboard',
    iamBaseUrl: config.IAM_INTERNAL_URL,
  });

  /**
   * A guard for one module of this product.
   *
   * The product-wide guard above only asks "may this user open the product at
   * all". The web already draws its agent tabs per module — a Content Analyst
   * gets Chat and Suggestions but no Carousels — and hiding a tab is not the
   * same as refusing the call behind it. Without these, that analyst can POST
   * to /api/carousels directly and generate exactly what their role says they
   * may not.
   */
  const moduleGuard = (moduleId: string) =>
    entitlementGuard({
      productId: 'instagram-dashboard',
      moduleId,
      iamBaseUrl: config.IAM_INTERNAL_URL,
    });

  const agentGuard = moduleGuard('ig-ai-agent');
  const chatGuard = moduleGuard('ig-ai-chat');
  const suggestionsGuard = moduleGuard('ig-ai-suggestions');
  const carouselsGuard = moduleGuard('ig-ai-carousels');

  // Protected routes (JWT required)
  const api = new OpenAPIHono();
  api.use('*', authGuard);
  api.use('*', entitlementsGuard);
  api.route('/me', createModuleAccessRoute(moduleAccessService));
  api.route('/dashboard', createDashboardRoutes(dashboardService, insightService));
  api.route('/media', createMediaRoutes(dashboardService));
  api.route('/sync', createSyncRoutes(syncService));
  // Growth agent routes (chat + suggestions)
  // Both paths on purpose: in Hono '/chat/*' does not match a bare '/chat',
  // which is exactly the list endpoint worth protecting.
  api.use('/chat', chatGuard);
  api.use('/chat/*', chatGuard);
  api.route('/chat', createChatRoutes(growthAgentService, repos.chatMessage));
  api.use('/suggestions', suggestionsGuard);
  api.use('/suggestions/*', suggestionsGuard);
  api.route('/suggestions', createSuggestionsRoutes(suggestionService));
  // Agent config + usage routes
  api.use('/agent', agentGuard);
  api.use('/agent/*', agentGuard);
  api.route('/agent', createAgentRoutes(repos.instagram, usageTracker, config.ENABLE_USAGE_TRACKING, moduleAccessService));
  // Carousel routes
  api.use('/carousels', carouselsGuard);
  api.use('/carousels/*', carouselsGuard);
  api.route('/carousels', createCarouselRoutes(carouselService));
  // Tenant administration contributed to the hub's settings area. Guarded on
  // the JWT role inside the router — the hub cannot protect this.
  api.route('/admin', createAdminRoutes(repos.instagram, usageTracker));

  // Protected auth routes: need JWT so authGuard has already set tenant context
  api.get('/auth/instagram/authorize', async (c) => {
    const tenant = c.get('tenant');
    // One IG account per user. A member who already holds one must release it
    // — or have an admin release it — before connecting another.
    const existingAccount = await repos.instagram.findAccountByOwner(ownerOf(tenant));
    if (existingAccount && existingAccount.syncStatus !== 'disconnected') {
      throw new ConflictError('InstagramAccount', 'userId', tenant.userId);
    }
    const url = oauthService.getAuthorizationUrl(tenant.tenantId, tenant.userId);
    return c.json({ success: true, data: { url } }, 200);
  });

  api.get('/auth/instagram/status', async (c) => {
    const tenant = c.get('tenant');
    const status = await oauthService.getConnectionStatus(ownerOf(tenant));
    return c.json({ success: true, data: status }, 200);
  });

  api.post('/auth/instagram/disconnect', async (c) => {
    const tenant = c.get('tenant');
    await oauthService.disconnectAccount(ownerOf(tenant));
    return c.json({ success: true, data: { message: 'Cuenta desconectada exitosamente' } }, 200);
  });
  
  app.route('/api', api);

  // Internal routes (no auth guard — protected by network/firewall)
  app.route('/internal', createInternalRoutes(usageTracker));
  // a4 purge-direction correction (owner-resolved): the entitlement cache
  // lives in the guard, so the purge route is hosted here — api-iam is the
  // CALLER on entitlement-mutating writes (mirrors the quotas purge pattern).
  app.route('/', createEntitlementsPurgeRoute([
      entitlementsGuard,
      agentGuard,
      chatGuard,
      suggestionsGuard,
      carouselsGuard,
    ]));

  // Static file serving for generated carousel images
  app.use('/carousels/*', serveStatic({ root: './public' }));

  // OpenAPI documentation
  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Instagram Analytics API',
      version: '0.1.0',
      description:
        'API para análisis de métricas de Instagram. Requiere autenticación JWT de api-iam.',
    },
    servers: [
      {
        url: `http://localhost:${String(config.PORT)}`,
        description: 'Local development',
      },
    ],
  });
  app.get('/docs', swaggerUI({ url: '/openapi.json' }));

  // Meta-required webhook stubs (must respond 200 — no auth needed)
  // https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/deauthorize-callback-url
  app.post('/api/auth/instagram/deauthorize', (c) => c.json({ success: true }, 200));
  app.post('/api/auth/instagram/delete', (c) => c.json({ success: true }, 200));

  // Global error handler (must be last)
  app.onError(errorHandler);

  // Note: SyncService constructor does not accept a post-sync callback.
  // generateSuggestions is triggered via a separate background approach if needed.
  // For now, suggestions are only generated on-demand via the chat endpoint.

  // Measurement job: run every 1 hour to measure outcomes of used suggestions
  const ONE_HOUR_MS = 60 * 60 * 1000;
  setInterval(() => {
    suggestionService.measureOutcomes().catch((e: unknown) => {
      console.error('[measurement-job] error:', e);
    });
  }, ONE_HOUR_MS);

  // Token refresh job: check every 24h, refresh tokens expiring within 10 days
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const runTokenRefresh = () => {
    oauthService.refreshExpiringTokens(10).catch((error: unknown) => {
      console.error('[token-refresh] Job failed:', error);
    });
  };
  // Run once at startup, then every 24h
  runTokenRefresh();
  setInterval(runTokenRefresh, TWENTY_FOUR_HOURS);

  // Start server
  console.log(`🚀 Instagram Analytics API starting on port ${String(config.PORT)}...`);
  serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(`✅ Server running at http://localhost:${String(info.port)}`);
    console.log(`📖 Swagger docs at http://localhost:${String(info.port)}/docs`);
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
