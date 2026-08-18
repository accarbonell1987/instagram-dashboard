import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { ForbiddenError } from '../../errors.js';
import { createApiRouter } from '../../lib/create-openapi-router.js';
import { ErrorResponseSchema } from '../../lib/shared-schemas.js';
import type { InstagramRepository } from '../../repositories/instagram/index.js';

import {
  AdminLinkedAccountsResponseSchema,
  AdminUnlinkResponseSchema,
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

export function createAdminRoutes(instagramRepository: InstagramRepository): OpenAPIHono {
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
