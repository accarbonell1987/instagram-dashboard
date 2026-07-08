# Diagramas de Secuencia — tenant-onboarding-auth

> Formato Mermaid. Renderizar en cualquier visor de Markdown con soporte Mermaid
> (GitHub, plugin de VSCode, Mermaid Live).

## Actores

- **U** — User Browser
- **H** — Hub (Next.js, `apps/hub`)
- **A** — Spring Boot API
- **OTP** — OTP Provider (SendGrid/Twilio)
- **B** — Bancard vPOS
- **S3** — S3 Object Storage

---

## 1. Login (usuario recurrente) — flujo feliz

```mermaid
sequenceDiagram
    participant U as User Browser
    participant H as Hub
    participant A as Spring API
    participant OTP as OTP Provider

    U->>H: GET /login
    H-->>U: Formulario de login (RSC)
    U->>H: Envía { email, password }
    H->>A: POST /auth/login { email, password }
    A->>A: Verifica contraseña (BCrypt)
    A->>A: Comprueba hash de cookie device_trust
    Note right of A: Dispositivo no es de confianza
    A->>A: Emite OTP (6 dígitos), almacena hash
    A->>OTP: Envía código al email
    OTP-->>A: 200 OK
    A-->>H: 200 { otpRequired: true, otpId, otpChannel: email }
    H-->>U: Formulario OTP (6 slots, email enmascarado)

    U->>H: Envía { code, trustDevice: false }
    H->>A: POST /auth/login/complete { otpId, code, trustDevice: false }<br/>Idempotency-Key: K1
    A->>A: Comparación en tiempo constante del código
    A->>A: Marca OTP usado, inserta sesión, emite refresh+access
    A-->>H: 200 { accessToken, expiresIn, user, tenant, role }<br/>Set-Cookie: refresh_token (HttpOnly, Secure, SameSite=Lax)
    H->>H: tokenHolder.set(accessToken, 900)
    H->>H: sessionStore.hydrate(user, tenant, role)
    H-->>U: Redirige a /portal
```

---

## 2. Login — contraseña incorrecta + bloqueo

```mermaid
sequenceDiagram
    participant U as User Browser
    participant H as Hub
    participant A as Spring API

    loop Intentos 1..4
        U->>H: Envía { email, wrongPassword }
        H->>A: POST /auth/login
        A->>A: Incrementa failed_login_attempts
        A-->>H: 401 { type: '.../unauthorized', detail: 'Invalid credentials' }
        H-->>U: "Correo o contraseña incorrectos."
    end

    U->>H: Envía { email, wrongPassword } [5to intento]
    H->>A: POST /auth/login
    A->>A: failed_login_attempts = 5 → bloquea cuenta 15 min
    A-->>H: 429 { code: 'account_locked', lockedUntil: 'T+15min' }
    H-->>U: "Cuenta bloqueada. Intenta de nuevo en 14:59." (cuenta regresiva)
    Note over U,H: Botón de envío deshabilitado, campo de contraseña oculto

    Note over A: Transcurren 15 minutos
    U->>H: Envía { email, correctPassword }
    H->>A: POST /auth/login
    A->>A: locked_until ha pasado → reinicia intentos → verifica contraseña
    A-->>H: 200 { otpRequired: true, otpId }
    H-->>U: Formulario OTP
```

---

## 3. Primer login (representante del asistente) — flujo completo

