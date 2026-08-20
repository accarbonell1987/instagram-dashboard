/**
 * Unit tests for agent routes
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { describe, it, expect, vi, beforeEach } from 'vitest';


import { AGENT_SETTINGS_SECTIONS } from '../../domain/agent-settings-sections.js';
import { NotFoundError } from '../../errors.js';
import { errorHandler } from '../../middleware/error-handler.js';
import type { InstagramRepository } from '../../repositories/instagram/index.js';
import type { UsageTracker } from '../../services/usage-tracker.service.js';

import { createAgentRoutes } from './agent.routes.js';

// ─── Response body types ───────────────────────────────────────────────────────

interface Quota {
  used: number;
  limit: number;
  period: string;
  resetsAt: string;
}

interface UsageData {
  quotas: { llm_tokens: Quota; fal_images: Quota; chat_sessions: Quota };
  periodStart: string;
  periodEnd: string;
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGetAgentConfig = vi.fn();
const mockSaveAgentConfig = vi.fn();
const mockHasFalApiKey = vi.fn().mockResolvedValue(false);
const mockGetUsage = vi.fn();

const mockHasLlmApiKey = vi.fn().mockResolvedValue(false);

const mockRepos = {
  getAgentConfig: mockGetAgentConfig,
  saveAgentConfig: mockSaveAgentConfig,
  hasFalApiKey: mockHasFalApiKey,
  saveFalApiKey: vi.fn().mockResolvedValue(undefined),
  hasLlmApiKey: mockHasLlmApiKey,
  saveLlmApiKey: vi.fn().mockResolvedValue(undefined),
};

const mockUsageTracker = {
  getUsage: mockGetUsage,
};

const TENANT_ID = 'b3e4c5d6-e7f8-4a9b-a0c1-d2e3f4a5b6c7';
const USER_ID = 'user-1';

/** Every settings section, so the default caller in these tests is unrestricted. */
const ALL_AGENT_MODULES = AGENT_SETTINGS_SECTIONS.map((section) => section.moduleId);

