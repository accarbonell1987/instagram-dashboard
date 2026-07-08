# Corehub IAM — Operational Runbook

> **Service**: `@corehub/api-iam` | **Port**: `8080` | **Stack**: Hono 4 + Prisma 6 + PostgreSQL 16

---

## Prerequisites

- Node.js >= 22.0.0
- pnpm >= 9.15.4
- Docker + Docker Compose (for local Postgres)
- Access to the monorepo root (`front-corehub-core`)

---

## Local Development Setup

### 1. Install dependencies

From the monorepo root:

```bash
pnpm install
```

### 2. Configure environment

```bash
cd apps/api-iam
cp .env.example .env
```

Open `.env` and fill in at minimum:

- `DATABASE_URL` — already set to the local Docker Postgres; change if needed
- `JWT_PRIVATE_KEY_PATH` and `JWT_PUBLIC_KEY_PATH` — set after the key generation step below
- `BANCARD_WEBHOOK_SECRET` — any string >= 16 chars is fine for local dev

### 3. Generate RSA keys

```bash
npx tsx src/scripts/generate-dev-keys.ts
```

This creates `apps/api-iam/keys/private.pem` and `apps/api-iam/keys/public.pem`.

Update `.env`:

```env
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
```

### 4. Start the database

```bash
# From apps/api-iam/
docker compose up -d
```

Wait for the health check to pass (~5 seconds). Postgres is ready when:

```bash
docker compose ps  # Status: healthy
```

### 5. Generate Prisma client

```bash
pnpm --filter @corehub/api-iam db:generate
```

### 6. Run migrations

```bash
pnpm --filter @corehub/api-iam db:migrate
```

### 7. Seed the database

```bash
pnpm --filter @corehub/api-iam db:seed
```

Seed creates:
- Three plans: `starter`, `professional`, `enterprise`
- System tenant (`__system__`) with `enterprise` plan
- SuperAdmin user from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` env vars (defaults: `admin@corehub.com` / `Change-me-in-production!`)
- Dev fixtures (only in `NODE_ENV=development`): `dev-tenant` with a fixed invitation token (`dev-invitation-token-fixed`)

### 8. Start the server

```bash
pnpm --filter @corehub/api-iam dev
```

### 9. Verify

```bash
curl http://localhost:8080/healthz
# Expected: {"status":"ok","service":"iam"}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8080` | HTTP port the server listens on |
| `NODE_ENV` | No | `development` | Runtime environment (`development` \| `production` \| `test`) |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3001` | Comma-separated list of allowed CORS origins |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `JWT_PRIVATE_KEY_PATH` | **Yes** | — | Path to RSA private key PEM file (PKCS8) |
| `JWT_PUBLIC_KEY_PATH` | **Yes** | — | Path to active RSA public key PEM file (SPKI) |
| `JWT_ACTIVE_KID` | **Yes** | — | Key ID for the active signing keypair (e.g. `key-2026-01`) |
| `JWT_PREVIOUS_PUBLIC_KEY_PATH` | No | — | Path to previous public key PEM (rotation — keep old tokens valid) |
| `JWT_PREVIOUS_KID` | No | — | Key ID for the previous public key (required if `JWT_PREVIOUS_PUBLIC_KEY_PATH` is set) |
| `JWT_ACCESS_TOKEN_TTL_SECONDS` | No | `900` | Access token lifetime in seconds (default: 15 min) |
| `JWT_REFRESH_TOKEN_TTL_SECONDS` | No | `604800` | Refresh token lifetime in seconds (default: 7 days) |
| `JWT_ISSUER` | No | `https://iam.corehub.com` | JWT `iss` claim |
| `JWT_AUDIENCE` | No | `corehub-hub` | JWT `aud` claim for access tokens |
| `JWT_OTP_VERIFICATION_AUDIENCE` | No | `otp-verification` | JWT `aud` claim for OTP verification tokens |
| `JWT_OTP_VERIFICATION_TTL_SECONDS` | No | `300` | OTP verification token lifetime in seconds |
| `OTP_EMAIL_PROVIDER` | No | `stub` | OTP email delivery provider (`stub` \| `resend`) |
| `OTP_SMS_PROVIDER` | No | `stub` | OTP SMS delivery provider (`stub` \| `twilio`) |
| `OTP_TTL_SECONDS` | No | `300` | OTP code lifetime in seconds |
| `OTP_MAX_ATTEMPTS` | No | `5` | Max OTP verification attempts before lockout |
| `OTP_LOCKOUT_SECONDS` | No | `900` | OTP lockout duration in seconds |
| `OTP_RESEND_COOLDOWN_SECONDS` | No | `30` | Minimum seconds between OTP resend requests |
| `EMAIL_PROVIDER` | No | `stub` | Transactional email provider (`stub` \| `resend`) |
| `EMAIL_FROM` | No | `no-reply@corehub.com` | From address for outgoing emails |
| `RESEND_API_KEY` | Conditional | — | Required when `OTP_EMAIL_PROVIDER=resend` or `EMAIL_PROVIDER=resend` |
| `BANCARD_PROVIDER` | No | `stub` | Bancard payment provider (`stub` \| `real`) |
| `BANCARD_API_KEY` | Conditional | — | Required when `BANCARD_PROVIDER=real` |
| `BANCARD_API_URL` | No | `https://vpos.infonet.com.py` | Bancard API base URL |
| `BANCARD_WEBHOOK_SECRET` | **Yes** | — | Webhook signature secret (min 16 chars) |
| `BANCARD_RETURN_URL` | No | `http://localhost:3001/onboarding/payment/return` | Payment return URL for the frontend |
| `BANCARD_SHOP_PROCESS_PREFIX` | No | `corehub` | Prefix for Bancard shop process IDs |
| `PDF_PROVIDER` | No | `stub` | PDF generation provider (`stub` \| `react-pdf`) |
| `STORAGE_PROVIDER` | No | `stub` | File storage provider (`stub` \| `s3`) |
| `STORAGE_STUB_DIR` | No | `/tmp/iam-storage` | Local directory for stub storage |
| `AWS_BUCKET` | Conditional | — | Required when `STORAGE_PROVIDER=s3` |
| `AWS_REGION` | Conditional | — | Required when `STORAGE_PROVIDER=s3` |
| `AWS_ACCESS_KEY_ID` | No | — | AWS credentials for S3 |
| `AWS_SECRET_ACCESS_KEY` | No | — | AWS credentials for S3 |
| `IDEMPOTENCY_TTL_SECONDS` | No | `86400` | Idempotency record lifetime (default: 24 h) |
| `DEVICE_TRUST_TTL_SECONDS` | No | `5184000` | Device trust lifetime (default: 60 days) |
| `DRAFT_TTL_SECONDS` | No | `604800` | Onboarding draft lifetime (default: 7 days) |
| `RESUME_TOKEN_TTL_SECONDS` | No | `604800` | Draft resume token lifetime (default: 7 days) |
| `RESERVED_TENANT_SLUGS` | No | `www,api,app,...` | Comma-separated list of slugs that cannot be used as tenant slugs |
| `SUPERADMIN_EMAIL` | No | `admin@corehub.com` | SuperAdmin email created by `db:seed` |
| `SUPERADMIN_PASSWORD` | No | `Change-me-in-production!` | SuperAdmin password created by `db:seed` |

