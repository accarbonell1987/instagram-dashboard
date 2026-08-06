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
    payment: { paymentId: 'pay-001', status: 'approved', method: 'bancard', bancardProcessId: null, instruction: null },
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
  localStorage.clear();
  mockPush.mockClear();
  mockWindowOpen.mockClear();
  vi.spyOn(window, 'open').mockImplementation(mockWindowOpen);
});

afterEach(() => {
  vi.clearAllMocks();
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

  it('does not render a document download button — documents are email-only', () => {
    renderStep(makeDraft());
    expect(screen.queryByRole('button', { name: /descargar/i })).not.toBeInTheDocument();
  });

  it('says documents were emailed when the payment already settled', () => {
    renderStep(makeDraft());
    expect(screen.getByText(/enviamos la confirmación del pago/i)).toBeInTheDocument();
  });

  it('says documents will be emailed once confirmed, for an unsettled bank-transfer payment', () => {
    renderStep(
      makeDraft({
        payment: { paymentId: 'pay-001', status: 'pending', method: 'bank_transfer', bancardProcessId: null, instruction: null },
      })
    );
    expect(screen.getByText(/apenas confirmemos tu transferencia/i)).toBeInTheDocument();
  });

  it('prefers the backend-provided instruction over localStorage', () => {
    localStorage.setItem(
      'draft:draft-test-001:payment:bank-transfer',
      JSON.stringify({
        kind: 'bank_transfer',
        reference: 'CH-STALE1',
        bankAccounts: [
          { bankName: 'Stale Bank', accountType: 'checking', accountNumber: '000', accountHolder: 'Stale' },
        ],
      })
    );
    renderStep(
      makeDraft({
        payment: {
          paymentId: 'pay-001',
          status: 'pending',
          method: 'bank_transfer',
          bancardProcessId: null,
          instruction: {
            kind: 'bank_transfer',
            reference: 'CH-7K2M4Q',
            bankAccounts: [
              { bankName: 'Banco Itaú', accountType: 'checking', accountNumber: '123456789', accountHolder: 'Corehub S.A.' },
            ],
          },
        },
      })
    );
    expect(screen.getByText('CH-7K2M4Q')).toBeInTheDocument();
    expect(screen.queryByText('CH-STALE1')).not.toBeInTheDocument();
  });

  it('repeats the reference and bank accounts when a bank-transfer instruction was persisted', () => {
    localStorage.setItem(
      'draft:draft-test-001:payment:bank-transfer',
      JSON.stringify({
        kind: 'bank_transfer',
        reference: 'CH-7K2M4Q',
        bankAccounts: [
          { bankName: 'Banco Itaú', accountType: 'checking', accountNumber: '123456789', accountHolder: 'Corehub S.A.' },
        ],
      })
    );
    renderStep(
      makeDraft({
        payment: { paymentId: 'pay-001', status: 'pending', method: 'bank_transfer', bancardProcessId: null, instruction: null },
      })
    );
    expect(screen.getByText('CH-7K2M4Q')).toBeInTheDocument();
    expect(screen.getByText('Banco Itaú')).toBeInTheDocument();
  });

  it('"Ir al inicio de sesión" navigates to /login (NOT / — user must activate account first)', () => {
    renderStep(makeDraft());
    fireEvent.click(screen.getByRole('button', { name: /ir al inicio de sesión/i }));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
