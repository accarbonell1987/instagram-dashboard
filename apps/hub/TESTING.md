# Guía de Testing Manual — Corehub Hub

> **Versión**: 1.0 — Mayo 2026  
> **Contexto**: Hub en modo MSW (mocks en el browser). No requiere backend real.

---

## Configuración inicial

### Arrancar el hub en modo mock

```bash
# Desde la raíz del monorepo
pnpm --filter @corehub/hub dev
```

El hub corre en **http://localhost:3001**. Los mocks MSW se activan automáticamente cuando la variable `NEXT_PUBLIC_API_MOCKING=enabled` está presente (ya está configurada en `.env.local` para dev).

> ⚠️ **Puerto 3001 conflicto**: `apps/hub` y `@internal/api-example` comparten el puerto 3001. **No ejecutes ambos al mismo tiempo.**

### Verificar que MSW está activo

Abrí las DevTools del browser → pestaña **Console**. Deberías ver:

```
[MSW] Mocking enabled.
```

Si no aparece: recargá la página o verificá que `NEXT_PUBLIC_API_MOCKING=enabled` está en `.env.local`.

---

## Datos de prueba (MSW — escenario `happy`)

| Dato | Valor |
|------|-------|
| **Email usuario** | `test@corehub.com` |
| **Contraseña** | `Pass1234!` (o cualquier contraseña con ese hash) |
| **Nombre** | Ana Pereira |
| **Rol** | TenantAdmin |
| **Empresa** | Empresa Acme S.A. |
| **Tenant slug** | `acme` |
| **Plan** | Profesional |
| **OTP válido** | `000000` (seis ceros) |
| **Token invitación (válido)** | `mock-invitation-token-happy` |
| **Token invitación (expirado)** | `mock-invitation-token-expired` |
| **Token de reanudación (válido)** | `mock-resume-token-happy` |
| **Email invitado** | `nuevo@empresa.com` |
| **Invitador** | Ana Pereira |

### Política de contraseña (MSW)

La API `/auth/password/policy` devuelve:

| Regla | Valor |
|-------|-------|
| Longitud mínima | 12 caracteres |
| Mayúsculas | Sí |
| Minúsculas | Sí |
| Dígito | Sí |
| Símbolo | Sí |
| Sin contraseñas comunes | Sí |

**Contraseña válida para pruebas**: `Corehub2026!`

---

## Activar escenarios MSW

Los escenarios se activan con el query param `?msw=<scenario-name>` en **cualquier URL** de la app. La selección se persiste en `localStorage` (`msw:scenario`).

Para **resetear** al escenario happy: visitar cualquier URL sin el parámetro `?msw=` y recargar, o limpiar `localStorage`.

### Tabla de escenarios disponibles

| Escenario | Query param | Comportamiento |
|-----------|-------------|----------------|
| `happy` | `?msw=happy` | Todo funciona. Login + OTP + onboarding + pago exitosos |
| `otp-failure` | `?msw=otp-failure` | El OTP siempre es rechazado (422) |
| `payment-cancelled` | `?msw=payment-cancelled` | Pago Bancard devuelve `declined` |
| `payment-timeout` | `?msw=payment-timeout` | Pago queda `pending` indefinidamente |
| `session-expired` | `?msw=session-expired` | El refresh token devuelve 401 → logout forzado |
| `invitation-expired` | `?msw=invitation-expired` | Token de invitación devuelve 410 |
| `invitation-used` | `?msw=invitation-used` | Token de invitación devuelve 409 (ya usada) |
| `device-trusted` | `?msw=device-trusted` | Login devuelve `otpRequired=false` (bypass OTP) |

**Cómo activar**: navegar a `http://localhost:3001/login?msw=otp-failure` → el escenario se activa para toda la sesión.

---

## Flujos

---

### 1. Login — `/login`

#### Happy path — Login completo con OTP

**URL**: `http://localhost:3001/login`

1. La página muestra una card con:
   - Título: **"Iniciar sesión"**
   - Descripción: "Accedé a tu portal de aplicaciones"
   - Campo **Correo electrónico** (placeholder: `tu@empresa.com`)
   - Campo **Contraseña**
   - Botón **"Ingresar"**
   - Links: "¿Olvidaste tu contraseña?" y "Registrá tu empresa"

2. Completar:
   - Correo: `test@corehub.com`
   - Contraseña: `Pass1234!`

3. Hacer clic en **"Ingresar"**.

4. ✅ El botón muestra **"Ingresando..."** mientras espera la respuesta.

