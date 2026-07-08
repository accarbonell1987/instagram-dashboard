# Sketches: Flujo de Onboarding y Autenticación — Corehub

> **Cómo usar este archivo**
> 1. Editá las secciones que quieras ajustar (paleta, copy, screens, prioridades).
> 2. Copiá todo el contenido a partir de "## Brief del producto" (sin este bloque) y pegalo en Claude Design.
> 3. Si querés iterar por bloques (por ejemplo, solo el wizard), copiá solo las secciones relevantes + componentes base.

---

## Brief del producto

Corehub es una plataforma SaaS multi-tenant B2B de servicios de telefonía para el mercado paraguayo y latinoamericano. Se dirige a dueños y representantes de pymes que registran sus empresas en la plataforma, y a administradores/usuarios que operan dentro del sistema una vez activos.

La plataforma opera bajo un modelo de suscripción mensual con planes diferenciados. El pago se procesa a través de Bancard, la pasarela de pagos estándar en Paraguay. Toda la interfaz está en español latinoamericano.

El flujo de autenticación y onboarding es el punto de entrada crítico del producto. La experiencia debe transmitir confianza, profesionalismo y seriedad institucional — el tono de una herramienta de gestión empresarial, no de una startup de consumo.

---

## Dirección visual

**Personalidad de marca**: profesional, confiable, institucional. Orientada a pymes. No "startup chillón".

**Mood**: limpio, denso de información pero respirable. Inspiración en herramientas B2B como Linear, Notion, o los portales bancarios modernos de América Latina.

**Paleta sugerida**:
- Primario: azul profundo o índigo (confianza, tecnología)
- Acento: verde esmeralda o teal (éxito, pago confirmado) / rojo sobrio (errores)
- Neutros: grises fríos para fondos y bordes
- Modo claro como default; el diseño debe soportar modo oscuro (tema aplicado por clase `dark` en el `html`)

**Tipografía**: sans-serif geométrica de alta legibilidad. Jerarquía clara: H1 grande para orientar al usuario en cada pantalla, body legible a 14–16px.

**Iconografía**: lineal, neutral, sin rellenos decorativos.

**Radio de bordes**: 8px para tarjetas y contenedores, 6px para inputs y botones. Sistema de espaciado en múltiplos de 4px.

**Sombras**: mínimas. Solo para modales y dropdowns.

---

## Componentes base reutilizables (diseñar primero)

Antes de las pantallas completas, definir estos primitivos porque aparecen en múltiples contextos:

### C-1. InputOTP — 6 slots

El componente central de la plataforma. Aparece en login, first-login, recover, y el wizard de onboarding.

- 6 slots separados visualmente, cada uno con ancho fijo (~48px cuadrado en desktop, ~40px en mobile)
- Estado `empty`: borde sutil, fondo neutro claro
- Estado `focused` (slot activo): borde primario destacado, fondo ligeramente tintado
- Estado `filled`: dígito visible, borde neutro
- Estado `error`: todos los slots con borde rojo suave, mensaje de error debajo
- Estado `success`: todos los slots con borde verde, check o indicador positivo
- Nota de accesibilidad: cada slot tiene `aria-label="Código de verificación, dígito N de 6"` y referencia a la región de error via `aria-describedby`

### C-2. Botón primario con estados

- Default, hover, focus (ring visible), disabled, loading (spinner inline reemplaza el label)
- Tamaños: SM, MD (default), LG
- Variantes: primario (fondo sólido), secundario (outline), ghost (texto solamente), destructivo (rojo)

### C-3. Chip de plan (sticky en el wizard)

Aparece en todas las pantallas del wizard de onboarding como indicador persistente del plan seleccionado.

- Contenido: logo/icono del plan + nombre del plan + precio + ciclo de facturación + link/botón "Cambiar"
- Desktop: barra horizontal en la parte superior del contenido del wizard, debajo del stepper
- Mobile: barra sticky en la parte inferior de la pantalla (encima del botón de avance)
- Variante compacta (texto truncado) para mobile

### C-4. Toasts / notificaciones

- Variantes: `success` (verde), `error` (rojo), `info` (azul), `warning` (amarillo)
- Posición: esquina superior derecha en desktop, centro-superior en mobile
- Estructura: icono + título corto + descripción opcional + botón "Cerrar"
- Comportamiento: auto-dismiss a los 5s; se pueden apilar hasta 3
- Accesibilidad: región `aria-live="assertive"` para errores, `aria-live="polite"` para success/info

