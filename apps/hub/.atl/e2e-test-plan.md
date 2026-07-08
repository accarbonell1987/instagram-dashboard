# Plan de Pruebas E2E — Corehub Hub

> **Versión contrato**: 1.1.1 | **Última actualización**: 2026-05-06
>
> Documento para verificación manual de flujos E2E en el navegador.
> Rellenar la columna **Resultado** a medida que se prueban los flujos.
>
> **Leyenda de resultados**: ✅ Pasa | ❌ Falla | ⚠️ Parcial | 🔲 Pendiente | ⏭️ Omitido

---

## Pre-requisitos

Antes de comenzar, verificar que los servicios estén corriendo:

| Servicio   | URL                   | Verificación                        |
| ---------- | --------------------- | ----------------------------------- |
| api-iam    | http://localhost:8080 | `GET /healthz` → `{ status: "ok" }` |
| hub        | http://localhost:3001 | Carga la página de login            |
| PostgreSQL | localhost:5432        | —                                   |

Variables de entorno del hub (`apps/hub/.env.local`):

```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_API_MOCKING=disabled
```

Datos de prueba (cargados con `pnpm --filter @corehub/api-iam db:seed-test`):
| Dato | Valor |
|------|-------|
| Email test | `test@corehub.com` |
| Password test | `Test1234!Secure` |
| OTP stub | `000000` (cualquier código en modo dev) |
| Invite token | `test-invite-token` |
| Invited email | `invited@corehub.com` |

---

## Flujo 1 — Login (usuario recurrente, flujo feliz)

**Ruta**: `/login`
**Objetivo**: Verificar que el login completo con OTP funciona y redirige al portal.

| #   | Paso                                                                      | Esperado                                                                | Resultado | Notas |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------- | ----- |
| 1.1 | Navegar a `http://localhost:3001/login`                                   | Se muestra formulario con campos "Correo electrónico" y "Contraseña"    | 🔲        |       |
| 1.2 | Ingresar `test@corehub.com` + `Test1234!Secure`, hacer clic en "Ingresar" | Aparece formulario OTP de 6 dígitos con mensaje indicando canal (email) | 🔲        |       |
| 1.3 | Ingresar código `000000` en los 6 slots, hacer clic en "Verificar código" | Redirige a `/` (portal)                                                 | 🔲        |       |
| 1.4 | Verificar que el portal muestra el nombre del usuario y tenant            | Header muestra datos reales del usuario autenticado                     | 🔲        |       |

---

## Flujo 2 — Login — contraseña incorrecta

**Ruta**: `/login`
**Objetivo**: Verificar manejo de errores de credenciales.

| #   | Paso                                                                    | Esperado                                                   | Resultado | Notas |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | --------- | ----- |
| 2.1 | Ingresar `test@corehub.com` + `wrongpassword`, hacer clic en "Ingresar" | Aparece mensaje de error "Correo o contraseña incorrectos" | 🔲        |       |
| 2.2 | El formulario sigue accesible y los campos no se borran                 | Puede reintentar sin recargar la página                    | 🔲        |       |
| 2.3 | Ingresar email inexistente `noexiste@test.com` + cualquier password     | Mismo error genérico (sin revelar si el email existe o no) | 🔲        |       |

---

## Flujo 3 — Login — bloqueo de cuenta

**Ruta**: `/login`
**Objetivo**: Verificar bloqueo tras 5 intentos fallidos.

| #   | Paso                                                              | Esperado                                                                                   | Resultado | Notas |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- | ----- |
| 3.1 | Realizar 4 intentos fallidos consecutivos con password incorrecta | Cada intento muestra error "Correo o contraseña incorrectos"                               | 🔲        |       |
| 3.2 | En el 5to intento fallido                                         | Aparece mensaje de cuenta bloqueada con cuenta regresiva (ej. "Intenta de nuevo en 14:59") | 🔲        |       |
| 3.3 | El botón "Ingresar" queda deshabilitado durante el bloqueo        | No puede volver a intentar hasta que expire el tiempo                                      | 🔲        |       |

---

## Flujo 4 — Refresh silencioso

**Objetivo**: Verificar que el access token se renueva automáticamente sin interrumpir al usuario.