5. ✅ La UI transiciona al **formulario OTP**. Se muestra:
   - Texto: "Enviamos un código de 6 dígitos a tu correo electrónico `test@corehub.com`."
   - 6 slots de entrada para el OTP
   - Checkbox **"Confiar en este dispositivo por 60 días"**
   - Botón **"Verificar código"** (deshabilitado hasta completar 6 dígitos)
   - Botón **"Reenviar código en 0:30"** (countdown de 30 segundos)
   - Botón **"Volver"**

6. Ingresar el código OTP: `000000`

7. Hacer clic en **"Verificar código"**.

8. ✅ El botón muestra **"Verificando..."** brevemente.

9. ✅ Redirección a `/` (portal autenticado).

10. ✅ La pantalla principal muestra:
    - **"Bienvenido, Ana Pereira"**
    - "Selecciona una aplicación para continuar"
    - Skeletons de carga (400ms) → luego las tarjetas de apps disponibles

---

#### Casos de error — Credenciales

**URL**: `http://localhost:3001/login`

##### ❌ Correo inválido (sin @)

1. Ingresar `noesuncorreo` en el campo de correo.
2. Ingresar cualquier contraseña.
3. Clic en **"Ingresar"**.
4. ❌ Error inline bajo el campo: _"Correo electrónico: Ingresá un correo electrónico válido"_ (validación Zod, no llama a la API).

##### ❌ Campos vacíos

1. No completar ningún campo y hacer clic en **"Ingresar"**.
2. ❌ Los errores de validación aparecen bajo cada campo requerido.

##### ❌ Credenciales incorrectas (email no existe)

1. Ingresar `noexiste@corehub.com` como correo.
2. Ingresar cualquier contraseña.
3. Clic en **"Ingresar"**.
4. ❌ Banner rojo arriba del formulario: _"Correo o contraseña incorrectos. Verificá tus datos e intentá de nuevo."_

##### ❌ Cuenta suspendida (ForbiddenError — 403)

> El mock no activa esto directamente. Está previsto para cuando el backend devuelve 403.
> Mensaje esperado: _"Tu cuenta está suspendida. Contactá con soporte."_

##### ❌ Rate limit (RateLimitError — 429)

> El mock no activa esto directamente. Está previsto para cuando el backend devuelve 429 con `Retry-After`.
> Mensaje esperado: _"Tu cuenta está temporalmente bloqueada. Podés intentar de nuevo en X minuto(s)."_

---

#### Casos de error — OTP

##### ❌ OTP incorrecto

1. Completar credenciales válidas y llegar al paso OTP.
2. Ingresar `123456` (código incorrecto).
3. Clic en **"Verificar código"**.
4. ❌ Error: _"Código incorrecto. Verificá el código e intentá de nuevo."_
5. Los 6 slots se vacían automáticamente.
6. Si quedan ≤2 intentos: el mensaje incluye _"Te quedan X intento(s)."_

##### ❌ OTP siempre falla (escenario `otp-failure`)

1. Navegar a `http://localhost:3001/login?msw=otp-failure`.
2. Completar credenciales válidas.
3. Ingresar cualquier código OTP (incluso `000000`).
4. ❌ Error: _"Código incorrecto. Verificá el código e intentá de nuevo."_ — siempre rechazado.

##### ❌ OTP agotado (máximo 5 intentos)

1. Ingresar código incorrecto 5 veces en el paso OTP.
2. ❌ Después del 5° intento: _"Demasiados intentos. Esperá 15 minutos antes de intentar de nuevo."_
3. Los 6 slots y el botón quedan deshabilitados.

##### ⚠️ Reenvío de OTP (cooldown 30s)

1. Estando en el paso OTP, el botón **"Reenviar código"** muestra el countdown: `Reenviar código en 0:30`.
2. Esperar 30 segundos.
3. ✅ El botón se habilita: **"Reenviar código"**.
4. Clic en **"Reenviar código"** → botón muestra **"Reenviando..."** → vuelve a iniciar countdown.
5. ✅ El nuevo código sigue siendo `000000` (MSW siempre devuelve el mismo).

##### ↩️ Volver al paso de credenciales desde OTP

1. En el paso OTP, hacer clic en **"Volver"**.
2. ✅ La UI regresa al formulario de correo/contraseña.

---

#### Device trust

**Escenario**: `?msw=device-trusted`  
**URL**: `http://localhost:3001/login?msw=device-trusted`

1. Completar credenciales: `test@corehub.com` / `Pass1234!`
2. Clic en **"Ingresar"**.
3. ✅ **Sin pasar por el paso OTP** — redirección directa a `/` (portal).
4. ✅ La pantalla muestra: _"Bienvenido, Ana Pereira"_

