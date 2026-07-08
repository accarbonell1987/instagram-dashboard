import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImageStorage } from './image-storage.js';

export class DiskImageStorage implements ImageStorage {
  constructor(
    private readonly publicDir: string,
    // baseUrl kept for interface compatibility but no longer embedded in the stored path
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly _baseUrl: string,
  ) {}

  async saveImage(carouselId: string, slideId: string, imageBuffer: Buffer): Promise<string> {
    const dir = join(this.publicDir, 'carousels', carouselId);
    await mkdir(dir, { recursive: true });

    const fileName = `${slideId}.jpg`;
    await writeFile(join(dir, fileName), imageBuffer);

    // Store as relative path so the frontend loads from the API server,
    // and resolvePublicUrl() in the service adds PUBLIC_BASE_URL only when
    // sending image URLs to Instagram during publish.
    return `/carousels/${carouselId}/${fileName}`;
  }
}
