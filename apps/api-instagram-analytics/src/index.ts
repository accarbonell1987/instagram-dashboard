import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { PrismaClient } from '@prisma/client';
import { join } from 'node:path';

import { config } from './config.js';
import { createRepositories } from './lib/create-repositories.js';
import { OAuthService } from './services/oauth.service.js';
import { SyncService } from './services/sync.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { InsightService } from './services/insight.service.js';
import { DeepSeekClient } from './lib/deepseek-client.js';
import { SuggestionService } from './services/suggestion.service.js';
import { GrowthAgentService } from './services/growth-agent.service.js';
import { ScriptGeneratorService } from './services/script-generator.service.js';
import { CarouselService } from './services/carousel.service.js';
import { FalAiImageProvider } from './lib/image/fal-ai-image-provider.js';
import { DiskImageStorage } from './lib/image/disk-image-storage.js';
import { UsageTracker } from './services/usage-tracker.service.js';
import { authGuard } from './middleware/auth-guard.js';
import { errorHandler } from './middleware/error-handler.js';
import { ConflictError } from './errors.js';
import { createHealthRoutes } from './routes/health/health.routes.js';
import { createAuthRoutes } from './routes/auth/auth.routes.js';
import { createDashboardRoutes } from './routes/dashboard/dashboard.routes.js';
import { createMediaRoutes } from './routes/media/media.routes.js';
import { createSyncRoutes } from './routes/sync/sync.routes.js';
import { createChatRoutes } from './routes/chat/chat.routes.js';
import { createSuggestionsRoutes } from './routes/suggestions/suggestions.routes.js';
import { createAgentRoutes } from './routes/agent/agent.routes.js';
import { createCarouselRoutes } from './routes/carousels/carousels.routes.js';
import { createInternalRoutes } from './routes/internal/internal.routes.js';

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
  const deepseekClient = new DeepSeekClient();

  // Usage tracking (feature-flagged — no-op when ENABLE_USAGE_TRACKING=false)
  // Must be instantiated before services that depend on it
  const usageTracker = new UsageTracker(
    prisma,
    config.IAM_INTERNAL_URL,
    config.ENABLE_USAGE_TRACKING,
  );

  const suggestionService = new SuggestionService(repos, deepseekClient, usageTracker);
  // GrowthAgentService requires suggestionService to be instantiated first
  const growthAgentService = new GrowthAgentService(repos, dashboardService, deepseekClient, suggestionService, usageTracker);
  // Carousel pipeline
  const scriptGeneratorService = new ScriptGeneratorService(deepseekClient, usageTracker);
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

  // Protected routes (JWT required)
  const api = new OpenAPIHono();
  api.use('*', authGuard);
  api.route('/dashboard', createDashboardRoutes(dashboardService, insightService));
  api.route('/media', createMediaRoutes(dashboardService));
  api.route('/sync', createSyncRoutes(syncService));
  // Growth agent routes (chat + suggestions)
  api.route('/chat', createChatRoutes(growthAgentService, repos.chatMessage));
  api.route('/suggestions', createSuggestionsRoutes(suggestionService));
  // Agent config + usage routes
  api.route('/agent', createAgentRoutes(repos.instagram, usageTracker, config.ENABLE_USAGE_TRACKING));
  // Carousel routes
  api.route('/carousels', createCarouselRoutes(carouselService));

  // Protected auth routes: need JWT so authGuard has already set tenant context
  api.get('/auth/instagram/authorize', async (c) => {
    const tenant = c.get('tenant');
    // Permanent binding: one IG account per tenant, forever
    const existingAccount = await repos.instagram.findAccountByTenantId(tenant.tenantId);
    if (existingAccount && existingAccount.syncStatus !== 'disconnected') {
      throw new ConflictError('InstagramAccount', 'tenantId', tenant.tenantId);
    }
    const url = oauthService.getAuthorizationUrl(tenant.tenantId, tenant.userId);
    return c.json({ success: true, data: { url } }, 200);
  });

  api.get('/auth/instagram/status', async (c) => {
    const tenant = c.get('tenant');
    const status = await oauthService.getConnectionStatus(tenant.tenantId, tenant.userId);
    return c.json({ success: true, data: status }, 200);
  });

  api.post('/auth/instagram/disconnect', async (c) => {
    const tenant = c.get('tenant');
    await oauthService.disconnectAccount(tenant.tenantId, tenant.userId);
    return c.json({ success: true, data: { message: 'Cuenta desconectada exitosamente' } }, 200);
  });
  
  app.route('/api', api);

  // Internal routes (no auth guard — protected by network/firewall)
  app.route('/internal', createInternalRoutes(usageTracker));

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
