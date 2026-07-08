# apps/hub — Corehub Hub

Portal multi-tenant de Corehub. Implementa autenticación, onboarding de tenants,
invitaciones, administración de organización y billing. Next.js 15 App Router + React 19 + Turbopack. Puerto 3001.

> **LEER ANTES de cualquier tarea** — sección "Key Conventions" y "Module Map" abajo.

## Stack local

- **Framework**: Next.js 15 App Router, React 19
- **Estilos**: Tailwind CSS v4
- **Forms**: React Hook Form + Zod (v3)
- **HTTP**: `apiFetchWithInterceptors` directo (no CrudService/coreServices — ver Key Conventions)
- **State**: Zustand (identity session store)
- **Testing**: Vitest 3 (unit, co-locado) + Playwright 1.50 (E2E, `e2e/`)
- **Mocks**: MSW 2.x browser worker (dev only, `NEXT_PUBLIC_API_MOCKING=enabled`)

## Estructura

```
apps/hub/
├── .atl/                      # Artefactos SDD (contract, design docs)
│   ├── api-contract.yaml      # OpenAPI 3.1 — source of truth del contrato
│   ├── auth-design.md         # Decisiones de diseño de autenticación
│   ├── mock-strategy.md       # Estrategia MSW
│   └── sequence-diagrams.md   # Diagramas de flujo
├── e2e/                       # Tests Playwright
│   ├── a11y.spec.ts           # Auditoría WCAG 2.2 (requiere server vivo)
│   ├── login.spec.ts
│   ├── wizard.spec.ts
│   └── ...
├── lighthouserc.cjs           # Config Lighthouse CI
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (portal)/          # Rutas autenticadas (/, /settings…)
│   │   ├── (public)/          # Rutas públicas (/login, /signup…)
│   │   ├── layout.tsx         # Root layout (ThemeProvider, Providers)
│   │   └── providers.tsx      # AuthProvider + MSW guard
│   ├── lib/
│   │   ├── api/               # HTTP layer
│   │   │   ├── client.ts      # apiFetch — fetch wrapper tipado
│   │   │   ├── errors.ts      # ApiError hierarchy
│   │   │   ├── idempotency.ts # generateIdempotencyKey / get / reset
│   │   │   ├── interceptors.ts# apiFetchWithInterceptors — token refresh automático
│   │   │   ├── plans.ts       # listPlans() — helper para /plans
│   │   │   └── types.ts       # Generado de api-contract.yaml (NO editar)
│   │   └── mocks/             # MSW: browser.ts, server.ts, db.ts, handlers/, seed.ts
│   └── modules/               # Screaming Architecture (dominio > técnica)
│       ├── identity/
│       ├── authentication/
│       ├── tenant-onboarding/
│       ├── invitations/
│       ├── admin/
│       └── billing/
```

## Module Map

| Module              | Path                             | Responsibility                                                                                                                       |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `identity`          | `src/modules/identity/`          | Session store (Zustand), tokenHolder, RequireAuth/RequireRole guards, useSession hook                                                |
| `authentication`    | `src/modules/authentication/`    | Login, OTP, first-login, password recovery flows + forms                                                                             |
| `tenant-onboarding` | `src/modules/tenant-onboarding/` | Signup wizard (6 steps), draft service, wizard state machine, payment polling                                                        |
| `invitations`       | `src/modules/invitations/`       | Invitation preview + accept flow                                                                                                     |
| `admin`             | `src/modules/admin/`             | Settings de organización (nombre, plan actual), gestión de equipo (invitar, suspender, eliminar miembros), solicitudes de cambio de plan. Services: `organization.service.ts`, `member.service.ts`, `invitation.service.ts`, `plan-change.service.ts` |
| `billing`           | `src/modules/billing/`           | Plan actual (BillingPlanSection), método de pago (PaymentMethodSection), historial de facturas (InvoicesSection). Services: `billing.service.ts`, `document.service.ts` |

## Key Conventions (hub-specific)

