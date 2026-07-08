import type { ICarouselRepository } from '../repositories/carousel.repository.js';
import type { InstagramRepository } from '../repositories/instagram/index.js';
import type { ScriptGeneratorService } from './script-generator.service.js';
import type { ImageProvider } from '../lib/image/image-provider.js';
import type { ImageStorage } from '../lib/image/image-storage.js';
import type { UsageTracker } from './usage-tracker.service.js';
import type {
  Carousel,
  CarouselSlide,
  GeneratedSlide,
  UpdateSlideInput,
  PublishCarouselInput,
  PublishCarouselResult,
  RegenerateCarouselInput,
  CreateUploadCarouselInput,
} from '../domain/carousel.js';
import { decryptToken } from '../lib/crypto.js';
import { NotFoundError, InsufficientScopeError, InstagramAPIError, AppError, QuotaExceededError } from '../errors.js';
import { InstagramClient } from '../lib/instagram-client.js';
import { config } from '../config.js';
import { compositeTextOnImage } from '../lib/image/text-compositor.js';

export class CarouselService {
  constructor(
    private readonly carouselRepo: ICarouselRepository,
    private readonly instagramRepo: InstagramRepository,
    private readonly scriptGenerator: ScriptGeneratorService,
    private readonly imageProvider: ImageProvider,
    private readonly imageStorage: ImageStorage,
    private readonly usageTracker?: UsageTracker,
  ) {}

  async previewScript(tenantId: string, topic: string): Promise<GeneratedSlide[]> {
    const account = await this.instagramRepo.findAccountByTenantId(tenantId);
    const agentConfig = account
      ? await this.instagramRepo.getAgentConfig(tenantId, account.userId)
      : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const basePrompt = (agentConfig as any)?.imageGen?.basePrompt as string | undefined;
    return this.scriptGenerator.generateScript(topic, basePrompt, tenantId);
  }

  async createCarousel(
    tenantId: string,
    topic: string,
    suggestionId?: string,
    approvedSlides?: GeneratedSlide[],
  ): Promise<{ id: string; status: string }> {
    // ── Pre-call quota enforcement ──
    if (this.usageTracker) {
      const tokenCheck = await this.usageTracker.checkQuota(tenantId, 'deepseek_tokens');
      if (!tokenCheck.allowed) {
        throw new QuotaExceededError('deepseek_tokens', tokenCheck.limit!, tokenCheck.resetsAt!);
      }
      const imageCheck = await this.usageTracker.checkQuota(tenantId, 'fal_images');
      if (!imageCheck.allowed) {
        throw new QuotaExceededError('fal_images', imageCheck.limit!, imageCheck.resetsAt!);
      }
    }

    // Resolve accountId from tenant for FK
    const account = await this.instagramRepo.findAccountByTenantId(tenantId);

    const carousel = await this.carouselRepo.create({
      tenantId,
      accountId: account?.id,
      ...(suggestionId !== undefined && { suggestionId }),
      topic,
    });

    // Resolve base image prompt from agent config
    const agentConfig = account
      ? await this.instagramRepo.getAgentConfig(tenantId, account.userId)
      : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const basePrompt = (agentConfig as any)?.imageGen?.basePrompt as string | undefined;

    // Fire-and-forget background generation
    void this._generateAsync(carousel.id, tenantId, topic, basePrompt, approvedSlides);

    return { id: carousel.id, status: carousel.status };
  }

  async listCarousels(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ carousels: Carousel[]; total: number; page: number; limit: number }> {
    const { carousels, total } = await this.carouselRepo.findAll(tenantId, page, limit);
    return { carousels, total, page, limit };
  }

  async getCarousel(id: string, tenantId: string): Promise<Carousel> {
    const carousel = await this.carouselRepo.findById(tenantId, id);
    if (!carousel) throw new NotFoundError('Carousel', id);
    return carousel;
  }

  async deleteCarousel(id: string, tenantId: string): Promise<void> {
    const carousel = await this.carouselRepo.findById(tenantId, id);
    if (!carousel) throw new NotFoundError('Carousel', id);
    await this.carouselRepo.delete(tenantId, id);
  }

  async updateSlide(
    carouselId: string,
    slideId: string,
    tenantId: string,
    data: UpdateSlideInput,
  ): Promise<CarouselSlide> {
    return this.carouselRepo.updateSlide(tenantId, carouselId, slideId, data);
  }

