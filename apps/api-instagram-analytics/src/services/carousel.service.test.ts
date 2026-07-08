/**
 * Unit tests for CarouselService — UsageTracker enforcement wiring
 * TDD: RED phase — tests written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CarouselService } from './carousel.service.js';
import type { UsageTracker } from './usage-tracker.service.js';
import { QuotaExceededError } from '../errors.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

function createMockUsageTracker(overrides: Partial<UsageTracker> = {}): UsageTracker {
  return {
    checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
    log: vi.fn().mockResolvedValue(undefined),
    getUsage: vi.fn(),
    purgeCache: vi.fn(),
    ...overrides,
  } as unknown as UsageTracker;
}

const mockCarouselRepo = {
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  delete: vi.fn(),
  updateSlide: vi.fn(),
  updateSlideStatus: vi.fn(),
  updateStatus: vi.fn(),
  reorderSlides: vi.fn(),
  resetForRegeneration: vi.fn(),
  updatePublishStatus: vi.fn(),
  createSlides: vi.fn(),
  deleteSlides: vi.fn(),
  countPendingSlides: vi.fn().mockResolvedValue(0),
};

const mockInstagramRepo = {
  findAccountByTenantId: vi.fn().mockResolvedValue({ id: 'acc-1', userId: 'user-1' }),
  getAgentConfig: vi.fn().mockResolvedValue(null),
  getFalApiKeyEncrypted: vi.fn(),
};

const mockScriptGenerator = {
  generateScript: vi.fn(),
};

const mockImageProvider = {
  generateImage: vi.fn(),
};

const mockImageStorage = {
  saveImage: vi.fn(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCarousel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'car-1',
    tenantId: 'tenant-1',
    accountId: 'acc-1',
    topic: 'Test topic',
    status: 'pending',
    caption: null,
    publishStatus: 'draft',
    publishedAt: null,
    igMediaId: null,
    igPermalink: null,
    suggestionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    slides: [],
    ...overrides,
  };
}

function makeSlide(overrides: Record<string, unknown> = {}) {
  return {
    id: 'slide-1',
    carouselId: 'car-1',
    order: 1,
    role: 'hook' as const,
    text: 'Slide text',
    visualPrompt: 'Visual prompt',
    imageUrl: null,
    status: 'pending',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeGeneratedSlides() {
  return [
    { order: 1, role: 'hook' as const, text: 'Hook text', visualPrompt: 'Hook visual' },
    { order: 2, role: 'cta' as const, text: 'CTA text', visualPrompt: 'CTA visual' },
  ];
}

// Mock the config module
vi.mock('../config.js', () => ({
  config: {
    PUBLIC_BASE_URL: 'http://localhost:3003',
    NODE_ENV: 'test',
    ENCRYPTION_KEY: 'a'.repeat(64), // 64-char hex string for AES-256-GCM
  },
}));

// Mock crypto to avoid real AES operations in tests
vi.mock('../lib/crypto.js', () => ({
  decryptToken: vi.fn().mockReturnValue('fake-access-token'),
  encryptToken: vi.fn().mockReturnValue('fake-encrypted'),
}));

// Mock text compositor to avoid image processing in tests
vi.mock('../lib/image/text-compositor.js', () => ({
  compositeTextOnImage: vi.fn().mockImplementation(
    (buffer: Buffer) => Promise.resolve(buffer),
  ),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CarouselService (UsageTracker enforcement)', () => {
  let service: CarouselService;
  let mockTracker: UsageTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTracker = createMockUsageTracker();
    // Reset key mocks
    mockCarouselRepo.create.mockResolvedValue(makeCarousel());
    mockCarouselRepo.createSlides.mockResolvedValue([
      makeSlide(),
      makeSlide({ id: 'slide-2', order: 2, role: 'cta' }),
    ]);
    mockInstagramRepo.findAccountByTenantId.mockResolvedValue({ id: 'acc-1', userId: 'user-1' });
    mockInstagramRepo.getAgentConfig.mockResolvedValue(null);
    mockInstagramRepo.getFalApiKeyEncrypted.mockResolvedValue('encrypted-key');
    mockScriptGenerator.generateScript.mockResolvedValue(makeGeneratedSlides());

    service = new CarouselService(
      mockCarouselRepo as any,
      mockInstagramRepo as any,
      mockScriptGenerator as any,
      mockImageProvider as any,
      mockImageStorage as any,
      mockTracker,
    );
  });

  describe('createCarousel()', () => {
    it('calls checkQuota before fire-and-forget', async () => {
      await service.createCarousel('tenant-1', 'Test topic');

      expect(mockTracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'deepseek_tokens');
      expect(mockTracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'fal_images');
      
      // Verify checkQuota was called before carousel.create
      const checkCalls = (mockTracker.checkQuota as ReturnType<typeof vi.fn>).mock.invocationCallOrder;
      const createCall = mockCarouselRepo.create.mock.invocationCallOrder[0];
      expect(checkCalls[0]).toBeLessThan(createCall!);
    });

    it('throws QuotaExceededError when token quota exceeded', async () => {
      (mockTracker.checkQuota as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ allowed: false, limit: 100000, resetsAt: '2026-07-01T00:00:00.000Z' });

      await expect(
        service.createCarousel('tenant-1', 'Test topic'),
      ).rejects.toThrow(QuotaExceededError);

      // Carousel should NOT be created when quota exceeded
      expect(mockCarouselRepo.create).not.toHaveBeenCalled();
    });

    it('throws QuotaExceededError when image quota exceeded', async () => {
      (mockTracker.checkQuota as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ allowed: true }) // tokens OK
        .mockResolvedValueOnce({ allowed: false, limit: 50, resetsAt: '2026-07-01T00:00:00.000Z' });

      await expect(
        service.createCarousel('tenant-1', 'Test topic'),
      ).rejects.toThrow(QuotaExceededError);

      expect(mockCarouselRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('_generateAsync() — post-call logging', () => {
    it('logs image_gen with success count after images succeed', async () => {
      mockImageProvider.generateImage.mockResolvedValue(Buffer.from('fake-image-data'));
      mockImageStorage.saveImage.mockResolvedValue('http://localhost:3003/carousels/car-1/slide-1.png');

      await service._generateAsync('car-1', 'tenant-1', 'Test topic');

      // Should log image_gen with success count (2 slides generated)
      expect(mockTracker.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          operation: 'image_gen',
          imageCount: 2,
        }),
      );
    });

    it('does NOT log image_gen when all image generations fail', async () => {
      mockImageProvider.generateImage.mockRejectedValue(new Error('Generation failed'));
      const approvedSlides = makeGeneratedSlides();
      mockCarouselRepo.createSlides.mockResolvedValue([
        makeSlide(),
        makeSlide({ id: 'slide-2', order: 2, role: 'cta' }),
      ]);

      await service._generateAsync('car-1', 'tenant-1', 'Test topic', undefined, approvedSlides);

      // log should NOT be called if successCount is 0
      const imageLogCalls = (mockTracker.log as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: any[]) => call[0]?.operation === 'image_gen',
      );
      expect(imageLogCalls).toHaveLength(0);
    });
  });

  describe('regenerateCarousel()', () => {
    it('calls checkQuota for deepseek_tokens before regeneration', async () => {
      mockCarouselRepo.findById.mockResolvedValue(
        makeCarousel({ publishStatus: 'draft', status: 'ready' }),
      );
      mockCarouselRepo.resetForRegeneration.mockResolvedValue(undefined);

      await service.regenerateCarousel('car-1', 'tenant-1', { topic: 'New topic' });

      expect(mockTracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'deepseek_tokens');
    });

    it('throws QuotaExceededError when token quota exceeded', async () => {
      mockCarouselRepo.findById.mockResolvedValue(
        makeCarousel({ publishStatus: 'draft', status: 'ready' }),
      );
      (mockTracker.checkQuota as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        limit: 100000,
        resetsAt: '2026-07-01T00:00:00.000Z',
      });

      await expect(
        service.regenerateCarousel('car-1', 'tenant-1', { topic: 'New topic' }),
      ).rejects.toThrow(QuotaExceededError);
    });
  });

  describe('regenerateSlide()', () => {
    it('calls checkQuota for fal_images before single slide regeneration', async () => {
      mockCarouselRepo.findById.mockResolvedValue(
        makeCarousel({ slides: [makeSlide()] }),
      );
      mockInstagramRepo.getFalApiKeyEncrypted.mockResolvedValue('encrypted-key');

      // regenerateSlide fires-and-forgets, but checkQuota runs synchronously before
      await service.regenerateSlide('car-1', 'slide-1', 'tenant-1');

      expect(mockTracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'fal_images');
    });

    it('throws QuotaExceededError when image quota exceeded', async () => {
      mockCarouselRepo.findById.mockResolvedValue(
        makeCarousel({ slides: [makeSlide()] }),
      );
      (mockTracker.checkQuota as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        limit: 50,
        resetsAt: '2026-07-01T00:00:00.000Z',
      });

      await expect(
        service.regenerateSlide('car-1', 'slide-1', 'tenant-1'),
      ).rejects.toThrow(QuotaExceededError);
    });
  });

  describe('previewScript()', () => {
    it('passes tenantId to scriptGenerator.generateScript for quota enforcement', async () => {
      mockScriptGenerator.generateScript.mockResolvedValue(makeGeneratedSlides());

      await service.previewScript('tenant-1', 'Test topic');

      // CRITICAL: generateScript must receive tenantId so UsageTracker.checkQuota is called
      // for the preview-script flow. Without this, previewScript bypasses quota enforcement.
      expect(mockScriptGenerator.generateScript).toHaveBeenCalledWith(
        'Test topic',
        undefined,   // basePrompt — no agent config
        'tenant-1',  // tenantId — required for quota enforcement
      );
    });

    it('propagates errors from generateScript when tenant has no account', async () => {
      mockInstagramRepo.findAccountByTenantId.mockResolvedValue(null);
      mockScriptGenerator.generateScript.mockResolvedValue(makeGeneratedSlides());

      const result = await service.previewScript('tenant-1', 'Test topic');

      // Should still work even without an account (basePrompt will be undefined)
      expect(result).toEqual(makeGeneratedSlides());
      expect(mockScriptGenerator.generateScript).toHaveBeenCalledWith(
        'Test topic',
        undefined,
        'tenant-1',
      );
    });
  });

  describe('constructor', () => {
    it('accepts UsageTracker as 6th constructor param', () => {
      const svc = new CarouselService(
        mockCarouselRepo as any,
        mockInstagramRepo as any,
        mockScriptGenerator as any,
        mockImageProvider as any,
        mockImageStorage as any,
        mockTracker,
      );
      expect(svc).toBeInstanceOf(CarouselService);
    });
  });
});

describe('CarouselService — upload carousel flow', () => {
  let service: CarouselService;

  const uploadSlide = (overrides: Record<string, unknown> = {}) => ({
    id: 'slide-1',
    carouselId: 'car-1',
    order: 1,
    role: 'hook' as const,
    text: 'Slide text',
    visualPrompt: '',
    imageUrl: null,
    uploadedImageUrl: null,
    imageMode: 'uploaded' as const,
    status: 'pending' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const uploadCarousel = (overrides: Record<string, unknown> = {}) => ({
    id: 'car-1',
    tenantId: 'tenant-1',
    accountId: 'acc-1',
    topic: 'Test',
    status: 'pending' as const,
    carouselType: 'upload' as const,
    caption: null,
    publishStatus: 'unpublished' as const,
    publishedAt: null,
    igMediaId: null,
    igPermalink: null,
    suggestionId: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    slides: [uploadSlide()],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCarouselRepo.create.mockResolvedValue(uploadCarousel());
    mockCarouselRepo.createSlides.mockResolvedValue([uploadSlide()]);
    mockCarouselRepo.findById.mockResolvedValue(uploadCarousel());
    mockCarouselRepo.updateSlideStatus.mockResolvedValue(undefined);
    mockCarouselRepo.updateStatus.mockResolvedValue(undefined);
    mockCarouselRepo.countPendingSlides.mockResolvedValue(0);
    mockInstagramRepo.findAccountByTenantId.mockResolvedValue({ id: 'acc-1', userId: 'user-1' });
    mockInstagramRepo.getFalApiKeyEncrypted.mockResolvedValue('encrypted-key');
    mockImageStorage.saveImage.mockResolvedValue('/carousels/car-1/slide-1.jpg');

    service = new CarouselService(
      mockCarouselRepo as any,
      mockInstagramRepo as any,
      mockScriptGenerator as any,
      mockImageProvider as any,
      mockImageStorage as any,
    );
  });

  describe('createUploadCarousel()', () => {
    it('creates carousel with carouselType=upload and returns slide IDs', async () => {
      const result = await service.createUploadCarousel('tenant-1', {
        tenantId: 'tenant-1',
        topic: 'Mi producto estrella',
        slides: [
          { order: 1, role: 'hook', text: 'Texto hook', imageMode: 'uploaded' },
          { order: 2, role: 'cta', text: 'Texto cta', imageMode: 'img2img', visualPrompt: 'Transform this' },
        ],
      });

      expect(mockCarouselRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ carouselType: 'upload', topic: 'Mi producto estrella' }),
      );
      expect(result.id).toBe('car-1');
      expect(result.slides).toHaveLength(1);
    });

    it('passes imageMode to createSlides', async () => {
      await service.createUploadCarousel('tenant-1', {
        tenantId: 'tenant-1',
        topic: 'Test',
        slides: [
          { order: 1, role: 'hook', text: 'Hook', imageMode: 'uploaded' },
          { order: 2, role: 'cta', text: 'CTA', imageMode: 'img2img', visualPrompt: 'Prompt' },
        ],
      });

      expect(mockCarouselRepo.createSlides).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ imageMode: 'uploaded', order: 1 }),
          expect.objectContaining({ imageMode: 'img2img', order: 2 }),
        ]),
      );
    });
  });

  describe('uploadSlideImage() — mode: uploaded', () => {
    it('saves image, composites text, marks slide ready', async () => {
      const imageBuffer = Buffer.from('fake-image');

      await service.uploadSlideImage('car-1', 'slide-1', 'tenant-1', imageBuffer);

      // Should save original first
      expect(mockImageStorage.saveImage).toHaveBeenCalledWith('car-1', 'slide-1-original', imageBuffer);
      // Then save composited final
      expect(mockImageStorage.saveImage).toHaveBeenCalledWith('car-1', 'slide-1', expect.any(Buffer));
      expect(mockCarouselRepo.updateSlideStatus).toHaveBeenCalledWith('slide-1', 'ready', '/carousels/car-1/slide-1.jpg');
    });

    it('marks slide failed if composite throws', async () => {
      const { compositeTextOnImage } = await import('../lib/image/text-compositor.js');
      (compositeTextOnImage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('sharp error'));

      await service.uploadSlideImage('car-1', 'slide-1', 'tenant-1', Buffer.from('img'));

      expect(mockCarouselRepo.updateSlideStatus).toHaveBeenCalledWith('slide-1', 'failed');
    });

    it('marks carousel ready when all slides complete', async () => {
      mockCarouselRepo.countPendingSlides.mockResolvedValue(0);
      // Second findById call (inside finalizeCarouselIfComplete) returns a carousel with a ready slide
      mockCarouselRepo.findById
        .mockResolvedValueOnce(uploadCarousel()) // first call in uploadSlideImage
        .mockResolvedValueOnce(uploadCarousel({ slides: [uploadSlide({ status: 'ready' })] }));

      await service.uploadSlideImage('car-1', 'slide-1', 'tenant-1', Buffer.from('img'));

      expect(mockCarouselRepo.updateStatus).toHaveBeenCalledWith('car-1', 'ready', undefined);
    });

    it('does not mark carousel ready while other slides are still pending', async () => {
      mockCarouselRepo.countPendingSlides.mockResolvedValue(1);

      await service.uploadSlideImage('car-1', 'slide-1', 'tenant-1', Buffer.from('img'));

      expect(mockCarouselRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('uploadSlideImage() — mode: img2img', () => {
    it('dispatches img2img in background and returns immediately', async () => {
      mockCarouselRepo.findById.mockResolvedValue(
        uploadCarousel({ slides: [uploadSlide({ imageMode: 'img2img', visualPrompt: 'Transform' })] }),
      );
      mockImageProvider.generateImage.mockResolvedValue(Buffer.from('generated'));

      await service.uploadSlideImage('car-1', 'slide-1', 'tenant-1', Buffer.from('source'));

      // Synchronous: save original + set generating
      expect(mockImageStorage.saveImage).toHaveBeenCalledWith('car-1', 'slide-1-original', expect.any(Buffer));
      expect(mockCarouselRepo.updateSlideStatus).toHaveBeenCalledWith('slide-1', 'generating', undefined, '/carousels/car-1/slide-1.jpg');
    });

    it('throws QuotaExceededError when fal_images quota exceeded', async () => {
      const tracker = createMockUsageTracker({
        checkQuota: vi.fn().mockResolvedValue({ allowed: false, limit: 50, resetsAt: '2026-07-01T00:00:00Z' }),
      });
      mockCarouselRepo.findById.mockResolvedValue(
        uploadCarousel({ slides: [uploadSlide({ imageMode: 'img2img', visualPrompt: 'Prompt' })] }),
      );

      const svcWithTracker = new CarouselService(
        mockCarouselRepo as any,
        mockInstagramRepo as any,
        mockScriptGenerator as any,
        mockImageProvider as any,
        mockImageStorage as any,
        tracker,
      );

      await expect(
        svcWithTracker.uploadSlideImage('car-1', 'slide-1', 'tenant-1', Buffer.from('img')),
      ).rejects.toThrow(QuotaExceededError);
    });
  });

  describe('uploadSlideImage() — carousel not found', () => {
    it('throws NotFoundError when carousel does not belong to tenant', async () => {
      const { NotFoundError } = await import('../errors.js');
      mockCarouselRepo.findById.mockResolvedValue(null);

      await expect(
        service.uploadSlideImage('bad-carousel', 'slide-1', 'tenant-1', Buffer.from('img')),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
