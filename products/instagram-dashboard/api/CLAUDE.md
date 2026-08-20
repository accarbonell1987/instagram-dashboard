# api-instagram-analytics

API de análisis de Instagram para el monorepo Corehub. Backend Hono 4.x que provee OAuth con Instagram, sincronización de métricas vía Graph API v25.0, y datos de dashboard para el módulo `dashboard-instagram` del Hub.

## Stack

- **Runtime**: Hono 4.x + @hono/node-server
- **API Docs**: @hono/zod-openapi + @hono/swagger-ui (auto-generado en `/docs`)
- **Database**: PostgreSQL + Prisma 6.x (schema en `prisma/schema.prisma`)
- **Auth**: JWT de api-iam (verificación vía JWKS con `jose`)
- **Testing**: Vitest 3.x, 80%+ coverage
- **Language**: TypeScript 5.7+ (strict, ESM, exactOptionalPropertyTypes)

## Quick Start

```bash
cd apps/api-instagram-analytics
cp .env.example .env
# Edit .env with real values
pnpm install
pnpm db:generate
pnpm db:push
pnpm dev
```

Server starts at `http://localhost:3003`. Swagger docs at `/docs`.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 3003 | Server port |
| DATABASE_URL | Yes | — | PostgreSQL connection string |
| IAM_JWKS_URL | Yes | — | api-iam base URL for JWKS (e.g., `http://localhost:8080`) |
| IG_APP_ID | Yes | — | Instagram App ID from Meta Developer Dashboard |
| IG_APP_SECRET | Yes | — | Instagram App Secret |
| IG_REDIRECT_URI | Yes | — | OAuth callback URL |
| IG_API_BASE_URL | No | `https://graph.instagram.com/v25.0` | Instagram Graph API base URL |
| ENCRYPTION_KEY | Yes | — | 64-char hex string for AES-256-GCM token encryption |
| CORS_ORIGIN | No | `*` | Allowed CORS origin |
| NODE_ENV | No | `development` | Environment (`development` \| `production` \| `test`) |

Generate an encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Architecture

```
src/
├── index.ts              # Composition root (bootstrap)
├── config.ts             # Zod-validated env vars
├── errors.ts             # AppError hierarchy
├── domain/               # Pure TypeScript interfaces
├── lib/                  # Utilities (JWT verifier, IG client, crypto)
├── middleware/            # Auth guard, rate limiter, error handler
├── repositories/         # Data access (Prisma)
├── services/             # Business logic (OAuth, sync, dashboard, insight)
└── routes/               # HTTP layer (OpenAPI-documented)
```

### API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | Public | Health check |
| GET | /health/ready | Public | Readiness (DB + IAM) |
| GET | /api/auth/instagram/login | Public* | OAuth redirect |
| GET | /api/auth/instagram/callback | Public | OAuth callback |
| GET | /api/auth/instagram/status | Public* | Connection status |
| GET | /api/dashboard | JWT | Full dashboard data |
| GET | /api/dashboard/insight | JWT | Insight card |
| GET | /api/media | JWT | Paginated media list |
| GET | /api/media/:id | JWT | Media detail |
| POST | /api/sync/trigger | JWT | Trigger sync |
| GET | /api/sync/status | JWT | Sync status |

*Login and status routes should require JWT but are mounted publicly for MVP simplicity. They return errors if called without valid auth.

### Data Flow

```
Hub Frontend (Next.js)
  → apiFetch() to localhost:3003
  → Auth Guard (JWT verification against api-iam JWKS)
  → Service (business logic)
  → Repository (Prisma queries, tenant-scoped)
  → PostgreSQL
```

### El modelo lo elige la cuenta, no el deployment

`LlmClient` (`src/lib/llm-client.ts`) es el SDK de OpenAI con `baseURL` configurable, así que un
solo camino de código habla con cualquier proveedor que implemente chat-completions. Claude y
Gemini entran por **OpenRouter**, no nativos: sus protocolos propios pedirían una segunda
implementación de tool-calling y parseo para el mismo resultado.

