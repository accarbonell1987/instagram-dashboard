import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { seedDb } from '@/lib/mocks/seed';

// Mock the heavy section components to focus on page-level concerns
vi.mock('@/modules/shared/billing/components/billing-plan-section', () => ({
  BillingPlanSection: () => <div data-testid="billing-plan-section">BillingPlanSection</div>,
}));
vi.mock('@/modules/shared/billing/components/payment-method-section', () => ({
  PaymentMethodSection: () => <div data-testid="payment-method-section">PaymentMethodSection</div>,
}));
vi.mock('@/modules/shared/billing/components/invoices-section', () => ({
  InvoicesSection: () => <div data-testid="invoices-section">InvoicesSection</div>,
}));

// Mock useSession to control role
const mockUseSession = vi.fn();
vi.mock('@/modules/iam/identity/hooks/use-session', () => ({
  useSession: () => mockUseSession(),
}));

import BillingPage from './page';

function renderWithRole(role: string | null) {
  mockUseSession.mockReturnValue({
    status: role !== null ? 'authenticated' : 'unauthenticated',
    session: role !== null ? { role, user: { id: '1', email: 'a@b.com', fullName: 'Test' }, tenant: { id: '1', slug: 'acme' }, accessToken: 'tok', expiresAt: 9999999999 } : null,
  });
  return render(<BillingPage />);
}

describe('BillingPage', () => {
  it('renders all three sections for TenantAdmin', () => {
    renderWithRole('TenantAdmin');
    expect(screen.getByTestId('billing-plan-section')).toBeInTheDocument();
    expect(screen.getByTestId('payment-method-section')).toBeInTheDocument();
    expect(screen.getByTestId('invoices-section')).toBeInTheDocument();
  });

  it('renders all three sections for SuperAdmin', () => {
    renderWithRole('SuperAdmin');
    expect(screen.getByTestId('billing-plan-section')).toBeInTheDocument();
    expect(screen.getByTestId('payment-method-section')).toBeInTheDocument();
    expect(screen.getByTestId('invoices-section')).toBeInTheDocument();
  });

  it('renders access denied fallback for User role', () => {
    renderWithRole('User');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Acceso denegado/i)).toBeInTheDocument();
    expect(screen.queryByTestId('billing-plan-section')).not.toBeInTheDocument();
  });

  it('renders access denied fallback when unauthenticated', () => {
    renderWithRole(null);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Acceso denegado/i)).toBeInTheDocument();
  });

  it('renders page heading "Facturación"', () => {
    renderWithRole('TenantAdmin');
    expect(screen.getByRole('heading', { name: 'Facturación' })).toBeInTheDocument();
  });
});
