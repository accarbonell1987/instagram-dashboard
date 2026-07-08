# apps/api-iam — Identity & Access Management

## Estado

**IMPLEMENTADO** — Los SDDs `iam-bootstrap` e `iam-logging` están archivados.
La API IAM es operacional con 31 endpoints, logging estructurado Pino v10, y cobertura de tests en services y repositories.

## Visión del módulo

`@corehub/api-iam` es el microservicio Node de identidad y acceso de la plataforma Corehub.
Implementa el contrato OpenAPI definido en `apps/hub/.atl/api-contract.yaml`.
Es la única fuente de verdad para autenticación, sesiones JWT, onboarding de tenants,
integración de pagos (Bancard) y generación de PDFs (factura + contrato).

**Boundary**: este servicio corre en `:8080`. El frontend (`apps/hub`) en `:3001`
lo consume exclusivamente a través del contrato OpenAPI. NO existe acoplamiento
directo entre los dos — el contrato es la interfaz.

## Stack

- **Framework**: Hono 4.x + `@hono/zod-openapi` (validación bidireccional + OpenAPI auto-generado)
- **Runtime**: Node.js 22+ via `@hono/node-server`
- **ORM**: Prisma 6.x (PostgreSQL 16)
- **Auth**: JWT RS256 con `jose`; hash de contraseñas con `argon2`
- **IDs**: `nanoid` para tokens opacos; UUIDs nativos de PostgreSQL para entidades
- **Logging**: Pino v10 (structured JSON en producción, pretty en desarrollo)
- **Jobs**: node-cron v3 (5 cron jobs de mantenimiento)
- **Tests**: Vitest 3

## Estructura de carpetas (implementada)

```
apps/api-iam/
├── src/
│   ├── index.ts              # Composition root — async function main() + await createLogger(config)
│   ├── config.ts             # Variables de entorno validadas con Zod
│   │                         #   ⚠️ Línea 93 usa console.* (logger no existe aún en ese punto)
│   ├── errors.ts             # AppError → NotFoundError, ConflictError, etc. + Problem Details (RFC 7807)
│   ├── domain/               # Interfaces TypeScript puras (User, Tenant, Draft, etc.)
│   ├── repositories/         # Interfaces + implementaciones Prisma por entidad
│   ├── services/             # Lógica de negocio (AuthService, OtpService, DraftService, etc.)
│   ├── routes/               # createRoute() por recurso (@hono/zod-openapi)
│   │   ├── auth/             # 14 endpoints Auth
│   │   ├── onboarding/       # 8 endpoints Onboarding
│   │   ├── plans/            # 2 endpoints Plans
│   │   ├── invitations/      # 2 endpoints Invitations
│   │   ├── identity/         # 1 endpoint Identity
│   │   ├── billing/          # 1 endpoint Billing
│   │   ├── webhooks/         # 1 endpoint Webhooks (Bancard)
│   │   └── well-known/       # 1 endpoint JWKS
│   ├── middleware/           # error-handler, request-id, auth-guard, idempotency, tenant-guard
│   │   └── access-log.middleware.ts  # HTTP access log via Pino (category: 'http')
│   ├── adapters/             # OTP (stub|Resend), Bancard (stub|real), PDF, Email, Storage, RateLimiter, KeyProvider
│   ├── lib/
│   │   ├── logger.ts         # createLogger() factory (async) + createSilentLogger()
│   │   └── index.ts          # Barrel
│   ├── jobs/
│   │   └── background-jobs.ts  # 5 cron jobs: cleanup OTP, password reset, idempotency, refresh tokens, drafts
│   ├── test-helpers/
│   │   └── logger.ts         # silentLogger + createMemoryLogger() para tests
│   ├── db/
│   │   ├── migration-runner.ts  # Runner de migraciones SQL para schemas de tenant
│   │   ├── with-tenant.ts       # Helper SET search_path para queries multi-tenant
│   │   ├── migrations-tenant/   # SQLs de migración de tenant schemas
│   │   └── seed.ts              # Seed de planes y datos de desarrollo
│   ├── scripts/
│   │   └── generate-dev-keys.ts # Genera claves RSA para desarrollo
│   └── types/
│       └── hono.d.ts            # Augmentación de tipos Hono (context variables)
├── prisma/
│   └── schema.prisma         # Schema Prisma (public schema)
├── .atl/                     # Artefactos SDD y documentación operativa
│   ├── orchestrator-bootstrap.md
│   ├── runbook.md
│   ├── jwt-key-rotation.md
│   ├── manual-tenant.md
│   └── logging-guide.md      # Referencia rápida del sistema de logging
├── docker-compose.yml        # Postgres 16 (5432) + Adminer (8081) para desarrollo local
├── .env.example
└── CLAUDE.md                 # Este archivo
```

