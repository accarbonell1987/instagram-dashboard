import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { DraftState } from '../services/draft.service';

import { Stepper } from './stepper';


function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    id: 'draft-001',
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

describe('Stepper', () => {
  it('renders all 6 step labels', () => {
    render(<Stepper current="plan" draft={makeDraft()} />);
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Representante')).toBeInTheDocument();
    expect(screen.getByText('Verificación')).toBeInTheDocument();
    expect(screen.getByText('Empresa')).toBeInTheDocument();
    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByText('Resumen')).toBeInTheDocument();
  });

  it('current step has aria-current="step"', () => {
    render(<Stepper current="otp" draft={makeDraft()} />);
    const currentItem = screen.getByRole('listitem', { name: /Verificación/i });
    expect(currentItem).toHaveAttribute('aria-current', 'step');
  });

  it('completed steps before current are marked completed', () => {
    const draft = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
    });
    render(<Stepper current="otp" draft={draft} />);
    // Plan and Representative should be completed
    const planItem = screen.getByRole('listitem', { name: /Plan/i });
    expect(planItem).toHaveAttribute('data-status', 'completed');
  });

  it('renders mobile compact indicator', () => {
    render(<Stepper current="company" draft={makeDraft()} />);
    // Mobile compact dot indicator shows "Paso N/6"
    expect(screen.getByText(/Paso 4/i)).toBeInTheDocument();
  });
});
