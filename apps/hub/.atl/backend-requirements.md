# Requisitos de Backend — Corehub Hub API

> Complemento de `api-contract.yaml`. La especificación OpenAPI es la fuente de verdad
> para las formas de datos; este documento cubre el comportamiento, la persistencia
> y las operaciones que la especificación no puede codificar.

## 1. Resumen general

El frontend (`apps/hub`, Next.js 15) es un consumidor puro de este servicio Spring Boot.
No existe backend Node. El contrato en `api-contract.yaml` define cada forma de
request/response; este documento define:
- Modelo de persistencia (schema-per-tenant)
- Estrategia de firma, rotación y TTL del JWT
- Patrón de idempotencia con ejemplos desarrollados
- OTP, pagos, generación de PDF, abstracciones de email/SMS
- Rate limits y hooks de observabilidad
- ADRs abiertas que el equipo Java debe cerrar

## 2. Stack esperado

- **Spring Boot 3.x** (Java 21 LTS recomendado)
- **Spring Security** para filtros de autenticación y guardas a nivel de método
- **Spring Data JPA** O **jOOQ** (a elección del equipo) — debe soportar multi-schema
- **Flyway** para migraciones (conjuntos de migración separados para `public` y
  schemas por tenant; ver §4)
- **JWT**: `nimbus-jose-jwt` (preferido sobre `jjwt` — mejor soporte para RS256)
- **PostgreSQL 15+** — soporte multi-schema es obligatorio
- **Redis** para: caché de idempotencia, contadores de rate limit, almacenamiento de OTP
- **Almacenamiento de objetos** compatible con S3 (AWS S3, MinIO) para PDFs
- **Tareas en background**: Spring `@Scheduled` para limpiezas; Spring `@Async` o
  Quartz para la cola de generación de PDF (elección del equipo)

## 3. Modelo de multitenancy — schema-per-tenant

### Schemas

- **Schema `public`**: registro cross-tenant. Tablas:
  `tenants`, `users`, `sessions`, `refresh_tokens`, `device_trusts`,
  `plans`, `onboarding_drafts`, `draft_steps`, `payments`,
  `invitations`, `idempotency_records`, `otp_codes`,
  `password_reset_tokens`, `audit_log`.
- **Schemas `tenant_<slug>`** (p. ej. `tenant_acme`): creados al enviar el borrador.
  Contienen datos de negocio (dominio de telefonía, fuera del alcance de este cambio).
  El schema se crea en una transacción junto con el INSERT del row de tenant;
  si falla, se hace rollback de ambos.

### Resolución de tenant

- **Entrada**: header `X-Tenant-Slug` (enviado por el frontend desde el JWT o la URL).
- **Verificación cruzada con JWT**: el filtro del backend valida `tenantSlug` contra
  el claim `tenant_id` del JWT. Si no coinciden → 403.
- **Regex del slug**: `^[a-z0-9-]{3,40}$`. Slugs reservados:
  `www`, `api`, `app`, `admin`, `hub`, `mail`, `static`, `cdn`, `signup`,
  `login`, `superadmin`. Rechazar en la creación del tenant.
- **Nombre del schema**: `tenant_<slug_con_guiones_reemplazados_por_underscores>` —
  p. ej. `acme-corp` → `tenant_acme_corp`.

### Flujo de provisionamiento (en `POST /onboarding/draft/{id}/submit`)

1. Validar borrador: status `payment_confirmed`, versión sin cambios.
2. Iniciar transacción.
3. INSERT del row en `tenants` con `status=pending`.
4. CREATE SCHEMA `tenant_<slug>`.
5. Ejecutar migraciones Flyway por tenant contra el nuevo schema.
6. INSERT del usuario TenantAdmin en `public.users` con FK `tenant_id`.
7. UPDATE `tenants.status=active`.
8. UPDATE `onboarding_drafts.status=completed`.
9. Generar PDFs de factura y contrato (sync o async — ver §10).
10. Emitir access token + refresh token.
11. Commit.

Si algún paso falla: rollback. Al re-ejecutar el endpoint submit con el mismo
`Idempotency-Key` se devuelve la respuesta de éxito cacheada (si el commit ocurrió)
o se reintenta (si hubo rollback).

## 4. Especificaciones del JWT

### Algoritmo y claves

