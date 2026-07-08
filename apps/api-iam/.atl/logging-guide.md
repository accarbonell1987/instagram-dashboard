# Logging Guide — api-iam

## Stack

Pino v10. Worker-thread async writes. JSON en producción, pretty en desarrollo.

## Factory

`createLogger(options: CreateLoggerOptions): Promise<Logger>` — async, en `src/lib/logger.ts`.
La composition root usa `await createLogger(config)` dentro de `async function main()`.

## Variables de entorno

| Variable | Default dev | Default prod | Descripción |
|---|---|---|---|
| `LOG_LEVEL` | `debug` | `info` | Nivel mínimo |
| `LOG_TO_CONSOLE` | `true` | `false` | Mirror a stdout |
| `LOG_FILE_PATH` | `./logs/api-iam.log` | (override) | Archivo de log |
| `LOG_FORMAT` | `pretty` | `json` | Formato consola |

## Categorías de eventos

- **http**: `http_request` (access log por request, emitido en `access-log.middleware.ts`)
- **auth**: `login_success`, `login_failed`, `logout`, `session_issued`, `refresh_reuse` (ERROR), `otp_required`, `password_recovery_*`, `invitation_accepted`, `first_login_completed`, `tenant_provisioned`, `provisioning_failed`
- **otp**: `otp_sent`, `otp_verified`, `otp_verify_failed`, `otp_locked`, `otp_rate_limited`
- **job**: `job_started`, `job_completed`, `job_failed` (5 cron jobs)
- **system**: `service_started`, `service_stopping`, `unhandled_error`

## Patrón de inyección en services

```typescript
// En *Deps:
logger: Logger  // required, no optional

// En el create factory:
const log = deps.logger.child({ component: 'auth' })

// Al emitir:
log.info({ category: 'auth', event: 'login_success', userId, tenantId }, 'login_success')
```

## Tests

```typescript
import { silentLogger } from '../test-helpers/logger.js'
// Pasar silentLogger a cualquier createXxxService({ ..., logger: silentLogger })
```

Para assertions de log output, usar `createMemoryLogger()` del mismo módulo.

**Importante**: usar `vi.clearAllMocks()`, NO `vi.restoreAllMocks()` — el segundo rompe mocks de módulos como `argon2`.

## Excepción documentada

`src/config.ts:93` y `main().catch(console.error)` en `src/index.ts` usan `console.*`.
El logger no existe aún en esos puntos — es la única excepción aceptada al no-console rule.

## Datos sensibles

Redact automático en: `password`, `token`, `refreshToken`, `otp`, `secret`, `Authorization` header, cookies.
NUNCA loguear credenciales, tokens completos ni datos PII en los fields.

## refresh_reuse → ERROR

El evento `refresh_reuse` se loguea a nivel `ERROR` (no warn) — indica posible robo de token.
Monitorear en producción con alertas activas.

## Módulo logger como leaf

`src/lib/logger.ts` es un módulo hoja — no importa nada de `services/`, `routes/` ni `repositories/`.
Esto evita dependencias circulares. Todos los demás módulos importan desde `lib/`, nunca al revés.