| #   | Paso                                                                                                                                             | Esperado                                                                            | Resultado | Notas                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| 4.1 | Iniciar sesión (Flujo 1)                                                                                                                         | Login exitoso, llega al portal                                                      | 🔲        |                                                                                           |
| 4.2 | En DevTools → Application → Cookies, verificar que existe cookie `refresh_token` en `http://localhost:8080`                                      | Cookie `refresh_token` visible, HttpOnly                                            | 🔲        |                                                                                           |
| 4.3 | Esperar 15 minutos (o simular: limpiar `accessToken` en memoria desde DevTools console: `localStorage.clear()`) y navegar a otra ruta del portal | El hub hace refresh silencioso y sigue mostrando el portal sin redirigir al login   | 🔲        | Difícil de probar manualmente — verificar en Network tab que se hace `POST /auth/refresh` |
| 4.4 | En Network tab, verificar shape de respuesta de `POST /auth/refresh`                                                                             | `{ accessToken: string, expiresIn: number }` — sin `tokenType`, `user`, ni `tenant` | 🔲        |                                                                                           |

---

## Flujo 5 — Cierre de sesión

**Objetivo**: Verificar logout limpio y broadcast multi-pestaña.

| #   | Paso                                                                            | Esperado                                                                 | Resultado | Notas |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------- | ----- |
| 5.1 | Iniciar sesión, llegar al portal                                                | Login exitoso                                                            | 🔲        |       |
| 5.2 | Abrir el mismo portal en una segunda pestaña                                    | Segunda pestaña también muestra el portal autenticado                    | 🔲        |       |
| 5.3 | En la pestaña 1, hacer clic en "Cerrar sesión" (o botón de logout en el header) | Pestaña 1 redirige a `/login`                                            | 🔲        |       |
| 5.4 | Verificar pestaña 2 sin hacer nada                                              | Pestaña 2 también redirige a `/login` automáticamente (BroadcastChannel) | 🔲        |       |
| 5.5 | Verificar que la cookie `refresh_token` fue eliminada                           | En DevTools → Cookies, no existe `refresh_token`                         | 🔲        |       |

---

## Flujo 6 — Primer login (representante del asistente)

**Ruta**: `/first-login?email=<email>`
**Objetivo**: Verificar el flujo de activación de cuenta para nuevos representantes.

| #   | Paso                                                                      | Esperado                                                    | Resultado | Notas |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------- | --------- | ----- |
| 6.1 | Navegar a `/first-login?email=test@corehub.com`                           | Muestra formulario de primer login con email pre-completado | 🔲        |       |
| 6.2 | Hacer clic en "Enviar código"                                             | Aparece formulario OTP                                      | 🔲        |       |
| 6.3 | Ingresar código `000000`                                                  | Avanza al formulario de establecer contraseña               | 🔲        |       |
| 6.4 | Verificar que se muestra la política de contraseña con checklist dinámico | Lista de requisitos se actualiza en tiempo real al escribir | 🔲        |       |
| 6.5 | Ingresar contraseña válida + confirmación, enviar                         | Redirige al portal (`/`) con sesión activa                  | 🔲        |       |

---

## Flujo 7 — Invitación

**Ruta**: `/invite/test-invite-token`
**Objetivo**: Verificar el flujo de aceptación de invitación magic-link.

| #   | Paso                                                       | Esperado                                                             | Resultado | Notas |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------- | --------- | ----- |
| 7.1 | Navegar a `http://localhost:3001/invite/test-invite-token` | Muestra preview de invitación con nombre del tenant y email invitado | 🔲        |       |
| 7.2 | Verificar que aparece `tenantName` (no vacío)              | Ej. "Test Tenant"                                                    | 🔲        |       |
| 7.3 | Hacer clic en "Aceptar invitación"                         | Aparece formulario de establecer contraseña                          | 🔲        |       |
| 7.4 | Ingresar contraseña válida y enviar                        | Redirige al portal con sesión activa como usuario invitado           | 🔲        |       |
| 7.5 | Intentar usar el mismo token de invitación nuevamente      | Muestra error 409 "Invitación ya utilizada"                          | 🔲        |       |
| 7.6 | Navegar a `/invite/token-inexistente`                      | Muestra página 404                                                   | 🔲        |       |

---

## Flujo 8 — Asistente de onboarding (flujo feliz completo)

**Ruta**: `/signup`
**Objetivo**: Verificar el flujo completo de registro de un nuevo tenant.

### Paso 8.1 — Selección de plan