- **Algoritmo**: RS256
- **Rotación de claves**: 2 claves activas en todo momento (activa + anterior),
  rotadas cada 90 días. Claves públicas expuestas en `GET /.well-known/jwks.json`
  (el frontend no verifica, pero otros servicios pueden hacerlo).
- **Header `kid`**: cada token lleva el ID de la clave activa.
- Las claves privadas viven en AWS Secrets Manager (o Vault). Nunca en variables de entorno.

### Claims

```json
{
  "sub": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "tenant_id": "empresa-acme",
  "tenant_uuid": "a5b8d4d2-9e1c-4d23-9f1f-62eea2c45f81",
  "role": "TenantAdmin",
  "iat": 1714411200,
  "exp": 1714412100,
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "iss": "https://api.corehub.com",
  "aud": "corehub-hub"
}
```

### TTLs (FIJOS — no modificar)

- **TTL del access token**: 900 s (15 minutos)
- **TTL del refresh token**: 604800 s (7 días)
- **Rotación del refresh**: uso único. Cada refresh emite un nuevo token e invalida
  el anterior. Repetir (usar un refresh ya consumido) devuelve 401 Y además invalida
  toda la familia de refresh (seguridad: robo de token detectado).
- **TTL de la cookie de confianza de dispositivo**: 5184000 s (60 días). Hash =
  `SHA-256(userAgent + screen + tz)`. Almacenado en `public.device_trusts`
  vinculado a `user_id`. Se invalida al cerrar sesión explícitamente.
- **Token de verificación OTP** (intermedio, post-OTP, pre-establecimiento de contraseña):
  300 s (5 min).
- **Token de enlace de primer login**: 48 horas.
- **Token de recuperación de contraseña**: 30 minutos.
- **Token de invitación**: 7 días.
- **Enlace de reanudación (asistente)**: 7 días.
- **URLs firmadas de PDF**: 5 minutos.
- **Retención del registro de idempotencia**: 24 horas.

## 5. Pistas de implementación de endpoints

> Espeja el OpenAPI. Para cada endpoint se esperan controllers, services y
> repositories. Se indican los límites de transacción cuando es relevante.

### `POST /auth/otp/send`
- Controller: `AuthOtpController`
- Service: `OtpService.issue(channel, purpose, identifier)`
- Comportamiento: insertar en `public.otp_codes` (`code_hash` BCrypt, no en texto plano),
  encolar la entrega mediante `OtpDeliveryAdapter`, devolver destino enmascarado.
- Rate limit (por IP y por identificador): 1 envío cada 30 s, máximo 5 por hora.
- Idempotencia: misma key → devolver respuesta cacheada.
- Nunca registrar el código en logs.

### `POST /auth/otp/verify`
- Comparación en tiempo constante.
- En éxito: marcar código como `used`, emitir token de verificación OTP (5 min) y
  devolverlo. Para `purpose=login`, la respuesta también señaliza que se puede
  llamar a `/auth/login/complete`.
- En fallo: incrementar intentos; al llegar a 5 → bloquear 15 minutos.

### `POST /auth/login`
- Controller: `AuthLoginController`
- Comportamiento: verificar contraseña con BCrypt. Comprobar hash de la cookie `device_trust`.
  - Si es de confianza → emitir sesión inmediatamente (sin OTP).
  - Si no → emitir OTP y devolver `{ otpRequired: true, otpId }`.
- Bloqueo: 5 intentos fallidos en 15 min → `account_locked` 429 con `lockedUntil`.
- Sin enumeración: mismo cuerpo 401 para contraseña incorrecta y email desconocido.

### `POST /auth/login/complete`
- Verificar OTP, establecer sesión: insertar row en `sessions`, emitir
  access token + refresh token. Establecer cookie `refresh_token`.
- Si `trustDevice=true`: insertar row en `device_trusts` + establecer cookie.

### `POST /auth/refresh`
- Leer la cookie `refresh_token`.
- Check + rotación atómica: SELECT ... FOR UPDATE; marcar el antiguo como `used`; insertar
  el nuevo con enlace `parent_id` (familia de refresh para detección de replay).
- Devolver nuevo access token + establecer nueva cookie de refresh.

### `GET /auth/password/policy`
- Configuración estática o respaldada en BD. El frontend la lee al montar cualquier
  formulario de establecimiento de contraseña para renderizar la lista dinámica.