### C-5. Estado de carga (página y botones)

- Skeleton de formulario: rectángulos animados simulando campos de input + botón
- Skeleton de tarjeta de plan: imagen/icono + líneas de texto + precio
- Spinner inline: icono giratorio a la izquierda del label del botón durante submit
- Página de carga completa: spinner centrado con texto "Cargando..." para transiciones entre pasos del wizard

### C-6. Widget de desarrollo MSW

Solo visible en entornos de desarrollo (`NODE_ENV=development`).

- Botón flotante en la esquina inferior derecha: icono de "bug" o engranaje + label "Dev"
- Al hacer clic: dropdown/panel emergente con lista de escenarios precargados (por ejemplo: "Login exitoso", "Login bloqueado", "OTP inválido", "Pago aprobado", "Pago rechazado")
- Al seleccionar un escenario: el handler MSW cambia, se muestra confirmación en toast
- Diseño deliberadamente utilitario (no necesita brillar)

### C-7. Header autenticado (portal)

Aparece en todas las rutas del grupo `(portal)`.

- Lado izquierdo: logotipo Corehub + nombre del tenant activo (en un chip o separador)
- Lado derecho: avatar del usuario (iniciales o foto) + nombre + dropdown con "Cerrar sesión" y, si aplica, "Mi cuenta"
- Mobile: logo + hamburger; el nombre del tenant se mueve al menú
- Separador visual (border-bottom) del contenido

---

## Pantallas (lista numerada)

### 1. Login — Email + Password

**Ruta**: `/login`
**Propósito**: Punto de entrada para usuarios recurrentes con cuenta activa.
**Estado A — formulario inicial**:
- Logo Corehub centrado en la parte superior
- Título: "Iniciar sesión"
- Subtítulo: "Ingresá tu correo y contraseña"
- Campo email (tipo `email`, label flotante o estática)
- Campo password (tipo `password` con toggle mostrar/ocultar)
- Link "¿Olvidaste tu contraseña?" alineado a la derecha debajo del campo password
- Botón primario "Continuar" (ancho completo)
- Separador sutil + link "¿No tenés cuenta? Registrá tu empresa"

**Estado B — OTP solicitado** (misma pantalla, form reemplazado):
- Mensaje de contexto: "Enviamos un código a tu·••••email.com" (email enmascarado)
- Componente InputOTP (6 slots)
- Countdown de reenvío: "Reenviar código en 0:28" (cuenta regresiva desde 30s)
- Después del countdown: botón activo "Reenviar código"
- Toggle "Confiar en este dispositivo por 60 días" (checkbox visible, con tooltip explicativo)
- Botón "Verificar" (primario)
- Link "Volver" para regresar al formulario email+password

**Estado C — credenciales inválidas**:
- El formulario de email+password permanece; debajo del campo password aparece mensaje de error inline en rojo: "Correo o contraseña incorrectos."
- Contador de intentos NO visible para el usuario (solo en estado de bloqueo)

**Estado D — cuenta bloqueada** (respuesta 429 con `account_locked`):
- El formulario se deshabilita completamente (inputs en estado `disabled`)
- Mensaje de error prominente (banner o alerta) con icono de candado: "Tu cuenta fue bloqueada por 5 intentos fallidos. Podés intentarlo de nuevo en [MM:SS]."
- Cuenta regresiva visible hasta el desbloqueo
- Link "¿Necesitás ayuda? Contactar soporte"

**Estado E — OTP con trust-device**:
- Mismo layout que Estado B pero con el toggle "Confiar en este dispositivo" más prominente, con label explicativo breve

**Responsive**:
- Desktop (1280px): formulario centrado en tarjeta de ~420px de ancho, fondo con patrón sutil o gradiente
- Tablet (768px): igual pero con más padding lateral
- Mobile (375px): formulario ocupa el ancho completo, sin tarjeta contenedora, padding 16px

---

### 2. First Login — Representante de empresa (primer acceso)

**Ruta**: `/first-login` (puede recibir `?email=...` pre-completado)
**Propósito**: El TenantAdmin completa el setup de su cuenta tras el pago del onboarding. El sistema le envió un enlace de activación.

**Step 1 — Solo email**:
- Título: "Activá tu cuenta"
- Subtítulo: "Ingresá el correo con el que registraste tu empresa para recibir tu código de acceso."
- Campo email (pre-completado si viene con `?email=`, pero editable)
- Botón "Enviar código"
- Indicación sutil de que es el primer acceso (diferente al login recurrente)

