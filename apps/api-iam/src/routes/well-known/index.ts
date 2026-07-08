import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { KeyProvider } from '../../adapters/index.js'
import { JsonWebKeySetSchema } from '../schemas/index.js'

export function createWellKnownRouter(keyProvider: KeyProvider) {
  const router = new OpenAPIHono()

  const getJwksRoute = createRoute({
    method: 'get',
    path: '/.well-known/jwks.json',
    tags: ['well-known'],
    security: [],
    responses: {
      200: {
        content: { 'application/json': { schema: JsonWebKeySetSchema } },
        description: 'JSON Web Key Set',
      },
    },
  })

  router.openapi(getJwksRoute, async (c) => {
    const jwks = await keyProvider.getJwks()
    c.header('Cache-Control', 'public, max-age=300')
    return c.json(jwks, 200)
  })

  return router
}
