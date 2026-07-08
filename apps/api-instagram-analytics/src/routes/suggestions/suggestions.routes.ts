import { Hono } from 'hono';
import type { SuggestionService } from '../../services/suggestion.service.js';
import { SuggestionsQuerySchema, MarkUsedRequestSchema, GenerateIdeaBodySchema } from './suggestions.schemas.js';
import type { SuggestionStatus } from '../../repositories/suggestion.repository.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSuggestionsRoutes(suggestionService: SuggestionService): Hono<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = new Hono<any>();

  // POST /generate — Generate a content_idea suggestion via AI
  routes.post('/generate', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string };
    const parsed = GenerateIdeaBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.issues } }, 400);
    }

    const suggestion = await suggestionService.generateContentIdea(tenant.tenantId, parsed.data.prompt);

    return c.json({
      success: true,
      data: {
        id: suggestion.id,
        category: suggestion.category,
        content: suggestion.content,
        status: suggestion.status,
        batchId: suggestion.batchId ?? null,
        outcome: suggestion.outcome ?? null,
        createdAt: suggestion.createdAt instanceof Date ? suggestion.createdAt.toISOString() : suggestion.createdAt,
      },
    }, 201);
  });

  // GET / — List suggestions (optionally filtered by status)
  routes.get('/', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string };
    const { tenantId } = tenant;

    const query = SuggestionsQuerySchema.safeParse({
      status: c.req.query('status'),
    });

    const status = query.success ? query.data.status : undefined;
    const suggestions = await suggestionService.getSuggestions(tenantId, status as SuggestionStatus | undefined);

    return c.json(
      {
        success: true,
        data: suggestions.map((s) => ({
          ...s,
          createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
          updatedAt: undefined,
          linkedAt: undefined,
          measuredAt: undefined,
          baselineJson: undefined,
          metricsJson: undefined,
        })),
      },
      200,
    );
  });

  // POST /:id/mark-used — Mark a suggestion as used
  routes.post('/:id/mark-used', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string };
    const { tenantId } = tenant;
    const { id } = c.req.param();

    let body: { linkedMediaId?: string | undefined };
    try {
      const raw = await c.req.json() as unknown;
      const parsed = MarkUsedRequestSchema.safeParse(raw);
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

    await suggestionService.markUsed(tenantId, id, body.linkedMediaId);

    return c.json({ success: true, data: { id } }, 200);
  });

  // POST /:id/dismiss — Dismiss a suggestion
  routes.post('/:id/dismiss', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string };
    const { tenantId } = tenant;
    const { id } = c.req.param();

    await suggestionService.dismiss(tenantId, id);

    return c.json({ success: true, data: { id } }, 200);
  });

  // GET /batches — List suggestion batches with their suggestions (paginated)
  routes.get('/batches', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string };
    const page = parseInt(c.req.query('page') ?? '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') ?? '10', 10), 50);

    const result = await suggestionService.listBatches(tenant.tenantId, page, limit);

    return c.json({
      success: true,
      data: {
        batches: result.batches.map((b) => ({
          id: b.id,
          userMessage: b.userMessage,
          createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
          suggestions: b.suggestions.map((s) => ({
            id: s.id,
            category: s.category,
            content: s.content,
            status: s.status,
            createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
          })),
        })),
        total: result.total,
        page,
        limit,
      },
    }, 200);
  });

  return routes;
}
