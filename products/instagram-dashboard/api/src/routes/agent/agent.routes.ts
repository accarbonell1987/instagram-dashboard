import { Hono } from 'hono';

import type { AgentConfig } from '../../domain/account.js';
import {
  findChangedSections,
  resolveEditableSections,
} from '../../domain/agent-settings-sections.js';
import { ForbiddenError, NotFoundError } from '../../errors.js';
import { encryptToken } from '../../lib/crypto.js';
import type { InstagramRepository } from '../../repositories/instagram/index.js';
import type { UsageTracker } from '../../services/usage-tracker.service.js';

import { SaveAgentSettingsBodySchema } from './agent.schemas.js';

/** Reads the caller's entitled module ids — the same lookup `/me/modules` uses. */
export interface ModuleAccessLookup {
  getAccessibleModuleIds(tenantId: string, userId: string): Promise<string[]>;
}

export function createAgentRoutes(
  repos: InstagramRepository,
  usageTracker: UsageTracker,
  usageTrackingEnabled: boolean,
  moduleAccess: ModuleAccessLookup,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Hono<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = new Hono<any>();

  // GET /settings — Get agent config + hasFalApiKey flag
  routes.get('/settings', async (c) => {
    const tenant = c.get('tenant');
    const { tenantId, userId } = tenant;
    const owner = { tenantId, userId };

    const [agentConfig, hasFalApiKey, hasLlmApiKey, moduleIds] = await Promise.all([
      repos.getAgentConfig(owner),
      repos.hasFalApiKey(owner),
      repos.hasLlmApiKey(owner),
      moduleAccess.getAccessibleModuleIds(tenantId, userId),
    ]);

    // The screen is told what it may edit rather than working it out itself.
    // It has no access to the tenant role — decoding the JWT client-side to
    // find one would be reading mutable data from a claim — and a second copy
    // of these rules would be a second place for them to go wrong. The same
    // table answers here and refuses in PUT.
    const editableSections = resolveEditableSections(moduleIds, tenant.role);

    // The keys themselves never come back — only whether one is set, which is
    // all the screen needs to say "configurada" instead of showing a secret.
    return c.json(
      { success: true, data: { agentConfig, hasFalApiKey, hasLlmApiKey, editableSections } },
      200,
    );
  });

  // PUT /settings — Save agent config + optional FAL API key (write-only)
  routes.put('/settings', async (c) => {
    const tenant = c.get('tenant');
    const { tenantId, userId } = tenant;
    const owner = { tenantId, userId };

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

    // Authorisation runs on the change, not on the screen. Hiding a tab stops
    // nobody: this endpoint took the whole payload with no per-field check, so
    // any member holding `ig-ai-agent` could set the model, the fal.ai key and
    // the character limits — the tenant's credentials and its token spend.
    const [storedConfig, moduleIds] = await Promise.all([
      repos.getAgentConfig(owner),
      moduleAccess.getAccessibleModuleIds(tenantId, userId),
    ]);
    const editable = new Set<string>(resolveEditableSections(moduleIds, tenant.role));
    const refused = findChangedSections(body, storedConfig).filter(
      (section) => !editable.has(section),
    );
    if (refused.length > 0) {
      throw new ForbiddenError(
        `No tenés permiso para cambiar: ${refused.join(', ')}`,
      );
    }

    try {
      const savePromises: Promise<void>[] = [
        repos.saveAgentConfig(owner, {
          niche: body.niche,
          tags: body.tags,
          ...(body.customPrompt !== undefined ? { customPrompt: body.customPrompt } : {}),
          // Store imageGen and limits inside agentConfig JSON
          ...(body.imageGen !== undefined ? { imageGen: body.imageGen } : {}),
          ...(body.limits !== undefined ? { limits: body.limits } : {}),
          ...(body.llm !== undefined ? { llm: body.llm } : {}),
        } as AgentConfig),
      ];

      // Encrypt and persist FAL API key if provided (write-only — never returned)
      if (body.falApiKey !== undefined) {
        const encrypted = encryptToken(body.falApiKey);
        savePromises.push(repos.saveFalApiKey(owner, encrypted));
      }

      if (body.llmApiKey !== undefined) {
        savePromises.push(repos.saveLlmApiKey(owner, encryptToken(body.llmApiKey)));
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
    const tenant = c.get('tenant');
    const { tenantId } = tenant;

    // Period boundaries: first day of current month → first day of next month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    // Daily quotas reset tonight, not at the end of the month. Reporting the
    // month boundary would tell someone blocked at 30 messages to come back in
    // three weeks.
    const dayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    ).toISOString();

    // Feature flag off: return unlimited placeholder
    if (!usageTrackingEnabled) {
      return c.json(
        {
          success: true,
          data: {
            quotas: {
              llm_tokens: { used: 0, limit: -1, period: 'month', resetsAt: periodEnd },
              fal_images: { used: 0, limit: -1, period: 'month', resetsAt: periodEnd },
              chat_sessions: { used: 0, limit: -1, period: 'day', resetsAt: dayEnd },
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
            llm_tokens: {
              used: usage.tokens.used,
              limit: usage.tokens.limit,
              period: usage.tokens.period,
              resetsAt: periodEnd,
            },
            fal_images: {
              used: usage.images.used,
              limit: usage.images.limit,
              period: usage.images.period,
              resetsAt: periodEnd,
            },
            chat_sessions: {
              used: usage.sessions.used,
              limit: usage.sessions.limit,
              period: usage.sessions.period,
              resetsAt: usage.sessions.period === 'day' ? dayEnd : periodEnd,
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