> **Cómo funciona**: cuando el escenario es `device-trusted` y el `deviceId` está presente en el request, el mock devuelve `otpRequired: false` con la sesión ya construida.

**Flujo de "Confiar en este dispositivo"** (en escenario normal):
1. Llegar al paso OTP.
2. Marcar el checkbox **"Confiar en este dispositivo por 60 días"**.
3. Ingresar OTP `000000`.
4. Clic en **"Verificar código"**.
5. ✅ Login exitoso. En una futura sesión con el mismo `deviceId`, el login bypasseará el OTP.

---

#### Banner post-recovery

**URL**: `http://localhost:3001/login?recovered=true`

1. Navegar directamente a esa URL.
2. ✅ Aparece un banner verde sobre el formulario: _"Contraseña actualizada correctamente. Iniciá sesión con tu nueva contraseña."_

---

### 2. Recuperación de contraseña — `/recover`

#### Happy path completo

**URL**: `http://localhost:3001/recover`

1. La página muestra:
   - Texto: "Ingresá tu correo electrónico y te enviaremos un código para restablecer tu contraseña."
   - Campo **Correo electrónico** (placeholder: `tu@empresa.com`)
   - Botón **"Enviar código"**

2. Ingresar `test@corehub.com`

3. Clic en **"Enviar código"**.
4. ✅ Botón muestra **"Enviando..."** mientras procesa.

5. ✅ Transición al paso OTP. Se muestra:
   - ⚠️ Banner verde (anti-enumeración): _"Si el correo test@corehub.com está registrado, recibirás un código de verificación en los próximos minutos."_
   - Formulario OTP (6 dígitos)
   - Sin checkbox de "Confiar en dispositivo" (no aplica en recover)

6. Ingresar `000000`

7. Clic en **"Verificar código"**.
8. ✅ Transición al paso **"Nueva contraseña"**. Se muestra:
   - Texto: "Ingresá tu nueva contraseña."
   - Campo **Nueva contraseña**
   - Checklist de reglas en tiempo real:
     - ○/✓ Mínimo 12 caracteres
     - ○/✓ Al menos una mayúscula
     - ○/✓ Al menos una minúscula
     - ○/✓ Al menos un número
     - ○/✓ Al menos un símbolo
   - Campo **Confirmar contraseña**
   - Botón **"Restablecer contraseña"** (deshabilitado hasta que todas las reglas pasen)

9. Ingresar contraseña: `Corehub2026!`
10. Confirmar: `Corehub2026!`

11. Clic en **"Restablecer contraseña"**.
12. ✅ Botón muestra **"Guardando..."** brevemente.
13. ✅ Redirección a `/login?recovered=true` con el banner verde de confirmación.

---

#### Casos de error — Recover

##### ❌ Email con formato inválido

1. Ingresar `noesuncorreo` en el campo.
2. Clic en **"Enviar código"**.
3. ❌ Error inline: _"Ingresá un correo electrónico válido"_

##### ⚠️ Anti-enumeración (email no registrado)

1. Ingresar un email que no existe: `noexiste@empresa.com`
2. Clic en **"Enviar código"**.
3. ✅ La UI **de todas formas transiciona al paso OTP** con el mismo mensaje: _"Si el correo noexiste@empresa.com está registrado, recibirás un código de verificación en los próximos minutos."_
4. El OTP no llegará, pero el usuario no sabe si el email existe o no (seguridad por diseño).

##### ❌ Rate limit (RateLimitError — 429)

> Si el backend devuelve 429:  
> Mensaje en el banner rojo: _"Demasiados intentos. Podés intentar de nuevo en X minuto(s)."_  
> La UI **NO transiciona** al paso OTP en este caso.

##### ❌ Contraseñas no coinciden

1. Llegar al paso de "Nueva contraseña".
2. Ingresar `Corehub2026!` en "Nueva contraseña" y `OtraPassword1!` en "Confirmar contraseña".
3. ❌ Error bajo el campo de confirmar: _"Las contraseñas no coinciden"_

##### ❌ Contraseña no cumple política

1. Ingresar `corta` en "Nueva contraseña".
2. ✅ La checklist muestra en rojo las reglas no cumplidas (longitud, mayúsculas, etc.).
3. El botón **"Restablecer contraseña"** permanece deshabilitado.

##### ↩️ Volver al paso de email desde OTP

1. En el paso OTP, hacer clic en **"Volver"**.
2. ✅ La UI regresa al formulario de email.

---

### 3. Primer acceso / Activación de cuenta — `/first-login`

#### Happy path

**URL**: `http://localhost:3001/first-login`

