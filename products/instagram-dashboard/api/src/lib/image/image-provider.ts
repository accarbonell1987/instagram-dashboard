export interface ImageGenerateOptions {
  baseImageBuffer?: Buffer;
  t2iModel?: string;
  i2iModel?: string;
}

export interface ImageProvider {
  generateImage(prompt: string, apiKey: string, options?: ImageGenerateOptions): Promise<Buffer>;
}
