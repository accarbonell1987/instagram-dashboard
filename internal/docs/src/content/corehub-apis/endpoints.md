---
title: "Endpoints — Corehub IAM"
description: "Referencia completa de los 31 endpoints del servicio IAM: auth, onboarding, plans, invitations, identity, billing, webhooks y well-known."
category: "API: Corehub IAM"
order: 103
date: "2026-05-05"
---

# Endpoints

Base URL: `http://localhost:8080`

> **Headers especiales**:
> - `Authorization: Bearer <access_token>` — requerido en endpoints protegidos
> - `X-Tenant-Slug: <slug>` — requerido en endpoints que operan sobre un tenant específico
> - `Idempotency-Key: <uuid>` — requerido en todas las mutations (POST/PATCH/DELETE) salvo webhooks
> - `X-Request-Id` — devuelto en todas las respuestas (trazabilidad)

---

## Health {#health}

| Método | Path | Descripción | Auth | Idempotency-Key |
|--------|------|-------------|------|-----------------|
| **GET** | `/healthz` | Liveness probe | No | No |

### GET /healthz

```json
// Response 200
{
  "status": "ok",
  "service": "iam"
}
```

---

## Well-known {#well-known}

| Método | Path | Descripción | Auth | Idempotency-Key |
|--------|------|-------------|------|-----------------|
| **GET** | `/.well-known/jwks.json` | JWK set público para verificación de JWT | No | No |

### GET /.well-known/jwks.json

```json
// Response 200  (Cache-Control: max-age=300)
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "key-2026-01",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

---

## Auth {#auth}

| Método | Path | Descripción | Auth | Idempotency-Key |
|--------|------|-------------|------|-----------------|
| **POST** | `/auth/login` | Login paso 1 — verifica credenciales | No | No |
| **POST** | `/auth/login/complete` | Login paso 2 — verifica OTP y emite sesión | No | Sí |
| **POST** | `/auth/otp/send` | Envía un código OTP | No | Sí |
| **POST** | `/auth/otp/verify` | Verifica OTP y devuelve verification token | No | Sí |
| **POST** | `/auth/otp/resend` | Reenvía OTP (respeta cooldown) | No | Sí |
| **POST** | `/auth/refresh` | Rota el refresh token y devuelve nuevo access token | No | No |
| **POST** | `/auth/logout` | Invalida la familia de refresh tokens | No | Sí |
| **GET** | `/auth/me` | Devuelve usuario, tenant y rol de la sesión activa | Sí | No |
| **GET** | `/auth/password/policy` | Devuelve la política de contraseñas | No | No |
| **POST** | `/auth/password/recover/request` | Solicita recuperación de contraseña (envía OTP) | No | Sí |
| **POST** | `/auth/password/recover/complete` | Completa la recuperación con OTP verification token | No | Sí |
| **POST** | `/auth/first-login/start` | Inicia el flujo de primer login (envía OTP) | No | Sí |
| **POST** | `/auth/first-login/set-password` | Establece contraseña y emite sesión | No | Sí |
| **POST** | `/auth/signup-rep/start` | Inicia signup de representante (deprecated) | No | Sí |

> `POST /auth/signup-rep/start` y `POST /auth/signup-rep/set-password` no están en el contrato v1.1.1 y están programados para eliminarse en v2.0.

### POST /auth/login

```json
// Request
{ "email": "admin@acme.com", "password": "MyPassword123!" }

// Response 200 — sin OTP
{
  "otpRequired": false,
  "session": {
    "accessToken": "eyJ...",
    "expiresIn": 900,
    "user": { "id": "usr_abc", "email": "admin@acme.com" },
    "tenant": { "id": "acme", "name": "Acme Corp" }
  }
}

// Response 200 — con OTP
{
  "otpRequired": true,
  "otpId": "otp_xyz",
  "channel": "email",
  "maskedDestination": "a***@acme.com",
  "expiresAt": "2026-05-05T10:20:00.000Z",
  "resendAvailableAt": "2026-05-05T10:05:30.000Z"
}
```

Respuestas de error: `401 Unauthorized`, `403 Forbidden`, `422 Unprocessable Entity`, `429 Too Many Requests`.

### POST /auth/login/complete

Requiere `Idempotency-Key`.

```json
// Request
{ "otpId": "otp_xyz", "code": "123456", "trustDevice": true }

