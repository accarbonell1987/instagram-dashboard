import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DraftProvider } from '../../context/draft-context';
import type { DraftState } from '../../services/draft.service';
import * as draftService from '../../services/draft.service';

import { StepPlanSelection } from './plan-selection-step';

import { applyScenario } from '@/lib/mocks/seed';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    id: 'draft-test-001',
    currentStep: 'plan',
    status: 'draft',
    plan: null,
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
        <StepPlanSelection draftId={draft.id} />
      </DraftProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  applyScenario('happy');
  mockPush.mockClear();
  vi.spyOn(draftService, 'patchDraft').mockResolvedValue({
    id: 'draft-test-001',
    currentStep: 'representative',
    status: 'draft',
    plan: {
      id: 'starter',
      name: 'Básico',
      price: 150_000,
      currency: 'PYG',
      billingCycle: 'monthly',
      features: [],
      popular: false,
    },
    representative: null,
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

describe('StepPlanSelection', () => {
  it('renders 3 plan cards after loading', async () => {
    renderStep(makeDraft());
    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(3);
    });
  });

  it('clicking a card selects it and shows Continuar, second click saves', async () => {
    renderStep(makeDraft());
    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(1);
    });

    const firstCard = screen.getAllByRole('article')[0];
    if (!firstCard) throw new Error('expected at least one card');
    fireEvent.click(firstCard);

    expect(mockPush).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/representative'));
    });
  });

  it('clicking directly on a card article also selects it', async () => {
    renderStep(makeDraft());
    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(1);
    });

    // Click the card article itself (not the button)
    const firstCard = screen.getAllByRole('article')[0];
    if (!firstCard) throw new Error('expected at least one card');
    fireEvent.click(firstCard);

    // Should select it and show "Continuar" — no navigation yet
    expect(mockPush).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
    });
  });
});