## Logging Estructurado

**Library**: Pino v10 — worker-thread async writes, JSON en producción, pretty en desarrollo.

**Factory**: `createLogger(options: CreateLoggerOptions): Promise<Logger>` en `src/lib/logger.ts` — es async.
La composition root (`src/index.ts`) usa `await createLogger(config)` dentro de `async function main()`.
`createSilentLogger()` existe para uso en tests que no requieren assert de logs.

**Variables de entorno**:

| Variable | Default dev | Default prod | Descripción |
|---|---|---|---|
| `LOG_LEVEL` | `debug` | `info` | Nivel mínimo |
| `LOG_TO_CONSOLE` | `true` | `false` | Mirror a stdout |
| `LOG_FILE_PATH` | `./logs/api-iam.log` | (override) | Archivo de log |
| `LOG_FORMAT` | `pretty` | `json` | Formato consola |

**Categorías de eventos** (campo `category` en cada log entry):

- `http` — `http_request` (access log por request, emitido en `access-log.middleware.ts`)
- `auth` — `login_success`, `login_failed`, `logout`, `session_issued`, `refresh_reuse` (ERROR), `otp_required`, `password_recovery_*`, `invitation_accepted`, `first_login_completed`, `tenant_provisioned`, `provisioning_failed`
- `otp` — `otp_sent`, `otp_verified`, `otp_verify_failed`, `otp_locked`, `otp_rate_limited`
- `job` — `job_started`, `job_completed`, `job_failed` (los 5 cron jobs)
- `system` — `service_started`, `service_stopping`, `unhandled_error`

**Patrón de inyección en services**:
- El campo `logger: Logger` es **obligatorio** (no opcional) en todos los `*Deps` de services
- Cada service crea un child logger: `const log = deps.logger.child({ component: 'auth' })`
- Al emitir: `log.info({ category: 'auth', event: 'login_success', userId, tenantId }, 'login_success')`
- El evento `refresh_reuse` se loguea a nivel `ERROR` (no warn) — indica posible robo de token

**Test helpers** (`src/test-helpers/logger.ts`):
- `silentLogger` — Pino silencioso para tests sin assertions de log
- `createMemoryLogger()` — captura logs en memoria para assertions de output

**Regla de mocks en tests**:
- Usar `vi.clearAllMocks()` — **NO** `vi.restoreAllMocks()` (rompe mocks de módulos como `argon2`)

**Excepción documentada**:
- `src/config.ts:93` y `main().catch(console.error)` en `src/index.ts` usan `console.*`
- El logger no existe aún en esos puntos — es la única excepción aceptada al no-console rule

**Datos sensibles — redact automático**: `password`, `token`, `refreshToken`, `otp`, `secret`, `Authorization` header, cookies. NUNCA loguear credenciales ni tokens completos en los fields.

## Convenciones (además de las del monorepo)

Seguir todas las convenciones de `CLAUDE.md` en la raíz. Adicionalmente:

- **Errores HTTP**: usar `application/problem+json` (RFC 7807) en TODOS los errores.
  Formato: `{ type, title, status, detail?, instance?, code? }`.
- **Idempotencia**: todos los endpoints de mutación (POST, PATCH, DELETE) excepto webhooks
  requieren `Idempotency-Key: UUID`. El middleware lo valida antes de llegar al handler.
- **Sin try/catch en services**: los services lanzan errores tipados (`AppError`).
  El `errorHandler` global los captura y los convierte a `Problem Details`.