- `LlmResolver` arma el cliente **por llamada** desde `agent_config.llm` + `llm_api_key_encrypted`,
  con *fallback* al env. Sin ese fallback, todo tenant que no configuró nada pierde el agente.
- Espeja el patrón que ya usaba fal.ai: clave por cuenta, cifrada, en su propia columna; de vuelta
  solo sale un booleano.
- **`reasoning_effort` es de DeepSeek y viaja en el body.** OpenAI y Groq rechazan el campo
  desconocido, así que la bandera está atada al preset del proveedor. Un proveedor desconocido no
  manda nada específico de nadie.
- Los servicios **ya no hardcodean modelo por llamada** (había `deepseek-v4-pro` para guiones y
  `flash` para chat). Con modelo configurable esa distinción no sobrevive; hay uno solo, y el
  registro de uso guarda `response.model` — **lo que respondió**, no lo que se pidió, porque un
  alias como `gpt-4o` resuelve a un build con fecha y la factura se escribe contra el build.
- El recurso de cuota se llama `llm_tokens`, no `deepseek_tokens`: el nombre del proveedor metido
  en la facturación describía algo que la cuota ya no mide. `ALTER TYPE ... RENAME VALUE` reescribe
  la etiqueta en su lugar, así que las filas de `plan_quotas` no necesitan backfill.

### Un cambio de schema desde el host NO llega al contenedor

`docker-compose.dev.yml` monta `- /app/node_modules` como volumen anónimo, que **enmascara** el
`node_modules` del host. El cliente Prisma de este paquete se genera ahí adentro (el `generator`
no declara `output`), así que:

- Correr `prisma db push` o `db:generate` desde el host actualiza la **base** y el cliente **del
  host**, y deja el del contenedor viejo.
- El síntoma es `Unknown argument \`campo\`` o `Unknown field` en una columna que **sí existe** en
  Postgres — el error acusa al código y la causa es el cliente.
- `tsx watch` recarga el proceso, no el contenedor, así que no lo arregla.

La cura es reiniciar el contenedor: su entrypoint corre `db:generate` y `db:push`.

```bash
docker restart corehub-instagram-api
```

Pasó dos veces: con `llm_api_key_encrypted` y con `ai_usage_logs.user_id`.

### El agente tiene dos relojes

El deployment corre `DEEPSEEK_MODEL=deepseek-v4-pro`, que pisa el default del código
(`deepseek-v4-flash`). `pro` razona más y tarda más: las generaciones acá promedian ~8k tokens y
28–59s. Si el chat tiene que ser rápido, ese env es la palanca, no el timeout.

`HOP_TIMEOUT_MS` (120s) acota **cada** llamada al modelo; `REQUEST_BUDGET_MS` (180s) acota el chat
entero, y la ventana de cada salto se recorta con lo que queda. Antes había un solo tope de 60s por
salto y nada acotaba el request: con `MAX_ITERATIONS = 5` una corrida lenta podía tener la conexión
abierta cinco minutos, y a la vez un chat normal —el rango observado acá es 28–59s— se rechazaba
por unos segundos de más. El límite estaba adentro del tráfico normal, no afuera.

### Guards de entitlements: producto y módulo

`api.use('*', entitlementsGuard)` solo pregunta *"¿puede abrir este producto?"*. Las rutas de IA
llevan además un guard **por módulo**, porque esconder una pestaña no es lo mismo que rechazar la
llamada que hay detrás:

| Ruta | Módulo requerido |
|---|---|
| `/api/chat` | `ig-ai-chat` |
| `/api/suggestions` | `ig-ai-suggestions` |
| `/api/agent` | `ig-ai-agent` |
| `/api/carousels` | `ig-ai-carousels` |

Sin esto, un `content-analist` —que en el front ve Chat y Sugerencias pero no Carruseles— podía
hacer `POST /api/carousels` a mano y generar justo lo que su rol dice que no.

