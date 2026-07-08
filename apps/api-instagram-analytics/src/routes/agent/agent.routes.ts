import { Hono } from 'hono';
import type { InstagramRepository } from '../../repositories/instagram/index.js';
import type { UsageTracker } from '../../services/usage-tracker.service.js';
import { SaveAgentSettingsBodySchema } from './agent.schemas.js';
import { NotFoundError } from '../../errors.js';
import { encryptToken } from '../../lib/crypto.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAgentRoutes(
  repos: InstagramRepository,
  usageTracker: UsageTracker,
  usageTrackingEnabled: boolean,
): Hono<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = new Hono<any>();

  // GET /settings — Get agent config + hasFalApiKey flag
  routes.get('/settings', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const { tenantId, userId } = tenant;

    const [agentConfig, hasFalApiKey] = await Promise.all([
      repos.getAgentConfig(tenantId, userId),
      repos.hasFalApiKey(tenantId),
    ]);

    return c.json(
      { success: true, data: { agentConfig, hasFalApiKey } },
      200,
    );
  });

  // PUT /settings — Save agent config + optional FAL API key (write-only)
  routes.put('/settings', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const { tenantId, userId } = tenant;

    let body: ReturnType<typeof SaveAgentSettingsBodySchema.parse>;
    try {
      const raw = await c.req.json() as unknown;
      const parsed = SaveAgentSettingsBodySchema.safeParse(raw);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: parsed.error.issues,
            },
          },
          400,
        );
      }
      body = parsed.data;
    } catch {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
        400,
      );
    }

    try {
      const savePromises: Promise<void>[] = [
        repos.saveAgentConfig(tenantId, userId, {
          niche: body.niche,
          tags: body.tags,
          ...(body.customPrompt !== undefined ? { customPrompt: body.customPrompt } : {}),
          // Store imageGen and limits inside agentConfig JSON
          ...(body.imageGen !== undefined ? { imageGen: body.imageGen } : {}),
          ...(body.limits !== undefined ? { limits: body.limits } : {}),
        } as any),
      ];

      // Encrypt and persist FAL API key if provided (write-only — never returned)
      if (body.falApiKey !== undefined) {
        const encrypted = encryptToken(body.falApiKey);
        savePromises.push(repos.saveFalApiKey(tenantId, encrypted));
      }

      await Promise.all(savePromises);

      return c.json(
        { success: true, data: { saved: true } },
        200,
      );
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: err.message } },
          404,
        );
      }
      throw err;
    }
  });

  // GET /usage — Get AI usage quotas for the authenticated tenant
  routes.get('/usage', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const { tenantId } = tenant;

    // Period boundaries: first day of current month → first day of next month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    // Feature flag off: return unlimited placeholder
    if (!usageTrackingEnabled) {
      return c.json(
        {
          success: true,
          data: {
            quotas: {
              deepseek_tokens: { used: 0, limit: -1, period: 'month', resetsAt: periodEnd },
              fal_images: { used: 0, limit: -1, period: 'month', resetsAt: periodEnd },
            },
            periodStart,
            periodEnd,
          },
        },
        200,
      );
    }

    const usage = await usageTracker.getUsage(tenantId);

    return c.json(
      {
        success: true,
        data: {
          quotas: {
            deepseek_tokens: {
              used: usage.tokens.used,
              limit: usage.tokens.limit,
              period: 'month',
              resetsAt: periodEnd,
            },
            fal_images: {
              used: usage.images.used,
              limit: usage.images.limit,
              period: 'month',
              resetsAt: periodEnd,
            },
          },
          periodStart,
          periodEnd,
        },
      },
      200,
    );
  });

  return routes;
}