> Este flujo es para usuarios invitados que aún no tienen contraseña configurada. No lleva a `/login` sino que va al portal directamente al finalizar.

1. La página muestra:
   - Campo **Correo electrónico** (placeholder: `tu@empresa.com`)
   - Botón **"Continuar"**

2. Ingresar `test@corehub.com`

3. Clic en **"Continuar"**.
4. ✅ Botón muestra **"Enviando..."** brevemente.

5. ✅ Transición al paso OTP.
   - Texto: "Enviamos un código de 6 dígitos a tu correo electrónico `test@corehub.com`."
   - Sin checkbox de "Confiar en dispositivo"

6. Ingresar `000000`

7. Clic en **"Verificar código"**.

8. ✅ Transición al paso **"Configurar contraseña"**:
   - Texto: "Configurá tu contraseña para activar tu cuenta."
   - Campo **Nueva contraseña** con checklist en tiempo real
   - Campo **Confirmar contraseña**
   - Botón **"Activar cuenta"**

9. Ingresar `Corehub2026!` en ambos campos.

10. Clic en **"Activar cuenta"**.
11. ✅ Botón muestra **"Guardando..."** brevemente.
12. ✅ Redirección a `/` (portal autenticado).

---

#### Casos de error — First Login

##### ❌ Correo inválido

1. Ingresar `noesuncorreo` y clic en **"Continuar"**.
2. ❌ Error inline: _"Ingresá un correo electrónico válido"_

##### ❌ Error en inicio (email no encontrado u otro error)

1. El mock para `first-login/start` siempre responde 200 con `MOCK_OTP_ID`.
2. Para simular un error: pausar MSW en DevTools y ver el error genérico.
3. Mensaje esperado: _"No se pudo iniciar el proceso. Verificá tu correo e intentá de nuevo."_ (o el `err.message` del servidor si es específico).

##### ↩️ Volver desde OTP a email

1. En el paso OTP, hacer clic en **"Volver"**.
2. ✅ La UI regresa al formulario de email (con el email ya precargado en `defaultValues`).

---

### 4. Aceptar invitación — `/invite/[token]`

#### Happy path

**URL**: `http://localhost:3001/invite/mock-invitation-token-happy`

1. La página muestra un **spinner** de carga mientras verifica el token.

2. ✅ Carga exitosa. Se muestra la pantalla de preview:
   - Título: **"Fuiste invitado a Empresa Acme S.A."**
   - Subtítulo: **"Ana Pereira te invitó como Usuario"** (role: User → "Usuario")
   - Card con: Label "Correo electrónico" → `nuevo@empresa.com`
   - Botón **"Aceptar invitación"**

3. Hacer clic en **"Aceptar invitación"**.

4. ✅ Transición al paso de contraseña:
   - Título: **"Creá tu contraseña"**
   - Subtítulo: "Accederás como **Usuario** en **Empresa Acme S.A.**."
   - Campos de contraseña con checklist

5. Ingresar `Corehub2026!` en ambos campos.

6. Clic en **"Crear cuenta y acceder"**.
7. ✅ Botón muestra **"Guardando..."** brevemente.
8. ✅ Redirección a `/` (portal autenticado como el usuario invitado).

---

#### Casos de error — Invitación

##### ❌ Invitación expirada

**Escenario A — URL con token de seed expirado**:  
`http://localhost:3001/invite/mock-invitation-token-expired`

**Escenario B — Via MSW**:  
`http://localhost:3001/invite/cualquier-token?msw=invitation-expired`

1. La página carga el spinner brevemente.
2. ❌ Se muestra la vista de error:
   - Título: **"Esta invitación expiró"**
   - Texto: _"Las invitaciones son válidas por 7 días. Pedí a la empresa que te envíe una nueva."_
   - Botón: **"Ir al inicio"** → navega a `/login`

##### ❌ Invitación ya usada (409)

**URL**: `http://localhost:3001/invite/cualquier-token?msw=invitation-used`

1. El spinner carga.
2. ❌ Se muestra:
   - Título: **"Esta invitación ya fue usada"**
   - Texto: _"Ya existe una cuenta asociada a esta invitación. Iniciá sesión para continuar."_
   - Botón: **"Ir a Iniciar sesión"** → navega a `/login`

##### ❌ Error genérico (token inválido / red caída)

1. Si la API devuelve un error no reconocido (ni 410 ni 409):
   - Título rojo: **"Error al cargar la invitación"**
   - Texto: _"No pudimos verificar tu invitación. Verificá el enlace o contactá a soporte."_
   - Botón: **"Ir a Iniciar sesión"**

