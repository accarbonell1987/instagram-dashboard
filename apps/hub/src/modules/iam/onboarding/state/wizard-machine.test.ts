import { describe, it, expect } from 'vitest';

import type { DraftState } from '../services/draft.service';

import {
  STEPS,
  nextStep,
  prevStep,
  isStepReachable,
  deriveCurrentStep,
} from './wizard-machine';

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

describe('STEPS', () => {
  it('contains all 7 steps in order', () => {
    expect(STEPS).toEqual([
      'product',
      'plan',
      'representative',
      'otp',
      'company',
      'payment',
      'summary',
    ]);
  });
});

describe('nextStep', () => {
  it('returns next step from plan', () => {
    expect(nextStep('plan')).toBe('representative');
  });

  it('advances through all steps', () => {
    expect(nextStep('representative')).toBe('otp');
    expect(nextStep('otp')).toBe('company');
    expect(nextStep('company')).toBe('payment');
    expect(nextStep('payment')).toBe('summary');
  });

  it('returns null at last step (summary)', () => {
    expect(nextStep('summary')).toBeNull();
  });
});

describe('prevStep', () => {
  it('returns null for the first step (product)', () => {
    expect(prevStep('product')).toBeNull();
  });

  // The machine is honest about the chain; the wizard header is what hides the
  // back button on 'plan', because product selection is entered from outside.
  it('goes back from plan to product', () => {
    expect(prevStep('plan')).toBe('product');
  });

  it('goes back from representative to plan', () => {
    expect(prevStep('representative')).toBe('plan');
  });

  it('goes back through all steps', () => {
    expect(prevStep('otp')).toBe('representative');
    expect(prevStep('company')).toBe('otp');
    expect(prevStep('payment')).toBe('company');
  });

  it('returns null from summary (no going back from summary)', () => {
    expect(prevStep('summary')).toBeNull();
  });
});

describe('isStepReachable', () => {
  it('plan is always reachable', () => {
    expect(isStepReachable('plan', makeDraft())).toBe(true);
  });

  it('representative is reachable only if plan selected', () => {
    const withPlan = makeDraft({ plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false } });
    expect(isStepReachable('representative', withPlan)).toBe(true);
    expect(isStepReachable('representative', makeDraft())).toBe(false);
  });

  it('otp is reachable only if representative set', () => {
    const withRep = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
    });
    expect(isStepReachable('otp', withRep)).toBe(true);
    expect(isStepReachable('otp', makeDraft())).toBe(false);
  });

  it('company is reachable only if otp verified', () => {
    const withOtp = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
      otpVerified: true,
    });
    expect(isStepReachable('company', withOtp)).toBe(true);
    expect(isStepReachable('company', makeDraft())).toBe(false);
  });

  it('payment is reachable only if company set', () => {
    const withCompany = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
      otpVerified: true,
      company: { legalName: 'ACME', ruc: '80012345-1', address: 'Calle 1', city: 'Asunción', country: 'PY' },
    });
    expect(isStepReachable('payment', withCompany)).toBe(true);
    expect(isStepReachable('payment', makeDraft())).toBe(false);
  });

  it('summary is reachable only if payment present', () => {
    const withPayment = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
      otpVerified: true,
      company: { legalName: 'ACME', ruc: '80012345-1', address: 'Calle 1', city: 'Asunción', country: 'PY' },
      payment: { paymentId: 'pay-001', status: 'approved', method: 'bancard', bancardProcessId: null },
    });
    expect(isStepReachable('summary', withPayment)).toBe(true);
    expect(isStepReachable('summary', makeDraft())).toBe(false);
  });
});

describe('deriveCurrentStep', () => {
  it('returns plan when no plan selected', () => {
    expect(deriveCurrentStep(makeDraft())).toBe('plan');
  });

  it('returns representative when plan set but no representative', () => {
    const draft = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
    });
    expect(deriveCurrentStep(draft)).toBe('representative');
  });

  it('returns otp when rep set but otp not verified', () => {
    const draft = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
    });
    expect(deriveCurrentStep(draft)).toBe('otp');
  });

  it('returns company when otp verified but no company', () => {
    const draft = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
      otpVerified: true,
    });
    expect(deriveCurrentStep(draft)).toBe('company');
  });

  it('returns payment when company set but no payment', () => {
    const draft = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
      otpVerified: true,
      company: { legalName: 'ACME', ruc: '80012345-1', address: 'Calle 1', city: 'Asunción', country: 'PY' },
    });
    expect(deriveCurrentStep(draft)).toBe('payment');
  });

  it('returns summary when payment approved', () => {
    const draft = makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
      otpVerified: true,
      company: { legalName: 'ACME', ruc: '80012345-1', address: 'Calle 1', city: 'Asunción', country: 'PY' },
      payment: { paymentId: 'pay-001', status: 'approved', method: 'bancard', bancardProcessId: null },
    });
    expect(deriveCurrentStep(draft)).toBe('summary');
  });

  it('uses server currentStep as fallback', () => {
    const draft = makeDraft({ currentStep: 'company' });
    // no plan etc, but currentStep from server says company
    // deriveCurrentStep should trust gating logic, falls back to plan
    expect(deriveCurrentStep(draft)).toBe('plan');
  });

  // ─── Bank-transfer gating (a transfer sits pending/in_review for days —
  // provisioning already happened at summary, so there's nothing to block on) ──

  function makeReadyDraft(payment: NonNullable<DraftState['payment']>): DraftState {
    return makeDraft({
      plan: { id: 'starter', name: 'Básico', price: 150_000, currency: 'PYG', billingCycle: 'monthly', features: [], popular: false },
      representative: { email: 'a@b.com', fullName: 'Ana', phone: '' },
      otpVerified: true,
      company: { legalName: 'ACME', ruc: '80012345-1', address: 'Calle 1', city: 'Asunción', country: 'PY' },
      payment,
    });
  }

  it('regression: returns payment when a Bancard payment is pending (must still block)', () => {
    const draft = makeReadyDraft({
      paymentId: 'pay-001',
      status: 'pending',
      method: 'bancard',
      bancardProcessId: 'proc-001',
    });
    expect(deriveCurrentStep(draft)).toBe('payment');
  });

  it('returns summary when a bank-transfer payment is pending', () => {
    const draft = makeReadyDraft({
      paymentId: 'pay-001',
      status: 'pending',
      method: 'bank_transfer',
      bancardProcessId: null,
    });
    expect(deriveCurrentStep(draft)).toBe('summary');
  });

  it('returns summary when a bank-transfer payment is in_review', () => {
    const draft = makeReadyDraft({
      paymentId: 'pay-001',
      status: 'in_review',
      method: 'bank_transfer',
      bancardProcessId: null,
    });
    expect(deriveCurrentStep(draft)).toBe('summary');
  });

  it('returns payment when a bank-transfer payment is declined (still blocks for retry)', () => {
    const draft = makeReadyDraft({
      paymentId: 'pay-001',
      status: 'declined',
      method: 'bank_transfer',
      bancardProcessId: null,
    });
    expect(deriveCurrentStep(draft)).toBe('payment');
  });
});