**Step 2 — OTP**:
- Mismo patrón que Login Estado B
- Mensaje específico: "Ingresá el código enviado a {email enmascarado} para verificar tu identidad"
- 6 slots InputOTP + countdown + reenviar

**Step 3 — Establecer contraseña**:
- Título: "Creá tu contraseña"
- Dos campos: "Nueva contraseña" + "Confirmar contraseña"
- Debajo de los campos: checklist dinámica de requisitos de contraseña (actualizada en tiempo real mientras el usuario escribe). Los requisitos vienen del endpoint `GET /auth/password/policy`. Ejemplos: "Mínimo 12 caracteres", "Al menos una mayúscula", "Al menos un número", "Al menos un símbolo". Cada ítem con icono check/X que cambia color (gris → verde al cumplir)
- Botón "Crear contraseña y acceder"
- Nota: `aria-live="polite"` en la checklist para leer los cambios al lector de pantalla

**Responsive**: igual que pantalla de Login

---

### 3. Recuperar contraseña

**Ruta**: `/recover` (step 1 y 2) → `/recover/confirm/[token]` (step 3)
**Propósito**: Usuario olvidó su contraseña. Flujo de 3 pasos.

**Step 1 — Solicitar por email**:
- Título: "Recuperar contraseña"
- Subtítulo: "Te enviaremos un código a tu correo para que puedas crear una nueva contraseña."
- Campo email
- Botón "Enviar código"
- Link "Recordé mi contraseña → Iniciar sesión"
- Nota: el mensaje de confirmación es idéntico si el email existe o no (anti-enumeración)

**Step 2 — OTP**:
- Mismo patrón: 6 slots + countdown + reenviar
- Mensaje: "Ingresá el código de 6 dígitos que enviamos a {email enmascarado}"

**Step 3 — Nueva contraseña** (en `/recover/confirm/[token]`):
- Igual al Step 3 del First Login: dos campos + checklist dinámica
- Botón "Actualizar contraseña"
- Si el token ya expiró (30 min): pantalla de error con mensaje "Este enlace expiró. Solicitá uno nuevo." + botón "Solicitar nuevo código"

**Responsive**: igual que Login

---

### 4. Aceptar invitación

**Ruta**: `/invite/[token]`
**Propósito**: Un usuario fue invitado por un TenantAdmin. El link llega por email.

**Estado A — token válido (pending)**:
- Logo Corehub + nombre de la empresa invitante (del campo `tenantName`)
- Título: "Fuiste invitado a {tenantName}"
- Cuerpo: "{inviterName} te invitó a unirte como {rol} en {tenantName}."
- El email del invitado visible (a modo de confirmación de identidad)
- Botón primario: "Aceptar invitación"
- Al hacer clic → muestra campos de contraseña + checklist dinámica inline (sin cambio de ruta)
- Botón final: "Crear cuenta y acceder"

**Estado B — token expirado** (TTL 7 días):
- Icono o ilustración de enlace roto / reloj
- Título: "Esta invitación expiró"
- Cuerpo: "Las invitaciones son válidas por 7 días. Pedí a {tenantName} que te envíe una nueva."
- Botón secundario: "Ir al inicio"

**Estado C — token ya usado**:
- Título: "Esta invitación ya fue usada"
- Cuerpo: "Ya aceptaste esta invitación. Si tenés problemas para acceder, iniciá sesión o contactá a tu administrador."
- Botón primario: "Ir a Iniciar sesión"

**Responsive**:
- Desktop: tarjeta centrada de ~480px con el logo de la empresa invitante prominente
- Mobile: full-width

---

### 5. Wizard de creación de empresa — Layout general

**Ruta**: `/signup/[draftId]/[step]`
**Propósito**: Flujo guiado de 6 pasos para registrar una empresa y suscribirse.

**Layout del wizard (diseñar como shell reutilizable)**:
- Header: logo Corehub (solo logo, sin nav completo)
- Stepper de progreso horizontal (desktop) / vertical compacto (mobile):
  - 6 pasos etiquetados: "Plan" → "Contacto" → "Verificación" → "Empresa" → "Pago" → "Resumen"
  - Estado de cada paso: `pending` (gris), `current` (primario con indicador activo), `completed` (check verde)
  - En desktop: stepper arriba del contenido
  - En mobile: stepper colapsado en línea de puntos (solo el paso actual visible con número/total)
