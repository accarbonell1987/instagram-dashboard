# Contract Issues — apps/api-iam ↔ apps/hub

> Registro vivo de inconsistencias detectadas en `apps/hub/.atl/api-contract.yaml`
> y su resolución coordinada con la sesión frontend SDD (`tenant-onboarding-auth`).
> El contrato es la única interfaz entre apps — no asumir ni interpretar.

## v1.1.0 — issues 1–5 (resueltos 2026-05-04)

Detectados durante `sdd-explore` del change `iam-bootstrap`.
Resueltos por la sesión frontend en el bump v1.0.0 → v1.1.0.

Detalle completo de cada resolución en engram:
- `sdd/iam-bootstrap/contract-decisions` (resoluciones, observation #425)
- `sdd/tenant-onboarding-auth/design/api-contract-changelog` (changelog del contrato, #424)
- `sdd/tenant-onboarding-auth/design/api-contract` (contrato completo v1.1.0)

| # | Issue                                                  | Resolución                                                                         |
| - | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1 | Falta `GET /.well-known/jwks.json`                     | **Agregado**. Público, RFC 7517, soporte rotación (`kid`), Cache-Control 5min.     |
| 2 | Falta `POST /webhooks/bancard`                         | **Agregado** bajo tag `webhooks`. Firma `X-Bancard-Signature`. 200 salvo 401/400.  |
| 3 | JWT claims incompletos en `Session.accessToken`        | **Documentado**: `sub, tenant_id, tenant_uuid, role, exp, iat, jti, iss, aud, kid` |
| 4 | `DraftUpdateRequest.otpVerified`                       | **Server-authoritative**. Backend IGNORA el campo silenciosamente (bug frontend).  |
| 5 | `trustDevice` ambiguo en `/auth/otp/verify`            | **Movido** a `POST /auth/login/complete` exclusivamente.                           |

### Decisión adicional vinculante

- **JWT `iss` canónico**: `https://iam.corehub.com`
- `backend-requirements.md §4` está stale (decía `api.corehub.com`) — usar el del contrato.

## Protocolo

Si durante `sdd-propose`/`sdd-spec`/`sdd-design`/`sdd-apply` aparece una nueva
inconsistencia, **parar**, escribir nueva sección acá, avisar al usuario, y
esperar resolución de la sesión frontend. **No asumir**, **no interpretar**.
