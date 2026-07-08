/**
 * Instagram Analytics MSW handlers test.
 *
 * Tests the mock handlers for the Instagram Analytics API (port 3003).
 * Uses the global MSW Node server from vitest.setup.ts.
 *
 * Strict TDD: RED phase — tests written before implementation.
 */
import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:3003';

describe('instagram MSW handlers', () => {
  describe('Auth', () => {
    it('GET /api/auth/instagram/status returns connection status', async () => {
      const response = await fetch(`${API_BASE}/api/auth/instagram/status`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as { success: boolean; data: { connected: boolean } };
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data.connected).toBe('boolean');
    });

    it('GET /api/auth/instagram/login redirects to Instagram OAuth', async () => {
      const response = await fetch(`${API_BASE}/api/auth/instagram/login`, {
        redirect: 'manual',
      });
      expect(response.status).toBe(302);
      const location = response.headers.get('Location');
      expect(location).toContain('instagram.com/oauth/authorize');
    });
  });

  describe('Dashboard', () => {
    it('GET /api/dashboard returns full dashboard data', async () => {
      const response = await fetch(`${API_BASE}/api/dashboard`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        success: boolean;
        data: {
          period: string;
          account: { username: string; accountType: string; followerCount: number };
          overview: { totalPosts: number; totalSaves: number; totalShares: number };
          ranking: unknown[];
          formatBreakdown: unknown[];
          heatmap: unknown[];
          insight: { insight: string; generatedAt: string };
          lastUpdated: string;
        };
      };

      expect(body.success).toBe(true);
      expect(body.data.period).toBe('7d');
      expect(body.data.account).toBeDefined();
      expect(body.data.account.username).toBeTypeOf('string');
      expect(body.data.account.accountType).toBe('BUSINESS');
      expect(body.data.overview).toBeDefined();
      expect(body.data.overview.totalPosts).toBeGreaterThan(0);
      expect(body.data.ranking).toBeInstanceOf(Array);
      expect(body.data.ranking.length).toBeGreaterThan(0);
      expect(body.data.formatBreakdown).toBeInstanceOf(Array);
      expect(body.data.formatBreakdown.length).toBeGreaterThan(0);
      expect(body.data.heatmap).toBeInstanceOf(Array);
      expect(body.data.heatmap.length).toBeGreaterThan(0);
      expect(body.data.insight).toBeDefined();
      expect(body.data.insight.insight).toContain('💡');
      expect(body.data.lastUpdated).toBeTypeOf('string');
    });

    it('GET /api/dashboard/insight returns insight only', async () => {
      const response = await fetch(`${API_BASE}/api/dashboard/insight`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        success: boolean;
        data: { insight: string; generatedAt: string };
      };

      expect(body.success).toBe(true);
      expect(body.data.insight).toContain('💡');
      expect(body.data.generatedAt).toBeTypeOf('string');
    });
  });

  describe('Sync', () => {
    it('POST /api/sync/trigger returns sync result', async () => {
      const response = await fetch(`${API_BASE}/api/sync/trigger`, { method: 'POST' });
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        success: boolean;
        data: { syncId: string; status: string };
      };

      expect(body.success).toBe(true);
      expect(body.data.syncId).toBeTypeOf('string');
      expect(body.data.status).toBe('started');
    });

    it('GET /api/sync/status returns sync status', async () => {
      const response = await fetch(`${API_BASE}/api/sync/status`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        success: boolean;
        data: {
          status: string;
          lastSyncAt: string;
          mediaCount: number;
          nextSyncAvailableAt: string | null;
        };
      };

      expect(body.success).toBe(true);
      expect(body.data.status).toBe('idle');
      expect(body.data.lastSyncAt).toBeTypeOf('string');
      expect(body.data.mediaCount).toBe(24);
      expect(body.data.nextSyncAvailableAt).toBeNull();
    });
  });

  describe('Media', () => {
    it('GET /api/media returns paginated media list', async () => {
      const response = await fetch(`${API_BASE}/api/media`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        success: boolean;
        data: { data: unknown[]; total: number; page: number; pageSize: number };
      };

      expect(body.success).toBe(true);
      expect(body.data.data).toBeInstanceOf(Array);
      expect(body.data.total).toBe(24);
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(10);
    });
  });

  describe('Auth — Disconnect', () => {
    it('POST /api/auth/instagram/disconnect returns success envelope', async () => {
      const response = await fetch(`${API_BASE}/api/auth/instagram/disconnect`, {
        method: 'POST',
      });
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        success: boolean;
        data: { message: string };
      };

      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Cuenta desconectada exitosamente');
    });
  });
});
