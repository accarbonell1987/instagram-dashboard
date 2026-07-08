import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DraftProvider } from '../../context/draft-context';
import type { DraftState } from '../../services/draft.service';
import * as draftService from '../../services/draft.service';

import { StepRepresentativeEmail } from './representative-step';

import { applyScenario } from '@/lib/mocks/seed';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    id: 'draft-test-001',
    currentStep: 'representative',
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
    representative: null,
    otpVerified: false,
    company: null,
    payment: null,
    version: 1,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    ...overrides,
  };
}

function renderStep(draft: DraftState) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DraftProvider value={{ draft, plan: draft.plan, draftId: draft.id, refresh: vi.fn() }}>
        <StepRepresentativeEmail draftId={draft.id} />
      </DraftProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  applyScenario('happy');
  mockPush.mockClear();
  vi.spyOn(draftService, 'patchDraft').mockResolvedValue({
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
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StepRepresentativeEmail', () => {
  it('renders email, fullName, and phone fields', () => {
    renderStep(makeDraft());
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/teléfono/i)).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    renderStep(makeDraft());
    const emailInput = screen.getByLabelText(/correo/i);
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // T13: Updated happy-path submit — uses composite phone controls
  it('submits and advances on valid input', async () => {
    renderStep(makeDraft());

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: 'test@empresa.com' },
    });
    fireEvent.change(screen.getByLabelText(/nombre completo/i), {
      target: { value: 'Ana Pereira' },
    });

    // Fill composite phone: dial code select (Radix combobox) + local number input
    const localInput = screen.getByLabelText(/número local/i);
    // Default dial code is already +595, just fill local number
    fireEvent.change(localInput, { target: { value: '21123456' } });

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/otp'));
    });

    expect(draftService.patchDraft).toHaveBeenCalledWith(
      'draft-test-001',
      'representative',
      expect.objectContaining({
        representative: expect.objectContaining({ phone: '+59521123456' }),
      })
    );
  });

  // T14: Email error on blur with invalid value
  it('shows email error on blur with invalid value', async () => {
    renderStep(makeDraft());
    const emailInput = screen.getByLabelText(/correo/i);
    fireEvent.change(emailInput, { target: { value: 'notanemail' } });
    fireEvent.blur(emailInput);
    await waitFor(() => {
      expect(screen.getByText(/correo electrónico inválido/i)).toBeInTheDocument();
    });
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  // T15: Email error clears after correction and re-blur
  it('clears email error after correction and re-blur', async () => {
    renderStep(makeDraft());
    const emailInput = screen.getByLabelText(/correo/i);

    // First: blur with invalid value to trigger error
    fireEvent.change(emailInput, { target: { value: 'notanemail' } });
    fireEvent.blur(emailInput);
    await waitFor(() => {
      expect(screen.getByText(/correo electrónico inválido/i)).toBeInTheDocument();
    });

    // Then: type a valid value and blur again
    fireEvent.change(emailInput, { target: { value: 'valid@empresa.com' } });
    fireEvent.blur(emailInput);
    await waitFor(() => {
      expect(screen.queryByText(/correo electrónico inválido/i)).not.toBeInTheDocument();
    });
  });

  // T16: Assembles E.164 phone from dial code + local number
  // Note: Radix Select renders a hidden native <select aria-hidden> for form integration.
  // We trigger change on that element because jsdom's pointer-event support is limited
  // and Radix Select's Portal-based dropdown doesn't fully render options in jsdom.
  it('assembles E.164 phone from dial code + local number', async () => {
    renderStep(makeDraft());

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: 'test@empresa.com' },
    });
    fireEvent.change(screen.getByLabelText(/nombre completo/i), {
      target: { value: 'Ana Pereira' },
    });

    // Radix Select renders a hidden native <select> for form integration (aria-hidden="true").
    // Use it to trigger the onValueChange callback in jsdom.
    const hiddenSelect = document.querySelector('select[aria-hidden="true"]') as HTMLSelectElement;
    expect(hiddenSelect).not.toBeNull();
    fireEvent.change(hiddenSelect, { target: { value: '+54' } });

    const localInput = screen.getByLabelText(/número local/i);
    fireEvent.change(localInput, { target: { value: '1123456789' } });

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => {
      expect(draftService.patchDraft).toHaveBeenCalledWith(
        'draft-test-001',
        'representative',
        expect.objectContaining({
          representative: expect.objectContaining({ phone: '+541123456789' }),
        })
      );
    });
  });

  // T17: Pre-fills composite inputs from stored draft phone
  it('pre-fills composite inputs from stored draft phone', () => {
    const draft = makeDraft({
      representative: {
        email: 'test@empresa.com',
        fullName: 'Ana Pereira',
        phone: '+59521123456',
      },
    });
    renderStep(draft);

    // The Radix SelectTrigger (combobox) displays the selected value text
    const dialTrigger = screen.getByRole('combobox', { name: /código.*país/i });
    const localInput = screen.getByLabelText(/número local/i);

    expect(dialTrigger).toHaveTextContent('PY +595');
    expect((localInput as HTMLInputElement).value).toBe('21123456');
  });

  // T18: Falls back to +595 for unrecognized dial code
  it('falls back to +595 for unrecognized dial code', () => {
    const draft = makeDraft({
      representative: {
        email: 'test@empresa.com',
        fullName: 'Ana Pereira',
        phone: '+99999999999',
      },
    });
    renderStep(draft);

    const dialTrigger = screen.getByRole('combobox', { name: /código.*país/i });
    expect(dialTrigger).toHaveTextContent('PY +595');
  });

  // T19: Shows phone error on blur with too-short local number
  it('shows phone error on blur with too-short local number', async () => {
    renderStep(makeDraft());

    const localInput = screen.getByLabelText(/número local/i);
    fireEvent.change(localInput, { target: { value: '123' } });
    fireEvent.blur(localInput);

    await waitFor(() => {
      expect(screen.getByText(/teléfono inválido/i)).toBeInTheDocument();
    });
    expect(localInput).toHaveAttribute('aria-invalid', 'true');
  });
});