### `POST /onboarding/draft` / `PATCH /onboarding/draft/{id}`
- `current_step` es derivado por el servidor, nunca confiar en el step del cliente.
- El campo `version` implementa concurrencia optimista. Discrepancia → 409 con
  el estado actual del borrador en el cuerpo.
- Persistir cada paso en la tabla de auditoría `draft_steps` para analítica.

### `POST /onboarding/draft/{id}/payment/initiate`
- Estrategia de idempotency key: ver §6 ejemplo desarrollado #2.
- Llama a la API Bancard vPOS, obtiene `process_id`, lo almacena en `payments`.
- Devuelve `redirectUrl` (página de checkout de Bancard).

### `POST /onboarding/draft/{id}/submit`
- Ver flujo de provisionamiento en §3.

### `GET /billing/documents/{id}/signed-url`
- Genera una URL pre-firmada de S3 con TTL de 5 min.
- Autorizado para: TenantAdmin propietario del documento.

## 6. Patrón de idempotencia (análisis detallado)

### Almacenamiento

`public.idempotency_records`:

```sql
CREATE TABLE public.idempotency_records (
  key UUID PRIMARY KEY,
  user_id UUID,
  request_method VARCHAR(10) NOT NULL,
  request_path TEXT NOT NULL,
  request_hash VARCHAR(64) NOT NULL,  -- SHA-256 del body
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  response_headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX ON public.idempotency_records (expires_at);
```

### Algoritmo

1. Leer el header `Idempotency-Key`. Si falta → 400.
2. Calcular `request_hash = SHA-256(method + path + body)`.
3. SELECT FOR UPDATE sobre la key.
4. **Encontrado** + mismo `request_hash` → devolver `response_status` + body cacheados.
5. **Encontrado** + `request_hash` diferente → devolver 422
   `{ code: 'idempotency_key_reused', detail: 'Same key, different payload' }`.
6. **No encontrado** → ejecutar el handler; al completar, INSERT del registro; commit.
7. Tarea de limpieza: eliminar donde `expires_at < NOW()`, se ejecuta cada hora.

### Implementación de referencia en Java

Implementar como `@Aspect` sobre los endpoints con la anotación `@Idempotent`:

```java
@Around("@annotation(Idempotent)")
public Object around(ProceedingJoinPoint pjp) {
  String key = request.getHeader("Idempotency-Key");
  IdempotencyRecord cached = repo.findByKey(key);
  if (cached != null) {
    if (!cached.requestHash.equals(currentHash)) throw new IdempotencyConflict();
    return ResponseEntity.status(cached.status).body(cached.body);
  }
  Object result = pjp.proceed();
  repo.save(new IdempotencyRecord(key, currentHash, result));
  return result;
}
```

### Ejemplo desarrollado 1 — Reintento de paso del asistente

```
User on step 4 clicks "Continuar"
→ Frontend generates idem key K1, persists in localStorage as `draft:D1:step:4:idem`
→ PATCH /onboarding/draft/D1 with K1, body {step:4, version:3, company:{...}}
→ Network times out (504). Response not received.
→ Frontend retries (auto + manual): SAME K1, SAME body.
→ Backend SELECT FOR UPDATE on K1. First request still in-flight: blocks. When it
  commits, the cached response is returned to the second call. No double-write.
```

### Ejemplo desarrollado 2 — Doble clic en el pago

```
User on step 5 clicks "Pagar"
→ Frontend generates idem key K2 = `${draftId}_payment_v1`, persists.
→ POST /onboarding/draft/D1/payment/initiate with K2.
→ Backend: no record → calls Bancard, gets process_id P1, returns redirectUrl R1.
   Stores idem record with body {paymentId, redirectUrl: R1, ...}.
→ User clicks "Pagar" again (slow render, double-click).
→ POST again with SAME K2.
→ Backend: finds record. Returns SAME R1. Bancard NOT called twice. Good.

User cancels on Bancard, returns to wizard with status=cancelled.
→ Frontend regenerates K3 and sends `X-Idempotency-Reset: true`.
→ Backend: header signals new attempt — invalidates old payment record (or
   moves it to history), creates new payment with K3. Bancard called fresh.
```

### Ejemplo desarrollado 3 — Reenvío de OTP

