import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock next/link and next/navigation
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockPathname = vi.fn(() => '/')
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

// Mock useSession and useAuth
const mockUseSession = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('@/modules/iam/identity/hooks/use-session', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock returns the vi.fn() result, typed any
  useSession: () => mockUseSession(),
}))

vi.mock('@/providers', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock returns the vi.fn() result, typed any
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/components/theme-selector', () => ({
  ThemeSelector: () => null,
}))

// Mock lucide-react
vi.mock('lucide-react', () => ({
  LogOut: () => <span>LogOut</span>,
  PaletteIcon: () => <span>Palette</span>,
  Settings: () => <span>Settings</span>,
  User: () => <span>User</span>,
  LayoutDashboard: () => <span>Dashboard</span>,
}))

// Mock @core/shared components and providers
vi.mock('@core/shared/components', () => ({
  ThemeToggleSelector: () => <span>ThemeToggle</span>,
}))

vi.mock('@core/shared/providers', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  ColorThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock @core/ui avatar (depends on Radix context)
vi.mock('@core/ui', async () => {
  const actual = await vi.importActual('@core/ui')
  return {
    ...(actual as object),
    Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AvatarImage: () => null,
    AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  }
})

import { Header } from '@/components/header'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function renderHeaderWithRole(role: string | null) {
  const sessionUser = role ? {
    id: 'user-1',
    email: 'admin@test.com',
    fullName: 'Admin User',
    picture: undefined,
  } : null

  mockUseSession.mockReturnValue({
    status: role !== null ? 'authenticated' : 'unauthenticated',
    session: role !== null
      ? { role, user: sessionUser, tenant: { id: 't1', slug: 'test', name: 'Test Org' } }
      : null,
  })

  mockUseAuth.mockReturnValue({
    session: {
      status: role !== null ? 'authenticated' : 'unauthenticated',
      session: role !== null
        ? { user: sessionUser, accessToken: 'tok' }
        : null,
    },
    signOut: vi.fn(),
  })

  return render(<Header />)
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Header — Backoffice link visibility', () => {
  it('shows Backoffice nav link when user is SuperAdmin', () => {
    renderHeaderWithRole('SuperAdmin')
    const backofficeLink = screen.getByLabelText('Backoffice')
    expect(backofficeLink).toBeInTheDocument()
    expect(backofficeLink.closest('a')).toHaveAttribute('href', '/backoffice/modules')
  })

  it('does NOT show Backoffice nav link when user is TenantAdmin', () => {
    renderHeaderWithRole('TenantAdmin')
    const backofficeLink = screen.queryByLabelText('Backoffice')
    expect(backofficeLink).toBeNull()
  })

  it('does NOT show Backoffice nav link when user is regular User', () => {
    renderHeaderWithRole('User')
    const backofficeLink = screen.queryByLabelText('Backoffice')
    expect(backofficeLink).toBeNull()
  })

  it('does NOT show Backoffice nav link when session is null (logged out)', () => {
    renderHeaderWithRole(null)
    const backofficeLink = screen.queryByLabelText('Backoffice')
    expect(backofficeLink).toBeNull()
  })
})
