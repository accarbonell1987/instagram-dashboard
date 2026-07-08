import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next/link and next/navigation
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockPathname = vi.fn(() => '/backoffice/modules')
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

// Mock useSession to control role
const mockUseSession = vi.fn()
vi.mock('@/modules/iam/identity/hooks/use-session', () => ({
  useSession: () => mockUseSession(),
}))

import { RequireRole } from '@/modules/iam/identity/guards/require-role'

// ─── Test component ────────────────────────────────────────────────────────────

function TestBackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="SuperAdmin">
      <div data-testid="backoffice-content">{children}</div>
    </RequireRole>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function renderWithRole(role: string | null) {
  mockUseSession.mockReturnValue({
    status: role !== null ? 'authenticated' : 'unauthenticated',
    session: role !== null ? { role } : null,
  })
  return render(
    <TestBackofficeLayout>
      <p>Backoffice Dashboard</p>
    </TestBackofficeLayout>
  )
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Backoffice Layout — RequireRole guard', () => {
  it('renders content when user is SuperAdmin', () => {
    renderWithRole('SuperAdmin')
    const content = screen.getByTestId('backoffice-content')
    expect(content).toBeInTheDocument()
  })

  it('shows access denied when user is TenantAdmin (not SuperAdmin)', () => {
    renderWithRole('TenantAdmin')
    const denied = screen.getByRole('alert')
    expect(denied).toHaveTextContent('Acceso denegado')
  })

  it('shows access denied when session is null', () => {
    renderWithRole(null)
    const denied = screen.getByRole('alert')
    expect(denied).toHaveTextContent('Acceso denegado')
  })
})
