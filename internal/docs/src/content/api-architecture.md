---
title: 'Arquitectura del API'
description: 'Capas, patrones y decisiones de diseno del API REST enterprise'
order: 10
date: 2026-02-26
readTime: 10 min
---

# Arquitectura del API

`internal/api-example` es una plantilla de API REST enterprise construida con **Hono 4.x** y **TypeScript**. Su diseño aplica el patrón Repository para desacoplar la fuente de datos, separación estricta de capas y documentación OpenAPI generada automáticamente desde los schemas Zod.

## Diagrama de capas

```
┌─────────────────────────────────────────────┐
│              HTTP Layer (Hono)              │
│  OpenAPIHono · createRoute() · /docs        │
│  Middleware: logger · cors · requestId      │
├─────────────────────────────────────────────┤
│              Routes Layer                   │
│  health.routes  users.routes  roles.routes  │
│  parties.routes  ← *.schemas.ts + DTOs      │
├─────────────────────────────────────────────┤
│              Services Layer                 │
│  UserService · RoleService · PartyService   │
│  Lanzan AppError — nunca hacen try/catch    │
├─────────────────────────────────────────────┤
│           Repository Interface              │
│   Repository<T, TCreate, TUpdate>           │
├──────────────┬──────────────┬───────────────┤
│   InMemory   │     File     │    Prisma     │
│   (Map RAM)  │  (JSON file) │ (PostgreSQL)  │
├─────────────────────────────────────────────┤
│              Domain Layer                   │
│     Party · User · Role · UserRole          │
├─────────────────────────────────────────────┤
│          Config / Errors                    │
│   config.ts (Zod) · errors.ts (AppError)    │
└─────────────────────────────────────────────┘
```

---

## Dominio

El modelo de datos tiene cuatro entidades relacionadas:

```
Party (persona u organización base)
├── id, type ("person" | "organization")
├── displayName, email?, phone?

User (usuario autenticable)
├── id, email, name?
├── partyId → Party.id  (relación 1:1)
├── roles → Role[]  (via UserRole)

Role (grupo de permisos)
├── id, name (único), description?
├── permissions: string[]

UserRole (junction M:N)
├── [userId, roleId]  (PK compuesto)
├── assignedAt
```

Los tipos de dominio son **interfaces TypeScript puras** — sin dependencias de framework ni de ORM. Cada entidad tiene su `CreateXInput` y `UpdateXInput` asociados.

---

## Repository Pattern

### Interfaz genérica

```typescript
interface Repository<T extends { id: string }, TCreate, TUpdate> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(data: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T | null>;
  remove(id: string): Promise<boolean>;
  filter(params: FilterParams): Promise<PaginatedResponse<T>>;
}
```

Los repositorios de cada entidad extienden esta interfaz con métodos específicos de dominio (`findByEmail`, `findByName`).

### Tres implementaciones

| Implementación       | Almacenamiento              | Cuándo usarla                |
| -------------------- | --------------------------- | ---------------------------- |
| `InMemoryRepository` | `Map<string, T>` en RAM     | Desarrollo, tests, demos     |
| `FileRepository`     | Archivos JSON en disco      | Prototipado con persistencia |
| `PrismaRepository`   | PostgreSQL via PrismaClient | Producción                   |

La implementación activa se selecciona en tiempo de arranque con la variable de entorno `DATA_SOURCE`. El resto del código no sabe qué implementación está en uso.

### Factory de repositorios

`src/lib/create-repositories.ts` es el único lugar que conoce las tres implementaciones:

```typescript
export function createRepositories(config: Config, prisma?: PrismaClient) {
  switch (config.DATA_SOURCE) {
    case "memory":  return { users: new UserInMemoryRepository(), ... }
    case "file":    return { users: new UserFileRepository(config.DATA_DIR), ... }
    case "prisma":  return { users: new UserPrismaRepository(prisma), ... }
  }
}
```

---

## Capa de Servicios

Los servicios contienen la lógica de negocio. Dos reglas invariables:

1. **Lanzan, no capturan** — nunca hacen `try/catch`. Cualquier error sube hacia el middleware.
2. **Usan `AppError`** — cada caso de error tiene una clase específica con el HTTP status code correcto.

```typescript
// UserService — ejemplo
async findById(id: string): Promise<User> {
  const user = await this.repository.findById(id);
  if (!user) throw new NotFoundError("User", id);  // → 404
  return user;
}

async create(data: CreateUserInput): Promise<User> {
  const existing = await this.repository.findByEmail(data.email);
  if (existing) throw new ConflictError("User", "email", data.email);  // → 409
  return this.repository.create(data);
}
```

### Jerarquía de errores

| Clase               | HTTP | Código             |
| ------------------- | ---- | ------------------ |
| `NotFoundError`     | 404  | `NOT_FOUND`        |
| `ConflictError`     | 409  | `CONFLICT`         |
| `ValidationError`   | 400  | `VALIDATION_ERROR` |
| `UnauthorizedError` | 401  | `UNAUTHORIZED`     |
| `ForbiddenError`    | 403  | `FORBIDDEN`        |
| `InternalError`     | 500  | `INTERNAL_ERROR`   |

---

## Capa de Rutas (OpenAPIHono)

Cada feature tiene dos archivos:

- **`*.schemas.ts`** — Schemas Zod con `.openapi()` + función `entityToDTO()`
- **`*.routes.ts`** — Rutas definidas con `createRoute()` + handlers

### Flujo de una petición

