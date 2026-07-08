import { createRoute } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { createApiRouter } from '../../lib/create-openapi-router.js';
import { ErrorResponseSchema } from '../../lib/shared-schemas.js';
import type { OAuthService } from '../../services/oauth.service.js';
import { OAuthCallbackQuerySchema } from './auth.schemas.js';

const loginRoute = createRoute({
  method: 'get',
  path: '/login',
  tags: ['Auth'],
  summary: 'Redirect to Instagram OAuth',
  responses: {
    302: { description: 'Redirect to Instagram authorization page' },
  },
});

const callbackRoute = createRoute({
  method: 'get',
  path: '/callback',
  tags: ['Auth'],
  summary: 'Handle OAuth callback from Instagram',
  request: { query: OAuthCallbackQuerySchema },
  responses: {
    302: { description: 'Redirect to dashboard on success' },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid parameters',
    },
    502: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Instagram API error',
    },
  },
});

export function createAuthRoutes(oauthService: OAuthService): OpenAPIHono {
  const routes = createApiRouter();

  // loginRoute stays public — used only for direct browser redirects (not frontend fetch)
  routes.openapi(loginRoute, (c) => {
    const tenant = c.get('tenant');
    const url = oauthService.getAuthorizationUrl(tenant.tenantId, tenant.userId);
    return c.redirect(url);
  });

  // callback must stay public — Instagram redirects here without our JWT
  routes.openapi(callbackRoute, async (c) => {
    const { code, state } = c.req.valid('query');
    const result = await oauthService.handleCallback(code, state);
    return c.redirect(result.redirectUrl);
  });

  // status is intentionally NOT mounted here — it needs authGuard (tenant context).
  // It is registered in index.ts under the protected /api sub-app.

  return routes;
}