```
User clicks "Enviar código"
→ Frontend generates K4. POST /auth/otp/send.
→ OTP code C1 sent.

30 seconds later, user clicks "Reenviar código"
→ Frontend generates K5 (NEW UUID — different action).
→ POST /auth/otp/send. Backend invalidates C1, issues C2.
→ NB: rate limiting (1/30s per identifier) is what enforces cooldown,
  NOT idempotency. Different keys = different intents.

If the second send fails network-side and frontend retries:
→ SAME K5 reused. Backend returns cached response. No double-send.
```

### Ejemplo desarrollado 4 — Submit (provisionamiento del tenant)

```
User on step 6 clicks "Confirmar"
→ Frontend generates K6 = `${draftId}_submit`, persists.
→ POST /onboarding/draft/D1/submit with K6.
→ Backend begins TX, creates schema, provisions, commits.
→ Cached: { tenantId: T1, accessToken: AT1, documents: {...} }
→ Network drops. User retries.
→ SAME K6 → cached response with SAME tenant. No duplicate tenant created.

If first call FAILED (rolled back, no commit):
→ No cache record exists. Retry executes fresh. Idempotent at DB level
  (UNIQUE constraint on draft_id + status=completed prevents two tenants
  per draft).
```

## 7. Requisitos de OTP

- **Código**: numérico de 6 dígitos (con relleno de ceros). Generado por `SecureRandom`.
- **TTL**: 300 s (5 minutos).
- **Máximo de intentos**: 5 por emisión de OTP.
- **Bloqueo tras agotamiento**: 15 minutos (por identificador).
- **Cooldown de reenvío**: 30 segundos.
- **Almacenamiento**: hash con BCrypt (factor de trabajo 10), nunca en texto plano.
- **Latencia de entrega objetivo**: p95 < 30 s.
- **Proveedor**: configurable mediante las variables de entorno `OTP_EMAIL_PROVIDER` y
  `OTP_SMS_PROVIDER`. Ver §11 para interfaces de adaptador.
- **Logging**: registrar `otpId`, `purpose`, `channel`, `maskedDestination`. NUNCA
  registrar el código ni el destino completo.

## 8. Integración con Bancard (vPOS Tradicional)

### Flujo

1. `POST /onboarding/draft/{id}/payment/initiate`:
   - El backend llama a la API Bancard `vpos/api/0.3/single_buy` con
     `{ public_key, operation: { token, shop_process_id, amount, currency, ... } }`.
   - `shop_process_id` = `${draftId}-${attempt}` (único por intento).
   - Bancard devuelve `process_id`. El backend lo almacena en `payments` y construye
     `redirectUrl = https://vpos.infonet.com.py/checkout/new/{process_id}`.
2. El usuario completa el pago en Bancard. Bancard lanza el webhook Y redirige al usuario.
3. Webhook: `POST /webhooks/bancard` (ver §13).
4. El frontend hace polling con `GET /onboarding/draft/{id}/payment/status`.

### Validación de firma del webhook

- Bancard envía HMAC-SHA256 en `X-Bancard-Signature`.
- Calcular `HMAC(BANCARD_WEBHOOK_SECRET, raw_body)`. Comparar en tiempo constante.
- Rechazar si no coinciden.

### Entrega duplicada de webhook

Bancard reintenta los webhooks. Idempotencia: clave por `(process_id, status)`.
La primera llegada gana; los webhooks idénticos posteriores devuelven 200 OK sin
efectos secundarios. Un `status` diferente para el mismo `process_id` → registrar en log + alertar.

### Mapeo de pagos a borradores

`payments.draft_id` es la FK. `payments.process_id` (Bancard) es único.
El handler del webhook hace join sobre `process_id` para encontrar `draft_id`,
actualiza el estado del borrador y dispara los efectos secundarios post-pago.

## 9. Generación de PDF (factura + contrato)

- Generados en el servidor tras `POST /onboarding/draft/{id}/submit`.
- Las plantillas son responsabilidad del equipo Java (probablemente Thymeleaf + iText, o OpenHTMLtoPDF).
- Almacenados en S3 en `s3://corehub-billing/{tenantId}/{documentId}.pdf`.
- Tabla `documents` en `public`: `(id, tenant_id, type, s3_key, generated_at)`.
- URLs firmadas mediante `GET /billing/documents/{id}/signed-url`. TTL de 5 min.
- Si es asíncrono: campo de estado en el documento; el frontend hace polling o muestra
  estado "generando". Recomendado: sincrónico dentro del submit (plantillas pequeñas, rápidas);
  fallback a asíncrono solo si la generación supera 3 s.
