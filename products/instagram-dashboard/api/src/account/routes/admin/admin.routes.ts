import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import type { UsageTracker } from '../../../agent/services/usage-tracker.service.js';
import { ForbiddenError } from '../../../errors.js';
import { createApiRouter } from '../../../shared/lib/create-openapi-router.js';
import { ErrorResponseSchema } from '../../../shared/lib/shared-schemas.js';
import type { InstagramRepository } from '../../repositories/instagram/index.js';

import {
  AdminLinkedAccountsResponseSchema,
  AdminUnlinkResponseSchema,
  AdminUsageResponseSchema,
} from './admin.schemas.js';

/**
 * The real gate for tenant administration.
 *
 * The hub decides which nav entry it draws, but it is not in the request path
 * and cannot protect anything — anyone can call this URL directly with a valid
 * token. So the check lives here, on the `role` claim api-iam signed.
 */
function assertTenantAdmin(role: string): void {
  if (role !== 'TenantAdmin' && role !== 'SuperAdmin') {
    throw new ForbiddenError('Solo un administrador puede gestionar las cuentas vinculadas');
  }
}

const listLinkedAccounts = createRoute({
  method: 'get',
  path: '/linked-accounts',
  tags: ['Admin'],
  summary: "Every Instagram account the tenant holds, and who holds it",
  responses: {
    200: {
      content: { 'application/json': { schema: AdminLinkedAccountsResponseSchema } },
      description: 'Linked accounts',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Not a tenant administrator',
    },
  },
});

const unlinkAccount = createRoute({
  method: 'delete',
  path: '/linked-accounts/{accountId}',
  tags: ['Admin'],
  summary: 'Release an account so somebody else can connect it',
  request: {
    params: z.object({ accountId: z.string().uuid() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AdminUnlinkResponseSchema } },
      description: 'Account released',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Not a tenant administrator',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No such account in this tenant',
    },
  },
});


const getUsage = createRoute({
  method: 'get',
  path: '/usage',
  summary: 'AI consumption for the tenant, and per member',
  request: {
    query: z.object({
      // Days back. Capped: this scans the usage log, and an unbounded window
      // on a busy tenant is a table scan someone triggers by editing a URL.
      days: z.coerce.number().int().min(1).max(90).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AdminUsageResponseSchema } },
      description: 'Totals and per-member breakdown',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Not a tenant administrator',
    },
  },
});

export function createAdminRoutes(
  instagramRepository: InstagramRepository,
  usageTracker?: UsageTracker,
): OpenAPIHono {
  const router = createApiRouter();

  router.openapi(listLinkedAccounts, async (c) => {
    const tenant = c.get('tenant');
    assertTenantAdmin(tenant.role);

    const accounts = await instagramRepository.listAccountsByTenantId(tenant.tenantId);

    return c.json(
      {
        accounts: accounts.map((account) => ({
          id: account.id,
          userId: account.userId,
          igUserId: account.igUserId,
          username: account.username,
          displayName: account.displayName ?? null,
          profilePictureUrl: account.profilePictureUrl ?? null,
          followersCount: account.followersCount ?? null,
          accountType: account.accountType,
          syncStatus: account.syncStatus,
          lastSyncAt: account.lastSyncAt ? account.lastSyncAt.toISOString() : null,
          connectedAt: account.connectedAt.toISOString(),
          tokenExpiresAt: account.tokenExpiresAt.toISOString(),
        })),
      },
      200,
    );
  });


  router.openapi(getUsage, async (c) => {
    const tenant = c.get('tenant');
    assertTenantAdmin(tenant.role);

    const days = c.req.valid('query').days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    if (!usageTracker) {
      // Tracking off: an empty breakdown, not an error. The screen should say
      // "nothing recorded", which is true, rather than fail to load.
      return c.json(
        {
          total: { tokens: 0, images: 0, calls: 0, messages: 0 },
          byUser: [],
          byOperation: [],
          daily: [],
          since: since.toISOString(),
        },
        200,
      );
    }

    return c.json(await usageTracker.getBreakdown(tenant.tenantId, since), 200);
  });

  router.openapi(unlinkAccount, async (c) => {
    const tenant = c.get('tenant');
    assertTenantAdmin(tenant.role);

    const { accountId } = c.req.valid('param');
    // Scoped to the caller's tenant inside the repository, so an id from
    // another organisation reads as missing rather than forbidden.
    const account = await instagramRepository.disconnectAccountById(tenant.tenantId, accountId);

    return c.json({ id: account.id, syncStatus: account.syncStatus }, 200);
  });

  return router;
}
