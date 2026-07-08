---
title: "Schema por tenant — Corehub IAM"
description: "Aislamiento de datos mediante schema-per-tenant en PostgreSQL. Cada tenant tiene su propio schema con datos completamente separados."
category: "API: Corehub IAM"
order: 107
date: "2026-05-05"
---

# Schema por tenant

## Modelo de aislamiento

El servicio IAM implementa **schema-per-tenant** en PostgreSQL: cada tenant tiene su propio schema con nombre `tenant_{slug}` (ej. `tenant_acme`, `tenant_contoso`).

Esto garantiza:

- **Aislamiento completo de datos**: una query sobre el tenant `acme` nunca puede leer datos del tenant `contoso`, ni por error ni por misconfiguration
- **Sin row-level security**: el aislamiento es a nivel de schema, más simple y más barato en términos de query plan
- **Provisionamiento atómico**: el schema de un tenant se crea de forma transaccional en el submit del onboarding

## Cómo funciona

Las queries a schemas de tenant usan `SET search_path TO tenant_<slug>` antes de cada operación:

```sql
SET search_path TO tenant_acme;
SELECT * FROM users WHERE id = 'usr_abc';
```

Esta lógica está encapsulada en `src/db/with-tenant.ts`. El código de servicio **nunca** hardcodea el schema ni construye queries con el slug del tenant: siempre delega al helper `withTenant(slug, fn)`.

## Schemas en la base de datos

| Schema | Contenido |
|--------|-----------|
| `public` | Tablas globales: `tenants`, `plans`, `users` (tabla pública), `idempotency_records`, `onboarding_drafts`, `payments`, `webhook_events`, `invitations` |
| `tenant_{slug}` | Tablas aisladas por tenant: `users`, `refresh_tokens`, `otp_codes`, `password_reset_tokens`, `device_trust_tokens` |

## Provisioning automático

Cuando se completa el onboarding (POST `/onboarding/draft/:draftId/submit`), el servicio de submit:

1. Valida que el pago esté confirmado y el draft en estado correcto
2. Crea el registro del tenant en el schema `public`
3. Ejecuta el migration runner para crear el schema `tenant_{slug}` y sus tablas
4. Crea el usuario administrador del tenant en el nuevo schema
5. Emite el access token y devuelve los documentos generados

El provisioning es transaccional: si cualquier paso falla, el tenant no queda en un estado parcial.

## Administración

**Adminer** (UI web de PostgreSQL) está disponible en `http://localhost:8081` cuando `docker compose` está corriendo:

| Campo | Valor |
|-------|-------|
| System | PostgreSQL |
| Server | `postgres` |
| Username | `corehub` |
| Password | `corehub_dev_password` |
| Database | `corehub_iam` |

Desde Adminer puedes inspeccionar cualquier schema: selecciona el schema en el dropdown de la izquierda.

## Provisioning manual

Para situaciones de troubleshooting o migraciones manuales, consulta el runbook en:

```
apps/api-iam/.atl/manual-tenant.md
```

Ese documento detalla los pasos para provisionar o reparar el schema de un tenant de forma manual, incluyendo los comandos SQL exactos.

## Migration runner

El runner de migraciones de tenant (`src/db/migration-runner.ts`) aplica las migraciones definidas para los schemas de tenant. A diferencia de las migraciones de Prisma (que solo aplican al schema `public`), las migraciones de tenant son SQL plain ejecutadas por el runner interno.

Esto permite:
- Migrar todos los tenants existentes en batch
- Migrar un tenant específico durante el provisioning
- Verificar el estado de migraciones por tenant

Los tests de integración del migration runner están en `src/db/migration-runner.test.ts`.
