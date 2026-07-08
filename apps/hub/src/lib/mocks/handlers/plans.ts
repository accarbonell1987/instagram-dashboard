import { http, HttpResponse } from 'msw';

import { db } from '../db';

import { notFound } from './problem';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

// NOTE: /plans returns { plans: [...] } per OpenAPI contract (not a raw array).
// RESOLVED (Phase 5, Option A): hub services use apiFetchWithInterceptors directly —
// NOT coreServices Axios wrapper. No envelope needed. plans.service.ts and
// draft.service.ts are plain TS functions over apiFetchWithInterceptors, matching
// the OpenAPI contract 1:1. coreServices stays unused for hub API calls.

export const plansHandlers = [
  // GET /plans
  http.get(`${BASE}/plans`, () => {
    const plans = db.plan.findMany({});
    return HttpResponse.json({ plans });
  }),

  // GET /plans/:planId
  http.get(`${BASE}/plans/:planId`, ({ params }) => {
    const plan = db.plan.findFirst({ where: { id: { equals: params['planId'] as string } } });
    if (plan === null) {
      return notFound('Plan not found');
    }
    return HttpResponse.json(plan);
  }),
];