| #     | Paso                                                                  | Esperado                                                             | Resultado | Notas                                                 |
| ----- | --------------------------------------------------------------------- | -------------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| 8.1.1 | Navegar a `/signup`                                                   | Redirige a `/signup/<draftId>/plan` y muestra los planes disponibles | 🔲        |                                                       |
| 8.1.2 | Verificar que los planes tienen `billingCycle` (no `billingInterval`) | Los precios/ciclos se muestran correctamente                         | 🔲        | Verificar en Network tab la respuesta de `GET /plans` |
| 8.1.3 | Seleccionar un plan haciendo clic en "Seleccionar"                    | Avanza al paso de representante                                      | 🔲        |                                                       |

### Paso 8.2 — Datos del representante

| #     | Paso                                        | Esperado                                                 | Resultado | Notas |
| ----- | ------------------------------------------- | -------------------------------------------------------- | --------- | ----- |
| 8.2.1 | Completar email, nombre completo y teléfono | Formulario acepta los datos                              | 🔲        |       |
| 8.2.2 | Hacer clic en "Continuar"                   | Avanza al paso OTP (el backend envía un código al email) | 🔲        |       |

### Paso 8.3 — Verificación OTP

| #     | Paso                                               | Esperado                                                  | Resultado | Notas |
| ----- | -------------------------------------------------- | --------------------------------------------------------- | --------- | ----- |
| 8.3.1 | Ingresar código `000000` en el formulario OTP      | Verifica el código correctamente                          | 🔲        |       |
| 8.3.2 | Avanza automáticamente al paso de datos de empresa | El paso OTP desaparece y aparece el formulario de empresa | 🔲        |       |

### Paso 8.4 — Datos de empresa

| #     | Paso                                       | Esperado                                   | Resultado | Notas |
| ----- | ------------------------------------------ | ------------------------------------------ | --------- | ----- |
| 8.4.1 | Completar razón social, RUC y demás campos | Formulario acepta los datos con validación | 🔲        |       |
| 8.4.2 | Hacer clic en "Continuar"                  | Avanza al paso de pago                     | 🔲        |       |

### Paso 8.5 — Pago (Bancard)

| #     | Paso                                                  | Esperado                                             | Resultado | Notas                            |
| ----- | ----------------------------------------------------- | ---------------------------------------------------- | --------- | -------------------------------- |
| 8.5.1 | Verificar que se muestra el resumen del plan y precio | Datos correctos del plan seleccionado                | 🔲        |                                  |
| 8.5.2 | Hacer clic en "Pagar con Bancard"                     | Redirige a la plataforma de Bancard (o stub en dev)  | 🔲        | En dev puede no estar disponible |
| 8.5.3 | Completar el pago en Bancard y volver                 | Regresa a `/signup/<draftId>/payment` y hace polling | 🔲        |                                  |
| 8.5.4 | Esperar confirmación del webhook                      | Avanza al paso resumen automáticamente               | 🔲        |                                  |

### Paso 8.6 — Resumen y submit

| #     | Paso                                                        | Esperado                             | Resultado | Notas |
| ----- | ----------------------------------------------------------- | ------------------------------------ | --------- | ----- |
| 8.6.1 | Verificar que el resumen muestra todos los datos ingresados | Plan, representante, empresa         | 🔲        |       |
| 8.6.2 | Hacer clic en "Confirmar y crear cuenta"                    | Procesa la creación del tenant       | 🔲        |       |
| 8.6.3 | Se muestran botones de descarga de factura y contrato       | Botones de PDF disponibles           | 🔲        |       |
| 8.6.4 | Redirige al portal con sesión activa                        | Usuario autenticado como TenantAdmin | 🔲        |       |

---

## Flujo 9 — Reanudación del asistente

**Objetivo**: Verificar que se puede reanudar el asistente desde un token de reanudación.

| #   | Paso                                                                                | Esperado                                                         | Resultado | Notas |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------- | ----- |
| 9.1 | Iniciar el asistente y completar hasta el paso "Empresa" sin terminar               | Draft guardado en el paso empresa                                | 🔲        |       |
| 9.2 | Navegar a `/signup/resume/<token>` (obtener token de la respuesta del backend)      | Redirige a `/signup/<draftId>/company` con datos pre-completados | 🔲        |       |
| 9.3 | Verificar que los datos previos (representante, plan) están visibles en el progreso | El chip del plan seleccionado se muestra                         | 🔲        |       |

---

## Flujo 10 — Recuperación de contraseña

**Ruta**: `/recover`
**Objetivo**: Verificar el flujo completo de reset de contraseña.

