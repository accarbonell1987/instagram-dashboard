# Arquitectura del Frontend — apps/hub

> Complemento de `api-contract.yaml` y `backend-requirements.md`.
> Define el mapa de módulos, el ciclo de vida de la sesión, la máquina de
> estados del asistente y los patrones de integración para la aplicación
> Next.js Hub.

## 1. Mapa de módulos (definitivo)

```
apps/hub/src/
├── app/
│   ├── layout.tsx                          # Raíz: providers, fuentes, tema
│   ├── providers.tsx                       # SessionProvider, QueryClientProvider, ThemeProvider, MockProvider (solo dev)
│   ├── (public)/                           # Grupo de rutas: SIN autenticación requerida
│   │   ├── layout.tsx                      # Chrome público (logo, cambio de idioma). Redirige usuarios autenticados a /portal.
│   │   ├── login/page.tsx
│   │   ├── signup/
│   │   │   ├── page.tsx                    # Página de selección de plan (crea borrador, redirige a URL de paso)
│   │   │   ├── [draftId]/
│   │   │   │   └── [step]/page.tsx         # Catch-all para pasos del asistente (friendly al refresh, 6 rutas en 1 archivo)
│   │   │   └── resume/[token]/page.tsx     # Entrada de reanudación magic-link
│   │   ├── invite/[token]/page.tsx
│   │   ├── first-login/page.tsx
│   │   └── recover/
│   │       ├── page.tsx                    # Solicitud por email
│   │       └── confirm/[token]/page.tsx    # Establecer nueva contraseña
│   └── (portal)/                           # Grupo de rutas: autenticación requerida
│       ├── layout.tsx                      # AuthGuard + chrome del portal (header/sidebar actual)
│       └── page.tsx                        # Cuadrícula de apps (el src/app/page.tsx actual se mueve aquí)
│
├── middleware.ts                           # Resolución de tenant + compuerta de autenticación por grupo de rutas
│
├── modules/                                # Arquitectura por gritos (screaming architecture)
│   ├── authentication/
│   │   ├── index.ts                        # Exports públicos
│   │   ├── components/
│   │   │   ├── login-form.tsx
│   │   │   ├── otp-form.tsx                # Envuelve @core/ui InputOTP
│   │   │   ├── set-password-form.tsx
│   │   │   ├── password-policy-checklist.tsx
│   │   │   └── recover-request-form.tsx
│   │   ├── hooks/
│   │   │   ├── use-login.ts
│   │   │   ├── use-otp.ts
│   │   │   ├── use-password-policy.ts
│   │   │   └── use-recover.ts
│   │   ├── schemas/                        # Schemas Zod (también alimentan los resolvers de RHF)
│   │   │   ├── login-schema.ts
│   │   │   ├── otp-schema.ts
│   │   │   └── password-schema.ts
│   │   ├── services/
│   │   │   └── auth-api.ts                 # Wrapper delgado sobre el cliente generado
│   │   └── types.ts
│   │
│   ├── tenant-onboarding/
│   │   ├── index.ts
│   │   ├── components/
│   │   │   ├── wizard-shell.tsx            # Layout + navegación de progreso
│   │   │   ├── wizard-progress.tsx
│   │   │   └── ...
│   │   ├── steps/                          # Una carpeta por paso
│   │   │   ├── plan-selection/
│   │   │   ├── representative/
│   │   │   ├── otp-verification/
│   │   │   ├── company-data/
│   │   │   ├── payment/
│   │   │   └── summary/
│   │   ├── state/
│   │   │   ├── wizard-machine.ts           # Máquina de estados (sin xstate, reducer puro)
│   │   │   ├── idempotency.ts              # UUID v4 por paso con clave `draft:${id}:step:${n}:idem`
│   │   │   └── resume.ts
│   │   ├── services/
│   │   │   └── onboarding-api.ts
│   │   └── types.ts
│   │
│   ├── invitations/
│   │   ├── index.ts
│   │   ├── components/
│   │   │   ├── invitation-preview.tsx
│   │   │   └── accept-form.tsx
│   │   ├── services/
│   │   │   └── invitations-api.ts
│   │   └── types.ts
│   │
│   ├── identity/
│   │   ├── index.ts
│   │   ├── session/
│   │   │   ├── session-store.ts            # Zustand: { user, tenant, role, accessToken, expiresAt }
│   │   │   ├── session-provider.tsx        # Inicializa a partir del refresh en el montaje
│   │   │   └── token.ts                    # Titular del access token en memoria + refresh silencioso single-flight
│   │   ├── guards/
│   │   │   ├── require-auth.tsx            # Componente cliente para guardas de grano fino
│   │   │   └── require-role.tsx
│   │   ├── hooks/
│   │   │   ├── use-session.ts
│   │   │   ├── use-current-tenant.ts
│   │   │   └── use-broadcast-auth.ts       # Suscriptor de BroadcastChannel('auth')
│   │   └── types.ts
│   │
│   └── billing/
│       ├── index.ts
│       ├── components/
│       │   └── pdf-download-button.tsx
│       ├── hooks/
│       │   └── use-document-url.ts
│       ├── services/
│       │   └── billing-api.ts
│       └── types.ts
│
└── lib/
    ├── api/
    │   ├── types.ts                        # Generado: salida de openapi-typescript (commiteado)
    │   ├── client.ts                       # createApiClient(baseUrl) → wrapper de fetch tipado
    │   ├── interceptors.ts                 # header de auth, idempotencia, refresh silencioso single-flight
    │   └── errors.ts                       # ApiError, ValidationError, …
    └── mocks/                              # MSW (ver mock-strategy.md)
        ├── browser.ts
        ├── server.ts
        ├── handlers/
        └── scenarios/
```

