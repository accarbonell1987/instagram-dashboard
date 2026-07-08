export interface ImageStorage {
  saveImage(carouselId: string, slideId: string, imageBuffer: Buffer): Promise<string>;
}
