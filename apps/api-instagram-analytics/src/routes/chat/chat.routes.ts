import { Hono } from 'hono';
import type { GrowthAgentService } from '../../services/growth-agent.service.js';
import type { IChatMessageRepository } from '../../lib/create-repositories.js';
import { ChatRequestSchema, DeleteMessageParamsSchema, DeleteHistoryQuerySchema } from './chat.schemas.js';
import { InternalError, RateLimitError } from '../../errors.js';

// In-memory per-tenant chat rate limiter (10 req/min)
const chatCounters = new Map<string, { count: number; windowStart: number }>();
const CHAT_MAX_CALLS = 10;
const CHAT_WINDOW_MS = 60 * 1000; // 1 minute

function checkChatRateLimit(tenantId: string): { allowed: boolean } {
  const now = Date.now();
  let counter = chatCounters.get(tenantId);

  if (!counter || now - counter.windowStart > CHAT_WINDOW_MS) {
    counter = { count: 0, windowStart: now };
    chatCounters.set(tenantId, counter);
  }

  if (counter.count >= CHAT_MAX_CALLS) {
    return { allowed: false };
  }

  counter.count++;
  return { allowed: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createChatRoutes(
  growthAgentService: GrowthAgentService,
  chatMessageRepo: IChatMessageRepository,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Hono<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = new Hono<any>();

  // POST / — Send a chat message
  routes.post('/', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const { tenantId, userId } = tenant;

    // Rate limit check
    const { allowed } = checkChatRateLimit(tenantId);
    if (!allowed) {
      throw new RateLimitError(60);
    }

    // Parse and validate body
    let body: { sessionId?: string | undefined; message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> | undefined };
    try {
      const raw = await c.req.json() as unknown;
      const parsed = ChatRequestSchema.safeParse(raw);
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

    const sessionId = body.sessionId ?? crypto.randomUUID();
    const history = body.history ?? [];

    try {
      const result = await growthAgentService.chat({
        tenantId,
        userId,
        sessionId,
        userMessage: body.message,
        history,
      });

      return c.json(
        {
          success: true,
          data: {
            reply: result.reply,
            sessionId,
            suggestions: result.suggestions.map((s) => ({
              ...s,
              createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
              updatedAt: undefined,
            })),
            toolCallsTrace: result.toolCallsTrace,
          },
        },
        200,
      );
    } catch (err) {
      // Handle AGENT_TIMEOUT → 504
      if (err instanceof InternalError && err.message === 'AGENT_TIMEOUT') {
        return c.json(
          { success: false, error: { code: 'AGENT_TIMEOUT', message: 'Agent timed out' } },
          504,
        );
      }
      throw err;
    }
  });

  // GET /history — Get chat history for a session
  routes.get('/history', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string };
    const { tenantId } = tenant;

    const sessionId = c.req.query('sessionId');
    if (!sessionId) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId query parameter is required' } },
        400,
      );
    }

    const messages = await chatMessageRepo.findBySession(tenantId, sessionId);
    return c.json(
      {
        success: true,
        data: messages.map((m) => ({
          ...m,
          createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
        })),
      },
      200,
    );
  });

  // DELETE /messages/:id — Delete a single message
  routes.delete('/messages/:id', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string };
    const { tenantId } = tenant;

    const parseResult = DeleteMessageParamsSchema.safeParse({ id: c.req.param('id') });
    if (!parseResult.success) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid message ID', details: parseResult.error.issues } },
        400,
      );
    }

    await chatMessageRepo.deleteById(tenantId, parseResult.data.id);

    return c.json(
      { success: true, data: { deleted: true } },
      200,
    );
  });

  // DELETE /history — Delete all messages in a session
  routes.delete('/history', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string };
    const { tenantId } = tenant;

    const parseResult = DeleteHistoryQuerySchema.safeParse({ sessionId: c.req.query('sessionId') });
    if (!parseResult.success) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId query parameter is required', details: parseResult.error.issues } },
        400,
      );
    }

    const deletedCount = await chatMessageRepo.deleteBySessionId(tenantId, parseResult.data.sessionId);

    return c.json(
      { success: true, data: { deletedCount } },
      200,
    );
  });

  return routes;
}
