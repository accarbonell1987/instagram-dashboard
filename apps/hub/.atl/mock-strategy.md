# Estrategia de Mock — apps/hub

> Complemento de `api-contract.yaml` y `auth-design.md`.

## 1. Por qué MSW (y no adaptadores de servicio)

El patrón de mock-adapter de `@core/core` es ideal para tests unitarios de servicios
pero opera por debajo de `fetch`. Para un frontend que:

- Genera headers de idempotencia en interceptores
- Lee/escribe cookies `httpOnly` para el refresh
- Quiere tests Playwright que reflejen el comportamiento real de la red
- Quiere cambiar "escenarios" desde un widget de dev sin tocar código

…necesitamos interceptar en la **capa de red**. MSW es el estándar:

| Propiedad | MSW | Adaptador de servicio |
|---|---|---|
| Intercepta en | `fetch`/XHR | Método de servicio |
| Ve headers/cookies | Sí | No (los servicios no conocen HTTP) |
| Funciona en navegador | Sí (Service Worker) | N/A |
| Funciona en Node (Vitest, Playwright) | Sí (`setupServer`) | Sí |
| Realista para E2E | Sí | No |
| Reutilizable en smoke de producción | Sí (con `passthrough`) | No |

**Decisión**: MSW en todas partes — dev, Vitest, Playwright. Los adaptadores de
servicio siguen disponibles en `@core/core` pero Hub no los usa en v1.

## 2. Configuración

### Dependencias

```json
{
  "devDependencies": {
    "msw": "^2.6.0",
    "@mswjs/data": "^0.16.2",
    "@bundled-es-modules/cookie": "^2.0.0"
  }
}
```

### Estructura de archivos (en `apps/hub/src/lib/mocks/`)

```
mocks/
├── browser.ts                # Configuración del worker para navegador
├── server.ts                 # Node setupServer (Vitest, Playwright)
├── index.ts                  # Inicializador condicional
├── db.ts                     # Factory de @mswjs/data (entidades en memoria)
├── seed.ts                   # Datos semilla por defecto
├── handlers/
│   ├── index.ts              # Compone todos los handlers
│   ├── auth.ts
│   ├── onboarding.ts
│   ├── plans.ts
│   ├── invitations.ts
│   ├── billing.ts
│   └── identity.ts
├── scenarios/
│   ├── index.ts              # Registro de escenarios
│   ├── happy.ts
│   ├── otp-failure.ts
│   ├── otp-locked.ts
│   ├── account-locked.ts
│   ├── payment-pending.ts
│   ├── payment-cancelled.ts
│   ├── payment-failed.ts
│   ├── payment-timeout.ts
│   ├── invitation-expired.ts
│   ├── invitation-used.ts
│   ├── draft-expired.ts
│   ├── pdf-error.ts
│   └── session-expired.ts
└── widget/
    ├── mock-widget.tsx       # Widget flotante solo para dev
    └── mock-widget.module.css
```

### Archivo del worker público

`apps/hub/public/mockServiceWorker.js` — generado mediante:

```bash
pnpm --filter hub exec msw init public/ --save
```

Commiteado en el repositorio. Se recompila al actualizar `msw`.

## 3. Activación

### Modo de desarrollo (automático)

```ts
// apps/hub/src/lib/mocks/index.ts
export async function maybeStartMocks() {
  if (process.env.NEXT_PUBLIC_API_MOCKING !== 'enabled') return
  if (typeof window === 'undefined') {
    const { server } = await import('./server')
    server.listen({ onUnhandledRequest: 'warn' })
  } else {
    const { worker } = await import('./browser')
    await worker.start({ onUnhandledRequest: 'warn' })
  }
}
```

Llamado una vez desde `app/providers.tsx` dentro de un `useEffect` protegido
por `process.env.NODE_ENV === 'development'`.

### Tree-shake en producción

- El `import('./browser')` dinámico está dentro de una rama `if` que el bundler
  puede demostrar que es falsa en producción:
  ```ts
  if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') { /* ... */ }
  ```