```mermaid
sequenceDiagram
    participant U as User Browser
    participant H as Hub
    participant A as Spring API
    participant OTP as OTP Provider

    Note over U,A: El usuario acaba de completar el pago del asistente.<br/>El backend envió un email de activación con el enlace de primer login.

    U->>H: GET /first-login?email=ana@empresa-acme.com
    H-->>U: Formulario de primer login (email pre-completado)

    U->>H: Envía "Enviar código"
    H->>A: POST /auth/first-login/start { email }<br/>Idempotency-Key: K1
    A->>A: Busca usuario pending_first_login
    A->>A: Emite OTP, almacena hash
    A->>OTP: Envía código
    A-->>H: 200 { otpId, channel: email, expiresAt, resendAvailableAt }
    H-->>U: Formulario OTP

    U->>H: Envía código
    H->>A: POST /auth/otp/verify { otpId, code }
    A->>A: Marca OTP usado, emite otpVerificationToken (5 min)
    A-->>H: 200 { otpVerificationToken, expiresAt }

    H->>A: GET /auth/password/policy
    A-->>H: 200 { minLength: 12, requireUpper, ... }
    H-->>U: Formulario de establecer contraseña con lista dinámica

    U->>H: Envía { password, confirm }
    H->>A: POST /auth/first-login/set-password { otpVerificationToken, password }<br/>Idempotency-Key: K2
    A->>A: Hashea contraseña, establece user.status=active, emite sesión
    A-->>H: 200 { accessToken, expiresIn, user, tenant, role }<br/>Set-Cookie: refresh_token
    H->>H: tokenHolder.set / sessionStore.hydrate
    H-->>U: Redirige a /portal
```

---

## 4. Primer login (usuario invitado) — aceptar + establecer contraseña

```mermaid
sequenceDiagram
    participant U as User Browser
    participant H as Hub
    participant A as Spring API

    U->>H: GET /invite/<token>
    H->>A: GET /invitations/<token>
    A->>A: Valida token (hash coincide, no expirado, no usado)
    A-->>H: 200 { email, tenantName, inviterName, role: User, expiresAt, status: pending }
    H-->>U: "Hola, has sido invitado a [Empresa] por [Invitador]."

    U->>H: Clic en "Aceptar invitación"
    H->>A: GET /auth/password/policy
    A-->>H: 200 { minLength: 12, ... }
    H-->>U: Formulario de establecer contraseña

    U->>H: Envía { password }
    H->>A: POST /invitations/<token>/accept { password }<br/>Idempotency-Key: K1
    A->>A: Marca token usado; crea usuario; hashea contraseña; emite sesión
    A-->>H: 200 { accessToken, expiresIn, user, tenant, role: User }<br/>Set-Cookie: refresh_token
    H->>H: tokenHolder.set / sessionStore.hydrate
    H-->>U: Redirige a /portal
```

---

## 5. Registro con asistente — flujo feliz completo con pago

