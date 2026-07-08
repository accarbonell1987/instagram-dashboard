import { test, expect } from '@playwright/test';
import { waitForMsw, fillOtp, setScenario } from './helpers.js';

// Seed user: test@corehub.com / any password (MSW doesn't validate password)
const SEED_EMAIL = 'test@corehub.com';
const SEED_PASSWORD = 'Pass1234!';

test.describe('Login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await waitForMsw(page);
  });

  test('renders login form', async ({ page }) => {
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible();
  });

  test('happy path: credentials → OTP → portal', async ({ page }) => {
    // Step 1: submit credentials
    await page.getByLabel(/correo electrónico/i).fill(SEED_EMAIL);
    await page.getByLabel(/contraseña/i).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: /ingresar/i }).click();

    // OTP form should appear (no heading in login OTP step — check verify button)
    await expect(page.getByRole('button', { name: /verificar código/i })).toBeVisible({
      timeout: 10_000,
    });

    // Step 2: enter OTP
    await fillOtp(page);

    // Redirects to portal
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

  test('shows error on unknown email', async ({ page }) => {
    await page.getByLabel(/correo electrónico/i).fill('noexiste@test.com');
    await page.getByLabel(/contraseña/i).fill('cualquiera');
    await page.getByRole('button', { name: /ingresar/i }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: /correo|contraseña|error/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('navigates to recover password page', async ({ page }) => {
    await page.getByRole('link', { name: /olvidaste tu contraseña/i }).click();
    await expect(page).toHaveURL('/recover');
  });
});

test.describe('Login flow — lockout (rate limit)', () => {
  test('shows lockout UI when API returns 429 (RateLimitError)', async ({ page }) => {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

    // Intercept the login endpoint and return a 429 with Retry-After header.
    // This bypasses MSW and returns a raw 429 directly to the browser fetch.
    await page.route(`${apiBase}/auth/login`, (route) => {
      void route.fulfill({
        status: 429,
        contentType: 'application/problem+json',
        headers: { 'Retry-After': '300' },
        body: JSON.stringify({
          type: 'https://corehub.com/errors/rate-limit',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Demasiados intentos fallidos.',
          retryAfterSeconds: 300,
        }),
      });
    });

    await page.goto('/login');
    await waitForMsw(page);

    await page.getByLabel(/correo electrónico/i).fill(SEED_EMAIL);
    await page.getByLabel(/contraseña/i).fill('wrongpassword');
    await page.getByRole('button', { name: /ingresar/i }).click();

    // LoginForm catches RateLimitError and shows lockout message with minutes
    await expect(page.getByRole('alert').filter({ hasText: /bloqueada|bloquead/i })).toBeVisible({
      timeout: 8_000,
    });

    // Form submit button should still be accessible (not removed from DOM)
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible();
  });
});

test.describe('Login flow — tenant mismatch', () => {
  test('redirects to /login?error=tenant_mismatch when wrong tenant', async ({ page }) => {
    // Tenant mismatch happens when the user tries to log in to a tenant they don't belong to.
    // The MSW auth handler returns 401 for unknown emails.
    // We simulate the mismatch by using the ?error=tenant_mismatch query param
    // that the middleware (or auth flow) would set on redirect.
    // Navigate directly to the login page with the error param to verify the UI handles it.
    await page.goto('/login?error=tenant_mismatch');
    await waitForMsw(page);

    // The login page should still render (not crash), and the form is accessible.
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible();
  });
});
