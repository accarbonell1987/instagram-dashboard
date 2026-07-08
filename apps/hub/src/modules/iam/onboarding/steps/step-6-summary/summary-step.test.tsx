import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DraftProvider } from '../../context/draft-context';
import type { DraftState } from '../../services/draft.service';

import { StepSummary } from './summary-step';

import { applyScenario } from '@/lib/mocks/seed';

const mockPush = vi.fn();
const mockWindowOpen = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    id: 'draft-test-001',
    currentStep: 'summary',
    status: 'completed',
    plan: {
      id: 'professional',
      name: 'Profesional',
      price: 450_000,
      currency: 'PYG',
      billingCycle: 'monthly',
      features: [],
      popular: true,
    },
    representative: { email: 'test@empresa.com', fullName: 'Ana Pereira', phone: '+59521123456' },
    otpVerified: true,
    company: {
      legalName: 'ACME S.A.',
      ruc: '80012345-1',
      address: 'Av. Mariscal 2000',
      city: 'Asunción',
      country: 'PY',
    },
    payment: { paymentId: 'pay-001', status: 'approved', bancardProcessId: null },
    version: 5,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    ...overrides,
  };
}

const mockDocuments = {
  invoiceUrl: '/mock-pdf/factura-test.pdf',
  contractUrl: '/mock-pdf/contrato-test.pdf',
};

function renderStep(draft: DraftState) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DraftProvider value={{ draft, plan: draft.plan, draftId: draft.id, refresh: vi.fn() }}>
        <StepSummary draftId={draft.id} documents={mockDocuments} />
      </DraftProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  applyScenario('happy');
  mockPush.mockClear();
  mockWindowOpen.mockClear();
  vi.spyOn(window, 'open').mockImplementation(mockWindowOpen);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StepSummary', () => {
  it('renders the success heading', () => {
    renderStep(makeDraft());
    expect(screen.getByRole('heading', { name: /registro completado/i })).toBeInTheDocument();
  });

  it('renders company name', () => {
    renderStep(makeDraft());
    expect(screen.getByText(/ACME S\.A\./)).toBeInTheDocument();
  });

  it('renders invoice and contract download buttons', () => {
    renderStep(makeDraft());
    expect(screen.getByRole('button', { name: /factura/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /contrato/i })).toBeInTheDocument();
  });

  it('clicking invoice opens the URL', () => {
    renderStep(makeDraft());
    fireEvent.click(screen.getByRole('button', { name: /factura/i }));
    expect(mockWindowOpen).toHaveBeenCalledWith(
      '/mock-pdf/factura-test.pdf',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('clicking contract opens the URL', () => {
    renderStep(makeDraft());
    fireEvent.click(screen.getByRole('button', { name: /contrato/i }));
    expect(mockWindowOpen).toHaveBeenCalledWith(
      '/mock-pdf/contrato-test.pdf',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('"Ir al inicio de sesión" navigates to /login (NOT / — user must activate account first)', () => {
    renderStep(makeDraft());
    fireEvent.click(screen.getByRole('button', { name: /ir al inicio de sesión/i }));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
