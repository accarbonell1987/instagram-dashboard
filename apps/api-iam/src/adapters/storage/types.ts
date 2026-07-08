export interface StorageUploadParams {
  key: string
  buffer: Buffer
  contentType: string
}

export interface StorageSignedUrlParams {
  key: string
  ttlSeconds: number
}

export interface StorageAdapter {
  upload(params: StorageUploadParams): Promise<void>
  signedUrl(params: StorageSignedUrlParams): Promise<string>
}