```mermaid
sequenceDiagram
    participant U as User Browser
    participant H as Hub
    participant A as Spring API
    participant OTP as OTP Provider
    participant B as Bancard

    U->>H: GET /signup?plan=professional<br/>(desde CTA de la landing)
    H->>A: POST /onboarding/draft { planId: professional }<br/>Idempotency-Key: K0
    A-->>H: 201 { id: D1, currentStep: plan, version: 0, plan, ... }
    H-->>U: Redirige a /signup/D1/plan

    U->>H: Confirma plan (ya pre-seleccionado)
    H->>A: PATCH /onboarding/draft/D1<br/>Idem-Key: K1<br/>{ step: representative, version: 0, plan }
    A-->>H: 200 { currentStep: representative, version: 1 }
    H-->>U: Redirige a /signup/D1/representative

    U->>H: Envía { email, fullName, phone }
    H->>A: PATCH /onboarding/draft/D1<br/>Idem-Key: K2<br/>{ step: otp, version: 1, representative }
    A->>A: Emite OTP, lo almacena
    A->>OTP: Envía código al email
    A-->>H: 200 { currentStep: otp, version: 2, otpId }
    H-->>U: Redirige a /signup/D1/otp (formulario OTP)

    U->>H: Envía código
    H->>A: POST /auth/otp/verify { otpId, code }
    Note right of A: purpose=signup-rep → marca draft como otp-verified (server-side).<br/>El cliente NO envía otpVerified en el body.
    A-->>H: 200 { otpVerificationToken }
    H->>A: PATCH /onboarding/draft/D1<br/>Idem-Key: K3<br/>{ step: company, version: 2 }
    A-->>H: 200 { currentStep: company, version: 3, otpVerified: true }
    Note right of A: otpVerified es read-only en DraftState — lo setea el servidor.<br/>El cliente lo lee, no lo escribe.
    H-->>U: Redirige a /signup/D1/company

    U->>H: Envía { legalName, ruc, address, city }
    H->>A: PATCH /onboarding/draft/D1<br/>Idem-Key: K4<br/>{ step: payment, version: 3, company }
    A-->>H: 200 { currentStep: payment, version: 4, company }
    H-->>U: Redirige a /signup/D1/payment (resumen de pago)

    U->>H: Clic en "Pagar"
    H->>A: POST /onboarding/draft/D1/payment/initiate<br/>Idem-Key: K5 (= "D1_payment_v1")
    A->>B: vPOS single_buy { shop_process_id: D1-1, amount, ... }
    B-->>A: { process_id: P1 }
    A->>A: Inserta fila en payments, status=pending
    A-->>H: 200 { paymentId: P1, redirectUrl: 'https://vpos.../P1' }
    H-->>U: window.location = redirectUrl

    U->>B: Completa el pago en Bancard
    B-->>U: Redirige a /signup/D1/payment?paymentId=P1
    B->>A: POST /webhooks/bancard { process_id: P1, status: approved }<br/>X-Bancard-Signature
    A->>A: Verifica HMAC, actualiza payments+draft, status=payment_confirmed

    U->>H: GET /signup/D1/payment?paymentId=P1
    loop Backoff 1s,2s,4s,8s,16s
        H->>A: GET /onboarding/draft/D1/payment/status
        A-->>H: 200 { status: approved, confirmedAt }
        Note over H: status=approved → sale del bucle
    end
    H->>A: PATCH /onboarding/draft/D1<br/>Idem-Key: K6<br/>{ step: summary, version: 4 }
    A-->>H: 200 { currentStep: summary, version: 5 }
    H-->>U: Redirige a /signup/D1/summary

    U->>H: Clic en "Confirmar y crear cuenta"
    H->>A: POST /onboarding/draft/D1/submit<br/>Idem-Key: K7 (= "D1_submit")
    A->>A: BEGIN TX
    A->>A: INSERT tenants, CREATE SCHEMA tenant_acme, ejecuta migraciones
    A->>A: INSERT usuario TenantAdmin, genera PDFs de factura+contrato
    A->>S3: Sube PDFs, obtiene keys
    A->>A: COMMIT TX
    A-->>H: 200 { tenantId, tenant, accessToken, expiresIn,<br/>documents: { invoiceUrl, contractUrl } }<br/>Set-Cookie: refresh_token
    H-->>U: Muestra resumen + botones de descarga + redirige a /portal
```

---

## 6. Reanudación del asistente por email

```mermaid
sequenceDiagram
    participant U as User Browser
    participant H as Hub
    participant A as Spring API

    Note over U,A: El usuario abandonó el asistente en el paso "company" hace 2 días.<br/>Tras la verificación OTP, el backend envió un email de reanudación.

    U->>H: Clic en enlace de reanudación del email<br/>GET /signup/resume/<opaqueToken>
    H->>A: GET /onboarding/draft/resume/<opaqueToken>
    A->>A: Valida token (hash coincide, no expirado, no usado)
    A->>A: Marca token usado (uso único)
    A-->>H: 200 { draftId: D1 }
    H->>H: router.replace(`/signup/D1/company`)

    H->>A: GET /onboarding/draft/D1
    A-->>H: 200 { id: D1, currentStep: company, version: 3, plan, representative, otpVerified: true, ... }
    H-->>U: El asistente renderiza el paso "company" con los datos anteriores pre-completados

    Note over U,H: El usuario continúa desde donde lo dejó.
```

---

## 7. Pago (Bancard) — iniciar → redirigir → webhook → polling → confirmación