---

## Connecting the Frontend

To point `apps/hub` at the real IAM instead of the MSW mocks:

```bash
# apps/hub/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
```

No code changes are needed in the frontend. The MSW mock layer is automatically bypassed when this variable is set.

> **Note**: `apps/hub` runs on port `3001`, which is the same as `@internal/api-example`. Do not run both simultaneously. The IAM service runs on port `8080`.

---

## Running Tests

```bash
# Run all tests once
pnpm --filter @corehub/api-iam test

# Watch mode (re-runs on file changes)
pnpm --filter @corehub/api-iam test:watch
```

Tests use Vitest 3. Test files are co-located with source files (`*.test.ts`).

---

## Common Issues

### Port 8080 already in use

Change the port via the `PORT` env var:

```env
PORT=8090
```

### Prisma client not generated

```bash
pnpm --filter @corehub/api-iam db:generate
```

Run this after any change to `prisma/schema.prisma`.

### JWT key files not found

```bash
npx tsx src/scripts/generate-dev-keys.ts
```

Then update `JWT_PRIVATE_KEY_PATH` and `JWT_PUBLIC_KEY_PATH` in `.env` to point to the generated files.

### Database connection refused

Ensure Docker is running and the Postgres container is healthy:

```bash
docker compose up -d
docker compose ps  # check Status is "healthy"
```

Reset the database if needed:

```bash
docker compose down -v && docker compose up -d
```

---

## Background Jobs

Five cron jobs run in-process via `node-cron`. They are disabled in the `test` environment.

| Job | Schedule | Description |
|---|---|---|
| OTP cleanup | Every 5 minutes (`*/5 * * * *`) | Deletes expired rows from `otp_codes` |
| Password reset token cleanup | Every 10 minutes (`*/10 * * * *`) | Deletes expired rows from `password_reset_tokens` |
| Idempotency record cleanup | Every hour (`0 * * * *`) | Deletes expired rows from `idempotency_records` |
| Refresh token cleanup | Every hour (`0 * * * *`) | Deletes expired rows from `refresh_tokens` |
| Abandoned draft cleanup | Daily at 03:00 (`0 3 * * *`) | Deletes expired rows from `onboarding_drafts` |

All jobs run at server startup. No external scheduler is required.

---

## Monitoring Endpoints

| Endpoint | Description |
|---|---|
| `GET /healthz` | Liveness probe — returns `{"status":"ok","service":"iam"}` |
| `GET /openapi.json` | Full OpenAPI 3.1 specification (auto-generated by `@hono/zod-openapi`) |
| `GET /.well-known/jwks.json` | Public JWK set for JWT verification (Cache-Control: `max-age=300`) |

---

## Adminer (Database UI)

Adminer is available at **http://localhost:8081** when `docker compose` is running.

| Field | Value |
|---|---|
| System | PostgreSQL |
| Server | `postgres` |
| Username | `corehub` |
| Password | `corehub_dev_password` |
| Database | `corehub_iam` |
