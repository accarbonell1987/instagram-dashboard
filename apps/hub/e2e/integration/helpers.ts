import { expect, type Page } from '@playwright/test';

// ─── Server health helpers ─────────────────────────────────────────────────────

/**
 * Polls GET http://localhost:8080/healthz until it returns 200 or timeout expires.
 * Playwright's webServer config already does this automatically, but this helper
 * is useful for explicit waits inside a test or global setup.
 */
export async function waitForApiIam(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://localhost:8080/healthz');
      if (res.ok) return;
    } catch {
      /* server not ready yet — keep polling */
    }
    await new Promise<void>((r) => setTimeout(r, 1_000));
  }
  throw new Error('api-iam did not become healthy within timeout');
}

/**
 * Polls GET http://localhost:3001 until it returns a non-5xx response or timeout expires.
 */
export async function waitForHub(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://localhost:3001');
      if (res.status < 500) return;
    } catch {
      /* server not ready yet — keep polling */
    }
    await new Promise<void>((r) => setTimeout(r, 1_000));
  }
  throw new Error('hub did not become healthy within timeout');
}

// ─── Auth helpers ──────────────────────────────────────────────────────────────

export const TEST_USER_EMAIL = 'test@corehub.com';
export const TEST_USER_PASSWORD = 'Test1234!Secure';
export const TEST_OTP = '000000';

/**
 * Fills the OTP input using the native setter trick.
 * Mirrors the pattern from apps/hub/e2e/helpers.ts for compatibility.
 */
export async function fillOtp(page: Page, code: string = TEST_OTP): Promise<void> {
  await page.waitForSelector('input[data-input-otp]', { state: 'attached', timeout: 10_000 });

  await page.evaluate((otpCode) => {
    const input = document.querySelector<HTMLInputElement>('input[data-input-otp]');
    if (input === null) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter === undefined) return;
    nativeSetter.call(input, otpCode);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, code);

  const verifyButton = page.getByRole('button', { name: /verificar código/i });
  await verifyButton.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(verifyButton).toBeEnabled({ timeout: 5_000 });
  await verifyButton.click();
}

/**
 * Logs in with test credentials and enters the OTP.
 * Returns true if login succeeded (redirected to portal), false if hub has MSW active.
 *
 * NOTE: api-iam must be running with an OTP stub that accepts '000000'.
 * In development/test the stub returns code '000000' by default.
 */
export async function loginAsTestUser(page: Page): Promise<boolean> {
  await page.goto('/login');

  await page.getByLabel(/correo electrónico/i).fill(TEST_USER_EMAIL);
  await page.getByLabel(/contraseña/i).fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: /ingresar/i }).click();

  // Wait for OTP step — if it doesn't appear, hub may be in MSW mode
  const otpVisible = await page
    .getByRole('button', { name: /verificar/i })
    .isVisible({ timeout: 15_000 })
    .catch(() => false);

  if (!otpVisible) return false;

  await fillOtp(page);

  // Wait for portal redirect
  const redirected = await page
    .waitForURL('/', { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  return redirected;
}