- `NEXT_PUBLIC_API_MOCKING` no está definida en el entorno de producción, la
  comparación literal evalúa a `'disabled'`, y el bundler elimina toda la rama.
- Paso de CI: `pnpm --filter hub bundle-analyze` verifica que no haya chunk de
  `msw` en la salida de producción.

### Modo de test (Vitest, Playwright)

Vitest:
```ts
// vitest.setup.ts
import { server } from './src/lib/mocks/server'
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

Playwright (CI):
```ts
// playwright.config.ts
globalSetup: './tests/e2e/global-setup.ts'
```

```ts
// tests/e2e/global-setup.ts
import { server } from '../../src/lib/mocks/server'
export default async function () {
  server.listen({ onUnhandledRequest: 'bypass' })
}
```

Playwright (staging — API real):
```bash
NEXT_PUBLIC_API_MOCKING=disabled PLAYWRIGHT_BASE_URL=https://hub.staging.corehub.com pnpm playwright test
```

## 4. Widget de desarrollo

Un control flotante en la esquina inferior derecha, renderizado solo en dev:

- Lista escenarios (grupo de radio)
- Al hacer clic → llama a `setScenario(name)` que:
  1. Escribe `localStorage.setItem('msw_scenario', name)`
  2. `worker.use(...scenarios[name])` (reemplaza los handlers)
  3. Confirmación por toast
- También lee el parámetro query `?msw=<name>` al montar (uso único, luego
  se limpia mediante `router.replace`).
- Persiste entre recargas (se re-aplica en `maybeStartMocks`).
- Plegable mediante el botón del encabezado para no cubrir la UI.

```tsx
// apps/hub/src/lib/mocks/widget/mock-widget.tsx
'use client'
import { scenarios } from '../scenarios'
import { useEffect, useState } from 'react'

export function MockWidget() {
  if (process.env.NODE_ENV !== 'development') return null
  const [active, setActive] = useState<string>('happy')
  // ... leer param query + localStorage al montar, applyScenario(active) al cambiar
}
```

## 5. Handlers de ejemplo (ejemplos desarrollados)

### Flujo feliz de login (`handlers/auth.ts`)

```ts
import { http, HttpResponse } from 'msw'
import { db } from '../db'

export const loginHandler = http.post('*/auth/login', async ({ request }) => {
  const { email, password } = await request.json() as { email: string; password: string }
  const user = db.user.findFirst({ where: { email: { equals: email } } })
  if (!user || user.passwordHash !== hash(password)) {
    return HttpResponse.json(
      { type: 'https://corehub.com/errors/unauthorized', title: 'Unauthorized', status: 401, detail: 'Invalid credentials' },
      { status: 401 },
    )
  }
  const otpId = crypto.randomUUID()
  db.otp.create({ id: otpId, userId: user.id, code: '000000', expiresAt: Date.now() + 300_000 })
  return HttpResponse.json({ otpRequired: true, otpId, otpChannel: 'email' })
})
```

### OTP inválido (`scenarios/otp-failure.ts`)

```ts
import { http, HttpResponse } from 'msw'

