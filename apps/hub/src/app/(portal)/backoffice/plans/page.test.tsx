import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { server } from '@/lib/mocks/server'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/backoffice/plans',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock useSession to return SuperAdmin
vi.mock('@/modules/iam/identity/hooks/use-session', () => ({
  useSession: () => ({
    status: 'authenticated' as const,
    session: { id: 'user-1', email: 'admin@test.com', fullName: 'Admin', role: 'SuperAdmin' as const, tenantId: 'tenant-1' },
    accessToken: 'token',
  }),
}))

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080'

// ─── Default MSW Handlers ─────────────────────────────────────────────────────

function setupDefaultHandlers() {
  server.use(
    // GET /admin/plans
    http.get(`${BASE}/admin/plans`, () => {
      return HttpResponse.json({
        plans: [
          { id: 'plan-1', name: 'Plan Básico', description: 'Plan básico', price: 99000, currency: 'PYG', billingInterval: 'month', active: true, tenantCount: 3, createdAt: '2024-01-01', updatedAt: '2024-06-01' },
          { id: 'plan-2', name: 'Plan Pro', description: 'Plan profesional', price: 199000, currency: 'PYG', billingInterval: 'month', active: true, tenantCount: 5, createdAt: '2024-01-01', updatedAt: '2024-06-01' },
        ],
      }, { status: 200 })
    }),
    // GET /admin/modules
    http.get(`${BASE}/admin/modules`, () => {
      return HttpResponse.json({
        modules: [
          { id: 'buscador-app', name: 'Buscador de Clientes', description: 'Consulta de clientes', defaultUrl: '/', active: true },
          { id: 'facturacion-app', name: 'Facturación Electrónica', description: 'Facturación', defaultUrl: '/', active: true },
          { id: 'rrhh-app', name: 'Recursos Humanos', description: 'RRHH', defaultUrl: '/', active: true },
        ],
      }, { status: 200 })
    }),
    // GET /admin/plans/:planId/modules
    http.get(`${BASE}/admin/plans/:planId/modules`, ({ params }) => {
      const { planId } = params as { planId: string }
      if (planId === 'plan-1') {
        return HttpResponse.json({ moduleIds: ['buscador-app', 'facturacion-app'] }, { status: 200 })
      }
      return HttpResponse.json({ moduleIds: [] }, { status: 200 })
    }),
    // PUT /admin/plans/:planId/modules
    http.put(`${BASE}/admin/plans/:planId/modules`, async ({ params }) => {
      const { planId } = params as { planId: string }
      if (planId === 'error-plan') {
        return HttpResponse.json({ type: 'about:blank', title: 'Internal Error', status: 500 }, { status: 500, headers: { 'Content-Type': 'application/problem+json' } })
      }
      return new HttpResponse(null, { status: 204 })
    }),
  )
}

import PlansPage from './page'

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function renderPage() {
  const result = render(<PlansPage />)
  // Wait for plans to load (module count badges appear after plans + modules fetch)
  await waitFor(() => {
    expect(screen.queryByText('Cargando planes...')).not.toBeInTheDocument()
  })
  return result
}