##### ❌ Error al aceptar (después de crear contraseña)

1. Llegar al paso de contraseña.
2. Si el servidor devuelve error al aceptar (por ej., token expiró durante el llenado):
3. ❌ Banner rojo bajo el título: _"Error al aceptar la invitación. Intenta de nuevo."_ (o el `err.message` del servidor).

---

### 5. Wizard de registro — `/signup` → `/signup/[draftId]/[step]`

El wizard tiene **6 pasos**: `plan` → `representative` → `otp` → `company` → `payment` → `summary`

#### Paso 0: Entrada al wizard — `/signup`

**URL**: `http://localhost:3001/signup`

1. La página muestra un **spinner** ("Iniciando registro...") mientras crea el draft.
2. ✅ Redirección automática a `/signup/draft-0001.../plan`.
3. El URL de destino depende del `draftId` generado (secuencial: `draft-0001-0000-0000-0000-000000000001`).

**Entrada con plan preseleccionado**:  
`http://localhost:3001/signup?plan=professional`  
→ Salta directo a `/signup/[draftId]/representative` (no muestra el paso de plan).

##### ❌ Error al crear draft

Si el servidor falla:
- ❌ Pantalla de error: "Error al iniciar" / _"No se pudo iniciar el registro. Intenta de nuevo."_
- Botón **"Reintentar"** que recarga.

---

#### Paso 1: Selección de plan — `/signup/[draftId]/plan`

1. La página muestra **"Elige tu plan"** con spinner de carga mientras obtiene los planes.

2. ✅ Se muestran 3 tarjetas de planes:
   - **Básico** — 150.000 PYG/mes — 3 features
   - **Profesional** ⭐ (badge "Popular") — 450.000 PYG/mes — 4 features
   - **Enterprise** — 0 PYG/mes (precio por consulta) — 4 features

3. Hacer clic en **"Profesional"**:
   - ✅ La card queda seleccionada (estado visual resaltado).
   - El botón de la card cambia a **"Continuar"**.

4. Hacer clic en **"Continuar"** en la card Profesional:
   - ✅ Botón muestra estado de carga.
   - ✅ Redirección a `/signup/[draftId]/representative`.

**Nota — interacción con card no seleccionada**:
- **Primer clic** en una card no seleccionada → la selecciona (no navega).
- **Segundo clic** (card ya seleccionada) → guarda y navega.

##### ❌ Error al guardar plan

Si el PATCH falla:
- ❌ Banner rojo: _"No se pudo guardar el plan. Intenta de nuevo."_
- El botón vuelve a habilitarse.

---

#### Paso 2: Datos del representante — `/signup/[draftId]/representative`

1. La página muestra **"Datos del representante"** con:
   - Campo **Correo electrónico** (placeholder: `representante@empresa.com`)
   - Campo **Nombre completo** (placeholder: `Ana Pereira`)
   - Campo **Teléfono** (selector de código de país LATAM + número)
   - Botón **"Continuar"**

2. Completar:
   - Email: `test@corehub.com`
   - Nombre: `Ana Pereira`
   - Teléfono: `+595` / `0981234567`

3. Clic en **"Continuar"**.
4. ✅ Botón muestra **"Enviando código..."** mientras guarda el draft y envía OTP.
5. ✅ Redirección a `/signup/[draftId]/otp?otpId=otp-00000000-...`

##### ❌ Validaciones del formulario (onBlur)

- Email vacío o inválido → error bajo el campo.
- Nombre completo vacío → error bajo el campo.
- Teléfono vacío o inválido → error bajo el campo.
- Al intentar enviar con errores: banner rojo "Por favor, corrige los errores en el formulario."

##### ❌ Rate limit al enviar OTP

❌ Banner rojo: _"Demasiados intentos. Esperá X segundos e intentá de nuevo."_

##### ❌ Error genérico al guardar

❌ Banner rojo: _"No se pudo guardar la información. Intenta de nuevo."_

---

#### Paso 3: Verificación OTP del representante — `/signup/[draftId]/otp`

1. La página muestra **"Verificación del correo"**:
   - Texto: "Enviamos un código a **test@corehub.com**"
   - Formulario OTP de 6 dígitos (sin checkbox de device trust)
   - Botones "Reenviar código" (con countdown 30s) y "Volver"

2. Ingresar `000000`

3. Clic en **"Verificar código"**.
4. ✅ Redirección a `/signup/[draftId]/company`.

##### ❌ OTP incorrecto

- ❌ Error: _"Código incorrecto. Verificá el código e intentá de nuevo."_
- Los slots se vacían.

##### ↩️ Volver al paso anterior

