/**
 * Unit tests for chat routes
 * TDD: RED phase — written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { createChatRoutes } from './chat.routes.js';
import { InternalError, RateLimitError } from '../../errors.js';
import { errorHandler } from '../../middleware/error-handler.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockChat = vi.fn();
const mockGrowthAgentService = {
  chat: mockChat,
  generateSuggestions: vi.fn(),
  getDashboardContext: vi.fn(),
  getTopPosts: vi.fn(),
  getFormatBreakdown: vi.fn(),
  getPostingHeatmap: vi.fn(),
  getSuggestionOutcomes: vi.fn(),
};

const mockFindBySession = vi.fn().mockResolvedValue([]);
const mockDeleteById = vi.fn().mockResolvedValue(undefined);
const mockDeleteBySessionId = vi.fn().mockResolvedValue(0);
const mockChatMessageRepo = {
  save: vi.fn(),
  findBySession: mockFindBySession,
  deleteById: mockDeleteById,
  deleteBySessionId: mockDeleteBySessionId,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'b3e4c5d6-e7f8-4a9b-a0c1-d2e3f4a5b6c7';
const SESSION_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

function makeApp() {
  // Create a test app that mocks auth (sets tenant context without verifying JWT)
  const app = new OpenAPIHono();

  // Mock auth middleware — sets tenant context
  app.use('*', async (c, next) => {
    c.set('tenant' as any, { tenantId: TENANT_ID, userId: 'user-1', tenantSlug: 'test', role: 'User' });
    await next();
  });

  const chatRoutes = createChatRoutes(mockGrowthAgentService as any, mockChatMessageRepo as any);
  app.route('/chat', chatRoutes);
  app.onError(errorHandler);
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Chat routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /chat', () => {
    it('valid request → 200 with reply, sessionId, suggestions, toolCallsTrace', async () => {
      mockChat.mockResolvedValueOnce({
        reply: 'Tus Reels funcionan muy bien.',
        suggestions: [],
        toolCallsTrace: [{ name: 'getDashboardContext', arguments: {} }],
      });

      const app = makeApp();
      const res = await app.request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          message: '¿Qué formato debo usar?',
          history: [],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.reply).toBe('Tus Reels funcionan muy bien.');
      expect(body.data.sessionId).toBe(SESSION_ID);
      expect(body.data.suggestions).toEqual([]);
      expect(body.data.toolCallsTrace).toHaveLength(1);
    });

    it('missing message → 400 validation error', async () => {
      const app = makeApp();
      const res = await app.request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          // message is missing
          history: [],
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    it('sessionId is auto-generated if not provided', async () => {
      mockChat.mockResolvedValueOnce({
        reply: 'Hola',
        suggestions: [],
        toolCallsTrace: [],
      });

      const app = makeApp();
      const res = await app.request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hola',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      // sessionId should be a UUID even if not provided
      expect(body.data.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('GrowthAgentService throws AGENT_TIMEOUT (InternalError) → 504', async () => {
      const timeoutError = new InternalError('AGENT_TIMEOUT');
      // Override statusCode to simulate the AGENT_TIMEOUT scenario
      mockChat.mockRejectedValueOnce(timeoutError);

      const app = makeApp();
      const res = await app.request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          message: 'test',
        }),
      });

      expect(res.status).toBe(504);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AGENT_TIMEOUT');
    });

    it('rate limit exceeded (11th request same tenant) → 429 with RATE_LIMITED code', async () => {
      // The in-route rate limiter allows 10 req/min per tenant.
      // Make the service succeed for the first 10, then the 11th hits the limiter.
      mockChat.mockResolvedValue({
        reply: 'OK',
        suggestions: [],
        toolCallsTrace: [],
      });

      // Use a unique tenant for this test to avoid cross-test counter pollution
      const RATE_TEST_TENANT = 'aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb';
      const app = new OpenAPIHono();
      app.use('*', async (c, next) => {
        c.set('tenant' as any, { tenantId: RATE_TEST_TENANT, userId: 'user-1', tenantSlug: 'test', role: 'User' });
        await next();
      });
      const chatRoutes = createChatRoutes(mockGrowthAgentService as any, mockChatMessageRepo as any);
      app.route('/chat', chatRoutes);
      app.onError(errorHandler);

      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        await app.request('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `request ${String(i)}` }),
        });
      }

      // 11th request should be rate limited
      const lastRes = await app.request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'eleventh request' }),
      });

      expect(lastRes.status).toBe(429);
      const body = await lastRes.json() as any;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /chat/history', () => {
    it('valid sessionId → 200 with message array', async () => {
      const messages = [
        { id: 'msg-1', tenantId: TENANT_ID, sessionId: SESSION_ID, role: 'user', content: 'Hola', createdAt: new Date().toISOString() },
        { id: 'msg-2', tenantId: TENANT_ID, sessionId: SESSION_ID, role: 'assistant', content: 'Hola, ¿en qué puedo ayudarte?', createdAt: new Date().toISOString() },
      ];
      mockFindBySession.mockResolvedValueOnce(messages);

      const app = makeApp();
      const res = await app.request(`/chat/history?sessionId=${SESSION_ID}`, {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });
  });

  describe('DELETE /chat/messages/:id', () => {
    it('deletes own message → 200 with deleted:true', async () => {
      const app = makeApp();
      const res = await app.request(`/chat/messages/${SESSION_ID}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.deleted).toBe(true);
      expect(mockDeleteById).toHaveBeenCalledWith(TENANT_ID, SESSION_ID);
    });

    it('non-existent message is idempotent → 200 (NFR-CP02)', async () => {
      const NONEXISTENT_ID = '11111111-1111-4111-a111-111111111111';
      // Repo catches P2025 internally — idempotent, no error thrown

      const app = makeApp();
      const res = await app.request(`/chat/messages/${NONEXISTENT_ID}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
    });
  });

  describe('DELETE /chat/history', () => {
    it('deletes all session messages → 200 with deletedCount', async () => {
      mockDeleteBySessionId.mockResolvedValueOnce(5);

      const app = makeApp();
      const res = await app.request(`/chat/history?sessionId=${SESSION_ID}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.deletedCount).toBe(5);
      expect(mockDeleteBySessionId).toHaveBeenCalledWith(TENANT_ID, SESSION_ID);
    });

    it('empty session → 200 with deletedCount 0', async () => {
      const EMPTY_SESSION_ID = '00000000-0000-4000-a000-000000000001';
      mockDeleteBySessionId.mockResolvedValueOnce(0);

      const app = makeApp();
      const res = await app.request(`/chat/history?sessionId=${EMPTY_SESSION_ID}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.deletedCount).toBe(0);
    });

    it('missing sessionId → 400 validation error', async () => {
      const app = makeApp();
      const res = await app.request('/chat/history', {
        method: 'DELETE',
      });

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });
});