## 2. Responsabilidades de los módulos

### `authentication`
- **Exports**: `LoginForm`, `OtpForm`, `SetPasswordForm`, `RecoverRequestForm`,
  hooks (`useLogin`, `useOtp`, `usePasswordPolicy`).
- **Gestiona**: formularios, schemas de validación, UX del OTP (cooldown de reenvío,
  cuenta regresiva de bloqueo), fetch de política de contraseña + refinamiento
  dinámico de Zod.

### `tenant-onboarding`
- **Exports**: `WizardShell`, componentes de paso, `useWizard`.
- **Gestiona**: máquina de estados del asistente, fetch/patch del borrador, idempotencia
  por paso, flujo de reanudación, polling del pago.
- **Rutas consumidas**: `/signup`, `/signup/[draftId]/[step]`, `/signup/resume/[token]`.

### `invitations`
- **Exports**: `InvitationPreview`, `AcceptForm`, `useInvitation`.
- **Gestiona**: vista previa del token de invitación + flujo de aceptación.

### `identity`
- **Exports**: `useSession`, `useCurrentTenant`, `RequireAuth`, `RequireRole`,
  `SessionProvider`.
- **Gestiona**: store de sesión, titular de token, refresh silencioso single-flight,
  broadcast multi-pestaña, validación de decodificación de JWT.

### `billing`
- **Exports**: `PdfDownloadButton`, `useDocumentUrl`.
- **Gestiona**: fetch de URL firmada con caché TTL-aware mediante React Query.

## 3. Ciclo de vida de la sesión

### Estrategia de almacenamiento

| Dato | Dónde | Por qué |
|---|---|---|
| Access token | `tokenHolder` a nivel de módulo en memoria | Resistente a XSS; nunca en localStorage |
| Refresh token | Cookie `httpOnly` establecida por el backend | El navegador lo envía automáticamente en `/auth/refresh` |
| Metadatos de sesión (user, tenant, role) | Store Zustand (memoria) | Serializado en el árbol React |
| Confianza de dispositivo | Cookie `httpOnly` | El backend valida en el servidor |
| Idempotency keys | `localStorage` por borrador+paso | Sobrevive al refresh durante las ventanas de reintento |

### Contrato de `tokenHolder`

```ts
// modules/identity/session/token.ts
let accessToken: string | null = null
let expiresAt: number | null = null
let refreshPromise: Promise<string> | null = null

export const tokenHolder = {
  get: () => accessToken,
  isExpired: () => !expiresAt || Date.now() >= expiresAt - 30_000,
  set: (token: string, expiresInSeconds: number) => {
    accessToken = token
    expiresAt = Date.now() + expiresInSeconds * 1000
  },
  clear: () => { accessToken = null; expiresAt = null },
  // Refresh silencioso single-flight — todos los 401s comparten una única llamada en vuelo.
  refresh: async (): Promise<string> => {
    if (refreshPromise) return refreshPromise
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(handleRefresh)
      .finally(() => { refreshPromise = null })
    return refreshPromise
  },
}
```

### Secuencia de arranque

