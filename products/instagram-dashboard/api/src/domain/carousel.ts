export type CarouselStatus = 'pending' | 'generating_script' | 'generating_images' | 'ready' | 'failed';
export type SlideStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type SlideRole = 'hook' | 'development' | 'cta' | 'default';
export type PublishStatus = 'unpublished' | 'published' | 'failed';
export type ImageMode = 'ai_gen' | 'uploaded' | 'img2img';
export type CarouselType = 'ai_gen' | 'upload';

export interface CarouselSlide {
  id: string;
  carouselId: string;
  order: number;
  role: SlideRole;
  text: string;
  visualPrompt: string;
  imageUrl: string | null;
  uploadedImageUrl: string | null;
  imageMode: ImageMode;
  status: SlideStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Carousel {
  id: string;
  tenantId: string;
  accountId: string | null;
  suggestionId: string | null;
  topic: string;
  status: CarouselStatus;
  errorMessage: string | null;
  caption: string | null;
  carouselType: CarouselType;
  publishStatus: PublishStatus;
  publishedAt: Date | null;
  igMediaId: string | null;
  igPermalink: string | null;
  createdAt: Date;
  updatedAt: Date;
  slides: CarouselSlide[];
}

export interface CreateCarouselInput {
  tenantId: string;
  accountId?: string;
  suggestionId?: string;
  topic: string;
}

export interface CreateUploadSlideInput {
  order: number;
  role: SlideRole;
  text: string;
  imageMode: 'uploaded' | 'img2img';
  visualPrompt?: string;
}

export interface CreateUploadCarouselInput {
  tenantId: string;
  accountId?: string;
  topic: string;
  caption?: string;
  slides: CreateUploadSlideInput[];
}

export interface UpdateSlideInput {
  text?: string;
  visualPrompt?: string;
}

export interface GeneratedSlide {
  order: number;
  role: SlideRole;
  text: string;
  visualPrompt: string;
}

export interface PublishCarouselInput {
  caption?: string;
}

export interface RegenerateCarouselInput {
  topic?: string;
}

export interface PublishCarouselResult {
  igMediaId: string;
  permalink: string;
}
