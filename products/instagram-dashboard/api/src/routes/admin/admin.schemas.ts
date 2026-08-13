import { z } from '@hono/zod-openapi';

/**
 * A linked Instagram account as the tenant's administrator sees it.
 *
 * `userId` is the platform user who connected it. The name behind that id lives
 * in api-iam, not here, so this endpoint reports the id and the screen resolves
 * it against the tenant's member list.
 */
export const AdminLinkedAccountSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    igUserId: z.string(),
    username: z.string(),
    displayName: z.string().nullable(),
    profilePictureUrl: z.string().nullable(),
    followersCount: z.number().int().nullable(),
    accountType: z.string(),
    syncStatus: z.string(),
    lastSyncAt: z.string().datetime().nullable(),
    connectedAt: z.string().datetime(),
    tokenExpiresAt: z.string().datetime(),
  })
  .openapi('AdminLinkedAccount');

export const AdminLinkedAccountsResponseSchema = z
  .object({
    accounts: z.array(AdminLinkedAccountSchema),
  })
  .openapi('AdminLinkedAccountsResponse');

export const AdminUnlinkResponseSchema = z
  .object({
    id: z.string().uuid(),
    syncStatus: z.string(),
  })
  .openapi('AdminUnlinkResponse');
