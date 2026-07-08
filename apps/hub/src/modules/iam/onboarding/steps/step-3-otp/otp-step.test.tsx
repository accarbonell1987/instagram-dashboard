import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DraftProvider } from '../../context/draft-context';
import type { DraftState } from '../../services/draft.service';

import { StepOtpVerification } from './otp-step';

import { applyScenario } from '@/lib/mocks/seed';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    id: 'draft-test-001',
    currentStep: 'otp',
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
    otpVerified: false,
    company: null,
    payment: null,
    version: 2,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    ...overrides,
  };
}

function renderStep(draft: DraftState) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DraftProvider value={{ draft, plan: draft.plan, draftId: draft.id, refresh: vi.fn() }}>
        <StepOtpVerification draftId={draft.id} />
      </DraftProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  applyScenario('happy');
  mockPush.mockClear();
});

describe('StepOtpVerification', () => {
  it('renders OTP form heading', () => {
    renderStep(makeDraft());
    expect(screen.getByRole('heading', { name: /verificación/i })).toBeInTheDocument();
  });

  it('renders OTP input', async () => {
    renderStep(makeDraft());
    await waitFor(() => {
      expect(screen.getByLabelText(/código de verificación/i)).toBeInTheDocument();
    });
  });

  it('shows the representative email after OTP is sent', async () => {
    renderStep(makeDraft());
    // Wait for the async sendOtp to complete — the email is only visible in the OtpForm
    // which renders when otpId.length > 0 (after the initial OTP request resolves).
    await waitFor(() => {
      expect(screen.getByText(/test@empresa.com/)).toBeInTheDocument();
    });
  });
});
