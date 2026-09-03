import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ConnectionWizard } from './connection-wizard'

import type { ConnectionRequest } from '@/features/account/services/connection.service'


const { getConnectionRequest, requestConnection, getOAuthUrl } = vi.hoisted(() => ({
  getConnectionRequest: vi.fn(),
  requestConnection: vi.fn(),
  getOAuthUrl: vi.fn().mockResolvedValue('https://instagram.example/oauth'),
}))
vi.mock('@/features/account/services/connection.service', () => ({
  getConnectionRequest,
  requestConnection,
  getOAuthUrl,
}))

const base: ConnectionRequest = {
  id: 'req-1',
  username: 'micuenta',
  status: 'awaiting_invite',
  lastError: null,
  requestedAt: '2026-09-03T10:00:00.000Z',
  inviteSentAt: null,
  connectedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  getOAuthUrl.mockResolvedValue('https://instagram.example/oauth')
})

describe('el paso que ve el cliente depende del estado', () => {
  it('sin solicitud previa pide el usuario', async () => {
    getConnectionRequest.mockResolvedValueOnce(null)

    render(<ConnectionWizard />)

    expect(await screen.findByLabelText('Tu usuario de Instagram')).toBeInTheDocument()
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument()
  })

  it('esperando el alta muestra que está en curso, no un formulario', async () => {
    getConnectionRequest.mockResolvedValueOnce(base)

    render(<ConnectionWizard />)

    expect(await screen.findByText('Paso 2 de 3')).toBeInTheDocument()
    expect(screen.queryByLabelText('Tu usuario de Instagram')).not.toBeInTheDocument()
  })

  it('con la invitación enviada explica cómo aceptarla', async () => {
    getConnectionRequest.mockResolvedValueOnce({ ...base, status: 'invite_sent' })

    render(<ConnectionWizard />)

    expect(await screen.findByText('Paso 3 de 3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Invitaciones de prueba' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/accounts/manage_access/',
    )
  })

  // Sólo después de que el cliente dice que aceptó se dispara el OAuth. Hacerlo
  // antes lo manda a Instagram a recibir un error que no puede interpretar.
  it('el OAuth recién aparece cuando el cliente confirma que aceptó', async () => {
    getConnectionRequest.mockResolvedValueOnce({ ...base, status: 'invite_sent' })
    render(<ConnectionWizard />)
    await screen.findByText('Paso 3 de 3')

    expect(screen.queryByRole('button', { name: 'Conectar Instagram' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ya la acepté, conectar' }))

    expect(await screen.findByRole('button', { name: 'Conectar Instagram' })).toBeInTheDocument()
  })
})

describe('los tres fallos de Development se explican distinto', () => {
  it('la cuenta personal se nombra por su nombre y dice cómo arreglarla', async () => {
    getConnectionRequest.mockResolvedValueOnce({
      ...base,
      status: 'failed',
      lastError: 'personal_account',
    })

    render(<ConnectionWizard />)

    expect(await screen.findByText(/es una cuenta personal/)).toBeInTheDocument()
    expect(screen.getByText(/Cambiar a cuenta profesional/)).toBeInTheDocument()
  })

  // Meta devuelve el mismo texto para "no tiene rol" y "no aceptó", así que el
  // wizard muestra los dos caminos en vez de adivinar uno.
  it('el resto de los fallos ofrece los dos caminos posibles', async () => {
    getConnectionRequest.mockResolvedValueOnce({
      ...base,
      status: 'failed',
      lastError: 'invite_not_accepted',
    })

    render(<ConnectionWizard />)

    expect(await screen.findByText(/todavía no fue aceptada/)).toBeInTheDocument()
    expect(screen.getByText(/y no con/)).toBeInTheDocument()
    expect(screen.queryByText(/es una cuenta personal/)).not.toBeInTheDocument()
  })
})

describe('el envío de la solicitud', () => {
  it('manda el usuario y avanza al paso siguiente', async () => {
    getConnectionRequest.mockResolvedValueOnce(null)
    requestConnection.mockResolvedValueOnce(base)

    render(<ConnectionWizard />)
    await userEvent.type(await screen.findByLabelText('Tu usuario de Instagram'), '@micuenta')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => { expect(requestConnection).toHaveBeenCalledWith('@micuenta') })
    expect(await screen.findByText('Paso 2 de 3')).toBeInTheDocument()
  })

  it('no envía con el campo vacío', async () => {
    getConnectionRequest.mockResolvedValueOnce(null)

    render(<ConnectionWizard />)
    await screen.findByLabelText('Tu usuario de Instagram')

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    expect(requestConnection).not.toHaveBeenCalled()
  })

  it('muestra el error del servidor sin perder lo escrito', async () => {
    getConnectionRequest.mockResolvedValueOnce(null)
    requestConnection.mockRejectedValueOnce(new Error('Usuario inválido'))

    render(<ConnectionWizard />)
    await userEvent.type(await screen.findByLabelText('Tu usuario de Instagram'), 'ana perez')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario inválido')
    expect(screen.getByLabelText('Tu usuario de Instagram')).toHaveValue('ana perez')
  })
})