/** Opens the module dialog for the plan whose row contains `planName`. */
async function openModuleDialog(planName: string) {
  const user = userEvent.setup()
  await renderPage()

  // Find the row with the plan name and click the module badge within it
  const row = screen.getByText(planName).closest('tr')
  if (!row) throw new Error(`Row not found for plan: ${planName}`)

  const badgeBtn = row.querySelector('button')
  if (!badgeBtn) throw new Error(`Module badge button not found for plan: ${planName}`)
  await user.click(badgeBtn)

  // Wait for dialog to appear
  await waitFor(() => {
    expect(screen.getByText(`Módulos — ${planName}`)).toBeInTheDocument()
  })
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('PlansPage — Module Assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultHandlers()
  })

  it('renders module count badges for each plan', async () => {
    await renderPage()

    // Plan Básico has 2 modules, Plan Pro has 0
    expect(screen.getByText('2 módulos')).toBeInTheDocument()
    expect(screen.getByText('Sin módulos')).toBeInTheDocument()
  })

  it('shows module name pills under badge when modules assigned', async () => {
    await renderPage()

    // Plan Básico has buscador-app + facturacion-app assigned
    expect(screen.getByText('Buscador de Clientes')).toBeInTheDocument()
    expect(screen.getByText('Facturación Electrónica')).toBeInTheDocument()
  })

  it('opens module assignment dialog when clicking module badge', async () => {
    await openModuleDialog('Plan Básico')
  })

  it('opens module assignment dialog when clicking module name pill', async () => {
    const user = userEvent.setup()
    await renderPage()

    // Click the module name pill for "Buscador de Clientes"
    const pill = screen.getByText('Buscador de Clientes')
    await user.click(pill)

    await waitFor(() => {
      expect(screen.getByText('Módulos — Plan Básico')).toBeInTheDocument()
    })
  })

  it('shows loading skeleton when dialog opens', async () => {
    // Delay responses so the loading state is visible
    server.use(
      http.get(`${BASE}/admin/modules`, async () => {
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json({
          modules: [{ id: 'test-app', name: 'Test App', description: '', defaultUrl: '/', active: true }],
        }, { status: 200 })
      }),
      http.get(`${BASE}/admin/plans/:planId/modules`, async () => {
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json({ moduleIds: [] }, { status: 200 })
      }),
    )

    const user = userEvent.setup()
    await renderPage()

    // Click badge for Plan Básico
    const row = screen.getByText('Plan Básico').closest('tr')!
    const badgeBtn = row.querySelector('button')!
    await user.click(badgeBtn)

    // Skeleton placeholders should appear while loading (animate-pulse divs)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)

    // Eventually the modules load
    await waitFor(() => {
      // After load, skeleton should disappear and list headers should appear
      expect(screen.getByText(/ASIGNADOS/)).toBeInTheDocument()
    })
  })

  it('displays modules in dual-list with current assignments', async () => {
    await openModuleDialog('Plan Básico')

    // Wait for dialog content to load
    await waitFor(() => {
      expect(screen.getByText(/ASIGNADOS/)).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')

    // Assigned modules (plan-1): buscador-app, facturacion-app
    expect(within(dialog).getByText('Buscador de Clientes')).toBeInTheDocument()
    expect(within(dialog).getByText('Facturación Electrónica')).toBeInTheDocument()

    // Available module: rrhh-app
    expect(within(dialog).getByText('Recursos Humanos')).toBeInTheDocument()
  })

  it('moves module from available to assigned when clicking +', async () => {
    await openModuleDialog('Plan Básico')

    await waitFor(() => {
      expect(screen.getByText(/ASIGNADOS/)).toBeInTheDocument()
    })

    // Click the + button for Recursos Humanos (in the DISPONIBLES column)
    const addBtn = screen.getByRole('button', { name: 'Agregar Recursos Humanos' })
    await userEvent.setup().click(addBtn)

    // Recursos Humanos should now be in ASIGNADOS (heading should show count increase)
    await waitFor(() => {
      expect(screen.getByText(/ASIGNADOS \(3\)/)).toBeInTheDocument()
    })

    // And no longer in DISPONIBLES
    expect(screen.queryByRole('button', { name: 'Agregar Recursos Humanos' })).toBeNull()
  })

  it('saves and shows success toast on Guardar', async () => {
    const { toast } = await import('sonner')
    await openModuleDialog('Plan Básico')

    await waitFor(() => {
      expect(screen.getByText(/ASIGNADOS/)).toBeInTheDocument()
    })

    // Click Guardar without changes (already has 2 modules assigned)
    const guardarBtn = screen.getByRole('button', { name: 'Guardar' })
    await userEvent.setup().click(guardarBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Módulos actualizados')
    })
  })

  it('shows error toast on save failure', async () => {
    const { toast } = await import('sonner')

    // Override plans list to include error-plan
    server.use(
      http.get(`${BASE}/admin/plans`, () => {
        return HttpResponse.json({
          plans: [
            { id: 'error-plan', name: 'Error Plan', description: '', price: 0, currency: 'PYG', billingInterval: 'month', active: true, tenantCount: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          ],
        }, { status: 200 })
      }),
    )

    await openModuleDialog('Error Plan')

    await waitFor(() => {
      expect(screen.getByText(/ASIGNADOS/)).toBeInTheDocument()
    })

    // Click Guardar — this plan is 'error-plan' which returns 500
    const guardarBtn = screen.getByRole('button', { name: 'Guardar' })
    await userEvent.setup().click(guardarBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })

  it('disables buttons while saving', async () => {
    // Make the save slow so we can observe the loading state
    let resolveSave: () => void
    server.use(
      http.put(`${BASE}/admin/plans/:planId/modules`, async () => {
        await new Promise<void>((r) => { resolveSave = r })
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await openModuleDialog('Plan Básico')

    await waitFor(() => {
      expect(screen.getByText(/ASIGNADOS/)).toBeInTheDocument()
    })

    // Click Guardar
    const guardarBtn = screen.getByRole('button', { name: 'Guardar' })
    await userEvent.setup().click(guardarBtn)

    // While saving, button should show "Guardando..." and be disabled
    await waitFor(() => {
      expect(screen.getByText('Guardando...')).toBeInTheDocument()
    })

    // Cancelar should also be disabled
    const cancelarBtn = screen.getByRole('button', { name: 'Cancelar' })
    expect(cancelarBtn).toBeDisabled()

    // Cleanup: resolve the pending promise
    resolveSave!()
  })

  it('shows empty state when no modules exist', async () => {
    // Override modules to return empty list
    server.use(
      http.get(`${BASE}/admin/modules`, () => {
        return HttpResponse.json({ modules: [] }, { status: 200 })
      }),
    )

    const user = userEvent.setup()
    await renderPage()

    // Click badge for Plan Básico
    const row = screen.getByText('Plan Básico').closest('tr')!
    const badgeBtn = row.querySelector('button')!
    await user.click(badgeBtn)

    await waitFor(() => {
      expect(screen.getByText('No hay módulos configurados.')).toBeInTheDocument()
    })
  })
})

// ─── Quota Section Tests ────────────────────────────────────────────────────────

describe('PlansPage — Quota Section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultHandlers()
  })

  it('renders quota section with three number inputs when form opens', async () => {
    const user = userEvent.setup()
    await renderPage()

    // Click the "Crear Plan" button in the page header (not the dialog)
    const createBtn = screen.getByRole('button', { name: 'Crear Plan' })
    await user.click(createBtn)

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText('Cuotas de IA')).toBeInTheDocument()
    })

    // Verify hint text
    expect(screen.getByText('Dejar vacío o 0 = ilimitado')).toBeInTheDocument()

    // Verify three quota inputs exist
    expect(screen.getByLabelText('Tokens DeepSeek / mes')).toBeInTheDocument()
    expect(screen.getByLabelText('Imágenes fal.ai / mes')).toBeInTheDocument()
    expect(screen.getByLabelText('Scripts / mes')).toBeInTheDocument()
  })

  it('quota inputs are rendered and accept user input', async () => {
    server.use(
      http.get(`${BASE}/admin/plans`, () => {
        return HttpResponse.json({
          plans: [
            { id: 'plan-1', name: 'Plan Básico', description: '', price: 99000, currency: 'PYG', billingInterval: 'month', active: true, tenantCount: 3, createdAt: '2024-01-01', updatedAt: '2024-06-01' },
          ],
        }, { status: 200 })
      }),
      http.get(`${BASE}/admin/modules`, () => {
        return HttpResponse.json({ modules: [] }, { status: 200 })
      }),
      http.get(`${BASE}/admin/plans/:planId/modules`, () => {
        return HttpResponse.json({ moduleIds: [] }, { status: 200 })
      }),
      http.post(`${BASE}/admin/plans`, async () => {
        return HttpResponse.json({
          id: 'plan-new',
          name: 'Plan Test',
          description: '',
          price: 1000,
          currency: 'USD',
          billingInterval: 'month',
          active: true,
          tenantCount: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }, { status: 201 })
      }),
      http.put(`${BASE}/admin/plans/:planId/quotas`, async () => {
        return HttpResponse.json({ success: true }, { status: 200 })
      }),
    )

    const user = userEvent.setup()
    await renderPage()

    // Open create plan dialog
    await user.click(screen.getByRole('button', { name: 'Crear Plan' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Verify quota section is present
    expect(screen.getByText('Cuotas de IA')).toBeInTheDocument()
    expect(screen.getByText('Dejar vacío o 0 = ilimitado')).toBeInTheDocument()

    // Verify all three quota inputs exist with correct labels
    expect(screen.getByLabelText('Tokens DeepSeek / mes')).toBeInTheDocument()
    expect(screen.getByLabelText('Imágenes fal.ai / mes')).toBeInTheDocument()
    expect(screen.getByLabelText('Scripts / mes')).toBeInTheDocument()

    // Fill quota values and verify they are accepted
    const tokensInput = screen.getByLabelText('Tokens DeepSeek / mes')
    const imagesInput = screen.getByLabelText('Imágenes fal.ai / mes')
    const scriptsInput = screen.getByLabelText('Scripts / mes')

    await user.type(tokensInput, '100000')
    await user.type(imagesInput, '50')
    await user.type(scriptsInput, '30')

    expect(tokensInput).toHaveValue(100000)
    expect(imagesInput).toHaveValue(50)
    expect(scriptsInput).toHaveValue(30)
  })

  // Note: Full form submission integration (PlanFormDialog → handleSave → API call)
  // is tested via plan-admin.service.test.ts (service contract) and plan-schema.test.ts
  // (schema validation). Quota UI rendering and input binding tested above.
})
