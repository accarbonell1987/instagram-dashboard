---
title: "Cross-cutting — Corehub IAM"
description: "Idempotencia, auth guard, tenant guard, errores RFC 7807, request ID, CORS y rate limiting."
category: "API: Corehub IAM"
order: 104
date: "2026-05-05"
---

# Cross-cutting

Comportamientos transversales que aplican a múltiples endpoints del servicio.

---

## Idempotencia

Todos los endpoints de mutación (POST, PATCH) excepto webhooks requieren el header `Idempotency-Key`.

### Header

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

El valor debe ser un UUID v4. Si el mismo key se presenta en una segunda request dentro del TTL, el servidor devuelve la respuesta almacenada de la primera request sin volver a ejecutar la operación.

### Comportamiento

| Escenario | Resultado |
|-----------|-----------|
| Primera request con key nuevo | Ejecuta la operación, guarda respuesta |
| Segunda request con el mismo key (dentro del TTL) | Devuelve la respuesta guardada (HTTP 200/201/etc.) |
| Request sin `Idempotency-Key` en endpoint que lo requiere | `422 Unprocessable Entity` |
| Key expirado (pasado el TTL) | Trata la request como nueva |

TTL por defecto: **24 horas** (`IDEMPOTENCY_TTL_SECONDS=86400`).

Un background job limpia los registros expirados cada hora.

### Ejemplo

```bash
curl -X POST http://localhost:8080/auth/logout \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -b "refresh_token=..."
```

---

## Auth guard

Las rutas protegidas requieren un JWT válido en el header `Authorization`.

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

El middleware verifica:

1. Que el header `Authorization` esté presente y tenga formato `Bearer <token>`
2. Que el JWT esté firmado con la clave pública activa (o la anterior, durante rotación)
3. Que el token no haya expirado (`exp` claim)
4. Que el `aud` claim sea `corehub-hub`

Si alguna validación falla, devuelve `401 Unauthorized` con Problem Details.

Endpoints protegidos: `GET /auth/me`, `GET /identity/me`, `GET /billing/documents/:id/url`.

---

## Tenant guard

Algunas operaciones validan que el tenant en el JWT coincide con el del request.

El header `X-Tenant-Slug` identifica el tenant del contexto actual:

```
X-Tenant-Slug: acme
```

El middleware compara el valor del header con el claim `tenant_id` del JWT. Si no coinciden, devuelve `403 Forbidden`.

---

## Error responses — RFC 7807

Todos los errores siguen el formato **Problem Details** (RFC 7807) con `Content-Type: application/problem+json`.

```json
{
  "type": "https://iam.corehub.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid or expired token",
  "instance": "/auth/me"
}
```

| Campo | Descripción |
|-------|-------------|
| `type` | URI que identifica el tipo de error |
| `title` | Descripción corta del error |
| `status` | Código HTTP |
| `detail` | Descripción detallada del error específico |
| `instance` | Path del request que generó el error (opcional) |
| `code` | Código de error de aplicación (opcional, para i18n en el frontend) |

### Códigos de error comunes

| Status | Escenario |
|--------|-----------|
| `400 Bad Request` | Request body inválido o estado no permitido |
| `401 Unauthorized` | Token ausente, inválido o expirado |
| `403 Forbidden` | Token válido pero sin permiso para la operación |
| `404 Not Found` | Recurso no encontrado |
| `409 Conflict` | Conflicto de estado (ej. draft ya completado) |
| `410 Gone` | Recurso expirado (ej. draft expirado, OTP consumido) |
| `422 Unprocessable Entity` | Validación de campos fallida o `Idempotency-Key` ausente |
| `429 Too Many Requests` | Rate limit excedido |
| `500 Internal Server Error` | Error interno del servidor |

---

## Request ID

Todas las respuestas incluyen el header `X-Request-Id` para trazabilidad:

```
X-Request-Id: 01HWXK2M3N4P5Q6R7S8T9U0V1W
```

El valor es un ULID generado por el middleware `request-id` al inicio de cada request. Inclúyelo en los reportes de bugs para facilitar la correlación con los logs.

---

## CORS

Los orígenes permitidos se configuran via la variable de entorno:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3001,https://hub.corehub.com
```

Por defecto solo `http://localhost:3001` está permitido.

---

## Rate limiting

### OTP

| Regla | Valor por defecto | Variable de entorno |
|-------|------------------|---------------------|
| Cooldown entre reenvíos | 30 segundos | `OTP_RESEND_COOLDOWN_SECONDS=30` |
| Máximo de intentos de verificación | 5 | `OTP_MAX_ATTEMPTS=5` |
| Lockout tras agotar intentos | 15 minutos | `OTP_LOCKOUT_SECONDS=900` |

Cuando se excede el rate limit de OTP, el servidor responde con `429 Too Many Requests` e incluye en el Problem Detail el tiempo hasta que el lockout expira.

### Password recovery

El endpoint `POST /auth/password/recover/request` aplica rate limiting por IP para evitar abuso. La respuesta siempre es `202` (nunca revela si el email existe), pero en caso de rate limit devuelve `429`.