```
App mount
  → SessionProvider mounts
  → tokenHolder.refresh() (silent, ignore 401)
    ├─ 200 → set token, fetch /auth/me, hydrate Zustand store
    └─ 401 → no session, public routes only
```

### Refresh en 401 (single-flight)

```
Request → fetch wrapper
  → if tokenHolder.isExpired() → refresh first (await single-flight)
  → attach Authorization header
  → fetch
  → if 401 from server → refresh once → retry once
  → if retry also 401 → throw UnauthorizedError, redirect /login
```

### Broadcast multi-pestaña

```ts
const channel = new BroadcastChannel('corehub-auth')
// Al iniciar sesión: channel.postMessage({ type: 'sign-in' })  (otras pestañas recargan la sesión)
// Al cerrar sesión: channel.postMessage({ type: 'sign-out' }) (otras pestañas limpian estado, redirigen a /login)
```

Alcance: por origen (por subdominio de tenant). En producción, las pestañas en
`acme.corehub.com` y `globex.corehub.com` NO comparten. Esto coincide con
el modelo de seguridad.

### `<RequireAuth>` y `<RequireRole>`

Componentes cliente renderizados dentro de `(portal)/layout.tsx`:

```tsx
<RequireAuth fallback={<RedirectToLogin />}>
  <RequireRole allow={['TenantAdmin','SuperAdmin']} fallback={<AccessDeniedPage />}>
    {children}
  </RequireRole>
</RequireAuth>
```

El middleware hace la compuerta liviana (sin JWT en la cookie → redirigir) antes
de la capa React. El middleware NO verifica la firma del JWT (sin clave pública
en el edge); solo comprueba presencia + expiración desde el cuerpo.

## 4. Máquina de estados del asistente

### Estados

```
INITIALIZING
  → DRAFT_LOADING (montaje de la página de paso)
  → STEP_PLAN
  → STEP_REPRESENTATIVE
  → STEP_OTP
  → STEP_COMPANY
  → STEP_PAYMENT_INIT
  → STEP_PAYMENT_REDIRECTING
  → STEP_PAYMENT_POLLING
  → STEP_PAYMENT_FAILED (terminal pero reintentable)
  → STEP_SUMMARY
  → COMPLETED
  → EXPIRED (terminal)
```

### Transiciones

- Todas las transiciones pasan por `PATCH /onboarding/draft/{id}` con el nuevo
  paso en el request y el `version` actual.
- El servidor es la fuente de verdad. El frontend refleja.
- **Idempotency keys por paso**: generadas una vez por intento de envío de paso,
  almacenadas en `localStorage` bajo `draft:${draftId}:step:${stepNumber}:idem`.
  Usadas durante toda la ventana de reintento. Se borran cuando el servidor devuelve 200.
- **La idempotencia del pago es especial**: key = `${draftId}_payment_v${attempt}`
  donde el intento se incrementa en el reintento iniciado por el usuario tras cancelar/fallar.
  La ruta de reintento también envía `X-Idempotency-Reset: true`.

### Persistencia

- El frontend nunca mantiene datos del asistente entre recargas de página.
- Al montar cualquier ruta del asistente → `GET /onboarding/draft/{id}` → hidratar.
- React Query gestiona el caché. `staleTime: 0` para el borrador (siempre fresco
  al remontar).

### Flujo de reanudación

```
Email link → /signup/resume/{token}
  → GET /onboarding/draft/resume/{token} → { draftId }
  → router.replace(`/signup/${draftId}/${currentStep}`)
  → step page hydrates from GET /onboarding/draft/{draftId}
```

### Polling del pago

```
On return from Bancard → /signup/{draftId}/payment?paymentId=...
  → useQuery(['payment-status', paymentId], { refetchInterval: backoff })
  → Backoff: 1s, 2s, 4s, 8s, 16s, max 60s total.
  → status='approved' → advance to summary
  → status='declined' | 'cancelled' → show retry CTA, regen idem key
  → 60s elapsed without confirmed → show "Verificando, esto puede tardar"
    + manual retry + email backup
```

## 5. Cliente API

### Generación de código

```bash
# package.json scripts
"codegen:api": "openapi-typescript apps/hub/.atl/api-contract.yaml -o src/lib/api/types.ts"
```

- `src/lib/api/types.ts` está **commiteado** (sin codegen en runtime).
- CI re-ejecuta el codegen y verifica que no haya diferencias (detección de desvío).

### Cliente