  async regenerateSlide(
    carouselId: string,
    slideId: string,
    tenantId: string,
  ): Promise<void> {
    const carousel = await this.carouselRepo.findById(tenantId, carouselId);
    if (!carousel) throw new NotFoundError('Carousel', carouselId);

    const slide = carousel.slides.find((s) => s.id === slideId);
    if (!slide) throw new NotFoundError('CarouselSlide', slideId);

    // ── Pre-call quota enforcement ──
    if (this.usageTracker) {
      const imageCheck = await this.usageTracker.checkQuota(tenantId, 'fal_images');
      if (!imageCheck.allowed) {
        throw new QuotaExceededError('fal_images', imageCheck.limit!, imageCheck.resetsAt!);
      }
    }

    const falApiKey = await this.resolveFalApiKey(tenantId);

    // Resolve style prefix from agent config (same logic as _generateAsync)
    const account = await this.instagramRepo.findAccountByTenantId(tenantId);
    const agentConfig = account
      ? await this.instagramRepo.getAgentConfig(tenantId, account.userId)
      : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageGenConfig = (agentConfig as any)?.imageGen as Record<string, string> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const basePrompt = (agentConfig as any)?.imageGen?.basePrompt as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t2iModel = (agentConfig as any)?.imageGen?.t2iModel as string | undefined;

    const rolePrompt = imageGenConfig?.[`${slide.role}Prompt`];
    const stylePrefix = rolePrompt ?? basePrompt ?? '';
    const fullPrompt = stylePrefix
      ? `${stylePrefix}. ${slide.visualPrompt}`
      : slide.visualPrompt;

    await this.carouselRepo.updateSlideStatus(slideId, 'generating');

    void (async () => {
      try {
        console.log(`[carousel:${carouselId}] regenerating slide ${slideId} (promptLen=${fullPrompt.length})`);
        const rawBuffer = await this.imageProvider.generateImage(fullPrompt, falApiKey, {
          ...(t2iModel !== undefined && { t2iModel }),
        });
        console.log(`[carousel:${carouselId}] slide ${slideId} image fetched (${rawBuffer.length} bytes), compositing...`);
        const imageBuffer = await compositeTextOnImage(rawBuffer, slide.text);
        const imageUrl = await this.imageStorage.saveImage(carouselId, slideId, imageBuffer);
        await this.carouselRepo.updateSlideStatus(slideId, 'ready', imageUrl);
        console.log(`[carousel:${carouselId}] slide ${slideId} regenerated: ${imageUrl}`);
        
        // ── Post-call logging: log single image regen ──
        if (this.usageTracker) {
          await this.usageTracker.log({
            tenantId,
            operation: 'image_gen',
            imageCount: 1,
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        console.error(`[carousel:${carouselId}] slide ${slideId} regenerate FAILED: ${msg}`);
        if (stack) console.error(stack);
        await this.carouselRepo.updateSlideStatus(slideId, 'failed');
      }
    })();
  }

  async reorderSlides(
    carouselId: string,
    tenantId: string,
    order: Array<{ id: string; order: number }>,
  ): Promise<CarouselSlide[]> {
    const carousel = await this.carouselRepo.findById(tenantId, carouselId);
    if (!carousel) throw new NotFoundError('Carousel', carouselId);
    return this.carouselRepo.reorderSlides(carouselId, order);
  }

  async regenerateCarousel(
    carouselId: string,
    tenantId: string,
    input: RegenerateCarouselInput,
  ): Promise<{ id: string; status: string }> {
    const carousel = await this.carouselRepo.findById(tenantId, carouselId);
    if (!carousel) throw new NotFoundError('Carousel', carouselId);

    if (carousel.publishStatus === 'published') {
      const err = new AppError(409, 'CAROUSEL_ALREADY_PUBLISHED', 'Cannot regenerate a published carousel');
      throw err;
    }

    // ── Pre-call quota enforcement ──
    if (this.usageTracker) {
      const tokenCheck = await this.usageTracker.checkQuota(tenantId, 'deepseek_tokens');
      if (!tokenCheck.allowed) {
        throw new QuotaExceededError('deepseek_tokens', tokenCheck.limit!, tokenCheck.resetsAt!);
      }
    }

    const account = await this.instagramRepo.findAccountByTenantId(tenantId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentConfig = account
      ? await this.instagramRepo.getAgentConfig(tenantId, account.userId)
      : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const basePrompt = (agentConfig as any)?.imageGen?.basePrompt as string | undefined;

    await this.carouselRepo.resetForRegeneration(carouselId, input.topic);

    const topic = input.topic ?? carousel.topic;
    void this._generateAsync(carouselId, tenantId, topic, basePrompt);

    return { id: carouselId, status: 'pending' };
  }

  async publishCarousel(
    carouselId: string,
    tenantId: string,
    input: PublishCarouselInput,
  ): Promise<PublishCarouselResult> {
    const carousel = await this.carouselRepo.findById(tenantId, carouselId);
    if (!carousel) throw new NotFoundError('Carousel', carouselId);

    if (carousel.publishStatus === 'published') {
      throw new AppError(409, 'CAROUSEL_ALREADY_PUBLISHED', 'Carousel has already been published');
    }

    if (carousel.status !== 'ready') {
      throw new AppError(422, 'CAROUSEL_NOT_READY', 'Carousel is not ready for publishing');
    }

    const slidesWithoutImage = carousel.slides.filter((s) => !s.imageUrl);
    if (slidesWithoutImage.length > 0) {
      throw new AppError(
        422,
        'CAROUSEL_SLIDES_INCOMPLETE',
        `${slidesWithoutImage.length} slide(s) are missing generated images`,
        { missingCount: slidesWithoutImage.length },
      );
    }

    // Resolve Instagram account + access token
    const account = await this.instagramRepo.findAccountByTenantId(tenantId);
    if (!account) throw new AppError(404, 'ACCOUNT_NOT_CONNECTED', 'No Instagram account connected');

    const tokenData = await this.instagramRepo.findAccountWithToken(account.id);
    if (!tokenData?.tokenEncrypted) {
      throw new AppError(404, 'ACCOUNT_NOT_CONNECTED', 'Instagram account token not found');
    }
    const accessToken = decryptToken(tokenData.tokenEncrypted);
    const igClient = new InstagramClient(accessToken);

    // Determine caption
    const hookSlide = carousel.slides.find((s) => s.role === 'hook');
    const caption = input.caption ?? carousel.caption ?? hookSlide?.text ?? '';

    // Build absolute image URLs
    const sortedSlides = [...carousel.slides].sort((a, b) => a.order - b.order);
    const absoluteUrls = sortedSlides.map((s) => this.resolvePublicUrl(s.imageUrl!));

    try {
      // Create one image container per slide (sequential — Instagram rejects parallel)
      const containerIds: string[] = [];
      for (const imageUrl of absoluteUrls) {
        const container = await igClient.createImageContainer(account.igUserId, imageUrl);
        containerIds.push(container.id);
      }

      // Create carousel container
      const carouselContainer = await igClient.createCarouselContainer(
        account.igUserId,
        containerIds,
        caption,
      );

      // Wait for Instagram to finish processing the container before publishing.
      // Skipping this step causes error 9007 "Media ID is not available".
      await igClient.waitForContainerReady(carouselContainer.id);

      // Publish
      const published = await igClient.publishMedia(account.igUserId, carouselContainer.id);

      // Fetch permalink
      let permalink = '';
      try {
        const permalinkData = await igClient.getMediaPermalink(published.id);
        permalink = permalinkData.permalink;
      } catch {
        permalink = `https://www.instagram.com/`;
      }

      // Update DB
      await this.carouselRepo.updatePublishStatus(carouselId, {
        publishStatus: 'published',
        publishedAt: new Date(),
        igMediaId: published.id,
        igPermalink: permalink,
        ...(input.caption !== undefined && { caption: input.caption }),
      });

      return { igMediaId: published.id, permalink };
    } catch (error) {
      if (error instanceof InsufficientScopeError) throw error;
      await this.carouselRepo.updatePublishStatus(carouselId, { publishStatus: 'failed' });
      if (error instanceof AppError) throw error;
      throw new InstagramAPIError(
        error instanceof Error ? error.message : 'Unknown error during publishing',
      );
    }
  }

  async createUploadCarousel(
    tenantId: string,
    input: CreateUploadCarouselInput,
  ): Promise<{ id: string; status: string; slides: Array<{ id: string; order: number; status: string }> }> {
    const account = await this.instagramRepo.findAccountByTenantId(tenantId);

    const carousel = await this.carouselRepo.create({
      tenantId,
      accountId: account?.id,
      topic: input.topic,
      ...(input.caption !== undefined && { caption: input.caption }),
      carouselType: 'upload',
    });

    const slides = await this.carouselRepo.createSlides(
      input.slides.map((s) => ({
        carouselId: carousel.id,
        order: s.order,
        role: s.role,
        text: s.text,
        visualPrompt: s.visualPrompt ?? '',
        imageMode: s.imageMode,
      })),
    );

    return {
      id: carousel.id,
      status: carousel.status,
      slides: slides.map((s) => ({ id: s.id, order: s.order, status: s.status })),
    };
  }

  async uploadSlideImage(
    carouselId: string,
    slideId: string,
    tenantId: string,
    imageBuffer: Buffer,
  ): Promise<void> {
    const carousel = await this.carouselRepo.findById(tenantId, carouselId);
    if (!carousel) throw new NotFoundError('Carousel', carouselId);

    const slide = carousel.slides.find((s) => s.id === slideId);
    if (!slide) throw new NotFoundError('CarouselSlide', slideId);

    // Save original uploaded image with '-original' suffix so it doesn't overwrite the final composite
    const uploadedPath = await this.imageStorage.saveImage(carouselId, `${slideId}-original`, imageBuffer);
    await this.carouselRepo.updateSlideStatus(slideId, 'generating', undefined, uploadedPath);

    if (slide.imageMode === 'uploaded') {
      // Composite text overlay and mark ready immediately
      try {
        const composited = await compositeTextOnImage(imageBuffer, slide.text);
        const finalPath = await this.imageStorage.saveImage(carouselId, slideId, composited);
        await this.carouselRepo.updateSlideStatus(slideId, 'ready', finalPath);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[carousel:${carouselId}] slide ${slideId} composite FAILED: ${msg}`);
        await this.carouselRepo.updateSlideStatus(slideId, 'failed');
      }
      await this.finalizeCarouselIfComplete(carouselId, tenantId);
      return;
    }

    if (slide.imageMode === 'img2img') {
      // Check img2img quota before dispatching
      if (this.usageTracker) {
        const imageCheck = await this.usageTracker.checkQuota(tenantId, 'fal_images');
        if (!imageCheck.allowed) {
          throw new QuotaExceededError('fal_images', imageCheck.limit!, imageCheck.resetsAt!);
        }
      }

      void (async () => {
        try {
          const falApiKey = await this.resolveFalApiKey(tenantId);
          const i2iAccount = await this.instagramRepo.findAccountByTenantId(tenantId);
          const i2iConfig = i2iAccount
            ? await this.instagramRepo.getAgentConfig(tenantId, i2iAccount.userId)
            : null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const i2iModel = (i2iConfig as any)?.imageGen?.i2iModel as string | undefined;
          const visualPrompt = slide.visualPrompt || slide.text;
          console.log(`[carousel:${carouselId}] img2img slide ${slideId} (promptLen=${visualPrompt.length})`);
          const rawBuffer = await this.imageProvider.generateImage(visualPrompt, falApiKey, {
            baseImageBuffer: imageBuffer,
            ...(i2iModel !== undefined && { i2iModel }),
          });
          const composited = await compositeTextOnImage(rawBuffer, slide.text);
          const finalPath = await this.imageStorage.saveImage(carouselId, slideId, composited);
          await this.carouselRepo.updateSlideStatus(slideId, 'ready', finalPath);
          if (this.usageTracker) {
            await this.usageTracker.log({ tenantId, operation: 'image_gen', imageCount: 1 });
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[carousel:${carouselId}] img2img slide ${slideId} FAILED: ${msg}`);
          await this.carouselRepo.updateSlideStatus(slideId, 'failed');
        }
        await this.finalizeCarouselIfComplete(carouselId, tenantId);
      })();
      return;
    }

    // Unexpected mode — fail the slide
    await this.carouselRepo.updateSlideStatus(slideId, 'failed');
    await this.finalizeCarouselIfComplete(carouselId, tenantId);
  }

  private async finalizeCarouselIfComplete(carouselId: string, tenantId: string): Promise<void> {
    const pending = await this.carouselRepo.countPendingSlides(carouselId);
    if (pending > 0) return;

    // Re-fetch to count failures
    const carousel = await this.carouselRepo.findById(tenantId, carouselId);
    if (!carousel) return;

    const hasReady = carousel.slides.some((s) => s.status === 'ready');
    await this.carouselRepo.updateStatus(
      carouselId,
      hasReady ? 'ready' : 'failed',
      hasReady ? undefined : 'All slides failed to process',
    );
  }

  private resolvePublicUrl(url: string): string {
    const base = config.PUBLIC_BASE_URL.replace(/\/$/, '');
    if (url.startsWith('/')) return `${base}${url}`;
    // Strip any stored origin (localhost or stale ngrok) and rebase to current PUBLIC_BASE_URL
    try {
      return `${base}${new URL(url).pathname}`;
    } catch {
      return `${base}/${url}`;
    }
  }

  // ── Background Generation ────────────────────────────────────────

  async _generateAsync(
    carouselId: string,
    tenantId: string,
    topic: string,
    basePrompt?: string,
    approvedSlides?: GeneratedSlide[],
  ): Promise<void> {
    try {
      let slides: CarouselSlide[];

      if (approvedSlides && approvedSlides.length > 0) {
        // User already reviewed the script — skip straight to image generation
        await this.carouselRepo.updateStatus(carouselId, 'generating_images');
        slides = await this.carouselRepo.createSlides(
          approvedSlides.map((s) => ({
            carouselId,
            order: s.order,
            role: s.role,
            text: s.text,
            visualPrompt: s.visualPrompt,
          })),
        );
      } else {
        await this.carouselRepo.updateStatus(carouselId, 'generating_script');
        const generatedSlides = await this.scriptGenerator.generateScript(topic, basePrompt);
        slides = await this.carouselRepo.createSlides(
          generatedSlides.map((s) => ({
            carouselId,
            order: s.order,
            role: s.role,
            text: s.text,
            visualPrompt: s.visualPrompt,
          })),
        );
        await this.carouselRepo.updateStatus(carouselId, 'generating_images');
      }

      let falApiKey: string;
      try {
        falApiKey = await this.resolveFalApiKey(tenantId);
      } catch {
        await this.carouselRepo.updateStatus(carouselId, 'failed', 'FAL API key not configured');
        return;
      }

      // Resolve role-specific prompts from agent config
      const account = await this.instagramRepo.findAccountByTenantId(tenantId);
      const agentConfig = account
        ? await this.instagramRepo.getAgentConfig(tenantId, account.userId)
        : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageGenConfig = (agentConfig as any)?.imageGen as Record<string, string> | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t2iModel = (agentConfig as any)?.imageGen?.t2iModel as string | undefined;

      let successCount = 0;
      let firstSlideError: string | undefined;
      for (const slide of slides) {
        try {
          await this.carouselRepo.updateSlideStatus(slide.id, 'generating');

          const rolePrompt = imageGenConfig?.[`${slide.role}Prompt`];
          const stylePrefix = rolePrompt ?? basePrompt ?? '';
          const fullPrompt = stylePrefix
            ? `${stylePrefix}. ${slide.visualPrompt}`
            : slide.visualPrompt;

          console.log(`[carousel:${carouselId}] generating slide ${slide.id} (role=${slide.role}, promptLen=${fullPrompt.length})`);

          const rawBuffer = await this.imageProvider.generateImage(fullPrompt, falApiKey, {
            ...(t2iModel !== undefined && { t2iModel }),
          });
          console.log(`[carousel:${carouselId}] slide ${slide.id} image fetched (${rawBuffer.length} bytes), compositing text...`);

          const imageBuffer = await compositeTextOnImage(rawBuffer, slide.text);
          console.log(`[carousel:${carouselId}] slide ${slide.id} composite done (${imageBuffer.length} bytes), saving...`);

          const imageUrl = await this.imageStorage.saveImage(carouselId, slide.id, imageBuffer);
          await this.carouselRepo.updateSlideStatus(slide.id, 'ready', imageUrl);
          console.log(`[carousel:${carouselId}] slide ${slide.id} ready: ${imageUrl}`);
          successCount++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          console.error(`[carousel:${carouselId}] slide ${slide.id} FAILED: ${msg}`);
          if (stack) console.error(stack);
          firstSlideError ??= msg;
          await this.carouselRepo.updateSlideStatus(slide.id, 'failed');
        }
      }

      if (successCount === 0) {
        await this.carouselRepo.updateStatus(carouselId, 'failed', firstSlideError ?? 'All image generations failed');
      } else {
        // ── Post-call logging: only after success ──
        if (this.usageTracker) {
          await this.usageTracker.log({
            tenantId,
            operation: 'image_gen',
            imageCount: successCount,
          });
        }
        await this.carouselRepo.updateStatus(carouselId, 'ready');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.carouselRepo.updateStatus(carouselId, 'failed', message);
    }
  }

  private async resolveFalApiKey(tenantId: string): Promise<string> {
    const encrypted = await this.instagramRepo.getFalApiKeyEncrypted(tenantId);
    if (!encrypted) {
      throw new Error('FAL API key not configured for this account');
    }
    return decryptToken(encrypted);
  }
}
