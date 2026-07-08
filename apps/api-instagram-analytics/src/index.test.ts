/**
 * Bootstrap composition root tests.
 *
 * Verifies that the bootstrap module follows the api-example pattern:
 * - All imports resolve
 * - Service constructors accept correct dependency types
 * - The bootstrap file can be loaded (server is mocked)
 *
 * Strict TDD: RED phase — tests written before implementation.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock @hono/node-server's serve to prevent actual server startup during tests
vi.mock('@hono/node-server', () => ({
  serve: vi.fn((_opts, callback?: (info: { port: number }) => void) => {
    // Call the callback to verify it exists (api-example pattern)
    if (callback) callback({ port: 3003 });
    return { close: vi.fn() };
  }),
}));

describe('Bootstrap (index.ts) — Composition Root', () => {
  it('all local module imports resolve (pre-flight check)', async () => {
    const { config } = await import('./config.js');
    expect(config.PORT).toBeTypeOf('number');
    expect(config.DATABASE_URL).toBeTypeOf('string');
    expect(config.CORS_ORIGIN).toBeTypeOf('string');
    expect(config.NODE_ENV).toBeTypeOf('string');

    const { createRepositories } = await import('./lib/create-repositories.js');
    expect(createRepositories).toBeTypeOf('function');

    const { OAuthService } = await import('./services/oauth.service.js');
    expect(OAuthService).toBeTypeOf('function');

    const { SyncService } = await import('./services/sync.service.js');
    expect(SyncService).toBeTypeOf('function');

    const { DashboardService } = await import('./services/dashboard.service.js');
    expect(DashboardService).toBeTypeOf('function');

    const { InsightService } = await import('./services/insight.service.js');
    expect(InsightService).toBeTypeOf('function');

    const { authGuard } = await import('./middleware/auth-guard.js');
    expect(authGuard).toBeDefined();

    const { errorHandler } = await import('./middleware/error-handler.js');
    expect(errorHandler).toBeDefined();

    const { createHealthRoutes } = await import('./routes/health/health.routes.js');
    expect(createHealthRoutes).toBeTypeOf('function');

    const { createAuthRoutes } = await import('./routes/auth/auth.routes.js');
    expect(createAuthRoutes).toBeTypeOf('function');

    const { createDashboardRoutes } = await import('./routes/dashboard/dashboard.routes.js');
    expect(createDashboardRoutes).toBeTypeOf('function');

    const { createMediaRoutes } = await import('./routes/media/media.routes.js');
    expect(createMediaRoutes).toBeTypeOf('function');

    const { createSyncRoutes } = await import('./routes/sync/sync.routes.js');
    expect(createSyncRoutes).toBeTypeOf('function');
  });

  it('service constructors accept dependency types correctly', async () => {
    const { OAuthService } = await import('./services/oauth.service.js');
    const { SyncService } = await import('./services/sync.service.js');
    const { DashboardService } = await import('./services/dashboard.service.js');
    const { InsightService } = await import('./services/insight.service.js');

    const mockRepos = { instagram: {} as any, chatMessage: {} as any, suggestion: {} as any, carousel: {} as any };

    // Constructors should accept repos parameter
    expect(() => new OAuthService(mockRepos)).not.toThrow();
    expect(() => new SyncService(mockRepos)).not.toThrow();
    expect(() => new DashboardService(mockRepos)).not.toThrow();

    // InsightService has no-arg constructor
    expect(() => new InsightService()).not.toThrow();
  });

  it('route factories return OpenAPIHono instances', async () => {
    const { createApiRouter } = await import('./lib/create-openapi-router.js');
    const router = createApiRouter();
    expect(router).toBeDefined();
    expect(typeof router.route).toBe('function');
    expect(typeof router.openapi).toBe('function');
  });

  it('index.ts can be loaded without crashing (all wiring connects)', async () => {
    // This is the critical test: verify bootstrap module loads and wires
    // all dependencies correctly without throwing.
    // serve() is mocked, PrismaClient is instantiated (no DB needed for load).
    const module = await import('./index.js');
    expect(module).toBeDefined();

    // Verify serve was called (meaning bootstrap ran successfully)
    const { serve } = await import('@hono/node-server');
    expect(serve).toHaveBeenCalled();
  });
});
