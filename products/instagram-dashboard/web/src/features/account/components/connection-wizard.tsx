'use client'

import { Button, Input, Label } from '@core/ui'
import { useState, type JSX } from 'react'

import { ConnectAccount } from '@/features/account/components/connect-account'
import { useConnectionRequest } from '@/features/account/hooks/use-connection-request'

/**
 * Wizard de conexión, necesario sólo mientras la app esté en Development.
 *
 * Sin App Review, Meta únicamente deja autorizar a cuentas con rol en la app, y
 * agregar un Instagram Tester no tiene API pública: lo hace el operador a mano.
 * Este flujo convierte esos siete pasos en tres pantallas y le muestra al
 * cliente en cuál está, en vez de coordinarlo por mensajes.
 *
 * Cuando salgan App Review, Business Verification y Access Verification, el paso
 * de la invitación desaparece y este componente queda reducido a ConnectAccount.
 * El resto —el formulario, los estados, los errores traducidos— se reutiliza.
 */
const ACCEPT_INVITE_URL = 'https://www.instagram.com/accounts/manage_access/'

export function ConnectionWizard(): JSX.Element {
  const { request, isLoading, error, submit } = useConnectionRequest()

  if (isLoading) {
    // Sin spinner: el wizard aparece completo o no aparece. Un esqueleto que
    // parpadea medio segundo agrega ruido, no información.
    return <div className="py-12" aria-busy="true" />
  }

  if (request === null) return <UsernameStep onSubmit={submit} error={error} />

  switch (request.status) {
    case 'awaiting_invite':
      return <WaitingStep username={request.username} />
    case 'invite_sent':
      return <AcceptInviteStep username={request.username} />
    case 'failed':
      return <FailureStep username={request.username} reason={request.lastError} onRetry={submit} />
    case 'connected':
      // El padre normalmente ya renderizó el dashboard; llegar acá significa que
      // la cuenta se desvinculó después. Volver a empezar es lo correcto.
      return <UsernameStep onSubmit={submit} error={error} />
  }
}

// ─── Paso 1 ──────────────────────────────────────────────────────────────────

function UsernameStep({
  onSubmit,
  error,
}: {
  onSubmit: (username: string) => Promise<void>
  error: string | null
}): JSX.Element {
  const [username, setUsername] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (username.trim() === '') return
    setIsSending(true)
    await onSubmit(username)
    setIsSending(false)
  }

  return (
    <Card title="Conectá tu cuenta de Instagram" step="Paso 1 de 3">
      <p className="text-sm text-muted-foreground">
        Decinos cuál es tu cuenta y la habilitamos. Necesitás una cuenta{' '}
        <strong>Profesional</strong> (Business o Creator).
      </p>

      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4 text-left">
        <div className="space-y-2">
          <Label htmlFor="ig-username">Tu usuario de Instagram</Label>
          <Input
            id="ig-username"
            value={username}
            onChange={(e) => { setUsername(e.target.value) }}
            placeholder="@micuenta"
            autoComplete="off"
            aria-describedby={error !== null ? 'ig-username-error' : undefined}
          />
          {error !== null && (
            <p id="ig-username-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <Note>
          ¿No sabés si tu cuenta es Profesional? En Instagram: Configuración →
          Tipo de cuenta y herramientas → Cambiar a cuenta profesional.
        </Note>

        <Button type="submit" disabled={isSending || username.trim() === ''} className="w-full">
          {isSending ? 'Enviando…' : 'Continuar'}
        </Button>
      </form>
    </Card>
  )
}

// ─── Paso 2 ──────────────────────────────────────────────────────────────────

function WaitingStep({ username }: { username: string }): JSX.Element {
  return (
    <Card title="Estamos habilitando tu cuenta" step="Paso 2 de 3">
      <p className="text-sm text-muted-foreground">
        Recibimos tu solicitud para <strong>@{username}</strong>. Estamos
        habilitándola; suele tardar poco. Esta pantalla se actualiza sola.
      </p>
      <Note>
        Podés cerrar esta ventana y volver más tarde. Tu solicitud queda
        guardada.
      </Note>
    </Card>
  )
}

// ─── Paso 3 ──────────────────────────────────────────────────────────────────

function AcceptInviteStep({ username }: { username: string }): JSX.Element {
  const [accepted, setAccepted] = useState(false)

  if (accepted) return <ConnectAccount />

  return (
    <Card title="Aceptá la invitación" step="Paso 3 de 3">
      <p className="text-sm text-muted-foreground">
        Te enviamos una invitación a <strong>@{username}</strong>. Aceptala desde
        Instagram y volvé acá.
      </p>

      <ol className="text-left text-sm space-y-2 text-muted-foreground list-decimal list-inside">
        <li>
          Abrí{' '}
          <a
            href={ACCEPT_INVITE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Invitaciones de prueba
          </a>{' '}
          en Instagram
        </li>
        <li>Buscá la invitación de Corehub y aceptala</li>
        <li>Volvé acá y seguí</li>
      </ol>

      <Note>
        Si no la ves: Instagram → Configuración → Apps y sitios web →
        Invitaciones de tester.
      </Note>

      <Button onClick={() => { setAccepted(true) }} className="w-full">
        Ya la acepté, conectar
      </Button>
    </Card>
  )
}

// ─── Fallo ───────────────────────────────────────────────────────────────────

/**
 * Meta devuelve el mismo texto genérico para "no tiene rol" y para "tiene rol
 * pero no aceptó", así que no se puede distinguir con certeza. Se muestran los
 * dos caminos en vez del mensaje crudo de Meta, que no nombra ninguno.
 */
function FailureStep({
  username,
  reason,
  onRetry,
}: {
  username: string
  reason: string | null
  onRetry: (username: string) => Promise<void>
}): JSX.Element {
  const isPersonal = reason === 'personal_account'

  return (
    <Card title="No pudimos conectar la cuenta" step="">
      {isPersonal ? (
        <p className="text-sm text-muted-foreground">
          <strong>@{username}</strong> es una cuenta personal. Instagram sólo
          comparte métricas de cuentas Profesionales. En Instagram: Configuración
          → Tipo de cuenta y herramientas → Cambiar a cuenta profesional.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Suele ser porque la invitación todavía no fue aceptada. Revisá:
          </p>
          <ol className="text-left text-sm space-y-2 text-muted-foreground list-decimal list-inside">
            <li>
              Que estés en Instagram con <strong>@{username}</strong> y no con
              otra cuenta
            </li>
            <li>
              Que hayas aceptado la invitación en{' '}
              <a
                href={ACCEPT_INVITE_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Invitaciones de prueba
              </a>
            </li>
          </ol>
        </>
      )}

      <Button variant="outline" onClick={() => { void onRetry(username) }} className="w-full">
        Volver a intentar
      </Button>
    </Card>
  )
}

// ─── Presentación compartida ─────────────────────────────────────────────────

function Card({
  title,
  step,
  children,
}: {
  title: string
  step: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="bg-card border rounded-xl p-8 space-y-6">
        {step !== '' && (
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {step}
          </p>
        )}
        <h2 className="text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="bg-muted/50 rounded-lg p-4 text-left text-xs text-muted-foreground">
      {children}
    </div>
  )
}
