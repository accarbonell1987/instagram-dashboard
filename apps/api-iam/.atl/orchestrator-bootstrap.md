# Orchestrator Bootstrap — apps/api-iam

> Este archivo es el primer prompt para una sesión orquestadora SDD que va a construir
> `apps/api-iam` — el microservicio Node de Identity & Access Management para Corehub.

## Tu rol

Sos el **orquestador SDD** para el change `iam-bootstrap`. Trabajás en paralelo a otra
sesión que está construyendo el frontend (`apps/hub`). **NO TOCAR** nada fuera de
`apps/api-iam/` y `packages/database/` (este último solo si necesitás extender schemas
compartidos — coordinar con el usuario antes).

## Lo que estás construyendo

Microservicio Node que implementa el contrato OpenAPI definido en
`apps/hub/.atl/api-contract.yaml`. Cubre:

- **Identity**: users, sessions, JWT RS256, refresh tokens, device trust
- **Auth**: login (2FA con OTP), primer login, recuperación de contraseña, logout
- **Tenants**: multi-tenant con schema-per-tenant en Postgres
- **Onboarding**: wizard server-side state machine (6 pasos), drafts, concurrencia optimista
- **Pagos**: integración Bancard vPOS Tradicional (webhook + polling)
- **Invitations**: accept flow (magic-link token)
- **Billing**: URLs firmadas para PDFs de factura y contrato

**NO cubre**: telefonía, billing recurrente, audit logs avanzados, RBAC fino.
Son fases futuras.

## Stack locked (no negociable)

- **Hono 4.x** + `@hono/zod-openapi` — validación bidireccional request + response, OpenAPI auto-generado
- **Prisma 6.x** + **PostgreSQL 16** (Docker Compose en `apps/api-iam/docker-compose.yml`)
- **JWT RS256** con `jose` — claims: `sub`, `tenant_id`, `tenant_uuid`, `role`, `exp`, `iat`, `jti`, `iss`, `aud`
- **argon2** — hash de contraseñas (no bcrypt)
- **Schema-per-tenant**: schema `public` para datos cross-tenant; schemas `tenant_{slug}` creados
  al submit del wizard en una única transacción con rollback completo si falla
- **OTP** via interface + adapters (stub | Resend | Twilio); inicial: stub que loguea el código
- **Bancard** via interface + adapters (stub | real); inicial: stub que aprueba siempre
- **PDFs** server-side: decidir en sdd-design entre `@react-pdf/renderer` o Puppeteer
- **Idempotency**: tabla `idempotency_records (key, request_hash, response_body, status_code, created_at, expires_at)`, TTL 24h
- **Tests**: Vitest 3; objetivo ≥ 80% cobertura en services + repositories

## Cómo recuperar contexto desde Engram

El frontend ya completó todo el SDD (explore → propose → spec → design → tasks → apply).
Ese trabajo es tu fuente de verdad. Comandos para recuperarlo:

```
mem_search(query: "sdd/tenant-onboarding-auth/design/api-contract", project: "front-corehub-core")
mem_get_observation(id: <returned-id>)  # contrato OpenAPI completo

mem_search(query: "sdd/tenant-onboarding-auth/spec", project: "front-corehub-core")
mem_get_observation(id: <returned-id>)  # 6 dominios, 15 reqs, 52 scenarios

mem_search(query: "sdd/tenant-onboarding-auth/design/sequence-diagrams", project: "front-corehub-core")
mem_get_observation(id: <returned-id>)  # 11 diagramas Mermaid

mem_search(query: "sdd/tenant-onboarding-auth/design/backend-requirements", project: "front-corehub-core")
mem_get_observation(id: <returned-id>)  # guía de implementación — ADAPTAR a Node, no copiar literal
```

También disponible en disco (read-only):

- `apps/hub/.atl/api-contract.yaml` — contrato OpenAPI (fuente de verdad para shapes)
- `apps/hub/.atl/sequence-diagrams.md` — 11 diagramas Mermaid de los flujos
- `apps/hub/.atl/backend-requirements.md` — comportamiento, persistencia, TTLs, idempotencia
  (escrito para Spring Boot — adaptar a Node/Hono/Prisma, no copiar literal)

## Reglas de coordinación con la sesión frontend

1. **`apps/hub/.atl/api-contract.yaml` es READ-ONLY para vos.** Si encontrás un bug
   o ambigüedad en el contrato, parar y avisar al usuario. No "interpretar" ni asumir.
2. **No tocar `apps/hub/**`** — es territorio del orquestador frontend.
3. **Topic keys Engram**: usás prefijo `sdd/iam-bootstrap/*`. No escribir en
   `sdd/tenant-onboarding-auth/*`.
4. **Branches/commits**: prefijo `feature/iam-*` para no chocar con ramas frontend.
5. **Si el contrato tiene typos, schemas faltantes o comportamiento ambiguo**: documentarlo
   en `apps/api-iam/.atl/contract-issues.md` y avisar al usuario antes de proceder.