- **El frontend espera** que la respuesta de `submit` incluya
  `documents.invoiceUrl` y `documents.contractUrl` ya firmadas y válidas.
  Si es asíncrono, se pueden diferir y refrescar mediante el endpoint de signed-url en el paso 6.

## 10. Abstracciones de email + SMS

```java
public interface OtpDeliveryAdapter {
  Channel channel();
  void send(String destination, String code, Duration ttl);
}

public interface EmailAdapter {
  void sendTemplated(String to, String templateId, Map<String,Object> vars);
}

public interface SmsAdapter {
  void send(String e164, String body);
}
```

Implementaciones:
- `SendgridEmailAdapter`, `SesEmailAdapter`, `SmtpEmailAdapter`
- `TwilioSmsAdapter`, `VonageSmsAdapter`

Proveedor seleccionado mediante `OTP_EMAIL_PROVIDER`, `OTP_SMS_PROVIDER`.

## 11. Schemas de base de datos (pistas DDL)

```sql
-- schema public
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  schema_name VARCHAR(60) NOT NULL UNIQUE,
  plan_id VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending','active','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(60),  -- BCrypt; nullable hasta que primer login lo establezca
  role VARCHAR(20) NOT NULL CHECK (role IN ('SuperAdmin','TenantAdmin','User')),
  full_name VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'pending_first_login',
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  family_id UUID NOT NULL,
  parent_id UUID REFERENCES public.refresh_tokens(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.device_trusts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  device_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_hash)
);

CREATE TABLE public.plans (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL,
  features JSONB NOT NULL,
  popular BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.onboarding_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_step VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL,
  plan_id VARCHAR(40),
  representative_email VARCHAR(254),
  data JSONB NOT NULL DEFAULT '{}',
  version INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  resume_token_hash VARCHAR(64),
  resume_token_expires_at TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES public.onboarding_drafts(id),
  tenant_id UUID REFERENCES public.tenants(id),
  bancard_process_id VARCHAR(100) UNIQUE,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL,
  reason VARCHAR(100),
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  inviter_user_id UUID REFERENCES public.users(id),
  email VARCHAR(254) NOT NULL,
  role VARCHAR(20) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  identifier VARCHAR(254) NOT NULL,
  channel VARCHAR(10) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  code_hash VARCHAR(60) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  locked_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.idempotency_records (...); -- §6
```

Schemas por tenant (`tenant_<slug>`): responsabilidad del equipo Java; datos de
negocio fuera del alcance de este cambio.

## 12. Rate limits

| Endpoint | Límite |
|---|---|
| `POST /auth/login` | 5 fallos / 15 min por identificador → bloqueo de 15 min |
| `POST /auth/otp/send` | 1/30 s + 5/hora por identificador; 1/10 s por IP |
| `POST /auth/otp/verify` | 5 intentos por OTP → bloqueo de 15 min |
| `POST /auth/refresh` | 60/min por usuario (cordura) |
| `POST /auth/password/recover/request` | 3/5 min por email; 10/hora por IP |
| `POST /onboarding/draft` (creación anónima) | 10/hora por IP |
| Todos los demás endpoints | 100/min por usuario (por defecto) |

Implementación: token bucket en Redis. Headers en respuesta 429:
`Retry-After: <seconds>`.

## 13. Webhooks

### `POST /webhooks/bancard`

- Sin autenticación (la firma es la autenticación).
- Header: `X-Bancard-Signature: <hex>`.
- Body: JSON de Bancard (process_id, status, ...).
- Validar HMAC-SHA256 con `BANCARD_WEBHOOK_SECRET`.
- Idempotente: clave por `(process_id, status)` en `webhook_events`.
- En aprobado: actualizar `payments.status=approved`, marcar borrador
  `payment_confirmed`, señalizar a cualquiera que esté haciendo polling.
- Siempre devolver 200 (Bancard reintenta en respuestas no 2xx). Los fallos reales
  → registrar en log + alertar, no devolver 500 a Bancard.

## 14. Tareas en background

- **Limpieza de borradores expirados** — diariamente a las 03:00. Eliminar borradores con
  `expires_at < NOW() AND status NOT IN ('completed')`.
