import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DraftProvider } from '../../context/draft-context';
import type { DraftState } from '../../services/draft.service';
import * as draftService from '../../services/draft.service';

import { StepCompanyData } from './company-step';

import { applyScenario } from '@/lib/mocks/seed';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    id: 'draft-test-001',
    currentStep: 'company',
    status: 'draft',
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
    company: null,
    payment: null,
    version: 3,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    ...overrides,
  };
}

function renderStep(draft: DraftState) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DraftProvider value={{ draft, plan: draft.plan, draftId: draft.id, refresh: vi.fn() }}>
        <StepCompanyData draftId={draft.id} />
      </DraftProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  applyScenario('happy');
  mockPush.mockClear();
  vi.spyOn(draftService, 'patchDraft').mockResolvedValue({
    id: 'draft-test-001',
    currentStep: 'payment',
    status: 'draft',
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
    payment: null,
    version: 4,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StepCompanyData', () => {
  it('renders the company form fields', () => {
    renderStep(makeDraft());
    expect(screen.getByLabelText(/razón social/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ruc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ciudad/i)).toBeInTheDocument();
  });

  it('validates RUC pattern — rejects invalid RUC', async () => {
    renderStep(makeDraft());

    fireEvent.change(screen.getByLabelText(/ruc/i), {
      target: { value: 'INVALID' },
    });

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/ruc inválido/i)).toBeInTheDocument();
    });
  });

  it('submits all fields and advances to payment', async () => {
    const { container } = renderStep(makeDraft());

    fireEvent.change(screen.getByLabelText(/razón social/i), {
      target: { value: 'Empresa ACME S.A.' },
    });
    fireEvent.change(screen.getByLabelText(/ruc/i), { target: { value: '80012345-1' } });
    fireEvent.change(screen.getByLabelText(/dirección/i), {
      target: { value: 'Av. Mariscal López 2000' },
    });
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'Asunción' } });
    // Radix Select renders hidden native <select aria-hidden="true"> — use those for fireEvent.change
    // Index 0 = tipoEmpresa, index 1 = departamento
    const hiddenSelects = container.querySelectorAll('select[aria-hidden="true"]');
    fireEvent.change(hiddenSelects[1]!, { target: { value: 'Central' } });
    fireEvent.change(screen.getByLabelText(/teléfono/i), { target: { value: '+59521123456' } });
    fireEvent.change(screen.getByLabelText(/persona de contacto/i), {
      target: { value: 'Ana Pereira' },
    });
    fireEvent.change(screen.getByLabelText(/cargo/i), { target: { value: 'Gerente' } });

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/payment'));
    });
  });
});