```
Request
  → Middleware (logger, cors, requestId)
  → OpenAPIHono.openapi(route, handler)
      → Validación Zod del request (query/params/body)
      → Handler → Service → Repository
      → Serialización DTO (entity → JSON-safe)
      → Validación Zod del response
  → Response
```

### Estructura de una ruta

```typescript
const getUser = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  request: { params: IdParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: UserResponseSchema } } },
    404: { content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
});

routes.openapi(getUser, async (c) => {
  const { id } = c.req.valid('param'); // tipado, ya validado por Zod
  const user = await userService.findById(id);
  return c.json({ success: true, data: userToDTO(user) }, 200);
});
```

### Schemas compartidos

`src/lib/shared-schemas.ts` centraliza los schemas reutilizables:

| Schema                       | Descripción                                              |
| ---------------------------- | -------------------------------------------------------- |
| `IdParamSchema`              | Parámetro `{id}` en la URL                               |
| `FilterQuerySchema`          | `page`, `pageSize`, `search`, `sortBy`, `sortOrder`      |
| `ErrorResponseSchema`        | `{ success: false, error: { code, message, details? } }` |
| `DeleteResponseSchema`       | `{ success: true, data: null }`                          |
| `paginatedResponseSchema(T)` | Factory para respuestas paginadas                        |

---

## Middleware

### Error Handler (`middleware/error-handler.ts`)

Intercepta todos los errores no manejados y los convierte al formato estándar:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User with id 'abc' not found"
  }
}
```

- `AppError` → usa su `statusCode` y `code`
- Cualquier otro error → 500 `INTERNAL_ERROR`

### Request ID (`middleware/request-id.ts`)

Inyecta un header `X-Request-ID` en cada request (UUID v4 o el valor enviado por el cliente). Útil para correlación de logs en producción.

---

## Composition Root

`src/index.ts` es el único lugar donde se ensamblan todas las dependencias:

```
bootstrap()
  ├── Carga PrismaClient (solo si DATA_SOURCE=prisma)
  ├── createRepositories(config, prisma?)
  ├── new UserService(repositories.users)
  ├── new RoleService(repositories.roles)
  ├── new PartyService(repositories.parties)
  ├── new OpenAPIHono()
  ├── app.route("/api/users", createUserRoutes(userService))
  ├── app.route("/api/roles", createRoleRoutes(roleService))
  ├── app.route("/api/parties", createPartyRoutes(partyService))
  ├── app.doc("/openapi.json", { ... })   ← spec OpenAPI
  ├── app.get("/docs", swaggerUI(...))    ← Swagger UI
  └── serve({ fetch: app.fetch, port })
```

PrismaClient se carga con `await import()` lazy para no abrir conexión a base de datos en los modos `memory` y `file`.

---

## Documentación OpenAPI

La documentación de la API se genera **automáticamente** a partir de los schemas Zod. No hay archivos `.yaml` ni `.json` escritos a mano.

- **`/openapi.json`** — Especificación OpenAPI 3.0 completa
- **`/docs`** — Swagger UI interactivo para explorar y probar endpoints

Cuando se modifica un schema Zod (añadir un campo, cambiar una validación), la documentación se actualiza sola en el próximo arranque.

---

## Estructura de archivos

```
internal/api-example/src/
├── index.ts                        # Composition Root
├── config.ts                       # Variables de entorno validadas con Zod
├── errors.ts                       # AppError + subclases (NotFound, Conflict, ...)
├── domain/
│   ├── party.ts                    # Interfaces: Party, CreatePartyInput, UpdatePartyInput
│   ├── user.ts                     # Interfaces: User, CreateUserInput, UpdateUserInput
│   └── role.ts                     # Interfaces: Role, CreateRoleInput, UpdateRoleInput
├── repositories/
│   ├── repository.interface.ts     # Repository<T, TCreate, TUpdate> + FilterParams
│   ├── seed.ts                     # Datos de ejemplo para modo memory/file
│   ├── base/
│   │   ├── in-memory.base.repository.ts
│   │   └── file.base.repository.ts
│   ├── user/   # user.in-memory · user.file · user.prisma · index.ts
│   ├── role/   # role.in-memory · role.file · role.prisma · index.ts
│   └── party/  # party.in-memory · party.file · party.prisma · index.ts
├── lib/
│   ├── create-repositories.ts      # Factory: DATA_SOURCE → implementación concreta
│   ├── create-openapi-router.ts    # OpenAPIHono con defaultHook de validación
│   └── shared-schemas.ts           # Schemas Zod reutilizables
├── services/
│   ├── user.service.ts
│   ├── role.service.ts
│   └── party.service.ts
├── middleware/
│   ├── error-handler.ts
│   └── request-id.ts
└── routes/
    ├── health/   health.routes.ts
    ├── users/    users.routes.ts · users.schemas.ts
    ├── roles/    roles.routes.ts · roles.schemas.ts
    └── parties/  parties.routes.ts · parties.schemas.ts
```

---

## Principios de diseño

### Inversión de dependencias

Los servicios dependen de la interfaz `Repository<T>`, nunca de una implementación concreta. Cambiar de memoria a PostgreSQL no toca ni una línea de servicio.

### Un solo nivel de herencia

Los repositorios concretos heredan de la clase base abstracta (`InMemoryBaseRepository`, `FileBaseRepository`). No hay herencia en servicios ni en rutas — todo es composición.

### Schemas como fuente de verdad única

Un mismo schema Zod valida el request, el response y genera la documentación OpenAPI. No hay DTOs independientes, ni tipos duplicados, ni sincronización manual.
