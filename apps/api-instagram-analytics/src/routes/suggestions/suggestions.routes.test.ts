/**
 * Unit tests for suggestions routes
 * TDD: RED phase — written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { createSuggestionsRoutes } from './suggestions.routes.js';
import { NotFoundError } from '../../errors.js';
import { errorHandler } from '../../middleware/error-handler.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGetSuggestions = vi.fn();
const mockCreateSuggestion = vi.fn();
const mockMarkUsed = vi.fn();
const mockDismiss = vi.fn();
const mockMeasureOutcomes = vi.fn();

const mockSuggestionService = {
  getSuggestions: mockGetSuggestions,
  createSuggestion: mockCreateSuggestion,
  markUsed: mockMarkUsed,
  dismiss: mockDismiss,
  measureOutcomes: mockMeasureOutcomes,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'b3e4c5d6-e7f8-4a9b-a0c1-d2e3f4a5b6c7';
const SUGGESTION_ID = 'c4d5e6f7-a8b9-4c0d-e1f2-a3b4c5d6e7f8';
const MEDIA_ID = 'd5e6f7a8-b9c0-4d1e-f2a3-b4c5d6e7f8a9';

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: SUGGESTION_ID,
    tenantId: TENANT_ID,
    category: 'hook',
    content: 'Empezá con el truco más inesperado',
    status: 'pending',
    linkedMediaId: null,
    linkedAt: null,
    outcome: null,
    measuredAt: null,
    baselineJson: null,
    metricsJson: null,
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
    ...overrides,
  };
}

function makeApp() {
  const app = new OpenAPIHono();

  // Mock auth middleware
  app.use('*', async (c, next) => {
    c.set('tenant' as any, { tenantId: TENANT_ID, userId: 'user-1', tenantSlug: 'test', role: 'User' });
    await next();
  });

  const routes = createSuggestionsRoutes(mockSuggestionService as any);
  app.route('/suggestions', routes);
  app.onError(errorHandler);
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Suggestions routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /suggestions', () => {
    it('returns 200 with suggestions array', async () => {
      const suggestions = [makeSuggestion(), makeSuggestion({ id: 'sugg-2' })];
      mockGetSuggestions.mockResolvedValueOnce(suggestions);

      const app = makeApp();
      const res = await app.request('/suggestions', {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(mockGetSuggestions).toHaveBeenCalledWith(TENANT_ID, undefined);
    });

    it('filters by status when status query param is provided', async () => {
      mockGetSuggestions.mockResolvedValueOnce([makeSuggestion({ status: 'used' })]);

      const app = makeApp();
      const res = await app.request('/suggestions?status=used', {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      expect(mockGetSuggestions).toHaveBeenCalledWith(TENANT_ID, 'used');
    });
  });

  describe('POST /suggestions/:id/mark-used', () => {
    it('valid body → 200', async () => {
      mockMarkUsed.mockResolvedValueOnce(undefined);

      const app = makeApp();
      const res = await app.request(`/suggestions/${SUGGESTION_ID}/mark-used`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedMediaId: MEDIA_ID }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(mockMarkUsed).toHaveBeenCalledWith(TENANT_ID, SUGGESTION_ID, MEDIA_ID);
    });

    it('missing linkedMediaId → 200 (optional — mark used without linking media)', async () => {
      mockMarkUsed.mockResolvedValueOnce(undefined);
      const app = makeApp();
      const res = await app.request(`/suggestions/${SUGGESTION_ID}/mark-used`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
    });

    it('invalid (non-UUID) linkedMediaId → 400', async () => {
      const app = makeApp();
      const res = await app.request(`/suggestions/${SUGGESTION_ID}/mark-used`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedMediaId: '' }),
      });

      expect(res.status).toBe(400);
    });

    it('suggestion not found → 404', async () => {
      mockMarkUsed.mockRejectedValueOnce(new NotFoundError('ContentSuggestion', SUGGESTION_ID));

      const app = makeApp();
      const res = await app.request(`/suggestions/${SUGGESTION_ID}/mark-used`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedMediaId: MEDIA_ID }),
      });

      expect(res.status).toBe(404);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /suggestions/:id/dismiss', () => {
    it('returns 200', async () => {
      mockDismiss.mockResolvedValueOnce(undefined);

      const app = makeApp();
      const res = await app.request(`/suggestions/${SUGGESTION_ID}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(mockDismiss).toHaveBeenCalledWith(TENANT_ID, SUGGESTION_ID);
    });

    it('suggestion not found → 404', async () => {
      mockDismiss.mockRejectedValueOnce(new NotFoundError('ContentSuggestion', 'nonexistent'));

      const app = makeApp();
      const res = await app.request(`/suggestions/nonexistent/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(404);
      const body = await res.json() as any;
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