- Chip de plan sticky (componente C-3): debajo del stepper en desktop, sticky bottom en mobile
- Área de contenido central: el formulario del paso
- Footer del wizard: botón "Continuar" / "Siguiente" (derecha) + botón "Atrás" (izquierda, excepto en el primer paso). El paso de Resumen tiene "Confirmar y crear cuenta".

---

### 5a. Wizard — Step 1: Selección de plan

**Condición**: Si el usuario llegó con `?plan={id}` en la URL, este paso se omite (redirect automático al Step 2). Si no, se muestra.

**Contenido**:
- Título: "Elegí tu plan"
- Subtítulo: "Podés cambiarlo más adelante."
- Grid de tarjetas de plan: 3 columnas en desktop, 1 columna en mobile (scroll vertical)
- Cada tarjeta de plan incluye:
  - Nombre del plan (por ejemplo: Básico, Profesional, Enterprise)
  - Badge "Más popular" en el plan recomendado (destacado visualmente, escala ligeramente mayor)
  - Precio en PYG o USD + período ("por mes")
  - Lista de 4–6 features con iconos check
  - Botón "Seleccionar" (o estado "Seleccionado" si está activo)
- La tarjeta seleccionada tiene borde primario destacado y fondo ligeramente tintado
- Nota: "Todos los planes incluyen período de prueba de 30 días. Sin cargo hasta que venza."

**Responsive**:
- Desktop: 3 columnas centradas, max-width ~900px
- Tablet: 2 columnas
- Mobile: 1 columna, tarjetas en stack vertical con scroll

---

### 5b. Wizard — Step 2: Email del representante

**Contenido**:
- Título: "¿Cuál es tu correo?"
- Subtítulo: "Este correo será el administrador principal de tu empresa en Corehub. Te enviaremos un código para verificarlo."
- Campo email grande
- Campo nombre completo del representante
- Campo teléfono de contacto
- Botón "Enviar código de verificación"
- Nota legal pequeña: "Al continuar aceptás los Términos de Servicio y la Política de Privacidad de Corehub." (links)

---

### 5c. Wizard — Step 3: Verificación OTP del email

**Contenido**:
- Título: "Verificá tu correo"
- Mensaje: "Enviamos un código de 6 dígitos a {email enmascarado}. Si no ves el correo, revisá tu carpeta de spam."
- Componente InputOTP 6 slots (C-1)
- Countdown de reenvío: "Reenviar código en 0:28"
- Intentos restantes (se muestra cuando quedan 2 o menos): "Te quedan 2 intentos antes del bloqueo temporario."
- Botón "Verificar"
- Estado de error OTP incorrecto: slots en rojo + mensaje inline "Código incorrecto. Verificá e intentá de nuevo."
- Estado de OTP bloqueado (5 intentos): mensaje "Demasiados intentos. Esperá 15 minutos antes de solicitar un nuevo código." + countdown

---

### 5d. Wizard — Step 4: Datos de la empresa

**Contenido**:
- Título: "Datos de tu empresa"
- Subtítulo: "Esta información aparecerá en tu contrato y factura."
- Formulario con ~10 campos (organizar en 2 columnas en desktop, 1 en mobile):
  - Razón social / nombre legal (campo ancho completo)
  - RUC (Registro Único del Contribuyente — campo con formato específico paraguayo)
  - Tipo de empresa (select: SA, SRL, Unipersonal, Otro)
  - Dirección fiscal (calle y número)
  - Ciudad
  - Departamento (select con los 17 departamentos de Paraguay + Asunción)
  - Teléfono de la empresa
  - Persona de contacto (puede diferir del representante legal)
  - Cargo de la persona de contacto
  - Sitio web (opcional, con label "(opcional)")
- Botón "Continuar"
- Indicador de campos obligatorios

---

### 5e. Wizard — Step 5: Pago

**Estado inicial — Resumen de pago**:
- Título: "Revisá tu pedido"
- Panel de resumen:
  - Nombre del plan seleccionado
  - Ciclo de facturación (mensual/anual)
  - Precio
  - Subtotal, impuestos (IVA 10% Paraguay), total
  - Período de prueba si aplica
- Nombre de empresa (del paso anterior, como confirmación)
- Botón primario grande: "Pagar con Bancard"
- Logo de Bancard + nota: "Serás redirigido al portal seguro de Bancard para completar el pago."
- Métodos de pago aceptados: Visa, Mastercard, Bancard Personal (logos pequeños)
- Lock icon + "Pago seguro con cifrado SSL"

