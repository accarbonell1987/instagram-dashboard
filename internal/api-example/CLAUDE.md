# internal/api-example — Políticas y convenciones

## Políticas obligatorias (non-negotiable)

### 1. Validación Zod en entrada Y salida

Toda ruta debe definir schemas Zod tanto para el **request** (params, query, body) como para el **response**. La validación de salida garantiza la integridad del contrato del API.

**Implementación técnica**: usar `@hono/zod-openapi` con `OpenAPIHono` y `createRoute()`.

```typescript
// ✅ Correcto — schema de request Y response explícitos
const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserResponseSchema } },
      description: 'User found',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Not found',
    },
  },
})

// ❌ Incorrecto — sin response schema
routes.get('/:id', async (c) => { ... })
```

**Los schemas de response** deben estar en el mismo archivo que la ruta (`*.routes.ts`) y seguir el formato `ApiResponse<T>`:

```typescript
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  partyId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const UserResponseSchema = z.object({
  success: z.literal(true),
  data: UserSchema,
});

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
```

---

### 2. Documentación OpenAPI siempre generada

La documentación se **genera automáticamente** desde los schemas — no se escribe a mano. Toda ruta nueva debe usar `createRoute()` para ser incluida en la spec.

- Documentación disponible en: `GET /docs` (Swagger UI)
- OpenAPI spec en: `GET /openapi.json`

**Dependencias necesarias**:

```bash
pnpm add @hono/zod-openapi @hono/swagger-ui --filter api-example
```

**Entry point del app** usa `OpenAPIHono`:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';

const app = new OpenAPIHono();

// Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }));
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: { title: 'CORE API', version: '0.0.0' },
});
```

---

### 3. Actualizar documentación tras cada cambio

Dado que los docs se derivan del código, **la actualización es automática** al modificar schemas o agregar rutas con `createRoute()`. Sin embargo:

- Al añadir una nueva entidad: crear el schema de response antes del handler
- Al cambiar un campo: actualizar el Zod schema (impacta automáticamente en docs y validación)
- Al deprecar un endpoint: usar `deprecated: true` en `createRoute()`

---

## Estructura de archivos por feature

```
src/routes/{feature}/
├── {feature}.routes.ts    # createRoute() + handler — importa el service
└── {feature}.schemas.ts   # Zod schemas de request Y response (reutilizables)
```

Los schemas en `{feature}.schemas.ts` se exportan para poder usarlos en tests.

---

## Patrón completo de ruta

```typescript
// users.schemas.ts
export const UserSchema = z.object({ ... })
export const UserResponseSchema = z.object({ success: z.literal(true), data: UserSchema })
export const UsersListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    data: z.array(UserSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
})
export const ErrorResponseSchema = z.object({ ... })  // compartido

// users.routes.ts
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'

export function createUserRoutes(userService: UserService) {
  const routes = new OpenAPIHono()

  const getUser = createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['Users'],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { content: { 'application/json': { schema: UserResponseSchema } }, description: 'OK' },
      404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' },
    },
  })

  routes.openapi(getUser, async (c) => {
    const { id } = c.req.valid('param')
    const user = await userService.findById(id)  // lanza NotFoundError si no existe
    return c.json({ success: true, data: user }, 200)
  })

  return routes
}
```

---

## Stack específico del API

| Dependencia         | Propósito                                                     |
| ------------------- | ------------------------------------------------------------- |
| `hono`              | Framework HTTP                                                |
| `@hono/node-server` | Adapter Node.js                                               |
| `@hono/zod-openapi` | OpenAPIHono + createRoute() — validación bidireccional + docs |
| `@hono/swagger-ui`  | UI de documentación en `/docs`                                |
| `zod`               | Schemas de validación                                         |
| `@core/database`    | Prisma client (solo para DATA_SOURCE=prisma)                  |

## Variables de entorno

| Variable       | Requerida   | Default       | Descripción                                 |
| -------------- | ----------- | ------------- | ------------------------------------------- |
| `DATA_SOURCE`  | No          | `memory`      | `memory` \| `file` \| `prisma`              |
| `DATA_DIR`     | No          | `./data`      | Directorio para datos JSON (solo file mode) |
| `PORT`         | No          | `3005`        | Puerto del servidor                         |
| `DATABASE_URL` | Solo prisma | —             | URL de PostgreSQL                           |
| `CORS_ORIGIN`  | No          | `*`           | Origen permitido para CORS                  |
| `NODE_ENV`     | No          | `development` | `development` \| `production` \| `test`     |
