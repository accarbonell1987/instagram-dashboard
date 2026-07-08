# @corehub/api-iam

Identity & Access Management microservice for the Corehub platform.

**Stack**: Hono 4 · Prisma 6 · PostgreSQL 16 · JWT RS256 · argon2id  
**Port**: `8080` | **DB**: `5432` | **Adminer**: `8050`

---

## Quick start

```bash
# 1. Install dependencies (from monorepo root)
pnpm install

# 2. Start the database (Docker — runs in background, keep it running)
cd apps/api-iam
docker compose up -d

# 3. Copy env and configure
cp .env.example .env

# 4. Generate RSA keys (required for JWT signing)
npx tsx src/scripts/generate-dev-keys.ts
# Then update .env:
#   JWT_PRIVATE_KEY_PATH=./keys/private.pem
#   JWT_PUBLIC_KEY_PATH=./keys/public.pem

# 5. Run migrations + seed
pnpm --filter @corehub/api-iam db:generate
pnpm --filter @corehub/api-iam db:migrate
pnpm --filter @corehub/api-iam db:seed

# 6. Start the server with hot-reload
pnpm --filter @corehub/api-iam dev
```

Verify:

```bash
curl http://localhost:8080/healthz
# → {"status":"ok","service":"iam"}
```

---

## Architecture

The Node server runs locally (hot-reload via `tsx watch`). PostgreSQL runs in Docker and is reachable at `localhost:5432`. They connect through the `DATABASE_URL` env var — no extra configuration needed.

```
┌─────────────────────┐        ┌──────────────────────────┐
│  pnpm dev (local)   │───────▶│  Docker: postgres:16     │
│  localhost:8080     │        │  localhost:5432           │
└─────────────────────┘        └──────────────────────────┘
                                ┌──────────────────────────┐
                                │  Docker: adminer         │
                                │  localhost:8081          │
                                └──────────────────────────┘
```

---

## URLs

| URL                                           | Description                                       |
| --------------------------------------------- | ------------------------------------------------- |
| `http://localhost:8080/healthz`               | Health check → `{ status: "ok", service: "iam" }` |
| `http://localhost:8080/docs`                  | Swagger UI — all endpoints, try-it-out            |
| `http://localhost:8080/openapi.json`          | OpenAPI 3.1 spec (JSON)                           |
| `http://localhost:8080/.well-known/jwks.json` | Public JWK set for JWT verification               |
| `http://localhost:8050`                       | Adminer — database UI                             |

**Adminer credentials**: System: PostgreSQL · Server: `postgres` · User: `corehub` · Password: `corehub_dev_password` · Database: `corehub_iam`

---

## Connect the frontend

To point `apps/hub` at this server instead of MSW mocks:

```bash
# apps/hub/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
```

No code changes needed in the frontend.

> **Note**: `apps/hub` runs on port `3001`, same as `@internal/api-example`. Don't run both simultaneously.

---

## What's implemented

| Domain          | Endpoints | Description                                                                                                                |
| --------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Auth**        | 14        | Login (2FA + device trust), OTP send/verify, JWT refresh rotation, logout, password recovery, first login, signup-rep flow |
| **Onboarding**  | 8         | 6-step wizard state machine, draft CRUD, resume token, payment initiation, submit (tenant provisioning)                    |
| **Webhooks**    | 1         | Bancard payment webhook (HMAC-SHA256 verification, atomic processing)                                                      |
| **Identity**    | 1         | Current tenant from JWT                                                                                                    |
| **Plans**       | 2         | List + get plans                                                                                                           |
| **Invitations** | 2         | Preview + accept invitation (creates user + session)                                                                       |
| **Billing**     | 1         | Signed document URL (5-min TTL)                                                                                            |
| **Well-known**  | 1         | JWKS endpoint (Cache-Control: 5min)                                                                                        |
| **Health**      | 1         | `/healthz` liveness probe                                                                                                  |
| **Total**       | **31**    | —                                                                                                                          |

### Cross-cutting

| Feature           | Description                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Idempotency       | All mutations require `Idempotency-Key` header. 24h TTL, replay detection                                                                 |
| Auth guard        | Bearer JWT verification on all protected routes                                                                                           |
| Tenant guard      | `X-Tenant-Slug` vs JWT claim validation                                                                                                   |
| Error handling    | RFC 7807 Problem Details (`application/problem+json`) on all errors                                                                       |
| CORS              | Configurable via `CORS_ALLOWED_ORIGINS`, credentials enabled                                                                              |
| Request ID        | `X-Request-Id` echoed in every response                                                                                                   |
| Background jobs   | 5 cron jobs: OTP cleanup (5min), password reset tokens (10min), idempotency records (1h), refresh tokens (1h), expired drafts (daily 3am) |
| Schema-per-tenant | Each tenant gets an isolated PostgreSQL schema (`tenant_{slug}`)                                                                          |

### Adapters (swappable via env vars)

| Adapter          | Stub                 | Real                                           |
| ---------------- | -------------------- | ---------------------------------------------- |
| OTP delivery     | Logs code to console | Resend (`OTP_EMAIL_PROVIDER=resend`)           |
| Email            | Logs to console      | Resend (`EMAIL_PROVIDER=resend`)               |
| Bancard payments | Always approves      | Real API (`BANCARD_PROVIDER=real`)             |
| PDF generation   | Minimal PDF buffer   | @react-pdf/renderer (`PDF_PROVIDER=react-pdf`) |
| Storage          | Local filesystem     | S3 (`STORAGE_PROVIDER=s3`)                     |

---

## Scripts

```bash
pnpm --filter @corehub/api-iam dev            # Start with hot-reload
pnpm --filter @corehub/api-iam build          # Compile TypeScript
pnpm --filter @corehub/api-iam type-check     # Type-check without emit
pnpm --filter @corehub/api-iam test           # Run tests (Vitest)
pnpm --filter @corehub/api-iam test:watch     # Tests in watch mode

pnpm --filter @corehub/api-iam db:generate    # Generate Prisma client
pnpm --filter @corehub/api-iam db:migrate     # Run migrations
pnpm --filter @corehub/api-iam db:seed        # Seed plans + superadmin
pnpm --filter @corehub/api-iam db:studio      # Open Prisma Studio
```

Docker:

```bash
docker compose up -d          # Start Postgres + Adminer
docker compose down           # Stop
docker compose down -v        # Stop + delete DB data (full reset)
```

---

## Operational docs

| Doc                        | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `.atl/runbook.md`          | Full setup guide, env vars reference, common issues |
| `.atl/jwt-key-rotation.md` | Zero-downtime JWT key rotation procedure            |
| `.atl/manual-tenant.md`    | SQL guide for manually provisioning a tenant        |