// Response 200
{
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "user": { "id": "usr_abc", "email": "admin@acme.com" },
  "tenant": { "id": "acme", "name": "Acme Corp" }
}
```

Respuestas de error: `400`, `401`, `422`, `429`.

### POST /auth/otp/send

Requiere `Idempotency-Key`.

```json
// Request
{ "identifier": "admin@acme.com", "channel": "email", "purpose": "login" }

// Response 200
{
  "otpId": "otp_xyz",
  "channel": "email",
  "maskedDestination": "a***@acme.com",
  "expiresAt": "2026-05-05T10:20:00.000Z",
  "resendAvailableAt": "2026-05-05T10:05:30.000Z"
}
```

### POST /auth/otp/verify

Requiere `Idempotency-Key`.

```json
// Request
{ "otpId": "otp_xyz", "code": "123456" }

// Response 200
{
  "otpVerificationToken": "eyJ...",
  "expiresAt": "2026-05-05T10:25:00.000Z"
}
```

### POST /auth/refresh

La cookie `refresh_token` se envía automáticamente. No requiere body.

```json
// Response 200
{
  "accessToken": "eyJ...",
  "expiresIn": 900
}
```

Respuestas de error: `401 Unauthorized`.

### GET /auth/me

Requiere `Authorization: Bearer <access_token>`.

```json
// Response 200
{
  "user": {
    "id": "usr_abc",
    "email": "admin@acme.com",
    "name": "Admin User",
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "tenant": {
    "id": "acme",
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corp",
    "slug": "acme"
  },
  "role": "TenantAdmin"
}
```

---

## Identity {#identity}

| Método | Path | Descripción | Auth | Idempotency-Key |
|--------|------|-------------|------|-----------------|
| **GET** | `/identity/me` | Perfil completo del usuario autenticado | Sí | No |

### GET /identity/me

Requiere `Authorization: Bearer <access_token>`.

Devuelve el perfil completo del usuario incluyendo datos del tenant y permisos. A diferencia de `/auth/me`, este endpoint puede incluir datos extendidos del perfil según la implementación del tenant.

```json
// Response 200
{
  "user": { "id": "usr_abc", "email": "admin@acme.com" },
  "tenant": { "id": "acme", "name": "Acme Corp" },
  "role": "TenantAdmin"
}
```

---

## Plans {#plans}

| Método | Path | Descripción | Auth | Idempotency-Key |
|--------|------|-------------|------|-----------------|
| **GET** | `/plans` | Lista todos los planes disponibles | No | No |
| **GET** | `/plans/:id` | Obtiene un plan por ID | No | No |

### GET /plans

```json
// Response 200
{
  "plans": [
    {
      "id": "plan_starter",
      "name": "Starter",
      "price": 29.99,
      "currency": "USD",
      "billingCycle": "monthly",
      "features": ["Feature A", "Feature B"],
      "popular": false
    }
  ]
}
```

### GET /plans/:id

```json
// Response 200
{
  "id": "plan_professional",
  "name": "Professional",
  "price": 79.99,
  "currency": "USD",
  "billingCycle": "monthly",
  "features": ["Feature A", "Feature B", "Feature C"],
  "popular": true
}
```

Respuestas de error: `404 Not Found`.

---

## Onboarding {#onboarding}

El onboarding sigue una **state machine** server-side. El draft es el objeto central que va avanzando entre pasos.

| Método | Path | Descripción | Auth | Idempotency-Key |
|--------|------|-------------|------|-----------------|
| **POST** | `/onboarding/draft` | Crea un nuevo draft de onboarding | No | Sí |
| **GET** | `/onboarding/draft/:draftId` | Obtiene el estado actual del draft | No | No |
| **PATCH** | `/onboarding/draft/:draftId` | Actualiza datos del draft | No | Sí |
| **GET** | `/onboarding/draft/resume/:token` | Resuelve un token de resume a draftId | No | No |
| **POST** | `/onboarding/draft/:draftId/resume-link` | Envía un link de resume por email | No | Sí |
| **POST** | `/onboarding/draft/:draftId/payment/initiate` | Inicia el pago Bancard | No | Sí |
| **GET** | `/onboarding/draft/:draftId/payment/status` | Consulta el estado del pago | No | No |
| **POST** | `/onboarding/draft/:draftId/submit` | Envía el draft y provisiona el tenant | No | Sí |

### POST /onboarding/draft

Requiere `Idempotency-Key`.

```json
// Request
{ "planId": "plan_professional" }

// Response 201
{
  "id": "dft_abc",
  "currentStep": "representative",
  "status": "in_progress",
  "version": 1,
  "plan": { "id": "plan_professional", "name": "Professional", "price": 79.99, ... },
  "representative": null,
  "otpVerified": false,
  "company": null,
  "payment": null,
  "expiresAt": "2026-05-12T10:00:00.000Z"
}
```

### PATCH /onboarding/draft/:draftId

Requiere `Idempotency-Key`.

```json
// Request
{
  "version": 1,
  "step": "representative",
  "data": {
    "representative": {
      "email": "rep@acme.com",
      "fullName": "John Doe",
      "phone": "+595981234567"
    }
  }
}

// Response 200 — DraftState actualizado
```

### POST /onboarding/draft/:draftId/submit

Requiere `Idempotency-Key`. Provisiona el tenant completo.

```json
// Request
{ "version": 5 }

// Response 200
{
  "tenantId": "acme",
  "tenant": { "id": "acme", "slug": "acme", "name": "Acme Corp" },
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "documents": [
    { "type": "invoice", "url": "https://..." },
    { "type": "contract", "url": "https://..." }
  ]
}
```

---

## Invitations {#invitations}

| Método | Path | Descripción | Auth | Idempotency-Key |
|--------|------|-------------|------|-----------------|
| **GET** | `/invitations/:token/preview` | Previsualiza la invitación antes de aceptarla | No | No |
| **POST** | `/invitations/:token/accept` | Acepta la invitación | No | Sí |

### GET /invitations/:token/preview

```json
// Response 200
{
  "email": "newuser@acme.com",
  "tenantName": "Acme Corp",
  "tenantSlug": "acme",
  "expiresAt": "2026-05-12T10:00:00.000Z"
}
```

Respuestas de error: `404 Not Found`, `410 Gone` (invitación expirada o ya usada).

### POST /invitations/:token/accept

Requiere `Idempotency-Key`.

```json
// Request
{ "password": "NewPassword123!" }

// Response 200
{
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "user": { "id": "usr_new", "email": "newuser@acme.com" },
  "tenant": { "id": "acme", "name": "Acme Corp" }
}
```

---

## Billing {#billing}

| Método | Path | Descripción | Auth | Idempotency-Key |
|--------|------|-------------|------|-----------------|
| **GET** | `/billing/documents/:id/url` | Devuelve URL firmada del documento | Sí | No |

### GET /billing/documents/:id/url

Requiere `Authorization: Bearer <access_token>`.

```json
// Response 200
{
  "url": "https://storage.example.com/documents/invoice_abc.pdf?signature=...",
  "expiresAt": "2026-05-05T11:00:00.000Z"
}
```

---

## Webhooks {#webhooks}

Los webhooks no utilizan `Idempotency-Key` global — tienen idempotencia interna por `(process_id, status)`.

El servicio **siempre devuelve 200** a Bancard, incluso en caso de error interno, para evitar reintentos no deseados.

| Método | Path | Descripción | Auth | Idempotency-Key |
|--------|------|-------------|------|-----------------|
| **POST** | `/webhooks/bancard/payment` | Confirmación de pago desde Bancard | No (firma HMAC) | No |

### POST /webhooks/bancard/payment

La autenticidad se verifica mediante firma HMAC en el header `X-Bancard-Signature` contra `BANCARD_WEBHOOK_SECRET`.

```json
// Request (payload de Bancard)
{
  "operation": {
    "process_id": "123456",
    "shop_process_id": "corehub-dft_abc",
    "currency": "PYG",
    "amount": "100000",
    "authorization_number": "654321",
    "response": "S",
    "response_description": "Transacción aprobada"
  }
}

// Response 200 (siempre)
{ "status": "received" }
```