- **Adapters con interfaz**: OTP, Bancard y PDF implementan interfaces. El proveedor
  se selecciona por variable de entorno al arrancar. El stub es el default en desarrollo.
- **Schema-per-tenant**: las queries a schemas de tenant usan `SET search_path TO tenant_<slug>`
  antes de cada operación, nunca hardcodeado en el código del servicio.
- **Idempotencia de webhooks Bancard**: clave por `(process_id, status)` en `webhook_events`.
  Siempre devolver 200 a Bancard, incluso en error (ver §13 de backend-requirements.md).
- **Draft recovery**: `PATCH /onboarding/draft/:draftId/recover` — public (no auth, no idempotency). Guards: `status=payment_confirmed` AND `tenantId=null`. Clears `data.company` from draft JSON. Allows re-entry into the wizard from the company step after a provisioning conflict.
- **JWT claims obligatorios**: `sub`, `tenant_id`, `tenant_uuid`, `role`, `exp`, `iat`, `jti`, `iss`, `aud`.
- **Soft delete de usuarios**: `users.deleted_at` — jamás se borran filas. `listByTenant` filtra `{ deletedAt: null }` (incluye suspendidos). Refresh guard: si `user.deletedAt !== undefined` → 401 `auth.account_deleted`.
- **Eliminar miembro — transacción atómica**: `prisma.$transaction` hace inline `tx.user.update(deletedAt)` + `refreshTokenRepo.invalidateAllForUser(userId, tx)`. NO llamar a `userRepo.softDelete()` desde la transacción — el repo tiene su propia referencia a prisma.
- **Último admin guard**: `updateMemberStatus` cuenta admins activos con `userRepo.countActiveAdmins(tenantId)`. Si es 1 y se intenta suspender/eliminar → 409 `identity.last_admin`.
- **Plan change contact-first**: `createPlanChangeService` verifica solicitud pendiente en BD antes de crear una nueva (409 si existe). Email a `PLAN_CHANGE_NOTIFY_TO` es fire-and-forget (error de email no falla el request).

## Coordinación con apps/hub

- `apps/hub/.atl/api-contract.yaml` es **READ-ONLY** para este servicio.
  Cualquier cambio al contrato requiere coordinación explícita con el orquestador frontend.
- El MSW del frontend (`apps/hub`) se desactiva apuntando `NEXT_PUBLIC_API_URL=http://localhost:8080`.
  El frontend no debería necesitar cambios de código para trabajar contra el iam real.
- No tocar nada en `apps/hub/**`.

## Comandos útiles

```bash
# Desarrollo
docker compose up -d              # Levanta Postgres + Adminer
pnpm --filter @corehub/api-iam dev    # Arranca el servidor con hot reload

# Base de datos
pnpm --filter @corehub/api-iam db:generate   # Genera Prisma client
pnpm --filter @corehub/api-iam db:migrate    # Ejecuta migraciones
pnpm --filter @corehub/api-iam db:migrate:deploy  # Non-interactive (for AI agents — use when dev can't run migrate dev)
pnpm --filter @corehub/api-iam db:seed       # Carga datos de desarrollo

# Tests
pnpm --filter @corehub/api-iam test          # Una vez
pnpm --filter @corehub/api-iam test:watch    # Watch mode

# Adminer (UI de base de datos): http://localhost:8081
```

## Endpoints implementados (42 total)

