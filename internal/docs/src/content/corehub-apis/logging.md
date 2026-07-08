---
title: "Logging — Corehub IAM"
description: "Stack de logging con Pino v10, JSON estructurado, categorías de eventos, background jobs y redacción automática de datos sensibles."
category: "API: Corehub IAM"
order: 105
date: "2026-05-05"
---

# Logging

## Stack de logging

El servicio usa **Pino v10** para logging JSON estructurado con soporte de worker-thread async (escritura no bloqueante al archivo de logs).

- Logs JSON estructurados en archivo (siempre)
- Consola opcional con `pino-pretty` en desarrollo
- Multi-stream: archivo + consola en paralelo
- Redacción automática de datos sensibles

## Configuración

| Variable de entorno | Por defecto | Descripción |
|--------------------|-------------|-------------|
| `LOG_LEVEL` | `info` | Nivel mínimo: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `LOG_TO_CONSOLE` | `true` | Habilita output por consola además del archivo |
| `LOG_FILE_PATH` | `./logs/api-iam.log` | Ruta del archivo de log (el directorio se crea automáticamente) |
| `LOG_FORMAT` | `pretty` | Formato de consola: `json` o `pretty` (pretty usa `pino-pretty`) |

## Estructura de un log entry

Todos los eventos incluyen los campos base del servicio más los campos específicos de la categoría:

```json
{
  "level": 30,
  "time": 1746488000000,
  "service": "api-iam",
  "env": "production",
  "requestId": "01HWXK2M3N4P5Q6R7S8T9U0V1W",
  "category": "auth",
  "event": "login_success",
  "userId": "usr_abc",
  "tenantId": "acme",
  "msg": "login_success"
}
```

Niveles Pino: `10=trace`, `20=debug`, `30=info`, `40=warn`, `50=error`, `60=fatal`.

## Categorías de eventos

### HTTP

| Evento | Nivel | Campos adicionales |
|--------|-------|--------------------|
| `http_request` | `info` / `warn` (4xx) / `error` (5xx) | `method`, `path`, `status`, `durationMs`, `ip` |

### Auth

| Evento | Nivel | Descripción |
|--------|-------|-------------|
| `login_success` | `info` | Login exitoso, sesión emitida |
| `login_failed` | `warn` | Credenciales incorrectas |
| `logout` | `info` | Cierre de sesión |
| `session_issued` | `info` | Token de sesión generado |
| `refresh_reuse` | `error` | Refresh token ya usado detectado — posible token theft |
| `otp_required` | `info` | 2FA requerido para el login |

> `refresh_reuse` se loguea a nivel `ERROR` porque indica un posible robo de token. Toda la familia de refresh tokens se invalida automáticamente.

### OTP

| Evento | Nivel | Descripción |
|--------|-------|-------------|
| `otp_sent` | `info` | Código OTP enviado al destinatario |
| `otp_verified` | `info` | OTP verificado correctamente |
| `otp_verify_failed` | `warn` | Intento de verificación fallido |
| `otp_locked` | `warn` | Usuario bloqueado por demasiados intentos fallidos |
| `otp_rate_limited` | `warn` | Cooldown de reenvío no expirado |

### Auth — Password

| Evento | Nivel | Descripción |
|--------|-------|-------------|
| `password_recovery_requested` | `info` | Solicitud de recuperación de contraseña |
| `password_recovery_completed` | `info` | Contraseña recuperada exitosamente |
| `password_recovery_rate_limited` | `warn` | Rate limit de recuperación excedido |

### Auth — Invitations

| Evento | Nivel | Descripción |
|--------|-------|-------------|
| `invitation_accepted` | `info` | Invitación aceptada y usuario creado |

### Jobs (background)

| Evento | Nivel | Campos adicionales |
|--------|-------|--------------------|
| `job_started` | `debug` | `job`, `runId` |
| `job_completed` | `info` | `job`, `runId`, `durationMs` |
| `job_failed` | `error` | `job`, `runId`, `err` |

### System

| Evento | Nivel | Descripción |
|--------|-------|-------------|
| `service_started` | `info` | Servidor HTTP escuchando |
| `service_stopping` | `info` | Señal de cierre recibida |
| `unhandled_error` | `error` | Excepción no capturada en el proceso |

## Background jobs

Cinco cron jobs corren en proceso usando `node-cron`. Están deshabilitados en el entorno `test`.

| Job | Schedule | Descripción |
|-----|----------|-------------|
| `cleanup-otp-codes` | Cada 5 minutos (`*/5 * * * *`) | Elimina filas expiradas de `otp_codes` |
| `cleanup-password-reset-tokens` | Cada 10 minutos (`*/10 * * * *`) | Elimina filas expiradas de `password_reset_tokens` |
| `cleanup-idempotency-keys` | Cada hora (`0 * * * *`) | Elimina registros expirados de `idempotency_records` |
| `cleanup-refresh-tokens` | Cada hora (`0 * * * *`) | Elimina refresh tokens expirados |
| `cleanup-drafts` | Diario a las 03:00 (`0 3 * * *`) | Elimina drafts de onboarding abandonados |

Todos los jobs se loguean con `job_started`, `job_completed` y `job_failed`. No se requiere scheduler externo.

## Redacción automática de datos sensibles

El logger redacta automáticamente los siguientes campos en cualquier nivel del objeto loguado:

| Path redactado | Sustituido por |
|---------------|----------------|
| `req.headers.authorization` | `[REDACTED]` |
| `req.headers.cookie` | `[REDACTED]` |
| `*.password` | `[REDACTED]` |
| `*.token` | `[REDACTED]` |
| `*.refreshToken` | `[REDACTED]` |
| `*.otp` | `[REDACTED]` |
| `*.secret` | `[REDACTED]` |

Esto aplica a todos los logs del servicio, incluyendo logs de errores que puedan incluir el contexto del request.
