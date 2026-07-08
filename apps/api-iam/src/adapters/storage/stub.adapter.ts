import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { StorageAdapter, StorageUploadParams, StorageSignedUrlParams } from './types.js'

export class StubStorageAdapter implements StorageAdapter {
  private readonly stubDir: string
  private readonly baseUrl: string

  constructor(stubDir: string, baseUrl: string) {
    this.stubDir = stubDir
    this.baseUrl = baseUrl
  }

  async upload(params: StorageUploadParams): Promise<void> {
    const fullPath = join(this.stubDir, params.key)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, params.buffer)
  }

  async signedUrl(params: StorageSignedUrlParams): Promise<string> {
    return `${this.baseUrl}/dev/storage/${params.key}?ttl=${params.ttlSeconds}`
  }
}
