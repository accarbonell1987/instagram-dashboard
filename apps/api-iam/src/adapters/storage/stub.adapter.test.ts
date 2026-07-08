import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { StubStorageAdapter } from './stub.adapter.js'

const testDir = join(tmpdir(), `stub-storage-test-${Date.now()}`)
const BASE_URL = 'http://localhost:8080'

beforeEach(() => {
  mkdirSync(testDir, { recursive: true })
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

describe('StubStorageAdapter', () => {
  it('upload creates file at expected path', async () => {
    const adapter = new StubStorageAdapter(testDir, BASE_URL)
    const buffer = Buffer.from('hello pdf')
    await adapter.upload({ key: 'tenants/abc/doc.pdf', buffer, contentType: 'application/pdf' })

    const expectedPath = join(testDir, 'tenants', 'abc', 'doc.pdf')
    expect(existsSync(expectedPath)).toBe(true)
    expect(readFileSync(expectedPath)).toEqual(buffer)
  })

  it('upload creates nested parent directories', async () => {
    const adapter = new StubStorageAdapter(testDir, BASE_URL)
    await adapter.upload({
      key: 'deep/nested/dir/file.pdf',
      buffer: Buffer.from('data'),
      contentType: 'application/pdf',
    })

    const expectedPath = join(testDir, 'deep', 'nested', 'dir', 'file.pdf')
    expect(existsSync(expectedPath)).toBe(true)
  })

  it('signedUrl returns HTTP URL with correct path and ttl', async () => {
    const adapter = new StubStorageAdapter(testDir, BASE_URL)
    const url = await adapter.signedUrl({ key: 'some/doc.pdf', ttlSeconds: 3600 })

    expect(url).toMatch(/^http:\/\//)
    expect(url).toContain('/dev/storage/some/doc.pdf')
    expect(url).toContain('ttl=3600')
  })
})