| #    | Paso                                                              | Esperado                                                             | Resultado | Notas |
| ---- | ----------------------------------------------------------------- | -------------------------------------------------------------------- | --------- | ----- |
| 10.1 | Navegar a `/recover`                                              | Muestra formulario con campo de email                                | 🔲        |       |
| 10.2 | Ingresar email válido y enviar                                    | Muestra mensaje de éxito genérico (sin confirmar si el email existe) | 🔲        |       |
| 10.3 | Ingresar email inexistente y enviar                               | Muestra el mismo mensaje de éxito (sin enumerar usuarios)            | 🔲        |       |
| 10.4 | Navegar a `/recover/confirm/<token>` (token del email o del seed) | Muestra formulario de nueva contraseña                               | 🔲        |       |
| 10.5 | Ingresar nueva contraseña válida y enviar                         | Redirige a `/login` con mensaje de éxito                             | 🔲        |       |
| 10.6 | Iniciar sesión con la nueva contraseña                            | Login exitoso                                                        | 🔲        |       |

---

## Flujo 11 — Acceso directo sin sesión

**Objetivo**: Verificar que las rutas protegidas redirigen correctamente.

| #    | Paso                                                               | Esperado                 | Resultado | Notas |
| ---- | ------------------------------------------------------------------ | ------------------------ | --------- | ----- |
| 11.1 | Sin sesión activa, navegar a `http://localhost:3001/`              | Redirige a `/login`      | 🔲        |       |
| 11.2 | Sin sesión activa, navegar a una ruta del portal (ej. `/settings`) | Redirige a `/login`      | 🔲        |       |
| 11.3 | Con sesión activa, navegar a `/login`                              | Redirige al portal (`/`) | 🔲        |       |

---

## Flujo 12 — Verificación de contratos de API

**Objetivo**: Verificar que las respuestas del backend cumplen el contrato en el Network tab.

| #    | Endpoint                            | Shape esperado                                                                                                | Resultado | Notas |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| 12.1 | `POST /auth/login` (éxito)          | `{ otpRequired: true, otpId, channel, maskedDestination, expiresAt }`                                         | 🔲        |       |
| 12.2 | `POST /auth/login/complete` (éxito) | `{ accessToken, expiresIn, user: { id, email, fullName }, tenant: { id, slug, name, planId, status }, role }` | 🔲        |       |
| 12.3 | `GET /auth/me`                      | `{ user: { id, email, fullName, picture? }, tenant: { id, slug, name, planId, status }, role }`               | 🔲        |       |
| 12.4 | `POST /auth/refresh`                | SOLO `{ accessToken, expiresIn }` — sin `tokenType`, `user`, `tenant`                                         | 🔲        |       |
| 12.5 | `GET /plans`                        | `{ plans: [{ id, name, price, currency, billingCycle, features: string[], popular }] }`                       | 🔲        |       |
| 12.6 | `GET /invitations/:token`           | `{ email, role, expiresAt, status, tenantName }`                                                              | 🔲        |       |
| 12.7 | `GET /onboarding/draft/:id`         | DraftState anidado: `{ plan: {...}, representative: {...}, otpVerified, company: {...}, payment: {...} }`     | 🔲        |       |

---

## Resumen de resultados

| Flujo | Descripción                          | Estado | Notas |
| ----- | ------------------------------------ | ------ | ----- |
| 1     | Login feliz                          | 🔲     |       |
| 2     | Login — credenciales incorrectas     | 🔲     |       |
| 3     | Login — bloqueo de cuenta            | 🔲     |       |
| 4     | Refresh silencioso                   | 🔲     |       |
| 5     | Cierre de sesión                     | 🔲     |       |
| 6     | Primer login (representante)         | 🔲     |       |
| 7     | Invitación                           | 🔲     |       |
| 8     | Onboarding wizard completo           | 🔲     |       |
| 9     | Reanudación del asistente            | 🔲     |       |
| 10    | Recuperación de contraseña           | 🔲     |       |
| 11    | Acceso sin sesión / rutas protegidas | 🔲     |       |
| 12    | Contratos de API (Network tab)       | 🔲     |       |

---

## Registro de bugs encontrados

| #   | Flujo | Descripción del bug | Severidad | Estado |
| --- | ----- | ------------------- | --------- | ------ |
| —   | —     | —                   | —         | —      |

> Agregar filas a medida que se encuentren problemas durante las pruebas.
> **Severidad**: 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🟢 Bajo