```ts
// src/lib/api/client.ts
import type { paths } from './types'

export function createApiClient(baseUrl: string) {
  return {
    auth: {
      login: (body: paths['/auth/login']['post']['requestBody']['content']['application/json']) =>
        request('/auth/login', { method: 'POST', body }),
      // ...
    },
  }
}
```

`request()` es un wrapper delgado de fetch que:
- Prefija `baseUrl`
- Serializa el body como JSON, parsea la respuesta JSON
- Auto-inyecta `Authorization: Bearer ${tokenHolder.get()}` para rutas no públicas
- Auto-genera `Idempotency-Key: ${uuid()}` para los no-GET a menos que el caller pase uno
- En 401: espera `tokenHolder.refresh()` (single-flight), reintenta una vez
- Lanza `ApiError` tipado según el schema de error del OpenAPI

### Interceptores

| Preocupación | Estrategia |
|---|---|
| Header de autenticación | Auto-inyección desde `tokenHolder` |
| Idempotency-Key | UUID automático por llamada; override explícito para reintento con la misma key |
| Refresh en 401 | Single-flight mediante `tokenHolder.refresh()` |
| Header de tenant | Auto-inyectar `X-Tenant-Slug` desde la sesión si está presente |
| Errores | Mapear 401/403/404/409/410/422/429 → excepciones tipadas |
| Reintento | Solo en GET idempotente + errores de red (3 reintentos, backoff exponencial) |

## 6. Resolución de tenant

### Lógica del middleware

```ts
// apps/hub/src/middleware.ts
const TENANT_MODE = process.env.NEXT_PUBLIC_TENANT_MODE ?? 'subdomain'

export function middleware(req: NextRequest) {
  // 1. Resolver tenant desde la URL
  const tenant = TENANT_MODE === 'subdomain'
    ? extractFromHost(req.headers.get('host'))
    : extractFromPath(req.nextUrl.pathname)

  // 2. Grupo de rutas públicas: siempre permitir
  if (req.nextUrl.pathname.startsWith('/login') ||
      req.nextUrl.pathname.startsWith('/signup') ||
      req.nextUrl.pathname.startsWith('/invite') ||
      req.nextUrl.pathname.startsWith('/first-login') ||
      req.nextUrl.pathname.startsWith('/recover')) {
    return NextResponse.next({ headers: { 'x-tenant-slug': tenant ?? '' } })
  }

  // 3. Portal: requerir presencia de cookie de refresh (compuerta liviana)
  const hasRefresh = req.cookies.has('refresh_token')
  if (!hasRefresh) return NextResponse.redirect(new URL('/login', req.url))

  // 4. La verificación cruzada del JWT ocurre en el cliente una vez que el token está decodificado.
  return NextResponse.next({ headers: { 'x-tenant-slug': tenant ?? '' } })
}

export const config = { matcher: ['/((?!api|_next|static|.*\\..*|favicon.ico).*)'] }
```

### Modos

| Valor de env | Resolución | Caso de uso |
|---|---|---|
| `subdomain` | `acme.corehub.com` → `acme` | Producción |
| `path` | `localhost:3001/t/acme/...` → `acme` | Desarrollo (sin trucos de DNS) |

`NEXT_PUBLIC_TENANT_MODE` es una variable de entorno pública (build-time).

### Verificación cruzada del JWT

Una vez que el token está en memoria, `useSession()` compara `session.tenant.slug`
con el tenant de la URL. Si no coinciden → `router.replace('/login?error=tenant_mismatch')`.

## 7. Patrones de formularios

### Stack

- `react-hook-form` (convención de skill del proyecto)
- `zod` para schemas
- `@hookform/resolvers/zod`
- Primitivas `Form` de `@core/ui` (organismo existente)

### Schema de contraseña dinámico

```ts
// modules/authentication/schemas/password-schema.ts
export function buildPasswordSchema(policy: PasswordPolicy) {
  return z.string()
    .min(policy.minLength, `Mínimo ${policy.minLength} caracteres`)
    .refine(s => !policy.requireUpper || /[A-Z]/.test(s), 'Falta una mayúscula')
    .refine(s => !policy.requireLower || /[a-z]/.test(s), 'Falta una minúscula')
    .refine(s => !policy.requireDigit || /[0-9]/.test(s), 'Falta un dígito')
    .refine(s => !policy.requireSymbol || /[^A-Za-z0-9]/.test(s), 'Falta un símbolo')
}
```