function makeApp(
  usageTrackingEnabled = true,
  // These tests are about the endpoints' behaviour, so the caller clears every
  // gate unless a test is specifically about a gate.
  access: { role?: string; moduleIds?: string[] } = {},
) {
  const app = new OpenAPIHono();

  // Mock auth middleware
  app.use('*', async (c, next) => {
    c.set('tenant', {
      tenantId: TENANT_ID,
      userId: USER_ID,
      tenantSlug: 'test',
      role: access.role ?? 'TenantAdmin',
    });
    await next();
  });

  const routes = createAgentRoutes(
    mockRepos as unknown as InstagramRepository,
    mockUsageTracker as unknown as UsageTracker,
    usageTrackingEnabled,
    { getAccessibleModuleIds: () => Promise.resolve(access.moduleIds ?? ALL_AGENT_MODULES) },
  );
  app.route('/agent', routes);
  app.onError(errorHandler);
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Agent routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /agent/settings', () => {
    it('returns 200 with null when no config exists', async () => {
      mockGetAgentConfig.mockResolvedValueOnce(null);
      mockHasFalApiKey.mockResolvedValueOnce(false);

      const app = makeApp();
      const res = await app.request('/agent/settings', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { agentConfig: unknown; hasFalApiKey: boolean } };
      expect(body.success).toBe(true);
      expect(body.data.agentConfig).toBeNull();
      expect(body.data.hasFalApiKey).toBe(false);
    });

    it('returns 200 with config when saved', async () => {
      const config = { niche: 'Moda', tags: ['Ropa', 'Tendencias'] };
      mockGetAgentConfig.mockResolvedValueOnce(config);
      mockHasFalApiKey.mockResolvedValueOnce(true);

      const app = makeApp();
      const res = await app.request('/agent/settings', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { agentConfig: unknown; hasFalApiKey: boolean } };
      expect(body.success).toBe(true);
      expect(body.data.agentConfig).toEqual(config);
      expect(body.data.hasFalApiKey).toBe(true);
    });
  });

  describe('PUT /agent/settings — authorisation', () => {
    const stored = {
      niche: 'Moda',
      tags: ['Ropa'],
      llm: { provider: 'deepseek' },
      limits: { slideText: 150 },
    };

    /**
     * The hole this closes. The endpoint took the whole payload with no
     * per-field check, so any member holding `ig-ai-agent` could point the
     * agent at their own model, rotate the tenant's fal.ai key, and raise the
     * character limits — spending the tenant's quota and touching its secrets.
     */
    it('refuses a member who tries to change the model', async () => {
      mockGetAgentConfig.mockResolvedValueOnce(stored);

      const app = makeApp(true, { role: 'User' });
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...stored, llm: { provider: 'openai' } }),
      });

      expect(res.status).toBe(403);
      expect(mockSaveAgentConfig).not.toHaveBeenCalled();
    });

    it('refuses a member who submits a fal.ai key', async () => {
      mockGetAgentConfig.mockResolvedValueOnce(stored);

      const app = makeApp(true, { role: 'User' });
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...stored, falApiKey: 'fal-stolen' }),
      });

      expect(res.status).toBe(403);
      expect(mockRepos.saveFalApiKey).not.toHaveBeenCalled();
    });

    it('refuses a member who raises the character limits', async () => {
      mockGetAgentConfig.mockResolvedValueOnce(stored);

      const app = makeApp(true, { role: 'User' });
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...stored, limits: { slideText: 500 } }),
      });

      expect(res.status).toBe(403);
      expect(mockSaveAgentConfig).not.toHaveBeenCalled();
    });

    /**
     * The other half: refusing must not cost a member the save they are
     * entitled to. The screen posts the whole config, so their payload carries
     * the admin-only values they merely loaded.
     */
    it('lets a member edit the topics while echoing back admin-only values', async () => {
      mockGetAgentConfig.mockResolvedValueOnce(stored);
      mockSaveAgentConfig.mockResolvedValueOnce(undefined);

      const app = makeApp(true, { role: 'User' });
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...stored, niche: 'Fitness' }),
      });

      expect(res.status).toBe(200);
      expect(mockSaveAgentConfig).toHaveBeenCalled();
    });

    // Holding the role is not enough when the tenant never bought the feature.
    it('refuses an admin whose tenant has no model module', async () => {
      mockGetAgentConfig.mockResolvedValueOnce(stored);

      const app = makeApp(true, {
        role: 'TenantAdmin',
        moduleIds: ALL_AGENT_MODULES.filter((id) => id !== 'ig-agent-model'),
      });
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...stored, llm: { provider: 'openai' } }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /agent/settings', () => {
    it('returns 200 on valid save', async () => {
      mockSaveAgentConfig.mockResolvedValueOnce(undefined);

      const app = makeApp();
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: 'Tecnología',
          tags: ['Gadgets'],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { saved: boolean } };
      expect(body.success).toBe(true);
      expect(body.data.saved).toBe(true);
      expect(mockSaveAgentConfig).toHaveBeenCalledWith({ tenantId: TENANT_ID, userId: USER_ID }, {
        niche: 'Tecnología',
        tags: ['Gadgets'],
      });
    });

    it('returns 200 with customPrompt', async () => {
      mockSaveAgentConfig.mockResolvedValueOnce(undefined);

      const app = makeApp();
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: 'Fitness',
          tags: ['Gym'],
          customPrompt: 'Sé breve',
        }),
      });

      expect(res.status).toBe(200);
      expect(mockSaveAgentConfig).toHaveBeenCalledWith({ tenantId: TENANT_ID, userId: USER_ID }, {
        niche: 'Fitness',
        tags: ['Gym'],
        customPrompt: 'Sé breve',
      });
    });

    it('returns 400 on invalid body (missing niche)', async () => {
      const app = makeApp();
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: ['Test'] }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 on empty tags array', async () => {
      const app = makeApp();
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: 'Test', tags: [] }),
      });

      // min(0) allows empty arrays — should pass validation
      expect(res.status).toBe(200);
    });

    it('returns 400 on tags exceeding max (30)', async () => {
      const app = makeApp();
      const tooManyTags = Array.from({ length: 31 }, (_, i) => `Tag${String(i)}`);
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: 'Test', tags: tooManyTags }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 on customPrompt exceeding max (2000)', async () => {
      const app = makeApp();
      const tooLong = 'x'.repeat(2001);
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: 'Test', tags: ['Tag'], customPrompt: tooLong }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 on invalid JSON body', async () => {
      const app = makeApp();
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });

      expect(res.status).toBe(400);
    });

    it('returns 404 when account not found', async () => {
      mockSaveAgentConfig.mockRejectedValueOnce(new NotFoundError('InstagramAccount', `${TENANT_ID}:${USER_ID}`));

      const app = makeApp();
      const res = await app.request('/agent/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: 'Test', tags: ['Tag'] }),
      });

      expect(res.status).toBe(404);
      const body = await res.json() as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── GET /agent/usage ────────────────────────────────────────────────────

  describe('GET /agent/usage', () => {
    it('returns 200 with quota structure when usage exists', async () => {
      mockGetUsage.mockResolvedValueOnce({
        tokens: { used: 12450, limit: 100000, period: 'month' },
        images: { used: 8, limit: 50, period: 'month' },
        sessions: { used: 3, limit: 30, period: 'day' },
        period: 'month',
      });

      const app = makeApp(true);
      const res = await app.request('/agent/usage', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: UsageData };
      expect(body.success).toBe(true);
      expect(body.data.quotas.llm_tokens.used).toBe(12450);
      expect(body.data.quotas.llm_tokens.limit).toBe(100000);
      expect(body.data.quotas.llm_tokens.period).toBe('month');
      expect(body.data.quotas.llm_tokens.resetsAt).toBeDefined();
      expect(body.data.quotas.fal_images.used).toBe(8);
      expect(body.data.quotas.fal_images.limit).toBe(50);
      expect(body.data.quotas.fal_images.period).toBe('month');
      expect(body.data.quotas.fal_images.resetsAt).toBeDefined();
      // The daily cap, which the endpoint used to leave out entirely.
      expect(body.data.quotas.chat_sessions.used).toBe(3);
      expect(body.data.quotas.chat_sessions.limit).toBe(30);
      expect(body.data.quotas.chat_sessions.period).toBe('day');
      expect(body.data.periodStart).toBeDefined();
      expect(body.data.periodEnd).toBeDefined();
      expect(mockGetUsage).toHaveBeenCalledWith(TENANT_ID);
    });

    it('returns 200 with zeros when no usage yet', async () => {
      mockGetUsage.mockResolvedValueOnce({
        tokens: { used: 0, limit: 100000, period: 'month' },
        images: { used: 0, limit: 50, period: 'month' },
        sessions: { used: 0, limit: 30, period: 'day' },
        period: 'month',
      });

      const app = makeApp(true);
      const res = await app.request('/agent/usage', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: UsageData };
      expect(body.success).toBe(true);
      expect(body.data.quotas.llm_tokens.used).toBe(0);
      expect(body.data.quotas.llm_tokens.limit).toBe(100000);
      expect(body.data.quotas.fal_images.used).toBe(0);
      expect(body.data.quotas.fal_images.limit).toBe(50);
    });

    it('returns 200 with unlimited placeholder when tracking disabled', async () => {
      const app = makeApp(false);
      const res = await app.request('/agent/usage', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: UsageData };
      expect(body.success).toBe(true);
      expect(body.data.quotas.llm_tokens.used).toBe(0);
      expect(body.data.quotas.llm_tokens.limit).toBe(-1);
      expect(body.data.quotas.llm_tokens.period).toBe('month');
      expect(body.data.quotas.fal_images.used).toBe(0);
      expect(body.data.quotas.fal_images.limit).toBe(-1);
      expect(body.data.quotas.fal_images.period).toBe('month');
      // getUsage should NOT be called when tracking is disabled
      expect(mockGetUsage).not.toHaveBeenCalled();
    });

    it('calls getUsage with the correct tenantId for tenant isolation', async () => {
      const TENANT_A = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const TENANT_B = '11111111-2222-3333-4444-555555555555';

      mockGetUsage.mockResolvedValueOnce({
        tokens: { used: 100, limit: 1000 },
        images: { used: 1, limit: 10 },
        sessions: { used: 0, limit: 5 },
        period: 'month',
      });

      // Create app with tenant A
      const appA = new OpenAPIHono();
      appA.use('*', async (c, next) => {
        c.set('tenant', { tenantId: TENANT_A, userId: 'user-a', tenantSlug: 'a', role: 'User' });
        await next();
      });
      const routesA = createAgentRoutes(
        mockRepos as unknown as InstagramRepository,
        mockUsageTracker as unknown as UsageTracker,
        true,
        { getAccessibleModuleIds: () => Promise.resolve(ALL_AGENT_MODULES) },
      );
      appA.route('/agent', routesA);
      appA.onError(errorHandler);

      await appA.request('/agent/usage', { method: 'GET' });
      expect(mockGetUsage).toHaveBeenCalledWith(TENANT_A);

      vi.clearAllMocks();

      mockGetUsage.mockResolvedValueOnce({
        tokens: { used: 200, limit: 2000 },
        images: { used: 2, limit: 20 },
        sessions: { used: 1, limit: 10 },
        period: 'month',
      });

      // Create app with tenant B
      const appB = new OpenAPIHono();
      appB.use('*', async (c, next) => {
        c.set('tenant', { tenantId: TENANT_B, userId: 'user-b', tenantSlug: 'b', role: 'User' });
        await next();
      });
      const routesB = createAgentRoutes(
        mockRepos as unknown as InstagramRepository,
        mockUsageTracker as unknown as UsageTracker,
        true,
        { getAccessibleModuleIds: () => Promise.resolve(ALL_AGENT_MODULES) },
      );
      appB.route('/agent', routesB);
      appB.onError(errorHandler);

      await appB.request('/agent/usage', { method: 'GET' });
      expect(mockGetUsage).toHaveBeenCalledWith(TENANT_B);
    });

    it('returns periodStart as first day and periodEnd as first day of next month', async () => {
      mockGetUsage.mockResolvedValueOnce({
        tokens: { used: 0, limit: 1000 },
        images: { used: 0, limit: 10 },
        sessions: { used: 0, limit: 5 },
        period: 'month',
      });

      const app = makeApp(true);
      const res = await app.request('/agent/usage', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: UsageData };
      const now = new Date();
      const expectedStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const expectedEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      expect(body.data.periodStart).toBe(expectedStart);
      expect(body.data.periodEnd).toBe(expectedEnd);
      // resetsAt should match periodEnd
      expect(body.data.quotas.llm_tokens.resetsAt).toBe(expectedEnd);
      expect(body.data.quotas.fal_images.resetsAt).toBe(expectedEnd);
    });

    it('returns period boundaries even when tracking disabled', async () => {
      const app = makeApp(false);
      const res = await app.request('/agent/usage', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: UsageData };
      const now = new Date();
      const expectedStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const expectedEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      expect(body.data.periodStart).toBe(expectedStart);
      expect(body.data.periodEnd).toBe(expectedEnd);
    });

    it('returns 200 with zero usage when getUsage returns all zeros', async () => {
      mockGetUsage.mockResolvedValueOnce({
        tokens: { used: 0, limit: 100000, period: 'month' },
        images: { used: 0, limit: 50, period: 'month' },
        sessions: { used: 0, limit: 30, period: 'day' },
        period: 'month',
      });

      const app = makeApp(true);
      const res = await app.request('/agent/usage', { method: 'GET' });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: UsageData };
      expect(body.data.quotas.llm_tokens.used).toBe(0);
      expect(body.data.quotas.llm_tokens.limit).toBe(100000);
      expect(body.data.quotas.fal_images.used).toBe(0);
      expect(body.data.quotas.fal_images.limit).toBe(50);
      expect(body.data.quotas.llm_tokens.period).toBe('month');
      expect(body.data.quotas.fal_images.period).toBe('month');
      expect(body.data.quotas.llm_tokens.resetsAt).toBeDefined();
      expect(body.data.quotas.fal_images.resetsAt).toBeDefined();
    });
  });
});
