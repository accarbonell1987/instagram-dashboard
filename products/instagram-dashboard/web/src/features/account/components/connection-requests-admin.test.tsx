import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { ConnectionRequestsAdmin } from './connection-requests-admin'

import type { PendingConnectionRequest } from '@/features/account/services/connection.service'


const base: PendingConnectionRequest = {
  id: 'req-1',
  tenantId: 'tenant-abc',
  userId: 'user-1',
  username: 'micuenta',
  status: 'awaiting_invite',
  lastError: null,
  requestedAt: '2026-09-03T10:00:00.000Z',
  inviteSentAt: null,
  connectedAt: null,
}

describe('ConnectionRequestsAdmin', () => {
  it('dice explícitamente que no hay nada pendiente', () => {
    render(<ConnectionRequestsAdmin requests={[]} onMarkSent={vi.fn()} busyId={null} />)

    expect(screen.getByText('No hay solicitudes pendientes.')).toBeInTheDocument()
  })

  // El operador copia este usuario al App Dashboard de Meta: si aparece
  // truncado o alterado, el alta se hace para otra cuenta.
  it('muestra el usuario y el tenant de cada solicitud', () => {
    render(<ConnectionRequestsAdmin requests={[base]} onMarkSent={vi.fn()} busyId={null} />)

    expect(screen.getByText('@micuenta')).toBeInTheDocument()
    expect(screen.getByText(/tenant-abc/)).toBeInTheDocument()
  })

  it('sólo ofrece marcar las que están esperando el alta', () => {
    render(
      <ConnectionRequestsAdmin
        requests={[base, { ...base, id: 'req-2', status: 'invite_sent' }]}
        onMarkSent={vi.fn()}
        busyId={null}
      />,
    )

    expect(screen.getAllByRole('button', { name: 'Ya la invité' })).toHaveLength(1)
  })

  it('avisa el paso que falta cuando espera el alta', () => {
    render(<ConnectionRequestsAdmin requests={[base]} onMarkSent={vi.fn()} busyId={null} />)

    expect(screen.getByText(/Instagram Tester en el App Dashboard/)).toBeInTheDocument()
  })

  it('marca la solicitud por su id', async () => {
    const onMarkSent = vi.fn()
    render(<ConnectionRequestsAdmin requests={[base]} onMarkSent={onMarkSent} busyId={null} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ya la invité' }))

    expect(onMarkSent).toHaveBeenCalledWith('req-1')
  })

  // Sin esto, el operador puede apretar dos veces mientras la petición viaja y
  // creer que marcó dos solicitudes distintas.
  it('deshabilita la que está en curso', () => {
    render(<ConnectionRequestsAdmin requests={[base]} onMarkSent={vi.fn()} busyId="req-1" />)

    expect(screen.getByRole('button', { name: 'Marcando…' })).toBeDisabled()
  })

  // El operador y el cliente tienen que hablar del mismo problema con las
  // mismas palabras, o la conversación empieza traduciendo.
  it('traduce el motivo del fallo en vez de mostrar el código', () => {
    render(
      <ConnectionRequestsAdmin
        requests={[{ ...base, status: 'failed', lastError: 'personal_account' }]}
        onMarkSent={vi.fn()}
        busyId={null}
      />,
    )

    expect(screen.getByText(/la cuenta es personal, no profesional/)).toBeInTheDocument()
    expect(screen.queryByText(/personal_account/)).not.toBeInTheDocument()
  })
})
