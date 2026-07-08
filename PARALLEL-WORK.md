# Coordinación de SDDs en paralelo

Este monorepo soporta múltiples sesiones Claude Code trabajando en paralelo en distintos
changes SDD. Esta nota documenta las convenciones para no chocar.

## Estado de SDDs backend

| Change | Estado | Archivado |
|---|---|---|
| `iam-bootstrap` | ✅ ARCHIVADO | SDD completo — API IAM implementada (31 endpoints, Prisma, adapters, tests) |
| `iam-logging` | ✅ ARCHIVADO | SDD completo — Pino v10 inyectado en todos los services y middleware |

> La API IAM (`apps/api-iam`) es operacional. Ambos SDDs backend han sido completados y archivados.

## SDDs activos

| Change | Owner (sesión) | Toca | Lee |
|---|---|---|---|
| `tenant-onboarding-auth` | Sesión "frontend" | `apps/hub/**`, `apps/landing-page/**` | `apps/hub/.atl/*` |

## Reglas

1. **El contrato OpenAPI** (`apps/hub/.atl/api-contract.yaml`) es la única interfaz entre apps.
   Cambios al contrato → coordinar con el usuario antes de aplicar. Ningún orquestador
   puede modificarlo unilateralmente.

2. **No cruzar territorios**: el orquestador X no toca el área del orquestador Y.
   En caso de duda sobre a quién pertenece un archivo → preguntar al usuario.

3. **Engram topic keys**: usar el prefijo del change (`sdd/{change-name}/*`).
   No escribir en topic keys de otro change.

4. **Branches**: prefijo del change (`feature/hub-*`, `feature/iam-*`).

5. **Commits**: prefijo `[hub]` o `[iam]` en el subject del commit para audit rápido.
   Ejemplo: `[iam] feat: add OTP service with stub adapter`

6. **Drift del contrato**: cualquier desincronización entre los MSW handlers del frontend
   y el backend real se reporta como bug del orquestador que la introdujo. El MSW
   del frontend es la fuente de verdad temporal mientras el backend no existe.

7. **Compaction safety**: cada sesión recupera contexto vía `mem_search` +
   `mem_get_observation` al inicio. Los topic keys son la fuente de verdad entre sesiones.

## Arrancar la sesión backend (iam-bootstrap) — COMPLETADO

> Esta sesión ya no aplica. `iam-bootstrap` e `iam-logging` están archivados.
> La API IAM está implementada y operacional. Ver `apps/api-iam/CLAUDE.md` para el estado actual.

## Verificar que ambas sesiones no chocan

Antes de un `git push` o `git merge`, verificar que no haya cambios en áreas ajenas:

```bash
# Sesión frontend — no debería tocar apps/api-iam/
git diff --name-only HEAD | grep apps/api-iam

# Sesión backend — no debería tocar apps/hub/
git diff --name-only HEAD | grep apps/hub
```