export const otpFailureScenario = [
  http.post('*/auth/otp/verify', () => HttpResponse.json(
    { type: '...', title: 'Validation', status: 422, code: 'otp_invalid', attemptsRemaining: 4 },
    { status: 422 },
  )),
]
```

### Envío del borrador (`handlers/onboarding.ts`)

```ts
export const submitDraftHandler = http.post('*/onboarding/draft/:id/submit', async ({ params, request }) => {
  const idemKey = request.headers.get('Idempotency-Key')
  if (!idemKey) return HttpResponse.json({ status: 400 }, { status: 400 })

  const cached = db.idempotency.findFirst({ where: { key: { equals: idemKey } } })
  if (cached) return HttpResponse.json(cached.body, { status: cached.status })

  const draft = db.draft.findFirst({ where: { id: { equals: params.id as string } } })
  if (!draft) return HttpResponse.json(/* 404 */, { status: 404 })
  if (draft.status !== 'payment_confirmed') return HttpResponse.json(/* 409 */, { status: 409 })

  const tenant = db.tenant.create({ slug: slugify(draft.companyLegalName), name: draft.companyLegalName, planId: draft.planId, status: 'active' })
  const user = db.user.create({ email: draft.representativeEmail, role: 'TenantAdmin', tenantId: tenant.id })
  const accessToken = signMockJwt({ sub: user.id, tenant_id: tenant.slug, role: 'TenantAdmin' })

  const body = {
    tenantId: tenant.id,
    tenant,
    accessToken,
    expiresIn: 900,
    documents: { invoiceUrl: '/mock/factura.pdf', contractUrl: '/mock/contrato.pdf' },
  }
  db.idempotency.create({ key: idemKey, status: 200, body })
  return HttpResponse.json(body, {
    status: 200,
    headers: { 'Set-Cookie': 'refresh_token=mock; HttpOnly; Path=/auth/refresh' },
  })
})
```

## 6. Persistencia de datos

`@mswjs/data` define los modelos:

```ts
// db.ts
import { factory, primaryKey, nullable, oneOf } from '@mswjs/data'

export const db = factory({
  tenant: { id: primaryKey(String), slug: String, name: String, planId: String, status: String },
  user: { id: primaryKey(String), email: String, role: String, tenantId: String, passwordHash: nullable(String) },
  draft: { id: primaryKey(String), status: String, currentStep: String, version: Number, planId: nullable(String), representativeEmail: nullable(String), companyLegalName: nullable(String) },
  otp: { id: primaryKey(String), userId: nullable(String), code: String, expiresAt: Number, attempts: Number, used: Boolean },
  invitation: { id: primaryKey(String), token: String, email: String, tenantId: String, role: String, expiresAt: Number, usedAt: nullable(Number) },
  idempotency: { key: primaryKey(String), status: Number, body: Object, createdAt: Number },
  payment: { id: primaryKey(String), draftId: String, status: String, redirectUrl: String },
})
```

En memoria; se reconstruye al recargar la página. Los presets de escenario llaman a
`db.tenant.create(...)`, etc. en su función de configuración.

## 7. Integración con Playwright

### CI (por defecto)

```ts
// playwright.config.ts
export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3001',
    extraHTTPHeaders: {},
  },
  webServer: {
    command: 'NEXT_PUBLIC_API_MOCKING=enabled pnpm --filter hub dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Cambio de escenario por test

```ts
import { test } from '@playwright/test'

test('account locked after 5 failures', async ({ page }) => {
  await page.goto('/login?msw=account_locked')
  // …assertions
})
```

El parámetro query `?msw=` es leído por la inicialización del widget y aplica
el escenario antes de las interacciones del test.

### Staging (API real)

```bash
NEXT_PUBLIC_API_MOCKING=disabled \
  PLAYWRIGHT_BASE_URL=https://hub.staging.corehub.com \
  pnpm --filter hub e2e:staging
```

## 8. Detección de desvío

Paso de CI (post-merge a `main`):

1. Generar tipos: `pnpm --filter hub codegen:api`
2. `git diff --exit-code apps/hub/src/lib/api/types.ts`
3. Lint del contrato: `pnpm --filter hub redocly lint apps/hub/.atl/api-contract.yaml`

Semanalmente (programado): ejecutar la suite Playwright contra staging con
mocks desactivados, alertar ante fallos (indica divergencia entre real y mock).

## 9. Idempotencia en los handlers MSW

Cada handler `POST/PATCH`:

```ts
const idemKey = request.headers.get('Idempotency-Key')
if (idemKey) {
  console.log(`[MSW] Idempotency-Key=${idemKey} method=${request.method} path=${url.pathname}`)
  const cached = db.idempotency.findFirst({ where: { key: { equals: idemKey } } })
  if (cached) return HttpResponse.json(cached.body, { status: cached.status })
}
// …handle…
db.idempotency.create({ key: idemKey, status, body, createdAt: Date.now() })
```

El escenario de test `payment_pending_retry` valida esto de extremo a extremo:
hace clic en "Pagar" dos veces y verifica que solo ocurrió un `db.payment.create`.
