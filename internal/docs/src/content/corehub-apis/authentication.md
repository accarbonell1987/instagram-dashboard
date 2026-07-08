---
title: "Autenticación — Corehub IAM"
description: "JWT RS256, flujo de login con OTP opcional, device trust, refresh rotation, 2FA y recuperación de contraseña."
category: "API: Corehub IAM"
order: 102
date: "2026-05-05"
---

# Autenticación

## JWT RS256

El servicio emite tokens JWT firmados con RSA 256 bits. La clave pública está disponible en el endpoint JWKS para que cualquier servicio pueda verificar los tokens de forma independiente.

### Claims del access token

| Claim | Tipo | Descripción |
|-------|------|-------------|
| `sub` | string | ID del usuario (nanoid opaco) |
| `tenant_id` | string | Slug del tenant (ej. `acme`) |
| `tenant_uuid` | string | UUID del tenant en la base de datos |
| `role` | string | Rol del usuario: `SuperAdmin`, `TenantAdmin` o `User` |
| `exp` | number | Unix timestamp de expiración |
| `iat` | number | Unix timestamp de emisión |
| `jti` | string | ID único del token (para revocación) |
| `iss` | string | Issuer (default: `https://iam.corehub.com`) |
| `aud` | string | Audience (default: `corehub-hub`) |
| `kid` | string | Key ID de la clave pública activa |

### TTLs

| Token | TTL por defecto | Variable de entorno |
|-------|-----------------|---------------------|
| Access token | 15 minutos | `JWT_ACCESS_TOKEN_TTL_SECONDS=900` |
| Refresh token | 7 días | `JWT_REFRESH_TOKEN_TTL_SECONDS=604800` |
| OTP verification token | 5 minutos | `JWT_OTP_VERIFICATION_TTL_SECONDS=300` |

### JWKS endpoint

```
GET /.well-known/jwks.json
Cache-Control: max-age=300
```

Devuelve el JWK set con las claves públicas activas. Los servicios externos deben usar este endpoint para verificar tokens sin contactar al IAM en cada request.

El servicio soporta **rotación de claves**: se puede configurar una clave anterior (`JWT_PREVIOUS_PUBLIC_KEY_PATH`) para que los tokens emitidos con la clave antigua sigan siendo válidos durante el periodo de transición.

---

## Flujo de login

El login es un proceso de dos pasos cuando el tenant tiene 2FA habilitado:

```
Cliente                          IAM
  |                               |
  |  POST /auth/login             |
  |  { email, password }          |
  |------------------------------>|
  |                               |  Verifica credenciales
  |                               |  Comprueba device_trust cookie
  |                               |
  |  [Sin OTP] 200 { session }    |  Device conocido → emite tokens directamente
  |<------------------------------|
  |                               |
  |  [Con OTP] 200 { otpRequired: true, otpId, channel, maskedDestination }
  |<------------------------------|
  |                               |
  |  POST /auth/login/complete    |
  |  { otpId, code, trustDevice } |
  |------------------------------>|
  |                               |  Verifica OTP
  |                               |  Genera refresh token (cookie HttpOnly)
  |                               |  Opcionalmente graba device_trust cookie
  |  200 { session }              |
  |<------------------------------|
```

### POST /auth/login — Paso 1

```json
// Request
{
  "email": "admin@acme.com",
  "password": "MyPassword123!"
}

// Response sin OTP (device conocido o 2FA no requerido)
{
  "otpRequired": false,
  "session": {
    "accessToken": "eyJ...",
    "expiresIn": 900,
    "user": { "id": "usr_abc", "email": "admin@acme.com" },
    "tenant": { "id": "acme", "name": "Acme Corp" }
  }
}

// Response con OTP requerido
{
  "otpRequired": true,
  "otpId": "otp_xyz",
  "channel": "email",
  "maskedDestination": "a***@acme.com",
  "expiresAt": "2026-05-05T10:20:00.000Z",
  "resendAvailableAt": "2026-05-05T10:05:30.000Z"
}
```

El refresh token **nunca** aparece en el cuerpo de la respuesta. Se entrega como cookie `HttpOnly; Secure; SameSite=Lax; Path=/auth/refresh`.

### POST /auth/login/complete — Paso 2 (OTP)

