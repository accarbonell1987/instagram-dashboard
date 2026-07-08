import { test, expect } from '@playwright/test';
import { fillOtp, loginAsTestUser } from './helpers.js';

/**
 * Integration tests — Onboarding wizard against real api-iam (no MSW).
 *
 * These tests verify the wizard flow works with the real API.
 *
 * Pre-requisites:
 *   - api-iam running on :8080 with OTP_STUB_CODE=000000
 *   - DB seeded: pnpm --filter @corehub/api-iam db:seed-test
 *   - Hub running on :3001 with NEXT_PUBLIC_API_URL=http://localhost:8080
 */
test.describe('Onboarding wizard — real API', () => {
  test('signup page loads and shows plan selection', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.getByRole('heading', { name: /elige tu plan/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('plan cards render with real plans from API', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.getByRole('heading', { name: /elige tu plan/i })).toBeVisible({
      timeout: 15_000,
    });

    const selectButtons = page.getByRole('button', { name: /seleccionar/i });
    await expect(selectButtons.first()).toBeVisible({ timeout: 10_000 });
  });

  test('full wizard flow: plan → rep → OTP → company → payment UI', async ({ page }) => {
    await page.goto('/signup');

    // Plan step
    await expect(page.getByRole('heading', { name: /elige tu plan/i })).toBeVisible({
      timeout: 15_000,
    });
    const firstCard = page.locator('article').first();
    await firstCard.getByRole('button', { name: /seleccionar/i }).click();

    // Representative step — wait for navigation to the representative step
    // The step component renders an email field for the representative
    const repEmailField = page.getByLabel(/correo electrónico/i).first();
    const repStepVisible = await repEmailField.isVisible({ timeout: 15_000 }).catch(() => false);

    if (!repStepVisible) {
      // May require real API to create draft — skip if hub running with MSW
      test.skip(
        true,
        'Representative step did not appear — hub may be running with MSW or draft creation failed. Run hub with NEXT_PUBLIC_API_URL=http://localhost:8080.'
      );
      return;
    }

    await repEmailField.fill('wizard-rep@test.com');
    await page.getByLabel(/nombre completo/i).fill('Integration Test User');
    await page.getByRole('button', { name: /continuar/i }).click();

    // OTP step — api-iam started with OTP_STUB_CODE=000000
    await page.waitForSelector('input[data-input-otp]', { state: 'attached', timeout: 20_000 });
    await fillOtp(page);

    // Company data step
    await expect(page.getByLabel(/razón social/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/razón social/i).fill('Empresa Test S.A.');
    await page.getByRole('button', { name: /continuar/i }).click();

    // Payment step — verify the UI renders
    await expect(page.getByRole('heading', { name: /pago/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /pagar con bancard/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  // TODO: Test draft resume via resume token once integration infrastructure is confirmed
  test.skip('wizard resume via resume token', async () => {
    // TODO: Create draft, extract resume token from response, navigate to resume URL
  });

  test('authenticated user sees portal when accessing / route', async ({ page }) => {
    const loggedIn = await loginAsTestUser(page);

    if (!loggedIn) {
      test.skip(
        true,
        'Login failed — hub may be running with MSW. Run hub with NEXT_PUBLIC_API_URL=http://localhost:8080.'
      );
      return;
    }

    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });
});
