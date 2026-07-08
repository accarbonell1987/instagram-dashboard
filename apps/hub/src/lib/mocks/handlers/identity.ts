import { http, HttpResponse } from 'msw';

import { db } from '../db';
import { SEED } from '../seed';

import { unauthorized } from './problem';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

export const identityHandlers = [
  // GET /tenants/current
  http.get(`${BASE}/tenants/current`, () => {
    const tenant = db.tenant.findFirst({ where: { id: { equals: SEED.tenantId } } });
    if (tenant === null) {
      return unauthorized('No active session');
    }

    return HttpResponse.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      planId: tenant.planId,
      status: tenant.status,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    });
  }),
];
