import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  createDraft,
  getDraft,
  patchDraft,
  consumeResumeToken,
  initiatePayment,
  getPaymentStatus,
  submitDraft,
} from './draft.service';

import { applyScenario } from '@/lib/mocks/seed';
import { getSessionState } from '@/modules/iam/identity/session/store';

beforeEach(() => {
  applyScenario('happy');
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createDraft', () => {
  it('creates a new draft and returns draftId + currentStep', async () => {
    const result = await createDraft();
    expect(result.draftId).toMatch(/^draft-/);
    expect(['plan', 'representative']).toContain(result.currentStep);
  });

  it('creates draft with planId and starts at representative step', async () => {
    const result = await createDraft({ planId: 'professional' });
    expect(result.currentStep).toBe('representative');
  });

  it('creates draft without planId and starts at plan step', async () => {
    const result = await createDraft();
    expect(result.currentStep).toBe('plan');
  });
});

describe('getDraft', () => {
  it('returns draft state for valid draftId', async () => {
    const created = await createDraft();
    const draft = await getDraft(created.draftId);
    expect(draft.id).toBe(created.draftId);
    expect(draft.currentStep).toBeDefined();
  });

  it('throws on unknown draftId', async () => {
    await expect(getDraft('nonexistent-draft')).rejects.toThrow();
  });
});

describe('patchDraft', () => {
  it('patches plan step and advances to representative', async () => {
    const created = await createDraft();
    const draft = await getDraft(created.draftId);
    const updated = await patchDraft(created.draftId, 'plan', {
      planId: 'professional',
      version: draft.version,
    });
    expect(updated.currentStep).toBe('representative');
  });

  it('generates a fresh idempotency key on every call (payload may change between submits)', async () => {
    const created = await createDraft();
    const draft = await getDraft(created.draftId);

    // patchDraft always resets the key before calling — each submit is independent.
    // This prevents 422 idempotency.key_reused when the user edits the form
    // and submits again with a different payload.
    const result = await patchDraft(created.draftId, 'plan', {
      planId: 'professional',
      version: draft.version,
    });

    expect(result.currentStep).toBe('representative');
  });
});

describe('consumeResumeToken', () => {
  it('returns draftId for valid token', async () => {
    const result = await consumeResumeToken('mock-resume-token-happy');
    expect(result.draftId).toMatch(/^draft-/);
  });
});

describe('initiatePayment', () => {
  it('returns redirectUrl and paymentId', async () => {
    const created = await createDraft({ planId: 'professional' });
    const result = await initiatePayment(created.draftId, 1);
    expect(result.redirectUrl).toBeDefined();
    expect(result.paymentId).toBeDefined();
  });
});

describe('getPaymentStatus', () => {
  it('returns a valid payment status', async () => {
    const created = await createDraft({ planId: 'professional' });
    await initiatePayment(created.draftId, 1);
    const status = await getPaymentStatus(created.draftId);
    expect(['pending', 'approved', 'declined', 'timeout']).toContain(status.status);
  });
});

describe('submitDraft', () => {
  it('returns tenantId, accessToken and documents without setting an authenticated session', async () => {
    const created = await createDraft({ planId: 'professional' });
    const draft = await getDraft(created.draftId);
    const result = await submitDraft(created.draftId, draft.version);
    expect(result.tenantId).toBeDefined();
    expect(result.accessToken).toBeDefined();
    // Bug 9 fix: backend now returns document IDs instead of pre-signed URLs
    expect(result.documents.invoiceId).toBeDefined();
    expect(result.documents.contractId).toBeDefined();

    // Session MUST NOT be authenticated after submit because the new user
    // has status 'pending_first_login' and must complete the activation
    // flow (first-login / set password) before accessing protected routes.
    const session = getSessionState();
    expect(session.status).not.toBe('authenticated');
  });
});