```json
// Request
{
  "otpId": "otp_xyz",
  "code": "123456",
  "trustDevice": true
}

// Response
{
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "user": { "id": "usr_abc", "email": "admin@acme.com" },
  "tenant": { "id": "acme", "name": "Acme Corp" }
}
```

---

## Device trust

Cuando el usuario marca `trustDevice: true` en el login completo, el servidor establece una cookie `device_trust` con un hash del User-Agent:

```
Set-Cookie: device_trust=<sha256_hash>; HttpOnly; Secure; SameSite=Strict; Max-Age=5184000
```

TTL por defecto: **60 días** (`DEVICE_TRUST_TTL_SECONDS=5184000`).

En el siguiente login desde el mismo dispositivo, si la cookie `device_trust` coincide con el hash almacenado, se salta el paso OTP.

---

## Refresh rotation

El refresh token sigue un modelo de **family rotation**:

1. Cada `POST /auth/refresh` invalida el token usado y emite uno nuevo
2. Si se detecta reuse (un token ya invalidado se vuelve a presentar), **toda la familia** queda invalidada — todos los dispositivos del usuario pierden la sesión
3. El token anterior se detecta por hash SHA-256 almacenado en la base de datos

Este comportamiento se loguea como `refresh_reuse` a nivel `ERROR` (posible token theft).

```bash
# Request (cookie refresh_token se envía automáticamente)
POST /auth/refresh

# Response
{
  "accessToken": "eyJ...",
  "expiresIn": 900
}
```

---

## Logout

```bash
# Request (cookie refresh_token se envía automáticamente)
POST /auth/logout
Idempotency-Key: <uuid>

# Response
204 No Content
```

El servidor invalida la familia de refresh tokens del token presentado y elimina la cookie `refresh_token`.

---

## 2FA — OTP

El servicio soporta envío de OTP por email o SMS. Los OTPs se gestionan con las siguientes reglas:

| Parámetro | Valor por defecto | Variable de entorno |
|-----------|------------------|---------------------|
| Duración del código | 5 minutos | `OTP_TTL_SECONDS=300` |
| Máximo de intentos | 5 | `OTP_MAX_ATTEMPTS=5` |
| Lockout tras agotar intentos | 15 minutos | `OTP_LOCKOUT_SECONDS=900` |
| Cooldown entre reenvíos | 30 segundos | `OTP_RESEND_COOLDOWN_SECONDS=30` |

Endpoints relacionados con OTP standalone (flujos fuera del login):

```
POST /auth/otp/send    — envía un OTP a un identificador (email o teléfono)
POST /auth/otp/verify  — verifica el código y devuelve un OTP verification token
POST /auth/otp/resend  — reenvía el OTP (respeta el cooldown)
```

---

## Recuperación de contraseña

```
1. POST /auth/password/recover/request  — envía email con código OTP
   { email }  →  202 (siempre, sin enumerar usuarios)

2. POST /auth/otp/verify                — verifica el código
   { otpId, code }  →  { otpVerificationToken, expiresAt }

3. POST /auth/password/recover/complete — establece nueva contraseña
   { otpVerificationToken, password }  →  200
```

La respuesta del paso 1 es siempre `202` para evitar enumeración de usuarios.

Límite de rate: el servicio aplica rate limiting por IP en el paso 1 (`429 Too Many Requests`).

---

## First login

El flujo `first-login` se usa para usuarios invitados por el tenant admin que necesitan activar su cuenta y establecer contraseña por primera vez:

```
1. POST /auth/first-login/start        — envía OTP al email del usuario invitado
   { email, tenantId }  →  { otpId, channel, maskedDestination, ... }

2. POST /auth/otp/verify               — verifica el código
   { otpId, code }  →  { otpVerificationToken }

3. POST /auth/first-login/set-password — establece contraseña e inicia sesión
   { otpVerificationToken, password, tenantId, tenantUuid, tenantSlug, tenantName }
   →  { accessToken, expiresIn, user, tenant }
```

---

## Política de contraseñas

```
GET /auth/password/policy
```

```json
{
  "minLength": 12,
  "requireUpper": true,
  "requireLower": true,
  "requireDigit": true,
  "requireSymbol": true,
  "disallowCommon": true
}
```