- Clic en **"Volver"** → `/signup/[draftId]/representative`

##### ⚠️ Navegación directa (sin otpId en URL)

Si el usuario navega directamente a `/signup/[draftId]/otp` sin el `?otpId=...`:
1. El spinner de "Enviando código..." aparece brevemente.
2. ✅ El OTP se envía automáticamente (nuevo envío).
3. Una vez recibido el `otpId`, aparece el formulario.

---

#### Paso 4: Datos de la empresa — `/signup/[draftId]/company`

1. La página muestra **"Datos de la empresa"** (grilla 2 columnas en desktop) con:
   - **Razón social** (placeholder: `Empresa ACME S.A.`) — ancho completo
   - **RUC** (placeholder: `80012345-1`)
   - **Tipo de empresa** (select: SA, SRL, SAS, Persona Física, etc.)
   - **Dirección fiscal** (placeholder: `Av. Mariscal López 2000`) — ancho completo
   - **Ciudad** (placeholder: `Asunción`)
   - **Departamento** (select con departamentos de Paraguay, default: Central)
   - **Teléfono** (placeholder: `+595 21 123456`, precargado del paso 2)
   - **Persona de contacto** (placeholder: `Ana Pereira`, precargado del paso 2)
   - **Cargo** (placeholder: `Gerente General`)
   - **Sitio web** (placeholder: `https://www.empresa.com`, **opcional**) — ancho completo
   - Botón **"Continuar"**

2. Completar datos obligatorios:
   - Razón social: `Empresa ACME S.A.`
   - RUC: `80012345-1`
   - Tipo: `SA`
   - Dirección: `Av. Mariscal López 2000`
   - Ciudad: `Asunción`
   - Departamento: `Central`
   - Teléfono: `+595 21 123456`
   - Persona de contacto: `Ana Pereira`
   - Cargo: `Gerente General`

3. Clic en **"Continuar"**.
4. ✅ Botón muestra **"Guardando..."** brevemente.
5. ✅ Redirección a `/signup/[draftId]/payment`.

##### ❌ Campos obligatorios vacíos

Al intentar enviar sin completar campos requeridos:
- ❌ Errores inline bajo cada campo faltante con borde rojo.
- ❌ Banner rojo: _"Por favor, corrige los errores en el formulario."_

##### ❌ Error al guardar

❌ Banner rojo: _"No se pudo guardar la información. Intenta de nuevo."_

---

#### Paso 5: Pago — `/signup/[draftId]/payment`

##### Vista de inicio del pago

1. La página muestra **"Pago"** con:
   - Título y descripción: "Completa tu pago para activar tu cuenta."
   - Panel "Resumen del pedido":
     - Nombre del plan + ciclo (ej: "Profesional · mensual")
     - Precio formateado (ej: `450.000 PYG`)
     - Empresa: nombre de la empresa del paso 4
   - Botón **"Pagar con Bancard"**
   - Texto: "Serás redirigido al portal de pago seguro de Bancard."

2. Clic en **"Pagar con Bancard"**.
3. ✅ Botón muestra **"Redirigiendo a Bancard..."** y se deshabilita.
4. ✅ Redirección a `/signup/[draftId]/payment?status=verifying` (en el mock el `redirectUrl` apunta al mismo origen).

##### Vista de verificación del pago (happy path)

1. La página muestra el spinner de verificación:
   - Spinner animado
   - Texto: **"Verificando tu pago..."**
   - Barra de progreso que avanza
   - Mensaje: "Confirmando con el proveedor de pagos..."

2. ✅ Después de ~3 polls (aprox. 3-6 segundos), el pago se aprueba.

3. ✅ Redirección automática a `/signup/[draftId]/summary`.

##### ❌ Pago rechazado — escenario `payment-cancelled`

**URL**: `http://localhost:3001/signup?msw=payment-cancelled`

1. Completar los pasos hasta llegar al pago.
2. Clic en **"Pagar con Bancard"**.
3. En la vista de verificación aparece inmediatamente:
   - ✗ ícono grande
   - Título: **"Pago rechazado"**
   - Texto: _"Tu pago fue rechazado. Verificá los datos de tu tarjeta e intentá de nuevo."_
   - Botón: **"Reintentar pago"** → vuelve a la vista de inicio del pago.

##### ⏱ Pago timeout — escenario `payment-timeout`

**URL**: `http://localhost:3001/signup?msw=payment-timeout`