`SetPasswordForm` llama a `useQuery('password-policy', getPolicy)`, construye
el schema una vez al montar, y renderiza `PasswordPolicyChecklist` con
actualizaciones `aria-live="polite"`.

### Mapeo de errores 422

```ts
// En el error de submit:
if (err instanceof ValidationError) {
  err.errors.forEach(e => form.setError(e.field, { message: e.message }))
  return
}
```

## 8. Límites de error

- **Por grupo de rutas**: `(public)/error.tsx` y `(portal)/error.tsx`.
- **Mostrar al usuario**: componente `<ErrorPage>` con CTA de reintento + toast
  para errores recuperables.
- **Logging**: error de window → POST `/observability/error` (fuera del alcance
  para v1; solo `console.error` + placeholder de Sentry).

## 9. Lista de verificación de accesibilidad (WCAG 2.2 AA)

- Todos los formularios: `aria-labelledby` al encabezado, regiones de error en vivo
- OTP: 6 slots, cada uno con `aria-label="Código de verificación, dígito N de 6"`,
  `aria-describedby` a la región de error
- Transiciones de paso del asistente: el foco se mueve al `<h1>` del paso al avanzar
- Botón de reenvío: `aria-disabled` con cuenta regresiva en `aria-label`
- Cargando: `aria-busy` en el submit durante la llamada en vuelo
- Skip links en cada layout público
- Anillos focus-visible preservados (defaults de `@core/ui`)
- Contraste de color: mínimo 4.5:1 para cuerpo, 3:1 para texto grande — los
  design tokens ya cumplen
- Teclado: el orden de Tab coincide con el orden visual; Esc cierra modales;
  Enter envía formularios

## 10. Presupuesto de rendimiento

- **Rutas públicas** (`/login`, `/signup`): < 100 KB JS gzipped, shell renderizado en servidor
- **Portal**: < 150 KB JS gzipped inicial; lazy-load de elementos de la cuadrícula de apps
- **Tipos OpenAPI**: tree-shaken (solo se conservan los `paths` importados)
- **`react-pdf` (si hay PDF en el frontend)**: import dinámico en el paso de resumen
- **MSW**: tree-shaken en producción (ver mock-strategy)

## 11. Testing

### Unitario (Vitest)

- Schemas: parse/stringify de ida y vuelta
- `tokenHolder` single-flight: 100 llamadas concurrentes de refresh → 1 llamada de red
- Reducer del asistente: transiciones de estado
- Componentes de formulario: render + validación + submit (RTL)

### E2E (Playwright)

- **CI**: integración Node de MSW (sin dependencia de backend real).
  `playwright.config.ts` registra el servidor MSW en `globalSetup`.
- **Staging**: `pnpm e2e:staging` — omite MSW, apunta a
  `https://api.staging.corehub.com`. Se usa antes de cada release.
- Flujos críticos:
  - Login (flujo feliz + bloqueo + mismatch de tenant)
  - Flujo feliz de registro con asistente
  - Refresh del asistente a mitad de paso
  - Reanudación del asistente desde email
  - Cancelación de pago + reintento
  - Aceptación de invitación

## 12. Variables de entorno

```
# Build-time (NEXT_PUBLIC_*)
NEXT_PUBLIC_API_URL=https://api.corehub.com
NEXT_PUBLIC_TENANT_MODE=subdomain   # o "path"
NEXT_PUBLIC_BANCARD_RETURN_BASE=https://hub.corehub.com
NEXT_PUBLIC_API_MOCKING=disabled    # "enabled" solo en dev

# Servidor (Next.js, si hay lógica de backend — actualmente ninguna)
# (n/a — Hub es client-only contra la API Java)
```

## 13. Migración desde el stub actual

1. Eliminar `apps/hub/src/providers/auth-context.tsx` y
   `apps/hub/src/providers/auth-context.types.ts`.
2. Mover `apps/hub/src/app/page.tsx` (cuadrícula de apps) a
   `apps/hub/src/app/(portal)/page.tsx`.
3. Envolver `(portal)/layout.tsx` con `<RequireAuth>` de
   `modules/identity`.
4. Reemplazar los usos de `useAuth()` con `useSession()`.
5. Agregar `middleware.ts`.
6. Agregar nuevas rutas públicas.
7. Actualizar los CTAs de la landing page (`apps/landing-page/.../pricing-card.tsx`)
   para que apunten a `/signup?plan=...`.
