import { test, expect } from '@playwright/test';
import { waitForMsw, fillOtp } from './helpers.js';

const SEED_EMAIL = 'test@corehub.com';
const VALID_PASSWORD = 'Password1234!';

test.describe('First login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/first-login');
    await waitForMsw(page);
  });

  test('renders first-login email form', async ({ page }) => {
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /continuar/i })).toBeVisible();
  });

  test('happy path: email → OTP → set password → portal', async ({ page }) => {
    // Step 1: enter email
    await page.getByLabel(/correo electrónico/i).fill(SEED_EMAIL);
    await page.getByRole('button', { name: /continuar/i }).click();

    // OTP form appears (no verification heading in first-login OTP step)
    await expect(page.getByRole('button', { name: /verificar código/i })).toBeVisible({
      timeout: 8_000,
    });

    // Step 2: enter OTP
    await fillOtp(page);

    // Set password form appears
    await expect(page.getByLabel(/nueva contraseña/i)).toBeVisible({ timeout: 8_000 });

    // Step 3: set password
    await page.getByLabel(/nueva contraseña/i).fill(VALID_PASSWORD);
    const confirmInput = page.getByLabel(/confirmar contraseña/i);
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(VALID_PASSWORD);
    }
    await page.getByRole('button', { name: /activar cuenta/i }).click();

    // Redirects to portal
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });
});

test.describe('Invitation accept flow', () => {
  test('renders invitation preview for valid token', async ({ page }) => {
    // SEED happy scenario: unknown token returns valid pending invitation
    await page.goto('/invite/mock-invitation-token-happy');
    await waitForMsw(page);

    // AcceptInvitationForm shows the tenant invitation heading and accept button
    await expect(page.getByRole('button', { name: /aceptar invitación/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows 410 expired UI for expired invitation token', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('msw:scenario', 'invitation-expired');
    });
    await page.goto('/invite/mock-invitation-token-expired');
    await waitForMsw(page);

    await expect(page.getByRole('heading', { name: /expir/i })).toBeVisible({ timeout: 8_000 });
  });
});