| Grupo | Count | Rutas |
|---|---|---|
| Auth | 14 | POST /auth/login, POST /auth/login/complete, POST /auth/otp/send, POST /auth/otp/verify, POST /auth/otp/resend, POST /auth/refresh, POST /auth/logout, GET /auth/password/policy, POST /auth/password/recover/request, POST /auth/password/recover/complete, POST /auth/first-login/start, POST /auth/first-login/set-password, GET /auth/first-login/validate, GET /auth/me |
| Onboarding | 9 | POST /onboarding/draft, GET/PATCH /onboarding/draft/:id, GET /onboarding/draft/resume/:token, POST /onboarding/draft/:id/resume-link, POST /onboarding/draft/:id/payment/initiate, GET /onboarding/draft/:id/payment/status, PATCH /onboarding/draft/:id/recover, POST /onboarding/draft/:id/submit |
| Identity | 6 | GET /tenants/current, GET /tenants/current/members, PATCH /tenants/current, PATCH /tenants/current/members/:id/status, DELETE /tenants/current/members/:id, PATCH /users/me |
| Invitations | 2 | POST /invitations (crear), DELETE /invitations/:id (revocar) |
| Plans | 2 | GET /plans, GET /plans/:id |
| Plan Change | 1 | POST /tenants/current/plan-change |
| Billing | 5 | GET /billing/payment-method (**stub**→null), POST /billing/payment-method (**stub**→202), GET /billing/invoices (**stub**→vacío), GET /billing/invoices/:id/signed-url (**stub**→404), GET /billing/documents/:id/signed-url (real) |
| Webhooks | 1 | POST /webhooks/bancard |
| Well-known | 1 | GET /.well-known/jwks.json |
| Health | 1 | GET /health |

> **Billing stubs**: Los 4 endpoints nuevos de billing retornan estado vacío/nulo. Son placeholders para cuando se implemente la tokenización de tarjetas vía Bancard y la generación de facturas reales.

## Admin Org Management (2026-05-14)

Flujos de administración de organización implementados en el SDD `admin-org-flows`:

- **Equipo** — `GET /tenants/current/members` devuelve todos los miembros no eliminados (incluyendo suspendidos). Incluye campo `status: 'active' | 'suspended' | 'pending_first_login'`.
- **Suspender/Activar miembro** — `PATCH /tenants/current/members/:id/status` con guard: no se puede suspender el último admin activo (409 `identity.last_admin`).
- **Eliminar miembro** — `DELETE /tenants/current/members/:id` — soft delete atómico: `user.deletedAt = now()` + `refreshTokenRepo.invalidateAllForUser()` en una sola transacción Prisma.
- **Renombrar organización** — `PATCH /tenants/current` con body `{ name: string }`.
- **Cambio de plan** — `POST /tenants/current/plan-change` — contact-first (sin billing real): crea `PlanChangeRequest` en BD + envía email a `PLAN_CHANGE_NOTIFY_TO`. Máximo 1 solicitud pendiente por tenant (409 si ya existe).
- **Refresh guard** — `auth.service.ts:refresh()` verifica `deletedAt !== undefined` (401 `auth.account_deleted`) y `status === 'suspended'` (401 `auth.account_suspended`).
- **Soft delete**: `users.deleted_at` — `listByTenant` filtra `{ deletedAt: null }` para excluir eliminados pero incluir suspendidos.

## Schema Drift Log

| Migration | Date | What |
|---|---|---|
| `20260513200000_fix_schema_drift` | 2026-05-13 | Added `activation_token_hash` (VARCHAR 64, unique), `activation_token_expires_at` (TIMESTAMP 3), `activation_token_used` (BOOLEAN DEFAULT false) to `users` table. Changed `refresh_tokens.family_id` from UUID to VARCHAR(32) to accept nanoid() values. |
| `admin-org-flows` | 2026-05-14 | Added `users.deleted_at` (TIMESTAMP 3, nullable) for soft delete. Added `PlanChangeRequest` model + `PlanChangeRequestStatus` enum. Added `status` field to `users`. |

**Rule**: `refresh_tokens.family_id` is `@db.VarChar(32)` — use `nanoid()` (21 chars), NOT `crypto.randomUUID()` (36 chars). Using UUID caused P2022 overflow errors on submit.

## Cleanup Log

| Date | What removed | Reason |
|---|---|---|
| 2026-05-15 | `OTP_SMS_PROVIDER` from `config.ts` | Config var was parsed but never read by `adapters/index.ts` when selecting the OTP adapter. Had zero effect at runtime. |

## Documentación operativa

- `.atl/runbook.md` — Operaciones comunes, troubleshooting
- `.atl/jwt-key-rotation.md` — Rotación de claves RS256
- `.atl/manual-tenant.md` — Provisioning manual de tenants
- `.atl/logging-guide.md` — Referencia rápida del sistema de logging
