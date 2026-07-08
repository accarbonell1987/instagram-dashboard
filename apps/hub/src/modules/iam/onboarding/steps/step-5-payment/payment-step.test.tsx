import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';

import { DraftProvider } from '../../context/draft-context';
import type { DraftState } from '../../services/draft.service';
import * as draftService from '../../services/draft.service';

import { StepPayment } from './payment-step';

import { applyScenario } from '@/lib/mocks/seed';

const mockPush = vi.fn();
const mockReplace = vi.fn();

// Module-level searchParams that can be swapped per test
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => currentSearchParams,
}));

// Mock window.location.assign
const mockAssign = vi.fn();

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    value: Object.assign(Object.create(null) as object, window.location, { assign: mockAssign }),
    writable: true,
  });
});

afterAll(() => {
  // Restore isn't needed for window.location.assign in jsdom, but mark for clarity
});

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
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
    ...overrides,
  };
}

function renderStep(draft: DraftState) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DraftProvider value={{ draft, plan: draft.plan, draftId: draft.id, refresh: vi.fn() }}>
        <StepPayment draftId={draft.id} />
      </DraftProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  applyScenario('happy');
  mockPush.mockClear();
  mockReplace.mockClear();
  mockAssign.mockClear();
  localStorage.clear();
  currentSearchParams = new URLSearchParams();
  vi.spyOn(draftService, 'initiatePayment').mockResolvedValue({
    redirectUrl: 'http://localhost:3001/?msw=mock-bancard&paymentId=payment-test-001',
    paymentId: 'payment-test-001',
  });
  vi.spyOn(draftService, 'getPaymentStatus').mockResolvedValue({ status: 'pending' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StepPayment — initiate view', () => {
  it('renders the payment summary and Pagar button', () => {
    renderStep(makeDraft());
    expect(screen.getByRole('heading', { name: /pago/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pagar con bancard/i })).toBeInTheDocument();
  });

  it('clicking Pagar calls initiatePayment and redirects', async () => {
    renderStep(makeDraft());
    fireEvent.click(screen.getByRole('button', { name: /pagar con bancard/i }));

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith(expect.stringContaining('localhost'));
    });
  });
});

describe('StepPayment — polling view', () => {
  it('renders verifying state when status=verifying in params', () => {
    currentSearchParams = new URLSearchParams('status=verifying&paymentId=payment-001');
    renderStep(makeDraft());
    expect(screen.getByText(/verificando/i)).toBeInTheDocument();
  });
});
