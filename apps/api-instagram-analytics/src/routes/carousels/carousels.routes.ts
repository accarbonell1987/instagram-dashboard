import { Hono } from 'hono';
import type { CarouselService } from '../../services/carousel.service.js';
import {
  CreateCarouselBodySchema,
  CreateUploadCarouselBodySchema,
  PreviewScriptBodySchema,
  UpdateSlideBodySchema,
  ReorderSlidesBodySchema,
  RegenerateCarouselBodySchema,
  PublishCarouselBodySchema,
} from './carousels.schemas.js';
import { AppError, InsufficientScopeError } from '../../errors.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCarouselRoutes(carouselService: CarouselService): Hono<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = new Hono<any>();

  // POST /preview-script — Generate a script preview without persisting (for user review)
  routes.post('/preview-script', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };

    const raw = await c.req.json() as unknown;
    const parsed = PreviewScriptBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.issues } },
        400,
      );
    }

    const slides = await carouselService.previewScript(tenant.tenantId, parsed.data.topic);
    return c.json({ success: true, data: { slides } }, 200);
  });

  // GET / — List carousels with pagination
  routes.get('/', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const page = Math.max(1, Number(c.req.query('page') ?? '1'));
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') ?? '20')));
    const result = await carouselService.listCarousels(tenant.tenantId, page, limit);
    return c.json({ success: true, data: result }, 200);
  });

  // POST / — Create carousel (fire-and-forget generation)
  routes.post('/', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };

    const raw = await c.req.json() as unknown;
    const parsed = CreateCarouselBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.issues } },
        400,
      );
    }

    const result = await carouselService.createCarousel(
      tenant.tenantId,
      parsed.data.topic,
      parsed.data.suggestionId,
      parsed.data.slides,
    );

    return c.json({ success: true, data: result }, 202);
  });

  // GET /:id — Poll carousel status + slides
  routes.get('/:id', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const id = c.req.param('id');

    const carousel = await carouselService.getCarousel(id, tenant.tenantId);
    return c.json({ success: true, data: carousel }, 200);
  });

  // PATCH /:id/slides/:slideId — Edit slide text or visualPrompt
  routes.patch('/:id/slides/:slideId', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const carouselId = c.req.param('id');
    const slideId = c.req.param('slideId');

    const raw = await c.req.json() as unknown;
    const parsed = UpdateSlideBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.issues } },
        400,
      );
    }

    const { text, visualPrompt } = parsed.data;
    const slideData = {
      ...(text !== undefined && { text }),
      ...(visualPrompt !== undefined && { visualPrompt }),
    };

    const slide = await carouselService.updateSlide(
      carouselId,
      slideId,
      tenant.tenantId,
      slideData,
    );

    return c.json({ success: true, data: slide }, 200);
  });

  // POST /:id/slides/:slideId/regenerate — Trigger slide image regeneration
  routes.post('/:id/slides/:slideId/regenerate', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const carouselId = c.req.param('id');
    const slideId = c.req.param('slideId');

    await carouselService.regenerateSlide(carouselId, slideId, tenant.tenantId);
    return c.json({ success: true, data: { queued: true } }, 202);
  });

  // PATCH /:id/reorder — Reorder slides
  routes.patch('/:id/reorder', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const carouselId = c.req.param('id');

    const raw = await c.req.json() as unknown;
    const parsed = ReorderSlidesBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.issues } },
        400,
      );
    }

    const slides = await carouselService.reorderSlides(carouselId, tenant.tenantId, parsed.data.order);
    return c.json({ success: true, data: { slides } }, 200);
  });

  // DELETE /:id — Delete a carousel
  routes.delete('/:id', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const carouselId = c.req.param('id');
    try {
      await carouselService.deleteCarousel(carouselId, tenant.tenantId);
      return c.json({ success: true, data: { deleted: true } }, 200);
    } catch (error) {
      if (error instanceof AppError) {
        return c.json(
          { success: false, error: { code: error.code, message: error.message } },
          error.statusCode as any,
        );
      }
      throw error;
    }
  });

  // POST /:id/regenerate — Reset and re-run full generation pipeline
  routes.post('/:id/regenerate', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const carouselId = c.req.param('id');

    let body: { topic?: string } = {};
    try {
      const raw = await c.req.json() as unknown;
      const parsed = RegenerateCarouselBodySchema.safeParse(raw);
      if (parsed.success) {
        const { topic } = parsed.data;
        if (topic !== undefined) body = { topic };
      }
    } catch {
      // empty body is valid
    }

    try {
      const result = await carouselService.regenerateCarousel(carouselId, tenant.tenantId, body);
      return c.json({ success: true, data: result }, 202);
    } catch (error) {
      if (error instanceof AppError) {
        return c.json(
          { success: false, error: { code: error.code, message: error.message } },
          error.statusCode as any,
        );
      }
      throw error;
    }
  });

  // POST /upload — Create upload carousel (no image files, JSON only — images uploaded per slide)
  routes.post('/upload', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };

    const raw = await c.req.json() as unknown;
    const parsed = CreateUploadCarouselBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.issues } },
        400,
      );
    }

    const result = await carouselService.createUploadCarousel(tenant.tenantId, {
      tenantId: tenant.tenantId,
      topic: parsed.data.topic,
      ...(parsed.data.caption !== undefined && { caption: parsed.data.caption }),
      slides: parsed.data.slides.map((s) => ({
        order: s.order,
        role: s.role,
        text: s.text,
        imageMode: s.imageMode,
        ...(s.visualPrompt !== undefined && { visualPrompt: s.visualPrompt }),
      })),
    });

    return c.json({ success: true, data: result }, 202);
  });

  // PUT /:id/slides/:slideId/image — Upload image for a specific slide (multipart)
  routes.put('/:id/slides/:slideId/image', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const carouselId = c.req.param('id');
    const slideId = c.req.param('slideId');

    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Expected multipart/form-data' } },
        400,
      );
    }

    const imageFile = formData.get('image');
    if (!(imageFile instanceof File)) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: image (File)' } },
        400,
      );
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(imageFile.type)) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Unsupported image type: ${imageFile.type}. Accepted: JPEG, PNG, WEBP` } },
        400,
      );
    }

    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    if (imageFile.size > MAX_BYTES) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Image too large. Maximum size is 10 MB' } },
        400,
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    try {
      await carouselService.uploadSlideImage(carouselId, slideId, tenant.tenantId, imageBuffer);
    } catch (error) {
      if (error instanceof AppError) {
        return c.json(
          { success: false, error: { code: error.code, message: error.message, details: error.details } },
          error.statusCode as any,
        );
      }
      throw error;
    }

    return c.json({ success: true, data: { queued: true } }, 202);
  });

  // POST /:id/publish — Publish carousel to Instagram
  routes.post('/:id/publish', async (c) => {
    const tenant = c.get('tenant' as any) as { tenantId: string; userId: string };
    const carouselId = c.req.param('id');

    let body: { caption?: string } = {};
    try {
      const raw = await c.req.json() as unknown;
      const parsed = PublishCarouselBodySchema.safeParse(raw);
      if (parsed.success) {
        const { caption } = parsed.data;
        if (caption !== undefined) body = { caption };
      }
    } catch {
      // empty body is valid
    }

    try {
      const result = await carouselService.publishCarousel(carouselId, tenant.tenantId, body);
      return c.json({ success: true, data: result }, 200);
    } catch (error) {
      if (error instanceof InsufficientScopeError) {
        return c.json(
          { success: false, error: { code: error.code, message: error.message } },
          403,
        );
      }
      if (error instanceof AppError) {
        return c.json(
          { success: false, error: { code: error.code, message: error.message, details: error.details } },
          error.statusCode as any,
        );
      }
      throw error;
    }
  });

  return routes;
}
