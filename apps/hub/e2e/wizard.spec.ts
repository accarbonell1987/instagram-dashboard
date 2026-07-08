import { test, expect } from '@playwright/test';
import { waitForMsw, fillOtp } from './helpers.js';

test.describe('Onboarding wizard — happy path', () => {
  test('full flow: plan → rep → OTP → company → payment → summary', async ({ page }) => {
    // ── Entry: /signup creates a draft and redirects to first step ──
    await page.goto('/signup');
    await waitForMsw(page);

    // Plan selection step — clicking "Seleccionar" on a card patches the draft and navigates
    await expect(page.getByRole('heading', { name: /elige tu plan/i })).toBeVisible({
      timeout: 10_000,
    });

    // Click "Seleccionar" inside the Profesional plan card
    const professionalCard = page.locator('article').filter({ hasText: 'Profesional' });
    await professionalCard.getByRole('button', { name: /seleccionar/i }).click();

    // ── Representative step ──
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible({ timeout: 8_000 });
    await page.getByLabel(/correo electrónico/i).fill('rep@empresa.com');
    await page.getByLabel(/nombre completo/i).fill('María González');
    await page.getByLabel(/teléfono/i).fill('+595981234567');
    await page.getByRole('button', { name: /continuar/i }).click();

    // ── OTP step ──
    await expect(page.getByRole('heading', { name: /verificación/i })).toBeVisible({
      timeout: 10_000,
    });
    await fillOtp(page);

    // ── Company data step ──
    await expect(page.getByLabel(/razón social|nombre legal/i)).toBeVisible({
      timeout: 8_000,
    });
    await page.getByLabel(/razón social|nombre legal/i).fill('Empresa Test S.A.');
    await page.getByLabel(/ruc/i).fill('80012345-6');
    await page.getByLabel(/dirección fiscal/i).fill('Av. España 1234');
    await page.getByLabel(/ciudad/i).fill('Asunción');
    await page.getByLabel(/teléfono/i).fill('+595981234567');
    await page.getByLabel(/persona de contacto/i).fill('María González');
    await page.getByLabel(/cargo/i).fill('Gerente');
    await page.getByRole('button', { name: /continuar/i }).click();

    // ── Payment step ──
    await expect(page.getByRole('button', { name: /pagar/i })).toBeVisible({
      timeout: 8_000,
    });
    await page.getByRole('button', { name: /pagar/i }).click();

    // MSW redirects to /signup/{draftId}/payment?status=verifying
    // After 3 polls (2s each) MSW returns 'approved' → redirects to summary
    await expect(page.getByRole('heading', { name: /registro completado/i })).toBeVisible({
      timeout: 30_000,
    });

    // ── Summary step ──
    await expect(page.getByRole('button', { name: /ir a la plataforma/i })).toBeVisible({
      timeout: 8_000,
    });
  });

  test('?plan=professional pre-selects the professional plan', async ({ page }) => {
    await page.goto('/signup?plan=professional');
    await waitForMsw(page);

    // Should skip plan step and go to representative directly
    // MSW: createDraft with planId sets currentStep='representative'
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible({ timeout: 10_000 });
  });
});
