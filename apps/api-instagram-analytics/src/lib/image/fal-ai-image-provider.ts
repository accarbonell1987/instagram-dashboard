import { createFalClient } from '@fal-ai/client';
import type { ImageProvider, ImageGenerateOptions } from './image-provider.js';

const DEFAULT_T2I_MODEL = 'fal-ai/ideogram/v3';
const DEFAULT_I2I_MODEL = 'fal-ai/flux/dev/image-to-image';
// Instagram portrait 4:5 (1080x1350)
const IMAGE_SIZE = { width: 1080, height: 1350 };
// How much the output should deviate from the source image (0=identical, 1=ignore source)
const IMG2IMG_STRENGTH = 0.7;

export class FalAiImageProvider implements ImageProvider {
  async generateImage(prompt: string, apiKey: string, options?: ImageGenerateOptions): Promise<Buffer> {
    if (options?.baseImageBuffer) {
      return this.generateImageToImage(prompt, apiKey, options.baseImageBuffer, options.i2iModel);
    }
    return this.generateTextToImage(prompt, apiKey, options?.t2iModel);
  }

  private async generateTextToImage(prompt: string, apiKey: string, model?: string): Promise<Buffer> {
    const client = createFalClient({ credentials: apiKey });
    const resolvedModel = model ?? DEFAULT_T2I_MODEL;

    let result: { data: { images?: Array<{ url: string }> } };
    try {
      result = await client.subscribe(resolvedModel, {
        input: {
          prompt,
          negative_prompt: 'text, letters, words, typography, captions, watermark, writing, labels',
          expand_prompt: false,
          image_size: IMAGE_SIZE,
          rendering_speed: 'BALANCED',
        },
      }) as { data: { images?: Array<{ url: string }> } };
    } catch (error) {
      const falError = error as { status?: number; body?: unknown; requestId?: string; message?: string };
      const detail = JSON.stringify({ status: falError.status, body: falError.body, requestId: falError.requestId });
      console.error(`[fal.ai] text-to-image error — ${falError.message ?? 'unknown'} | detail: ${detail}`);
      throw new Error(`fal.ai API error ${falError.status ?? '?'}: ${falError.message ?? 'unknown'} — ${detail}`);
    }

    console.log(`[fal.ai] raw result keys: ${Object.keys(result ?? {}).join(', ')}`);

    const imageUrl = result?.data?.images?.[0]?.url;
    if (!imageUrl) {
      const dataStr = JSON.stringify(result?.data);
      console.error(`[fal.ai] no image URL in response. data: ${dataStr}`);
      throw new Error(`fal.ai returned no image URL. Response data: ${dataStr}`);
    }

    return this.downloadImage(imageUrl);
  }

  private async generateImageToImage(prompt: string, apiKey: string, baseImageBuffer: Buffer, model?: string): Promise<Buffer> {
    const client = createFalClient({ credentials: apiKey });
    const resolvedModel = model ?? DEFAULT_I2I_MODEL;

    // fal.ai requires a URL — upload the buffer to fal storage first
    const imageFile = new File([baseImageBuffer], 'source.jpg', { type: 'image/jpeg' });
    const uploadedUrl = await client.storage.upload(imageFile);
    console.log(`[fal.ai] uploaded base image to fal storage: ${uploadedUrl.slice(0, 80)}...`);

    let result: { data: { images?: Array<{ url: string }> } };
    try {
      result = await client.subscribe(resolvedModel, {
        input: {
          prompt,
          image_url: uploadedUrl,
          strength: IMG2IMG_STRENGTH,
          num_images: 1,
        },
      }) as { data: { images?: Array<{ url: string }> } };
    } catch (error) {
      const falError = error as { status?: number; body?: unknown; requestId?: string; message?: string };
      const detail = JSON.stringify({ status: falError.status, body: falError.body, requestId: falError.requestId });
      console.error(`[fal.ai] image-to-image error — ${falError.message ?? 'unknown'} | detail: ${detail}`);
      throw new Error(`fal.ai img2img error ${falError.status ?? '?'}: ${falError.message ?? 'unknown'} — ${detail}`);
    }

    const imageUrl = result?.data?.images?.[0]?.url;
    if (!imageUrl) {
      const dataStr = JSON.stringify(result?.data);
      console.error(`[fal.ai] no image URL in img2img response. data: ${dataStr}`);
      throw new Error(`fal.ai img2img returned no image URL. Response data: ${dataStr}`);
    }

    return this.downloadImage(imageUrl);
  }

  private async downloadImage(imageUrl: string): Promise<Buffer> {
    console.log(`[fal.ai] downloading image from ${imageUrl.slice(0, 80)}...`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image from fal.ai: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
