import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { setCookie } from 'hono/cookie';
import type { InvitationService } from '../../services/index.js';
import type { Config } from '../../config.js';
import type { InvitationStatus } from '../../repositories/invitation/types.js';
import { ForbiddenError } from '../../errors.js';
import {
  InvitationPreviewSchema,
  AcceptInvitationRequestSchema,
  AcceptInvitationResponseSchema,
  CreateInvitationRequestSchema,
  CreateInvitationResponseSchema,
  InvitationListResponseSchema,
  commonErrorResponses,
} from '../schemas/index.js';

function setHubSessionCookie(c: Parameters<typeof setCookie>[0], config: Config): void {
  // hub_session is a presence-only cookie (not httpOnly) so the Next.js middleware
  // can read it on all routes and redirect to /login when no session exists.
  // It carries no sensitive data — the real auth gate is the refresh_token cookie.
  setCookie(c, 'hub_session', '1', {
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: config.JWT_REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function createInvitationsRouter(
  invitationService: InvitationService,
  idempotency: MiddlewareHandler,
  config: Config,
  authGuard?: MiddlewareHandler,
) {
  const router = new OpenAPIHono();

  // ── Public routes (no authGuard) ───────────────────────────────────────

  const getInvitationRoute = createRoute({
    method: 'get',
    path: '/invitations/{token}',
    operationId: 'getInvitation',
    tags: ['invitations'],
    security: [],
    request: {
      params: z.object({ token: z.string() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: InvitationPreviewSchema } },
        description: 'Invitation preview',
      },
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
      410: commonErrorResponses[410],
    },
  });

  router.openapi(getInvitationRoute, async (c) => {
    const { token } = c.req.valid('param');
    const preview = await invitationService.getInvitation(token);
    return c.json(
      {
        email: preview.email,
        role: preview.role,
        expiresAt:
          preview.expiresAt instanceof Date
            ? preview.expiresAt.toISOString()
            : String(preview.expiresAt),
        status: 'pending' as const,
        tenantName: preview.tenantName,
        inviterName: preview.inviterName,
      },
      200,
    );
  });

  const acceptInvitationRoute = createRoute({
    method: 'post',
    path: '/invitations/{token}/accept',
    operationId: 'acceptInvitation',
    tags: ['invitations'],
    security: [],
    request: {
      params: z.object({ token: z.string() }),
      body: {
        content: { 'application/json': { schema: AcceptInvitationRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: AcceptInvitationResponseSchema } },
        description: 'Session after accepting invitation',
      },
      400: commonErrorResponses[400],
      409: commonErrorResponses[409],
      410: commonErrorResponses[410],
      422: commonErrorResponses[422],
    },
  });

  router.use('/invitations/:token/accept', idempotency);

  router.openapi(acceptInvitationRoute, async (c) => {
    const { token } = c.req.valid('param');
    const { password, deviceId } = c.req.valid('json');

    const { session, refreshTokenRaw } = await invitationService.acceptInvitation({
      token,
      password,
      deviceId,
    });

    setCookie(c, 'refresh_token', refreshTokenRaw, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/auth/refresh',
      maxAge: config.JWT_REFRESH_TOKEN_TTL_SECONDS,
    });
    setHubSessionCookie(c, config);

    return c.json(session, 200);
  });

  // ── Admin routes (authGuard required) ────────────────────────────────

  if (authGuard !== undefined) {
    router.use('/invitations', authGuard);
    router.use('/invitations/:id', authGuard);
  }

  const createInvitationRoute = createRoute({
    method: 'post',
    path: '/invitations',
    operationId: 'createInvitation',
    tags: ['invitations'],
    request: {
      body: {
        content: { 'application/json': { schema: CreateInvitationRequestSchema } },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: CreateInvitationResponseSchema } },
        description: 'Invitation created',
      },
      403: commonErrorResponses[403],
      409: commonErrorResponses[409],
      422: commonErrorResponses[422],
    },
  });

  router.on('POST', '/invitations', idempotency);

  router.openapi(createInvitationRoute, async (c) => {
    const user = c.var.user;
    if (user.role !== 'TenantAdmin' && user.role !== 'SuperAdmin') {
      throw new ForbiddenError('admin.invitations.forbidden');
    }

    const { email, role } = c.req.valid('json');
    const result = await invitationService.createInvitation({
      tenantUuid: user.tenantUuid,
      inviterUserId: user.sub,
      email,
      role,
    });

    return c.json(
      {
        id: result.id,
        email: result.email,
        role: result.role,
        expiresAt: result.expiresAt instanceof Date ? result.expiresAt.toISOString() : String(result.expiresAt),
      },
      201,
    );
  });

  const listInvitationsRoute = createRoute({
    method: 'get',
    path: '/invitations',
    operationId: 'listInvitations',
    tags: ['invitations'],
    request: {
      query: z.object({
        status: z.enum(['pending', 'accepted', 'expired', 'revoked']).optional(),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: InvitationListResponseSchema } },
        description: 'List of invitations',
      },
      403: commonErrorResponses[403],
    },
  });

  router.openapi(listInvitationsRoute, async (c) => {
    const user = c.var.user;
    if (user.role !== 'TenantAdmin' && user.role !== 'SuperAdmin') {
      throw new ForbiddenError('admin.invitations.forbidden');
    }

    const { status } = c.req.valid('query');
    const items = await invitationService.listInvitations({
      tenantUuid: user.tenantUuid,
      statusFilter: status as InvitationStatus | undefined,
    });

    return c.json(
      {
        items: items.map((item) => ({
          id: item.id,
          email: item.email,
          role: item.role,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          expiresAt: item.expiresAt.toISOString(),
          usedAt: item.usedAt instanceof Date ? item.usedAt.toISOString() : undefined,
          revokedAt: item.revokedAt instanceof Date ? item.revokedAt.toISOString() : undefined,
        })),
      },
      200,
    );
  });

  const revokeInvitationRoute = createRoute({
    method: 'delete',
    path: '/invitations/{id}',
    operationId: 'revokeInvitation',
    tags: ['invitations'],
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      204: {
        description: 'Invitation revoked',
      },
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  });

  router.use('/invitations/:id', idempotency);

  router.openapi(revokeInvitationRoute, async (c) => {
    const user = c.var.user;
    if (user.role !== 'TenantAdmin' && user.role !== 'SuperAdmin') {
      throw new ForbiddenError('admin.invitations.forbidden');
    }

    const { id } = c.req.valid('param');
    await invitationService.revokeInvitation({ id, tenantUuid: user.tenantUuid });

    return c.body(null, 204);
  });

  return router;
}
