# Flujo de Onboarding de Tenants — Guía Completa

> Última actualización: 2026-05-13
> Complementa `api-contract.yaml`, `auth-design.md` y `sequence-diagrams.md`.

## Visión general

El wizard de onboarding registra una nueva empresa (tenant) en Corehub. Tiene 6 pasos
secuenciales que avanzan solo hacia adelante (salvo recovery). El estado vive en un
`OnboardingDraft` en el backend — el frontend es stateless y reconstruye desde el draft.

```
Plan → Representante → OTP → Empresa → Pago → Resumen
```

Cada paso corresponde a una ruta: `/signup/{draftId}/{step}`.

---

## Estado del draft

| Status | Significado |
|---|---|
| `draft` | Recién creado o en progreso |
| `payment_pending` | Pago iniciado |
| `payment_confirmed` | Bancard confirmó el pago — listo para submit |
| `completed` | Provisioning completado, tenant activo |

`deriveCurrentStep` en el frontend determina en qué paso forzar al usuario basándose
en qué datos tiene el draft (`plan`, `representative`, `otpVerified`, `company`, `payment`).

---

## Paso 1 — Plan (`/signup/{draftId}/plan`)

- `POST /onboarding/draft` → crea el draft, retorna `draftId`
- `PATCH /onboarding/draft/{draftId}` con `step: 'plan'` al seleccionar un plan
- Idempotency key por scope `draft:create:{planId}` (persiste en localStorage)

---

## Paso 2 — Representante (`/signup/{draftId}/representative`)

- Formulario: email, nombre completo, teléfono
- Al submit: `POST /auth/otp/send` → retorna `otpId`
- Navega a `/signup/{draftId}/otp?otpId={otpId}` pasando el otpId por query param
  para evitar re-enviar OTP y golpear el rate limit de 30s

---

## Paso 3 — OTP (`/signup/{draftId}/otp`)

- Prefiere `otpId` de la query string (pasado desde el paso 2)
- Si navegan directamente (sin query param): envía OTP nuevo en `useEffect`
- Al verificar: `POST /auth/otp/verify` → `patchDraft(draftId, 'otp', { version })`
- Navega a `/signup/{draftId}/company`

---

## Paso 4 — Empresa (`/signup/{draftId}/company`)

- Formulario: razón social (`legalName`), RUC, dirección, ciudad, país
- `PATCH /onboarding/draft/{draftId}` con `step: 'company'`

---

## Paso 5 — Pago (`/signup/{draftId}/payment`)

### Iniciación

```
handleInitiatePayment()
  → POST /onboarding/draft/{draftId}/payment/initiate
  → retorna { redirectUrl, paymentId }

if (redirectUrl.origin === window.location.origin):
  router.push(pathname + search)      # SPA navigation (mismo origin)
else:
  window.location.href = redirectUrl  # Full page navigation (Bancard real o stub)
```

⚠️ **Con Bancard stub en desarrollo**: `redirectUrl = 'http://localhost:8080/__stub/bancard/approve?...'`
Esto es diferente origin al hub (`localhost:3001`) → `window.location.href` → **recarga completa de página**.
Todo el estado JS (access token, módulos) se reinicia.

### Flujo del stub

```
window.location.href = 'http://localhost:8080/__stub/bancard/approve?process_id=...'
  → API aprueba el pago via webhook interno
  → c.redirect('http://localhost:3001/signup/{draftId}/payment?status=verifying', 302)
  → Hub recarga en /payment?status=verifying (fresh JavaScript)
```

### Polling

- `usePaymentPolling` hace `GET /onboarding/draft/{draftId}/payment/status` cada 2s
- `status=approved` → `router.push('/signup/{draftId}/summary')` (SPA navigation)
- Timeout: 60 segundos

---

## Paso 6 — Resumen (`/signup/{draftId}/summary`)

### Provisioning

`useDraftSubmission` llama `submitDraft(draftId, version)` exactamente una vez
(protegido por `submitAttempted.current` ref y `retryCount` para reintentos).

```
POST /onboarding/draft/{draftId}/submit
  → { accessToken, tenantId, documents: { invoiceId, contractId } }
```

Tras el submit exitoso:
1. `setAccessToken(fromJwt(result.accessToken))` — establece el token en memoria
2. `setSessionState({ status: 'authenticated', session })` — hidrata el store Zustand
3. `setDocuments(...)` — muestra la pantalla de éxito con botones de descarga