```mermaid
sequenceDiagram
    participant U as User Browser
    participant H as Hub
    participant A as Spring API
    participant B as Bancard

    U->>H: Clic en "Pagar"
    H->>H: Genera idem key K = "D1_payment_v1", persiste en localStorage
    H->>A: POST /onboarding/draft/D1/payment/initiate<br/>Idempotency-Key: K
    A->>A: Valida estado del borrador (=otp_verified o company)
    A->>B: vPOS single_buy { shop_process_id: D1-1, amount, currency }
    B-->>A: { process_id: P1 }
    A->>A: INSERT payments(P1, draft=D1, status=pending)
    A-->>H: 200 { paymentId: P1, redirectUrl: 'https://vpos.../checkout/new/P1' }
    H->>U: window.location = redirectUrl

    U->>B: Datos de tarjeta, 3DS, etc.
    par Webhook (servidor a servidor)
        B->>A: POST /webhooks/bancard { process_id: P1, status: approved }<br/>X-Bancard-Signature: <hmac>
        A->>A: Valida HMAC, idempotente en (process_id, status)
        A->>A: UPDATE payments set status=approved, confirmedAt=NOW()
        A->>A: UPDATE draft set status=payment_confirmed
        A-->>B: 200 OK
    and Redirección del navegador
        B-->>U: Redirige a /signup/D1/payment?paymentId=P1
    end

    U->>H: GET /signup/D1/payment?paymentId=P1
    loop Backoff exponencial 1s,2s,4s,8s,16s; máx 60s
        H->>A: GET /onboarding/draft/D1/payment/status
        alt webhook llegó primero
            A-->>H: 200 { status: approved, confirmedAt }
            Note over H: Sale del bucle
        else aún pendiente
            A-->>H: 200 { status: pending }
            Note over H: Espera el siguiente intervalo
        end
    end
    H-->>U: "Pago confirmado" + avanza al resumen
```

---

## 8. Timeout de pago — webhook con retraso

```mermaid
sequenceDiagram
    participant U as User Browser
    participant H as Hub
    participant A as Spring API
    participant B as Bancard

    U->>B: Paga, redirige de vuelta
    B-->>U: Redirige a /signup/D1/payment?paymentId=P1

    U->>H: Llega a la página de pago
    loop Backoff hasta 60s total
        H->>A: GET /onboarding/draft/D1/payment/status
        A-->>H: 200 { status: pending }
    end

    Note over H: Transcurridos 60s sin confirmación
    H-->>U: "No pudimos confirmar tu pago aún.<br/>Te avisaremos por correo cuando se confirme."
    H-->>U: Muestra acciones: "Reintentar verificación" / "Volver al inicio"

    Note over A,B: El webhook llega más tarde (p. ej. 90s después de la redirección)
    B->>A: POST /webhooks/bancard { process_id: P1, status: approved }
    A->>A: UPDATE draft status=payment_confirmed
    A->>A: Envía email "pago confirmado, finaliza tu registro"

    Note over U: El usuario hace clic en el enlace del email → /signup/D1/summary
    U->>H: GET /signup/D1/summary
    H->>A: GET /onboarding/draft/D1
    A-->>H: 200 { currentStep: summary, status: payment_confirmed }
    H-->>U: Reanuda en el paso de resumen
```

---

## 9. Refresh silencioso del JWT en 401

```mermaid
sequenceDiagram
    participant U as User Browser
    participant H as Hub
    participant A as Spring API

    Note over H: Se disparan múltiples llamadas concurrentes (queries paralelos al cargar el portal).
    par Llamada A
        H->>A: GET /resource1 (Bearer expirado)
    and Llamada B
        H->>A: GET /resource2 (Bearer expirado)
    and Llamada C
        H->>A: GET /resource3 (Bearer expirado)
    end
    A-->>H: 401 (×3, las tres llamadas)

    Note over H: tokenHolder.refresh() — single-flight: solo UNA llamada sale.
    H->>A: POST /auth/refresh (Cookie: refresh_token)
    A->>A: SELECT FOR UPDATE refresh_tokens, marca el antiguo como usado, emite el nuevo
    A-->>H: 200 { accessToken, expiresIn }<br/>Set-Cookie: refresh_token (rotado)
    H->>H: tokenHolder.set(newToken, 900)

    par Reintenta las 3 llamadas
        H->>A: GET /resource1 (Bearer nuevo)
        H->>A: GET /resource2 (Bearer nuevo)
        H->>A: GET /resource3 (Bearer nuevo)
    end
    A-->>H: 200, 200, 200
    H-->>U: Renderiza sin interrupción visible

    Note over A: Escenario de replay:<br/>Si un cliente malicioso intenta el ANTIGUO refresh token
    H->>A: POST /auth/refresh (cookie ANTIGUA, de algún modo)
    A->>A: Token marcado como usado → toda la familia queda invalidada
    A-->>H: 401
    H->>H: tokenHolder.clear(), sessionStore.reset()
    H-->>U: Redirige a /login?error=session_compromised
```

