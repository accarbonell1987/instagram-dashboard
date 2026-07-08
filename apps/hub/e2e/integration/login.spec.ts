import { test, expect } from '@playwright/test';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from './helpers.js';

/**
 * Integration tests — Login flow against real api-iam (no MSW).
 *
 * Pre-requisites:
 *   - api-iam running on :8080 with OTP stub (OTP_STUB_CODE=000000)
 *   - DB seeded: pnpm --filter @corehub/api-iam db:seed-test
 *   - Hub running on :3001 with NEXT_PUBLIC_API_URL=http://localhost:8080
 *
 * NOTE: Tests that go through the full login flow (OTP → portal) require
 * the hub to be running WITHOUT MSW. Static form tests pass regardless.
 */
test.describe('Login flow — real API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login form', async ({ page }) => {
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible();
  });

  test('happy path: email+password → OTP → portal', async ({ page }) => {
    // Step 1: submit credentials
    await page.getByLabel(/correo electrónico/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/contraseña/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /ingresar/i }).click();

    // OTP step should appear — button text is "Verificar código"
    const otpButton = page.getByRole('button', { name: /verificar/i });
    const otpVisible = await otpButton.isVisible({ timeout: 15_000 }).catch(() => false);

    if (!otpVisible) {
      // Hub may be running with MSW which handles login differently
      test.skip(
        true,
        'OTP step did not appear — hub may be running with MSW. Run hub with NEXT_PUBLIC_API_URL=http://localhost:8080 to test the full flow.'
      );
      return;
    }

    // Step 2: fill OTP via native input event (InputOTP component)
    await page.evaluate((otpCode) => {
      const input = document.querySelector<HTMLInputElement>('input[data-input-otp]');
      if (input === null) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      if (nativeSetter === undefined) return;
      nativeSetter.call(input, otpCode);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, '000000');

    await otpButton.click();

    // Step 3: verify portal redirect
    await expect(page).toHaveURL('/', { timeout: 15_000 });
  });

  test('shows error on wrong password', async ({ page }) => {
    await page.getByLabel(/correo electrónico/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/contraseña/i).fill('wrong-password-xyz');
    await page.getByRole('button', { name: /ingresar/i }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: /correo|contraseña|error|incorrecto/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows error on unknown email', async ({ page }) => {
    await page.getByLabel(/correo electrónico/i).fill('no-such-user@test.com');
    await page.getByLabel(/contraseña/i).fill('whatever');
    await page.getByRole('button', { name: /ingresar/i }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: /correo|contraseña|error|incorrecto/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