**Estado de redirección** (post-clic en "Pagar"):
- El botón cambia a estado loading: spinner + "Redirigiendo a Bancard..."
- Toda la interfaz se congela (inputs deshabilitados) para evitar doble-clic
- Si demora más de 3s: mensaje "Esto puede tardar unos segundos..."

**Estado de polling — vuelta de Bancard** (en `/signup/[draftId]/payment?paymentId=...`):
- Pantalla de espera con spinner central grande
- Título: "Verificando tu pago..."
- Subtítulo: "Esto puede tardar algunos segundos. No cierres esta pestaña."
- Barra de progreso indeterminada (opcional)
- Si pasan 60s sin confirmación → ver Estado de timeout

**Estado de pago rechazado o cancelado**:
- Icono de error (X en círculo)
- Título: "El pago no pudo completarse"
- Descripción: "Tu tarjeta fue rechazada o cancelaste el pago. No se realizó ningún cargo."
- Botón primario: "Intentar de nuevo"
- Botón secundario: "Usar otra tarjeta"
- Link: "Contactar soporte"

**Estado de timeout de pago** (60s de polling sin respuesta):
- Icono de reloj o advertencia
- Título: "No pudimos confirmar tu pago aún"
- Descripción: "Esto puede deberse a demoras en el procesamiento. Si el pago fue exitoso, te enviaremos un correo de confirmación y podrás continuar desde ahí."
- Botón: "Reintentar verificación" (vuelve a hacer polling)
- Link: "Contactar soporte"

---

### 5f. Wizard — Step 6: Resumen / Éxito

**Contenido**:
- Icono de check grande en verde (celebración sobria, sin confetti)
- Título: "¡Tu empresa está lista!"
- Subtítulo: "{nombre de empresa} fue registrada exitosamente en Corehub."
- Panel de documentos:
  - Botón de descarga: "Descargar factura PDF" (icono descarga)
  - Botón de descarga: "Descargar contrato PDF" (icono descarga)
  - Nota: "También enviamos estos documentos a {email del representante}."
- Botón primario grande: "Ir a la plataforma"
- Detalle del plan activo (nombre + fecha de próxima facturación)

---

### 6. Resume del wizard desde email

**Ruta**: `/signup/resume/[token]`
**Propósito**: Pantalla intersticial cuando el usuario vuelve desde un email de reanudación.

**Contenido**:
- Logo Corehub
- Icono de "bienvenida de vuelta" (ondas o similar)
- Título: "Bienvenido de vuelta"
- Cuerpo: "Continuarás el registro de tu empresa desde donde lo dejaste. El borrador de {nombre de empresa o email} está listo."
- Botón: "Continuar registro"
- Nota: si el token ya expiró (7 días) → mostrar mensaje de error: "Este enlace ya no es válido. Los borradores se eliminan después de 7 días inactivos." + botón "Comenzar de nuevo"

---

### 7. Portal — Dashboard / Grid de apps (refinamiento)

**Ruta**: `/` (dentro del grupo `(portal)`)
**Propósito**: Vista principal post-autenticación. Acceso a las aplicaciones del tenant.

**Contenido**:
- Header autenticado (componente C-7): logo + nombre del tenant + avatar con dropdown
- Área principal: grid de AppCards
  - Cada card: icono/logo de la app + nombre + descripción breve + botón "Acceder"
  - Estado activo vs inactivo de las apps según el plan
  - Card de app inactiva: fondo gris, badge "No incluido en tu plan", CTA "Actualizar plan"
- Estado vacío (cero apps): ilustración simple + "Tu plan no incluye aplicaciones aún. Actualizá tu plan para acceder."
- Footer con versión + links legales

**Responsive**:
- Desktop: grid de 3–4 columnas
- Tablet: 2 columnas
- Mobile: 1 columna, cards en stack

---

## Estados transversales

### Error 403 — Tenant mismatch

Se muestra cuando el JWT del usuario corresponde a un tenant diferente al de la URL actual (`acme.corehub.com` con JWT de `globex`).

- Ruta destino: `/login?error=tenant_mismatch`
- O página inline antes del redirect
- Título: "No tenés acceso a este espacio"
- Cuerpo: "Estás intentando acceder a un espacio que no corresponde a tu cuenta. Iniciá sesión con la cuenta correcta o contactá al administrador de {tenantName}."
- Botón: "Iniciar sesión"
- Link: "Ir al inicio"

### Error 403 — Acceso denegado por rol