- **Limpieza de OTPs expirados** — cada hora. Eliminar `otp_codes` con
  `expires_at < NOW() - INTERVAL '1 hour'`.
- **Limpieza de refresh tokens usados** — diariamente. Eliminar tokens con
  `used_at < NOW() - INTERVAL '30 days'`.
- **Limpieza de registros de idempotencia** — cada hora. Eliminar donde `expires_at < NOW()`.
- **Cola de reintentos de migración de tenant** — cada 5 min. Reintentar el
  provisionamiento de schema fallido (override manual disponible para SuperAdmin).

## 15. Variables de entorno

```
# Servidor
SERVER_PORT=8080
PUBLIC_URL=https://api.corehub.com
HUB_URL=https://hub.corehub.com

# Base de datos
DATABASE_URL=jdbc:postgresql://host:5432/corehub
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
TENANT_SCHEMA_PREFIX=tenant_

# JWT
JWT_PRIVATE_KEY_PATH=/secrets/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/secrets/jwt-public.pem
JWT_PREVIOUS_PRIVATE_KEY_PATH=...
JWT_KID_ACTIVE=2026-04
JWT_ISSUER=https://api.corehub.com
JWT_AUDIENCE=corehub-hub
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=604800

# OTP
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5
OTP_LOCKOUT_SECONDS=900
OTP_RESEND_COOLDOWN_SECONDS=30
OTP_EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=...
OTP_SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+595...

# Bancard
BANCARD_PUBLIC_KEY=...
BANCARD_PRIVATE_KEY=...
BANCARD_API_URL=https://vpos.infonet.com.py
BANCARD_WEBHOOK_SECRET=...
BANCARD_SHOP_PROCESS_ID_PREFIX=corehub

# Almacenamiento
S3_BUCKET_BILLING=corehub-billing
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Redis
REDIS_URL=redis://localhost:6379

# CORS
CORS_ALLOWED_ORIGINS=https://hub.corehub.com,https://*.corehub.com
```

## 16. Observabilidad

- **Request ID**: cada request tiene `X-Request-Id` (generado si está ausente).
  Propagado a los logs y al sufijo de `shop_process_id` de Bancard.
- **Logging estructurado**: JSON, una línea por request. Campos:
  `request_id`, `user_id`, `tenant_slug`, `route`, `status`, `latency_ms`.
- **Audit log** (`public.audit_log`): para operaciones sensibles — login,
  cambio de contraseña, OTP emitido, pago iniciado, tenant provisionado.
- **Nunca registrar**: contraseñas, códigos OTP, datos completos de tarjetas de crédito,
  contenido del JWT, refresh tokens, contenido de URLs firmadas.
- **Métricas**: Prometheus `/actuator/prometheus`. Recomendadas:
  `auth_login_attempts_total{result}`, `otp_delivery_latency_seconds`,
  `payment_outcome_total{status}`, `tenant_provisioning_duration_seconds`.
- **Trazabilidad**: OpenTelemetry. Propagar `traceparent` desde el frontend.

## 17. Preguntas abiertas / ADRs para el equipo Java

Estas NO afectan el contrato — al frontend no le importan — pero el equipo Java
debe resolverlas:

- **ADR-1**: Elección de ORM — Spring Data JPA vs jOOQ. El multi-schema es
  más limpio con jOOQ; JPA necesita `@TenantId` o un interceptor de schema.
- **ADR-2**: Proveedor de email — SendGrid (recomendado por las plantillas) vs
  AWS SES (más barato a escala).
- **ADR-3**: Proveedor de SMS — Twilio (mejor cobertura en PY) vs AWS SNS.
- **ADR-4**: Herramienta de migración para schemas por tenant — Flyway con
  `placeholders` por schema vs runner personalizado.
- **ADR-5**: Librería de PDF — iText 7 (licencia comercial a escala) vs
  OpenHTMLtoPDF (gratuita, más lenta) vs Apache PDFBox.
- **ADR-6**: Tareas en background — Spring `@Async` + `ThreadPoolTaskExecutor`
  vs Quartz vs RabbitMQ/Kafka.
- **ADR-7**: Generación de PDF sync vs async en el submit. Recomendado sync si
  p95 < 2 s; en caso contrario, async con 202 + polling.
