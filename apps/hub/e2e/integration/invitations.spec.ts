import { test, expect } from '@playwright/test';

/**
 * Integration tests — Invitations API contract compliance.
 *
 * Verifies that GET /invitations/:token returns contract-compliant data:
 *   - `tenantName` is present
 *   - `email` is present
 *
 * Pre-requisites:
 *   - api-iam running on :8080
 *   - DB seeded: pnpm --filter @corehub/api-iam db:seed-test
 *     (creates invitation with token 'test-invite-token' for 'invited@corehub.com')
 *
 * Note: api-iam returns responses WITHOUT an envelope ({ success, data }).
 * GET /invitations/:token returns InvitationPreview directly.
 */
test.describe('Invitations API — contract compliance', () => {
  const API_URL = 'http://localhost:8080';
  const TEST_INVITE_TOKEN = 'test-invite-token';
  const TEST_INVITED_EMAIL = 'invited@corehub.com';

  test('GET /invitations/:token returns invitation preview with tenantName and email', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/invitations/${TEST_INVITE_TOKEN}`);

    // Expect 200 for a valid pending invitation
    expect(response.status()).toBe(200);

    // api-iam returns InvitationPreview directly (no envelope)
    const data = (await response.json()) as Record<string, unknown>;

    // Contract requires: tenantName, email
    expect(typeof data['tenantName']).toBe('string');
    expect((data['tenantName'] as string).length).toBeGreaterThan(0);

    expect(typeof data['email']).toBe('string');
    expect(data['email']).toBe(TEST_INVITED_EMAIL);
  });

  test('GET /invitations/:token with unknown token returns 404', async ({ request }) => {
    const response = await request.get(`${API_URL}/invitations/non-existent-token-xyz`);
    expect(response.status()).toBe(404);
  });
});
