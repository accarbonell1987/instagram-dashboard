# Documentos de Diseño — Corehub Hub

Artefactos SDD del portal multi-tenant. Fuente de verdad para el contrato API
y las decisiones de arquitectura del frontend.

**Backend**: `apps/api-iam` (Hono 4.x + `@hono/zod-openapi`, Node.js 22, Puerto 8080)
**Frontend**: `apps/hub` (Next.js 15 App Router, Puerto 3001)

## Documentos

| Archivo | Propósito | Audiencia |
|---|---|---|
| [api-contract.yaml](./api-contract.yaml) | OpenAPI 3.1 — contrato de endpoints (v1.6.0) | Ambos |
| [auth-design.md](./auth-design.md) | Arquitectura del frontend: auth, sesión, token | Devs frontend |
| [mock-strategy.md](./mock-strategy.md) | Configuración de la capa de mock MSW | Devs frontend |
| [sequence-diagrams.md](./sequence-diagrams.md) | Diagramas Mermaid de cada flujo | Ambos |
| [onboarding-flow.md](./onboarding-flow.md) | Flujo de onboarding: 6 pasos, draft, pago, submit | Ambos |
| [backend-requirements.md](./backend-requirements.md) | Especificación detallada de endpoints | Devs backend |
| [e2e-test-plan.md](./e2e-test-plan.md) | Plan de tests E2E con Playwright | QA / devs frontend |

## Inicio rápido

**Trabajar en el frontend:**
1. Leer `CLAUDE.md` del hub para el mapa de módulos y convenciones.
2. Activar MSW: `NEXT_PUBLIC_API_MOCKING=enabled` en `.env.local`.
3. Generar tipos desde el contrato: `pnpm --filter @corehub/hub openapi-types`.

**Trabajar en el backend:**
1. Leer `CLAUDE.md` de `api-iam` para estructura, convenciones y endpoints.
2. El contrato `api-contract.yaml` es READ-ONLY para `api-iam` — cualquier cambio se coordina desde el frontend.
3. Correr: `docker compose up -d && pnpm --filter @corehub/api-iam dev`.

## Versiones del contrato

| Versión | Cambios |
|---------|---------|
| 1.6.0 | User.status en JWT + /auth/me; bloqueo first-login en login |
| 1.5.0 | Billing: PaymentMethod, InvoiceList, signed-url para facturas |
| 1.4.x | Plan change: PlanChangeRequest, contact-first flow |
| 1.3.x | Admin org: members CRUD, soft delete, suspend/activate |
| 1.2.x | Invitations: create, revoke, accept |
| 1.1.1 | Auth completo, onboarding 6 pasos, Bancard webhook |

## Convenciones transversales

- **Autenticación**: JWT RS256, access token 15 min + refresh token 7 días, rotación en cada uso.
- **Multi-tenancy**: schema-per-tenant. `public` para usuarios/sesiones/planes. `tenant_{slug}` para datos de negocio.
- **Idempotencia**: header `Idempotency-Key` en todas las mutaciones. `apiFetchWithInterceptors` lo genera automáticamente.
- **Errores**: `application/problem+json` (RFC 7807) en todos los errores. `ApiError` hierarchy en el frontend.
- **Tenant resolution**: subdomain en producción (`{tenant}.hub.corehub.com`), path en dev (`localhost:3001/t/{slug}/…`).
