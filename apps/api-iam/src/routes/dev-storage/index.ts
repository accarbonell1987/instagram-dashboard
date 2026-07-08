import { Hono } from 'hono'
import { createReadStream, existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { Readable } from 'node:stream'

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export function createDevStorageRouter(stubDir: string) {
  const router = new Hono()

  router.get('/dev/storage/*', (c) => {
    const key = c.req.path.replace('/dev/storage/', '')

    // Prevent path traversal
    const fullPath = resolve(join(stubDir, key))
    if (!fullPath.startsWith(resolve(stubDir))) {
      return c.text('Forbidden', 403)
    }

    if (!existsSync(fullPath)) {
      return c.text('Not found', 404)
    }

    const ext = extname(fullPath).toLowerCase()
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

    const stream = createReadStream(fullPath)
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: { 'Content-Type': contentType },
    })
  })

  return router
}