1. Completar los pasos hasta el pago.
2. Clic en **"Pagar con Bancard"**.
3. La barra de progreso avanza durante ~60 segundos.
4. ⚠️ Al llegar al límite:
   - ⏱ ícono grande
   - Título: **"Verificación pendiente"**
   - Texto: _"No pudimos confirmar tu pago aún. Verificá tu correo o contactá a soporte."_
   - Botón **"Reintentar verificación"** → intenta volver a consultar el estado.
   - Botón **"Ir al inicio"** → navega a `/`.

##### ❌ Error al iniciar el pago

Si `payment/initiate` falla:
- ❌ Banner rojo: _"No se pudo iniciar el pago. Intenta de nuevo."_
- El botón vuelve a habilitarse.

---

#### Paso 6: Resumen / Confirmación — `/signup/[draftId]/summary`

1. Primero se muestra el spinner de "Completando registro..." mientras se ejecuta el `submit`.

2. ✅ Una vez completado, la pantalla muestra:
   - ✓ ícono verde circular grande
   - Título: **"Registro completado"**
   - Texto: _"**[Razón social]** ya es parte de Corehub. Tu cuenta está lista."_
   - Sección **"Tus documentos"**:
     - Botón **"Descargar Factura PDF"**
     - Botón **"Descargar Contrato PDF"**
   - Botón grande: **"Ir a la plataforma"** → navega a `/`
   - Texto: _"También recibirás los documentos en tu correo electrónico."_

3. Hacer clic en **"Ir a la plataforma"**.
4. ✅ Redirección a `/` (portal autenticado).

##### ❌ Error al completar el registro

Si el submit falla:
- ❌ Mensaje de error con rol `alert`.
- Botón **"Ir al inicio"** para salir sin completar.

---

### 6. Reanudar registro — `/signup/resume/[token]`

**URL**: `http://localhost:3001/signup/resume/mock-resume-token-happy`

#### Happy path

1. La página muestra un **spinner** grande centrado ("Retomando registro...").
2. El sistema consume el token, obtiene el `draftId` y deriva el paso actual.
3. ✅ Redirección automática a `/signup/draft-resume-0000-0000-0000-000000000001/company`
   (el draft de prueba está en el paso `company` con OTP ya verificado).

#### ❌ Token expirado o ya usado

Si el token no existe, está expirado o ya fue usado (410 de la API):

1. La pantalla muestra:
   - Título: **"Este enlace expiró"**
   - Texto: _"El enlace de reanudación ya no es válido. Puedes comenzar el registro de nuevo."_
   - Botón: **"Comenzar de nuevo"** → navega a `/signup`.

#### ❌ Error genérico al retomar

Si hay otro error (red, etc.):

1. La pantalla muestra:
   - Título: **"Error al retomar"**
   - Mensaje: _"No se pudo retomar el registro. Intenta de nuevo."_
   - Botón: **"Comenzar de nuevo"** → navega a `/signup`.

#### Probar con escenario `invitation-expired` (reutiliza el handler)

**URL**: `http://localhost:3001/signup/resume/cualquier-token?msw=invitation-expired`

> ⚠️ El escenario `invitation-expired` también afecta el handler de resume tokens (devuelve 410). Útil para probar la vista de expiración sin necesidad del token real.

---

### 7. Portal autenticado — `/`

#### Happy path — Acceso normal

**URL**: `http://localhost:3001/` (tras login exitoso)

1. La página muestra:
   - Encabezado: **"Bienvenido, [nombre completo]"** (ej: "Bienvenido, Ana Pereira")
   - Subtítulo: "Selecciona una aplicación para continuar"
   - Grid de **skeletons** de carga (6 tarjetas animadas durante 400ms)

2. ✅ Después de 400ms, aparecen las tarjetas de apps (`AppCard`).

3. Si no hay apps disponibles:
   - Texto centrado: _"No hay aplicaciones disponibles."_

4. Hacer clic en una tarjeta de app:
   - ✅ Se abre en una nueva pestaña del browser.

#### ⚠️ Refresh silencioso de token

El sistema hace refresh automático del access token cuando está por expirar. Para probar:

1. Login exitoso.
2. Esperar o simular expiración del token.
3. ✅ La aplicación debería continuar funcionando sin pedirte que vuelvas a loguearte (refresh transparente).

#### ❌ Sesión expirada (refresh token inválido)

**Escenario**: `?msw=session-expired`  
**URL**: `http://localhost:3001/?msw=session-expired`

1. Loguearte con credenciales válidas.
2. Cuando el token intenta renovarse, el mock devuelve 401.
3. ❌ El sistema detecta la sesión expirada → redirección a `/login`.

#### ↩️ Acceso sin autenticación

1. Cerrar sesión o abrir una ventana en incógnito.
2. Intentar acceder directamente a `http://localhost:3001/`.
3. ✅ Redirección automática a `/login` (RequireAuth guard).