- **tokenHolder**: Module-level singleton en `identity/session/token.ts`. Single-flight refresh deduplication. NO usar directamente en componentes — usar `useSession()`.
- **Token race condition (fixed)**: `AuthProvider` calls `refreshSession()` on every mount when unauthenticated. During onboarding, after the Bancard stub full-page redirect, `refreshSession()` runs concurrently with `submitDraft`. If refresh fails while `submitDraft` has already set a new token, `executeRefresh()` must NOT clear it. Fixed in `identity/session/refresh.ts`: snapshot token before fetch, only clear if `getAccessToken() === tokenAtStart`.
- **Bancard stub causes full-page navigation**: stub `redirectUrl` is `http://localhost:8080/__stub/bancard/approve?...` (different origin from hub at `localhost:3001`) → `window.location.href` instead of `router.push` → full page reload → all module-level state cleared.
- **submitDraft sets the access token**: `draft.service.ts:submitDraft` calls `setAccessToken(fromJwt(result.accessToken))` and `setSessionState(authenticated)` after a successful submit. This is the only place where the onboarding flow establishes a session. The billing `/documents/{id}/signed-url` endpoint requires this token.
- **Wizard machine**: Pure reducer en `tenant-onboarding/state/wizard-machine.ts`. Sin side effects — las transiciones de step son funciones puras.
- **Idempotency**: `lib/api/idempotency.ts` — cada step mutante del wizard genera/persiste una key por `(draftId, step)`. La key de pago usa contador de intentos. `apiFetchWithInterceptors` auto-genera `Idempotency-Key` para todos los POST/PATCH/PUT/DELETE.
- **MSW**: Activado con `NEXT_PUBLIC_API_MOCKING=enabled`. Escenarios switchables via dev widget o `?msw=scenario-name` query param. Desactivar para trabajar contra `api-iam` real.
- **apiFetchWithInterceptors**: Todas las llamadas API de producción usan este wrapper (no `apiFetch` directo). Maneja token refresh automático, inyecta `Idempotency-Key` en mutaciones, y mapea errores HTTP a la jerarquía `ApiError`.
- **Errors**: ApiError hierarchy en `lib/api/errors.ts`. `ValidationError` usa `errors: ValidationErrorDetail[]` (RFC 7807 array format).
- **NO Cookies para auth** — tokens en memory únicamente. MSW opera a nivel fetch.
- **Port**: 3001 (hub posee este puerto). `@internal/api-example` se movió a 3005, así que ya no colisionan.
- **Providers render**: `providers.tsx` retorna `<></>` mientras MSW arranca — es intencional (no spinner).
- **Per-section loading**: Cada sección de settings (OrganizationCard, PaymentMethodSection, InvoicesSection) gestiona su propio `useEffect` + estado de carga. No hay loading global de página.
- **Plain `<table>` para listas tabulares**: Facturas e invitaciones usan `<table>` nativo (no componentes Table de `@core/ui`). Ver `invitations-list.tsx` y `invoices-section.tsx` como referencia.
- **Billing stubs**: Los endpoints de billing en `api-iam` son stubs que retornan estado vacío (`paymentMethod: null`, `items: []`). La integración real con Bancard para tokenización de tarjetas es trabajo futuro.
- **`session.role`**: El rol está en `session.role` (no en `session.user.role`). Usar `useSession()` para leer el rol en componentes.
- **RequireRole**: `<RequireRole role={['TenantAdmin', 'SuperAdmin']}>` — envuelve secciones y rutas que solo son visibles para admins. Redirige a `/` si el rol no está autorizado.

## Scripts disponibles

| Script             | Comando                                    |
| ------------------ | ------------------------------------------ |
| Dev (Turbopack)    | `pnpm --filter @corehub/hub dev`           |
| Build              | `pnpm --filter @corehub/hub build`         |
| Tests unitarios    | `pnpm --filter @corehub/hub test`          |
| Tests E2E          | `pnpm --filter @corehub/hub test:e2e`      |
| Typecheck          | `pnpm --filter @corehub/hub type-check`    |
| Codegen (types.ts) | `pnpm --filter @corehub/hub openapi-types` |

## Onboarding — Draft Recovery

When `POST /onboarding/draft/{draftId}/submit` returns a conflict error (`onboarding.ruc_already_exists` or `onboarding.email_already_exists`), the user needs to fix their data and retry. The recovery flow:

1. `useDraftSubmission` sets `conflictStep` based on `error.backendCode`
2. `summary-step.tsx` renders an error UI with an "Editar datos" button
3. Clicking → `recoverDraft(draftId, 'company')` → `PATCH /onboarding/draft/{draftId}/recover`
4. Backend clears `data.company` from the draft JSON
5. `refresh()` is called → `deriveCurrentStep` returns `'company'` (company is null) → wizard auto-redirects to the company step

Note: Backend currently only supports recovering to `'company'` step. For `representative` conflicts, also recover to `'company'` (clears company data, user must re-enter both).

> `types.ts` en `src/lib/api/types.ts` se genera de `.atl/api-contract.yaml`.
> **NO editar manualmente** — siempre regenerar con `openapi-types` tras cambiar el contrato.

## Contrato API

- Archivo: `.atl/api-contract.yaml` (OpenAPI 3.1)
- Versión actual: **1.6.0**
- Lint: `pnpm --package=@redocly/cli dlx redocly lint .atl/api-contract.yaml`
- Cambios al contrato requieren PR coordinado con el equipo backend (`apps/api-iam`).

## Testing

### Vitest (unit)

- Tests co-locados: `foo.ts` → `foo.test.ts` en el mismo directorio
- Setup: `vitest.setup.ts` — MSW server lifecycle + testing-library/jest-dom
- Config: `vitest.config.ts`
- **Ejecutar desde `apps/hub/`**: `npx vitest run` — los alias `@/` se resuelven desde `vitest.config.ts:root`
- **442 tests en 63 archivos** (estado post-billing + cleanup)

### Playwright (E2E)

- Config: `playwright.config.ts` — webServer con `NEXT_PUBLIC_API_MOCKING=enabled`
- Los specs E2E usan MSW (browser worker) — no necesitan backend real
- `e2e/a11y.spec.ts` — requiere server vivo (`next start`); no corre en CI básico
- Config Lighthouse CI: `lighthouserc.cjs`

## A11y y Performance

- **A11y spec**: `e2e/a11y.spec.ts` — axe-core WCAG 2.2 Level A+AA en `/login` y `/recover`
- **Lighthouse CI**: `lighthouserc.cjs` — performance ≥ 0.9 (warn), accessibility ≥ 0.9 (error)
- MSW no aparece en bundles de producción (tree-shaking via dynamic import condicional)

## Settings — Rutas y acceso

| Ruta                           | Módulo      | Roles requeridos                |
| ------------------------------ | ----------- | ------------------------------- |
| `/settings/organization`       | `admin`     | TenantAdmin, SuperAdmin         |
| `/settings/team`               | `admin`     | TenantAdmin, SuperAdmin         |
| `/settings/billing`            | `billing`   | TenantAdmin, SuperAdmin         |

El layout de settings filtra los NavLinks por rol via `useSession()`. Los NavLinks con `requiresRole` solo aparecen si el rol del usuario está en la lista.