- **Hay que montar las dos rutas**: en Hono `'/chat/*'` **no** matchea `/chat` pelado, que suele ser
  el listado. Siempre `api.use('/x', g)` **y** `api.use('/x/*', g)`.
- `/api/admin` queda **sin** guard de módulo a propósito: es administración del tenant, no una
  función del producto, y gatearla dejaría a un admin con rol restrictivo fuera de su propia
  pantalla de administración.
- **Cada guard tiene su caché** (TTL 60s). `createEntitlementsPurgeRoute` recibe la lista completa;
  purgar solo algunos deja a los demás sirviendo una decisión vieja, que se ve como "cambié el rol
  y no pasó nada".

### Aislamiento: por tenant Y por usuario

Todo dato se scopea por `tenant_id` **y** `user_id`, no solo por tenant. El `authGuard` saca ambos
del JWT verificado (`TenantContext`), y las rutas lo estrechan con `ownerOf(tenant)` antes de
pasárselo a un servicio — el contexto también trae `role` y `tenantSlug`, que a un servicio no le
incumben.

- **Una cuenta de Instagram por usuario**: `@@unique([tenantId, userId])`. Cada miembro conecta la
  suya; el admin del tenant las ve todas en `/settings` del hub y puede liberarlas.
  Revierte `20260619000001_one_account_per_tenant`, que había fijado una por tenant.
- `Owner` (`src/domain/owner.ts`) se pasa como **un objeto**, nunca como dos strings sueltos: un
  método `(tenantId, userId, id)` son tres strings intercambiables, y el día que dos se cruzan la
  query corre igual y devuelve las filas de otro.
- `chat_messages`, `suggestion_batches`, `content_suggestions` y `carousels` llevan `user_id`.
  Antes iban solo por tenant, así que **cualquier miembro leía el chat con la IA de los demás**.
- **`ai_usage_logs` lleva `user_id` nullable, y es solo para reportar.** La cuota se sigue
  contando por tenant (`getPlanQuotas(tenantId)`): el plan lo compró el tenant, y ventanear la
  cuota por miembro le daría a cada uno la asignación entera. El `user_id` alimenta el desglose de
  `/api/admin/usage`, nada más.
  - **Nullable porque las filas anteriores no se pueden atribuir.** Se reportan en su propia
    entrada, ni descartadas (los miembros dejarían de sumar el total) ni repartidas (acreditaría
    consumo a quien no lo hizo).
- `deleteById` usa `deleteMany` en vez de `delete`: `delete` exige un where único, así que scoparlo
  por dueño obligaría a leer la fila antes y confiar en ella en el medio. De paso queda idempotente.

### Multi-Tenant Isolation

All data is scoped by `tenant_id` from the verified JWT. The `authGuard` middleware extracts `tenant_uuid` and `tenant_slug` from JWT claims. Every repository query includes `WHERE tenant_id = ?`.

### Instagram Graph API Integration

- Version: v25.0
- Access: Standard (own accounts, NO App Review required)
- Rate limit: ~200 calls/hour per token — tracked by in-memory counter
- Token: OAuth 2.0 code → short-lived (1h) → long-lived (60d), stored encrypted with AES-256-GCM
- Required scopes: `instagram_business_basic`, `instagram_business_manage_insights`

### Conventions

- ESM native (`.js` extensions in imports)
- `import type` for type-only imports
- kebab-case filenames
- `create*` factory functions
- Services throw AppError subclasses — never try/catch internally
- Route handlers are thin (extract params → call service → return JSON)
- Zod schemas import from `@hono/zod-openapi`, NOT from `zod`
- Tests co-located (`*.test.ts` alongside `*.ts`)
- 80%+ coverage required

### Related Modules

- `apps/hub/src/modules/dashboard-instagram/` — Frontend dashboard consuming this API
- `apps/api-iam/` — JWT provider (auth dependency)
- `internal/api-example/` — Reference Hono pattern
