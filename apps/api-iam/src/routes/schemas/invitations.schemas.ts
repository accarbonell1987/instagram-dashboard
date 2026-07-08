import { z } from '@hono/zod-openapi';
import { SessionSchema } from './auth.schemas.js';

export const InvitationPreviewSchema = z.object({
  email: z.string().email(),
  tenantName: z.string(),
  inviterName: z.string().optional(),
  role: z.enum(['SuperAdmin', 'TenantAdmin', 'User']),
  expiresAt: z.string(),
  status: z.enum(['pending', 'accepted', 'expired', 'revoked']),
});

export const AcceptInvitationRequestSchema = z.object({
  password: z.string(),
  deviceId: z.string().uuid().optional(),
});

export const AcceptInvitationResponseSchema = SessionSchema;

// ── Admin schemas ──────────────────────────────────────────────────────────

export const CreateInvitationRequestSchema = z.object({
  email: z.string().email(),
  role: z.enum(['TenantAdmin', 'User']),
});

export const CreateInvitationResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['SuperAdmin', 'TenantAdmin', 'User']),
  expiresAt: z.string().datetime(),
});

export const InvitationStatusSchema = z.enum(['pending', 'accepted', 'expired', 'revoked']);

export const InvitationListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['SuperAdmin', 'TenantAdmin', 'User']),
  status: InvitationStatusSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  usedAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
});

export const InvitationListResponseSchema = z.object({
  items: z.array(InvitationListItemSchema),
});
