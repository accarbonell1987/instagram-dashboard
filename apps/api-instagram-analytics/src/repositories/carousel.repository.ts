import type { PrismaClient } from '@prisma/client';
import { CarouselStatus, SlideStatus, SlideRole } from '@prisma/client';
import type { Carousel, CarouselSlide, CarouselStatus as DomainCarouselStatus, SlideStatus as DomainSlideStatus, SlideRole as DomainSlideRole, ImageMode, CarouselType, PublishStatus } from '../domain/carousel.js';
import { NotFoundError } from '../errors.js';

export type { CarouselStatus, SlideStatus };

export interface CreateSlideInput {
  carouselId: string;
  order: number;
  role: DomainSlideRole;
  text: string;
  visualPrompt: string;
  imageMode?: ImageMode;
}

export interface ICarouselRepository {
  create(data: {
    tenantId: string;
    accountId?: string | undefined;
    suggestionId?: string | undefined;
    topic: string;
    caption?: string | undefined;
    carouselType?: CarouselType | undefined;
  }): Promise<Carousel>;
  findAll(tenantId: string, page: number, limit: number): Promise<{ carousels: Carousel[]; total: number }>;
  findById(tenantId: string, id: string): Promise<Carousel | null>;
  delete(tenantId: string, id: string): Promise<void>;
  updateStatus(id: string, status: DomainCarouselStatus, errorMessage?: string): Promise<void>;
  createSlides(slides: CreateSlideInput[]): Promise<CarouselSlide[]>;
  updateSlide(tenantId: string, carouselId: string, slideId: string, data: { text?: string; visualPrompt?: string }): Promise<CarouselSlide>;
  updateSlideStatus(slideId: string, status: DomainSlideStatus, imageUrl?: string, uploadedImageUrl?: string): Promise<void>;
  countPendingSlides(carouselId: string): Promise<number>;
  reorderSlides(carouselId: string, order: Array<{ id: string; order: number }>): Promise<CarouselSlide[]>;
  deleteSlides(carouselId: string): Promise<void>;
  updatePublishStatus(
    carouselId: string,
    data: {
      publishStatus: PublishStatus;
      publishedAt?: Date;
      igMediaId?: string;
      igPermalink?: string;
      caption?: string;
    },
  ): Promise<void>;
  resetForRegeneration(carouselId: string, newTopic?: string): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaRow = Record<string, any>;

export class PrismaCarouselRepository implements ICarouselRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    tenantId: string;
    accountId?: string | undefined;
    suggestionId?: string | undefined;
    topic: string;
    caption?: string | undefined;
    carouselType?: CarouselType | undefined;
  }): Promise<Carousel> {
    const record = await this.prisma.carousel.create({
      data: {
        tenantId: data.tenantId,
        ...(data.accountId !== undefined && { accountId: data.accountId }),
        ...(data.suggestionId !== undefined && { suggestionId: data.suggestionId }),
        topic: data.topic,
        ...(data.caption !== undefined && { caption: data.caption }),
        ...(data.carouselType !== undefined && { carouselType: data.carouselType }),
        status: CarouselStatus.pending,
      },
      include: { slides: { orderBy: { order: 'asc' } } },
    });
    return this.toDomain(record);
  }

  async findAll(tenantId: string, page: number, limit: number): Promise<{ carousels: Carousel[]; total: number }> {
    const skip = (page - 1) * limit;
    const [records, total] = await this.prisma.$transaction([
      this.prisma.carousel.findMany({
        where: { tenantId },
        include: { slides: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.carousel.count({ where: { tenantId } }),
    ]);
    return { carousels: records.map((r) => this.toDomain(r)), total };
  }

  async findById(tenantId: string, id: string): Promise<Carousel | null> {
    const record = await this.prisma.carousel.findFirst({
      where: { tenantId, id },
      include: { slides: { orderBy: { order: 'asc' } } },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.prisma.carousel.deleteMany({ where: { id, tenantId } });
  }

  async updateStatus(id: string, status: DomainCarouselStatus, errorMessage?: string): Promise<void> {
    await this.prisma.carousel.update({
      where: { id },
      data: {
        status: status as CarouselStatus,
        ...(errorMessage !== undefined && { errorMessage }),
      },
    });
  }

  async createSlides(slides: CreateSlideInput[]): Promise<CarouselSlide[]> {
    if (slides.length === 0) return [];
    await this.prisma.carouselSlide.createMany({ data: slides.map((s) => ({
      carouselId: s.carouselId,
      order: s.order,
      role: s.role as SlideRole,
      text: s.text,
      visualPrompt: s.visualPrompt,
      ...(s.imageMode !== undefined && { imageMode: s.imageMode }),
      status: SlideStatus.pending,
    })) });
    const records = await this.prisma.carouselSlide.findMany({
      where: { carouselId: slides[0]!.carouselId },
      orderBy: { order: 'asc' },
    });
    return records.map((r) => this.toSlideDomain(r));
  }

  async updateSlide(
    tenantId: string,
    carouselId: string,
    slideId: string,
    data: { text?: string; visualPrompt?: string },
  ): Promise<CarouselSlide> {
    // Verify tenant isolation via carousel
    const carousel = await this.prisma.carousel.findFirst({ where: { id: carouselId, tenantId } });
    if (!carousel) throw new NotFoundError('Carousel', carouselId);

    const record = await this.prisma.carouselSlide.update({
      where: { id: slideId },
      data: {
        ...(data.text !== undefined && { text: data.text }),
        ...(data.visualPrompt !== undefined && { visualPrompt: data.visualPrompt }),
      },
    });
    return this.toSlideDomain(record);
  }

  async updateSlideStatus(slideId: string, status: DomainSlideStatus, imageUrl?: string, uploadedImageUrl?: string): Promise<void> {
    await this.prisma.carouselSlide.update({
      where: { id: slideId },
      data: {
        status: status as SlideStatus,
        ...(imageUrl !== undefined && { imageUrl }),
        ...(uploadedImageUrl !== undefined && { uploadedImageUrl }),
      },
    });
  }

  async countPendingSlides(carouselId: string): Promise<number> {
    return this.prisma.carouselSlide.count({
      where: {
        carouselId,
        status: { notIn: [SlideStatus.ready, SlideStatus.failed] },
      },
    });
  }

  async reorderSlides(
    carouselId: string,
    order: Array<{ id: string; order: number }>,
  ): Promise<CarouselSlide[]> {
    // Two-phase update to avoid @@unique([carouselId, order]) collisions mid-transaction
    await this.prisma.$transaction(async (tx) => {
      // Phase 1: set negative temporary orders to avoid constraint conflicts
      for (const item of order) {
        await tx.carouselSlide.update({
          where: { id: item.id },
          data: { order: -(item.order + 1) },
        });
      }
      // Phase 2: set final orders
      for (const item of order) {
        await tx.carouselSlide.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }
    });

    const records = await this.prisma.carouselSlide.findMany({
      where: { carouselId },
      orderBy: { order: 'asc' },
    });
    return records.map((r) => this.toSlideDomain(r));
  }

  async deleteSlides(carouselId: string): Promise<void> {
    await this.prisma.carouselSlide.deleteMany({ where: { carouselId } });
  }

  async updatePublishStatus(
    carouselId: string,
    data: {
      publishStatus: PublishStatus;
      publishedAt?: Date;
      igMediaId?: string;
      igPermalink?: string;
      caption?: string;
    },
  ): Promise<void> {
    await this.prisma.carousel.update({
      where: { id: carouselId },
      data: {
        publishStatus: data.publishStatus,
        ...(data.publishedAt !== undefined && { publishedAt: data.publishedAt }),
        ...(data.igMediaId !== undefined && { igMediaId: data.igMediaId }),
        ...(data.igPermalink !== undefined && { igPermalink: data.igPermalink }),
        ...(data.caption !== undefined && { caption: data.caption }),
      },
    });
  }

  async resetForRegeneration(carouselId: string, newTopic?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.carouselSlide.deleteMany({ where: { carouselId } });
      await tx.carousel.update({
        where: { id: carouselId },
        data: {
          status: CarouselStatus.pending,
          errorMessage: null,
          ...(newTopic !== undefined && { topic: newTopic }),
        },
      });
    });
  }

  private toDomain(record: PrismaRow): Carousel {
    return {
      id: record['id'] as string,
      tenantId: record['tenantId'] as string,
      accountId: (record['accountId'] as string | null) ?? null,
      suggestionId: (record['suggestionId'] as string | null) ?? null,
      topic: record['topic'] as string,
      status: record['status'] as DomainCarouselStatus,
      errorMessage: (record['errorMessage'] as string | null) ?? null,
      caption: (record['caption'] as string | null) ?? null,
      carouselType: ((record['carouselType'] as string | null) ?? 'ai_gen') as CarouselType,
      publishStatus: ((record['publishStatus'] as string | null) ?? 'unpublished') as PublishStatus,
      publishedAt: (record['publishedAt'] as Date | null) ?? null,
      igMediaId: (record['igMediaId'] as string | null) ?? null,
      igPermalink: (record['igPermalink'] as string | null) ?? null,
      createdAt: record['createdAt'] as Date,
      updatedAt: record['updatedAt'] as Date,
      slides: (record['slides'] as PrismaRow[] ?? []).map((s) => this.toSlideDomain(s)),
    };
  }

  private toSlideDomain(record: PrismaRow): CarouselSlide {
    return {
      id: record['id'] as string,
      carouselId: record['carouselId'] as string,
      order: record['order'] as number,
      role: record['role'] as DomainSlideRole,
      text: record['text'] as string,
      visualPrompt: record['visualPrompt'] as string,
      imageUrl: (record['imageUrl'] as string | null) ?? null,
      uploadedImageUrl: (record['uploadedImageUrl'] as string | null) ?? null,
      imageMode: ((record['imageMode'] as string | null) ?? 'ai_gen') as ImageMode,
      status: record['status'] as DomainSlideStatus,
      createdAt: record['createdAt'] as Date,
      updatedAt: record['updatedAt'] as Date,
    };
  }
}