Se muestra in-app (sin redirect) cuando el usuario accede a una función que su rol no permite.

- Banner o página inline (no modal)
- Título: "Acceso denegado"
- Cuerpo: "No tenés los permisos necesarios para ver esta sección. Si creés que es un error, contactá al administrador de tu empresa."
- No hay CTA de logout (el usuario puede seguir navegando)

### Modal — Sesión expirada

Aparece cuando el access token expiró y el refresh también falló (o fue comprometido).

- Modal centrado (no ocupa toda la pantalla)
- Título: "Tu sesión expiró"
- Cuerpo: "Por seguridad, cerramos tu sesión. Por favor, iniciá sesión nuevamente."
- Botón primario: "Ir a Iniciar sesión"
- Cerrar el modal también redirige a login
- El fondo del modal oscurece el contenido (overlay)

### Página 404 — Ruta pública

Para rutas que no existen en el grupo público.

- Logo Corehub
- Código grande "404" o ilustración minimal
- Título: "Página no encontrada"
- Cuerpo: "La dirección que buscás no existe o fue movida."
- Botón: "Ir al inicio"

---

## Notas de accesibilidad

Incluir anotaciones en los wireframes sobre los siguientes puntos:

- **Focus visible**: todos los inputs, botones y links deben mostrar un ring de focus claramente visible. No ocultar el focus outline por defecto del navegador.
- **Orden de Tab**: debe seguir el orden visual de arriba a abajo, izquierda a derecha. En el wizard, el Tab no debe saltar al stepper entre campos del formulario.
- **InputOTP**: los 6 slots se navegan con Tab (cada slot) o con las flechas del teclado. Cada slot tiene `aria-label="Código de verificación, dígito [N] de 6"`. La región de error tiene `id` único referenciado por `aria-describedby` en cada slot.
- **Formularios**: cada campo tiene su `<label>` asociado por `htmlFor`/`id`. Los mensajes de error se asocian al campo via `aria-describedby`. Los formularios tienen `aria-labelledby` apuntando al `<h1>` de la pantalla.
- **Errores en tiempo real**: las checklists de contraseña y los contadores de cooldown usan `aria-live="polite"`. Los errores críticos (cuenta bloqueada, OTP inválido) usan `aria-live="assertive"`.
- **Botones con estado**: el botón "Reenviar código" usa `aria-disabled="true"` con `aria-label="Reenviar código disponible en [N] segundos"` durante el countdown.
- **Modales**: al abrirse, el foco se mueve al título del modal. Al cerrarse, vuelve al elemento que lo disparó. El modal tiene `role="dialog"` y `aria-modal="true"`.
- **Wizards**: al avanzar de paso, el foco se mueve al `<h1>` del nuevo paso para que el lector de pantalla anuncie el cambio de contexto.
- **Contraste**: mínimo 4.5:1 para texto normal, 3:1 para texto grande (headings). Los estados de error en rojo deben cumplir contraste sobre el fondo utilizado.
- **Targets táctiles**: tamaño mínimo de 44x44px para todos los elementos interactivos en mobile.
- **Skip link**: presente en los layouts de grupo `(public)` y `(portal)` para saltar al contenido principal.

---

## Entregable esperado

Wireframes / sketches en baja-media fidelidad, anotados, agrupados por flujo. Los sketches NO necesitan ser pixel-perfect, pero deben mostrar:

- Jerarquía visual clara (qué elemento es más prominente)
- Disposición de todos los elementos mencionados en cada estado
- Anotaciones de comportamiento (qué pasa al hacer clic en X, qué disparos el countdown)
- Código de color semántico básico (verde = éxito, rojo = error, primario = acción principal)

**Tres breakpoints por pantalla** (prioridad: mobile-first para el wizard; desktop-first para el portal):
- Mobile: 375px de ancho
- Tablet: 768px de ancho
- Desktop: 1280px de ancho

**Agrupación sugerida por flujo**:
1. Componentes base (C-1 a C-7)
2. Flujo de login recurrente (pantalla 1, todos los estados)
3. Flujo de primer acceso (pantalla 2, todos los steps)
4. Flujo de recuperación de contraseña (pantalla 3)
5. Flujo de invitación (pantalla 4, todos los estados)
6. Wizard de creación de empresa (shell + steps 5a a 5f, todos los estados del pago)
7. Reanudación del wizard (pantalla 6)
8. Portal dashboard (pantalla 7)
9. Estados de error transversales (403, sesión expirada, 404)
