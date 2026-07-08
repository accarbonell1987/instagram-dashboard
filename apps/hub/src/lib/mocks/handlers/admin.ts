import { http, HttpResponse } from 'msw';

import { db } from '../db';
import { SEED } from '../seed';
import { stableFuture, stableNow } from '../seed-utils';

import { conflict, notFound, unprocessable } from './problem';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

// ─── Status computation ───────────────────────────────────────────────────────

const FIXED_NOW_ISO = stableNow();

function computeStatus(inv: {
  revokedAt: string | null;
  usedAt: string | null;
  expiresAt: string;
}): 'pending' | 'accepted' | 'expired' | 'revoked' {
  if (inv.revokedAt !== null) return 'revoked';
  if (inv.usedAt !== null) return 'accepted';
  if (inv.expiresAt <= FIXED_NOW_ISO) return 'expired';
  return 'pending';
}

// ─── Admin handlers ───────────────────────────────────────────────────────────

export const adminHandlers = [
  // POST /invitations — create invitation (TenantAdmin only)
  http.post(`${BASE}/invitations`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; role?: string };
    const email = body.email ?? '';
    const role = body.role ?? 'User';

    // Check if there is already a pending invitation for this email in this tenant
    const existing = db.invitation.findFirst({
      where: {
        email: { equals: email },
        tenantId: { equals: SEED.tenantId },
      },
    });

    if (existing !== null) {
      const existingStatus = computeStatus({
        revokedAt: existing.revokedAt,
        usedAt: existing.usedAt,
        expiresAt: existing.expiresAt,
      });

      if (existingStatus === 'pending') {
        return conflict('invitation.pending_exists');
      }
    }

    const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const expiresAt = stableFuture(7 * 24 * 3600);

    db.invitation.create({
      id,
      token: `token-${id}`,
      email,
      tenantId: SEED.tenantId,
      tenantName: 'Empresa Acme S.A.',
      inviterName: 'Ana Pereira',
      role,
      expiresAt,
      usedAt: null,
      revokedAt: null,
      status: 'pending',
    });

    return HttpResponse.json(
      { id, email, role, expiresAt },
      { status: 201 },
    );
  }),

  // GET /invitations — list tenant invitations with optional status filter
  http.get(`${BASE}/invitations`, ({ request }) => {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');

    const allInvitations = db.invitation.findMany({
      where: { tenantId: { equals: SEED.tenantId } },
    });

    const items = allInvitations
      .map((inv) => {
        const status = computeStatus({
          revokedAt: inv.revokedAt,
          usedAt: inv.usedAt,
          expiresAt: inv.expiresAt,
        });
        return {
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status,
          createdAt: stableNow(), // stable for tests
          expiresAt: inv.expiresAt,
          ...(inv.usedAt !== null ? { usedAt: inv.usedAt } : {}),
          ...(inv.revokedAt !== null ? { revokedAt: inv.revokedAt } : {}),
        };
      })
      .filter((item) => statusFilter === null || item.status === statusFilter);

    return HttpResponse.json({ items });
  }),

  // DELETE /invitations/:id — revoke a pending invitation
  http.delete(`${BASE}/invitations/:id`, ({ params }) => {
    const id = params['id'] as string;

    const invitation = db.invitation.findFirst({
      where: { id: { equals: id }, tenantId: { equals: SEED.tenantId } },
    });

    if (invitation === null) {
      return notFound('Invitation not found');
    }

    if (invitation.usedAt !== null) {
      return unprocessable('invitation.already_accepted');
    }

    if (invitation.revokedAt !== null) {
      return unprocessable('invitation.already_revoked');
    }

    db.invitation.update({
      where: { id: { equals: id } },
      data: { revokedAt: stableNow(), status: 'revoked' },
    });

    return new HttpResponse(null, { status: 204 });
  }),

  // GET /tenants/current/members — list active members of the current tenant
  http.get(`${BASE}/tenants/current/members`, () => {
    const users = db.user.findMany({
      where: { tenantId: { equals: SEED.tenantId } },
    });

    const items = users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status ?? 'active',
      createdAt: stableNow(),
    }));

    return HttpResponse.json({ items });
  }),

  // PATCH /tenants/current — update tenant name
  http.patch(`${BASE}/tenants/current`, async ({ request }) => {
    const body = (await request.json()) as { name?: string };
    const name = body.name ?? '';

    const tenant = db.tenant.findFirst({
      where: { id: { equals: SEED.tenantId } },
    });

    if (tenant === null) {
      return notFound('Tenant not found');
    }

    const updated = db.tenant.update({
      where: { id: { equals: SEED.tenantId } },
      data: { name },
    });

    return HttpResponse.json(updated);
  }),

  // PATCH /tenants/current/members/:memberId/status — update member status
  http.patch(`${BASE}/tenants/current/members/:memberId/status`, async ({ request, params }) => {
    const memberId = params['memberId'] as string;
    const body = (await request.json()) as { status?: string };
    const status = body.status ?? 'active';

    const user = db.user.findFirst({
      where: { id: { equals: memberId }, tenantId: { equals: SEED.tenantId } },
    });

    if (user === null) {
      return notFound('Member not found');
    }

    db.user.update({
      where: { id: { equals: memberId } },
      data: { status },
    });

    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /tenants/current/members/:memberId — remove a member
  http.delete(`${BASE}/tenants/current/members/:memberId`, ({ params }) => {
    const memberId = params['memberId'] as string;

    const user = db.user.findFirst({
      where: { id: { equals: memberId }, tenantId: { equals: SEED.tenantId } },
    });

    if (user === null) {
      return notFound('Member not found');
    }

    db.user.delete({
      where: { id: { equals: memberId } },
    });

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /tenants/current/plan-change — request a plan change
  http.post(`${BASE}/tenants/current/plan-change`, async ({ request }) => {
    const body = (await request.json()) as { toPlanId?: string };
    const toPlanId = body.toPlanId ?? '';

    // Check if a pending request already exists
    const existing = db.planChangeRequest.findFirst({
      where: {
        tenantId: { equals: SEED.tenantId },
        status: { equals: 'pending' },
      },
    });

    if (existing !== null) {
      return conflict('plan_change.pending_exists');
    }

    const id = `pcr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    db.planChangeRequest.create({
      id,
      tenantId: SEED.tenantId,
      requestedBy: SEED.userId,
      toPlanId,
      status: 'pending',
      createdAt: stableNow(),
    });

    return HttpResponse.json({ id }, { status: 201 });
  }),
];
