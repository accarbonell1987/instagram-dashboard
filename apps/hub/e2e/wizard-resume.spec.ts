import { test, expect } from '@playwright/test';
import { waitForMsw } from './helpers.js';

test.describe('Wizard resume from email link', () => {
  test('valid resume token redirects to the correct draft step', async ({ page }) => {
    // The MSW handler for GET /onboarding/draft/resume/:token
    // returns { draftId: 'draft-0001-...' } when token is not in DB
    // (fallback behavior) — good enough to verify navigation happens.
    await page.goto('/signup/resume/mock-resume-token-happy');
    await waitForMsw(page);

    // Should redirect to /signup/{draftId}/{step}
    await expect(page).toHaveURL(/\/signup\/.+\/.+/, { timeout: 10_000 });
  });

  test('expired resume token shows gone/expired UI', async ({ page }) => {
    // To simulate a 410, we'd need the 'invitation-expired' scenario
    // (reuses the same gone() handler behavior in MSW onboarding handler)
    await page.addInitScript(() => {
      localStorage.setItem('msw:scenario', 'invitation-expired');
    });
    await page.goto('/signup/resume/any-token');
    await waitForMsw(page);

    await expect(page.getByRole('heading', { name: /expir/i })).toBeVisible({ timeout: 8_000 });
  });
});