### Race condition del token (RESUELTA)

Después de la recarga completa de página (paso 5 con Bancard stub), `AuthProvider`
monta y llama `refreshSession()` sin token (no hay cookie de refresh todavía).
Mientras tanto, `submitDraft` puede completarse y llamar `setAccessToken(newToken)`.

Si `refreshSession()` falla DESPUÉS de que `submitDraft` seteó el token, el código
original llamaba `clearAccessToken()` — borrando el token válido → 401 en descarga.

**Fix** (`identity/session/refresh.ts`): se captura `tokenAtStart = getAccessToken()`
antes del fetch. Al fallar, solo se limpia si `getAccessToken() === tokenAtStart`.
Si un nuevo token fue seteado durante el refresh in-flight, se preserva.

### Descarga de documentos

```
DocumentDownloadButton
  → getDocumentSignedUrl(documentId)
  → GET /billing/documents/{documentId}/signed-url
  → authGuard verifica el JWT del access token
  → billingService verifica document.tenantId === token.tenant_uuid
  → retorna { url, expiresAt }
  → window.open(url, '_blank')
```

Requiere el access token seteado por `submitDraft`. El endpoint `/billing/*` tiene
authGuard — el submit DEBE completarse antes de que el usuario pueda descargar.

### Estados de error en resumen

| Error | Causa | UX |
|---|---|---|
| `onboarding.ruc_already_exists` | RUC ya registrado (race o reintento) | Botón "Editar datos de empresa" → recovery |
| `onboarding.email_already_exists` | Email del representante ya existe | Botón "Editar datos del representante" → recovery |
| Otros errores | Red, timeout, error interno | Botón "Reintentar" (mismo draft, misma version) |

---

## Draft Recovery

Cuando el submit falla por conflicto de datos, el draft queda en `payment_confirmed`
pero sin tenant (provisioning no ocurrió). El usuario necesita editar los datos.

```
recoverDraft(draftId, 'company')
  → PATCH /onboarding/draft/{draftId}/recover { step: 'company' }
  → backend: borra data.company del JSON del draft
  → refresh() del contexto
  → deriveCurrentStep detecta company=null → redirige a /company
```

> **Nota**: El backend actualmente solo soporta `step: 'company'`. Para conflictos
> de representante, también se hace recovery a 'company' — el usuario debe re-ingresar
> ambos (empresa y verificar email).

---

## Diagrama de flujo completo (devmode con Bancard stub)

```
/signup
  ↓ createDraft()
/signup/{id}/plan → patchDraft('plan')
  ↓
/signup/{id}/representative → sendOtp() → patchDraft en step OTP
  ↓ ?otpId=...
/signup/{id}/otp → verifyOtp() → patchDraft('otp')
  ↓
/signup/{id}/company → patchDraft('company')
  ↓
/signup/{id}/payment → initiatePayment()
  ↓ window.location.href = 'http://localhost:8080/__stub/bancard/approve?...'
[FULL PAGE RELOAD — módulo JS reiniciado]
  ↓ redirect 302 → /signup/{id}/payment?status=verifying
/signup/{id}/payment (polling)
  ↓ status='approved' → router.push (SPA)
/signup/{id}/summary
  ↓ submitDraft() → setAccessToken(token)
[Pantalla de éxito con botones de descarga]
  ↓ click descarga → GET /billing/documents/{id}/signed-url (usa token)
```

---

## Idempotency keys

| Scope | Key en localStorage | Cuándo se resetea |
|---|---|---|
| `draft:create:{planId}` | Creación del draft | Nunca (draft único por plan) |
| `draft:{id}:step:{name}` | Cada paso de datos | Antes de cada submit (payload puede cambiar) |
| `draft:{id}:payment:v{n}` | Pago (por intento) | Al reintentar pago (v2, v3, ...) |
| `draft:{id}:submit` | Submit final | Nunca (idempotente = mismo resultado) |

---

## Variables de entorno relevantes

| Variable | Dev | Producción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | URL del IAM service |
| `NEXT_PUBLIC_API_MOCKING` | `disabled` (real) o `enabled` (MSW) | `disabled` |
| `NEXT_PUBLIC_TENANT_MODE` | `path` | `subdomain` |
