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
