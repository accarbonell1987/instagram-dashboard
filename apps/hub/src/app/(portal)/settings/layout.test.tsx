import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/link and next/navigation
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}));

const mockPathname = vi.fn(() => '/settings');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock useSession to control role
const mockUseSession = vi.fn();
vi.mock('@/modules/iam/identity/hooks/use-session', () => ({
  useSession: () => mockUseSession(),
}));

import SettingsLayout from './layout';

function renderWithRole(role: string | null, pathname = '/settings') {
  mockPathname.mockReturnValue(pathname);
  mockUseSession.mockReturnValue({
    status: role !== null ? 'authenticated' : 'unauthenticated',
    session: role !== null
      ? { role, user: { id: '1', email: 'a@b.com', fullName: 'Test' }, tenant: { id: '1', slug: 'acme' }, accessToken: 'tok', expiresAt: 9999999999 }
      : null,
  });
  return render(<SettingsLayout><div>Content</div></SettingsLayout>);
}

describe('SettingsLayout — billing nav link', () => {
  it('shows "Facturación" link for TenantAdmin', () => {
    renderWithRole('TenantAdmin');
    expect(screen.getByRole('link', { name: 'Facturación' })).toBeInTheDocument();
  });

  it('shows "Facturación" link for SuperAdmin', () => {
    renderWithRole('SuperAdmin');
    expect(screen.getByRole('link', { name: 'Facturación' })).toBeInTheDocument();
  });

  it('hides "Facturación" link for User role', () => {
    renderWithRole('User');
    expect(screen.queryByRole('link', { name: 'Facturación' })).not.toBeInTheDocument();
  });

  it('hides "Facturación" link when session is null', () => {
    renderWithRole(null);
    expect(screen.queryByRole('link', { name: 'Facturación' })).not.toBeInTheDocument();
  });

  it('marks "Facturación" link as aria-current="page" when on /settings/billing', () => {
    renderWithRole('TenantAdmin', '/settings/billing');
    const billingLink = screen.getByRole('link', { name: 'Facturación' });
    expect(billingLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not affect visibility of other nav links for any role', () => {
    renderWithRole('User');
    // Base links should always be visible
    expect(screen.getByRole('link', { name: 'Resumen' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Equipo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Organización' })).toBeInTheDocument();
  });
});