---

## 10. Cierre de sesión (broadcast multi-pestaña)

```mermaid
sequenceDiagram
    participant T1 as Tab 1
    participant T2 as Tab 2
    participant T3 as Tab 3
    participant BC as BroadcastChannel('corehub-auth')
    participant A as Spring API

    Note over T1,T3: El usuario tiene Hub abierto en 3 pestañas (mismo origen).

    T1->>T1: Clic en "Cerrar sesión"
    T1->>A: POST /auth/logout<br/>Idempotency-Key: K
    A->>A: Invalida la familia de refresh token<br/>Set-Cookie: refresh_token=; Max-Age=0
    A-->>T1: 204
    T1->>T1: tokenHolder.clear(), sessionStore.reset()
    T1->>BC: postMessage({ type: 'sign-out' })
    T1-->>T1: Redirige a /login

    par Oyentes
        BC-->>T2: { type: 'sign-out' }
        T2->>T2: tokenHolder.clear(), sessionStore.reset()
        T2-->>T2: Redirige a /login (sin llamada API necesaria)
    and
        BC-->>T3: { type: 'sign-out' }
        T3->>T3: tokenHolder.clear(), sessionStore.reset()
        T3-->>T3: Redirige a /login
    end
```

---

## 11. Discrepancia de tenant en resolución → 403

```mermaid
sequenceDiagram
    participant U as User Browser
    participant MW as Next.js Middleware
    participant H as Hub (RSC)
    participant A as Spring API

    Note over U: Usuario logueado en acme.corehub.com<br/>JWT.tenant_id = "acme"

    U->>MW: GET https://globex.corehub.com/portal
    MW->>MW: Extrae tenant del Host → "globex"
    MW->>MW: Cookie refresh_token presente → deja pasar
    MW-->>H: Request con x-tenant-slug: globex

    H->>H: SessionProvider monta, llama tokenHolder.refresh()
    H->>A: POST /auth/refresh (Cookie: refresh_token desde el origen de acme?)
    Note over A: El dominio de la cookie puede estar limitado a acme — el refresh falla con 401

    alt Cookie compartida mediante dominio padre
        A-->>H: 200 { accessToken (tenant_id: acme) }
        H->>H: useSession(): JWT.tenant_id="acme" ≠ URL tenant "globex"
        H-->>U: Redirige a /login?error=tenant_mismatch
        H-->>U: "No tienes acceso a este espacio. Inicia sesión con la cuenta correcta."
    else Cookie limitada por subdominio
        A-->>H: 401
        H->>H: tokenHolder.clear()
        H-->>U: Redirige a /login (sin código de error — parece sesión nueva)
    end
```

---

## Notas

- Todos los diagramas asumen `tenant-mode=subdomain` para producción. En modo `path`
  el prefijo de URL cambia pero las interacciones entre actores son idénticas.
- Todas las llamadas `POST` y `PATCH` en flujos de mutación incluyen `Idempotency-Key`.
  Los diagramas lo muestran donde afecta materialmente al flujo; se omite en llamadas
  que no interactúan con el estado de idempotencia.
- `Set-Cookie: refresh_token` siempre usa
  `HttpOnly; Secure; SameSite=Lax; Path=/auth/refresh; Max-Age=604800`.