## ADRs que el orquestador DEBE cerrar en sdd-design

Estas decisiones afectan la implementación y no pueden dejarse abiertas:

- **ADR-1**: Generación de PDFs — `@react-pdf/renderer` (más liviano, SSR-friendly) vs Puppeteer (más fiel al HTML, más pesado). Recomendado: `@react-pdf/renderer` para plantillas simples.
- **ADR-2**: Proveedor de email inicial — Resend (DX excelente, moderno) vs SendGrid (usado en backend-requirements.md). Recomendado: Resend para el stub, con adaptador intercambiable.
- **ADR-3**: Runner de migraciones por tenant — Prisma con `$executeRaw` vs runner custom. Recomendado: custom runner con SQL crudo, ya que Prisma no soporta schemas dinámicos nativamente.
- **ADR-4**: Rate limiting — en memoria con `hono/rate-limiter` (solo en desarrollo/staging) vs Redis. Recomendado: abstracción con adapter, stub en memoria por defecto.
- **ADR-5**: Generación de PDFs sync vs async en submit. Ver §9 de backend-requirements.md. Recomendado: sync si p95 < 2s; fallback async.

## Flujos críticos que deben funcionar al 100%

Validar contra los 11 diagramas de `apps/hub/.atl/sequence-diagrams.md`:

1. Login (usuario recurrente) — credenciales → OTP → sesión
2. Login — bloqueo por intentos fallidos (5 intentos → 15 min)
3. Primer login (representante del wizard) — OTP → set password → sesión
4. Primer login (usuario invitado) — token → set password → sesión
5. Registro con wizard — 6 pasos → Bancard → submit → provisioning de tenant
6. Reanudación del wizard por email (token opaco → draftId)
7. Pago Bancard — webhook + polling
8. Timeout de pago — 60s sin confirmación
9. Refresh silencioso del JWT en 401 (single-flight, replay detection)
10. Logout (broadcast multi-pestaña — el backend invalida la familia de refresh)
11. Tenant mismatch → 403

## Lo que ya está hecho (el scaffolding)

- `apps/api-iam/package.json` — deps instaladas tras `pnpm install`
- `apps/api-iam/tsconfig.json` — extiende `@core/config/typescript/node`
- `apps/api-iam/src/index.ts` — placeholder con `GET /healthz`
- `apps/api-iam/prisma/schema.prisma` — placeholder con comentarios de diseño
- `apps/api-iam/docker-compose.yml` — Postgres 16 + Adminer
- `apps/api-iam/.env.example` — todas las variables necesarias
- `apps/api-iam/CLAUDE.md` — convenciones y estructura objetivo
- Este archivo

## Lo que NO está hecho (tu trabajo)

- Schema Prisma completo (public schema + template de tenant schema)
- Runner de migraciones schema-per-tenant
- Config (`src/config.ts`) con validación Zod
- Error types (`src/errors.ts`) con Problem Details (RFC 7807)
- Middleware: error-handler, request-id, auth-guard, idempotency
- Todos los endpoints del contrato OpenAPI mapeados a routes/services/repositories
- Auth completa
- Adapters (OTP, Bancard, PDF, Email)
- Webhook Bancard (`POST /webhooks/bancard`)
- Background tasks (cleanup de drafts expirados, OTPs, idempotency records)
- Tests
- Documentación operativa en `apps/api-iam/.atl/`

## Output esperado al final del SDD

Al cerrar `iam-bootstrap`, se espera que:

1. `GET http://localhost:8080/healthz` → `{ status: "ok", service: "iam" }`
2. Todos los endpoints del contrato OpenAPI implementados y funcionales
3. El frontend puede deshabilitar MSW configurando `NEXT_PUBLIC_API_URL=http://localhost:8080`
   y trabajar contra el IAM real **sin cambios de código en `apps/hub/`**
4. Los 11 flujos de `sequence-diagrams.md` verificados manualmente o con tests
5. Cobertura de tests: ≥ 80% en `services/` y `repositories/`
6. `apps/api-iam/.atl/` con: runbook operativo, guía de rotación de JWT keys,
   guía para agregar un tenant manualmente

## Cómo arrancar

1. Corroborá que `pnpm install` ya se ejecutó en la raíz del monorepo
2. Levantá la base de datos: `cd apps/api-iam && docker compose up -d`
3. Ejecutá `/sdd-init` — esto detecta el stack y guarda el contexto en Engram
4. Confirmá modo **interactivo** + artifact store **engram**
5. Ejecutá `/sdd-new iam-bootstrap` — arranca explore + proposal
6. Seguí las fases: spec → design → tasks → apply (en batches) → verify → archive

Cuando estés listo para arrancar, decime **"go"** o **"listo"**.
