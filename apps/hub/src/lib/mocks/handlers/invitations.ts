import { http, HttpResponse } from 'msw';

import { db } from '../db';
import { getActiveScenario } from '../scenarios/index';
import { SEED } from '../seed';
import { mintFakeJwt, stableFuture } from '../seed-utils';

import { getCachedIdempotent, putIdempotentCache } from './idempotency-cache';
import { conflict, gone } from './problem';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';
const REFRESH_COOKIE = `refresh_token=mock-refresh-token; HttpOnly; Path=/auth/refresh; SameSite=Lax; Max-Age=604800`;
const SESSION_COOKIE = `hub_session=1; Path=/; SameSite=Lax; Max-Age=604800`;

function sessionHeaders(): Headers {
  const h = new Headers();
  h.append('Set-Cookie', REFRESH_COOKIE);
  h.append('Set-Cookie', SESSION_COOKIE);
  return h;
}

export const invitationsHandlers = [
  // GET /invitations/:token
  http.get(`${BASE}/invitations/:token`, ({ params }) => {
    const token = params['token'] as string;
    const scenario = getActiveScenario();

    if (scenario === 'invitation-expired') {
      return gone('Invitation expired');
    }

    if (scenario === 'invitation-used') {
      return conflict('Invitation already used');
    }

    const invitation = db.invitation.findFirst({ where: { token: { equals: token } } });
    if (invitation?.status === 'expired') {
      return gone('Invitation expired');
    }

    if (invitation?.status === 'accepted') {
      return conflict('Invitation already used');
    }

    if (invitation === null) {
      // For happy/unknown tokens: return a valid preview
      return HttpResponse.json({
        email: 'nuevo@empresa.com',
        tenantName: 'Empresa Acme S.A.',
        inviterName: 'Ana Pereira',
        role: 'User',
        expiresAt: stableFuture(7 * 24 * 3600),
        status: 'pending',
      });
    }

    return HttpResponse.json({
      email: invitation.email,
      tenantName: invitation.tenantName,
      inviterName: invitation.inviterName,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    });
  }),

  // POST /invitations/:token/accept
  http.post(`${BASE}/invitations/:token/accept`, ({ params, request }) => {
    const idemKey = request.headers.get('Idempotency-Key');
    if (idemKey !== null) {
      const cached = getCachedIdempotent(idemKey);
      if (cached !== null) return cached;
    }

    const token = params['token'] as string;
    const scenario = getActiveScenario();

    if (scenario === 'invitation-expired') {
      return gone('Invitation expired');
    }

    if (scenario === 'invitation-used') {
      return conflict('Invitation already used');
    }

    const invitation = db.invitation.findFirst({ where: { token: { equals: token } } });
    if (invitation?.status === 'expired') {
      return gone('Invitation expired');
    }

    if (invitation?.status === 'accepted') {
      return conflict('Invitation already used');
    }

    const accessToken = mintFakeJwt({
      sub: SEED.userId,
      tenant_id: SEED.tenantSlug,
      tenant_uuid: SEED.tenantId,
      tenant_slug: SEED.tenantSlug,
      role: 'User',
    });

    const responseBody = {
      accessToken,
      expiresIn: 900,
      user: {
        id: SEED.userId,
        email: invitation?.email ?? 'nuevo@empresa.com',
        fullName: 'Nuevo Usuario',
        picture: null,
      },
      tenant: {
        id: SEED.tenantId,
        slug: SEED.tenantSlug,
        name: 'Empresa Acme S.A.',
        planId: SEED.planProfessional,
        status: 'active',
      },
      role: 'User',
    };

    if (idemKey !== null) putIdempotentCache(idemKey, 200, responseBody);
    return HttpResponse.json(responseBody, { headers: sessionHeaders() });
  }),
];