---

## Checklist de regresión rápida

Usar después de cualquier cambio significativo en el código:

### Autenticación básica

- [ ] Login con `test@corehub.com` + `Pass1234!` → OTP → portal ✅
- [ ] OTP incorrecto muestra error ❌
- [ ] Login con email inexistente muestra "Correo o contraseña incorrectos" ❌
- [ ] Device trust: login con `?msw=device-trusted` bypasea OTP ✅
- [ ] Recovery: email → OTP → nueva contraseña → redirect a `/login?recovered=true` ✅
- [ ] First-login: email → OTP → contraseña → portal ✅

### Invitaciones

- [ ] `/invite/mock-invitation-token-happy` → preview → contraseña → portal ✅
- [ ] `/invite/cualquier-token?msw=invitation-expired` → vista "Esta invitación expiró" ❌
- [ ] `/invite/cualquier-token?msw=invitation-used` → vista "Esta invitación ya fue usada" ❌

### Wizard de registro

- [ ] `/signup` → spinner → redirige a `/signup/[draftId]/plan` ✅
- [ ] Paso plan: seleccionar Profesional → continuar → paso representative ✅
- [ ] Paso representative: completar datos → enviar → OTP ✅
- [ ] Paso OTP: `000000` → company ✅
- [ ] Paso company: completar → continuar → payment ✅
- [ ] Paso payment: iniciar → verificando → aprobado → summary ✅
- [ ] Paso summary: "Registro completado" con documentos ✅
- [ ] `?msw=payment-cancelled`: pago rechazado muestra "Pago rechazado" ❌
- [ ] `?msw=payment-timeout`: timeout muestra "Verificación pendiente" ⚠️

### Reanudación

- [ ] `/signup/resume/mock-resume-token-happy` → redirige al paso correcto ✅
- [ ] Resume con token inválido → "Este enlace expiró" ❌

### Portal

- [ ] Acceso autenticado muestra "Bienvenido, [nombre]" ✅
- [ ] Acceso sin autenticación redirige a `/login` ✅
- [ ] `?msw=session-expired` → refresh falla → redirect a `/login` ❌

---

## Scenarios MSW disponibles — Referencia completa

| Scenario ID | Query param | Descripción | Flujos afectados |
|-------------|-------------|-------------|------------------|
| `happy` | `?msw=happy` | Todo funciona correctamente | Todos los flujos — happy paths |
| `otp-failure` | `?msw=otp-failure` | OTP siempre rechazado (422) | Login (OTP), cualquier flujo con OTP |
| `payment-cancelled` | `?msw=payment-cancelled` | Bancard devuelve `declined` | Wizard paso 5 |
| `payment-timeout` | `?msw=payment-timeout` | Pago queda `pending` siempre | Wizard paso 5 |
| `session-expired` | `?msw=session-expired` | Refresh token devuelve 401 | Portal (`/`), cualquier ruta autenticada |
| `invitation-expired` | `?msw=invitation-expired` | Invitación devuelve 410 | `/invite/[token]`, también afecta `/signup/resume/[token]` |
| `invitation-used` | `?msw=invitation-used` | Invitación devuelve 409 | `/invite/[token]` |
| `device-trusted` | `?msw=device-trusted` | Login sin OTP (`otpRequired: false`) | `/login` |

### Persistencia del escenario

- El escenario seleccionado se guarda en `localStorage` con clave `msw:scenario`.
- Se puede cambiar en cualquier momento añadiendo `?msw=<scenario>` a cualquier URL.
- Para volver al default `happy`: limpiar `localStorage` manualmente (DevTools → Application → Local Storage → eliminar `msw:scenario`) o navegar con `?msw=happy`.

---

## Notas de debugging

### Ver logs MSW

En DevTools → Console, MSW loguea cada request interceptado:
```
[MSW] GET /auth/me  (200 OK)
[MSW] POST /auth/login  (200 OK)
```

### Inspeccionar el db MSW (estado en memoria)

No hay UI para esto, pero puedes agregar un `console.log` en un handler o usar el panel de Network para ver los request/response bodies.

### Limpiar estado entre pruebas

El estado MSW persiste solo mientras la página está abierta. Un **full reload** (Ctrl+Shift+R) o cambio de escenario con `?msw=happy` resetea la base de datos en memoria del MSW.

### Verificar idempotencia

Los endpoints con `Idempotency-Key` (PATCH draft, POST payment, POST invitations accept) son idempotentes. Si el mismo request se repite (misma key), devuelve la respuesta cacheada sin efectos secundarios.
