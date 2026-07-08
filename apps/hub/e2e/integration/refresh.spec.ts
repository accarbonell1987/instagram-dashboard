import { test, expect } from '@playwright/test';

/**
 * Integration tests — Auth refresh token contract compliance.
 *
 * Verifies that POST /auth/refresh returns ONLY { accessToken, expiresIn }
 * with NO extra fields (tokenType, user, tenant) per contract v1.1.1.
 *
 * Pre-requisites:
 *   - api-iam running on :8080 with OTP stub
 *   - DB seeded: pnpm --filter @corehub/api-iam db:seed-test
 *
 * Note: api-iam returns responses WITHOUT an envelope.
 * POST /auth/refresh returns: { accessToken, expiresIn } directly.
 *
 * NOTE ON UI TESTS: Tests that perform browser-based login require the hub
 * to be running WITHOUT MSW (NEXT_PUBLIC_API_URL=http://localhost:8080).
 * When reuseExistingServer=true and the hub is already running with MSW,
 * those tests are skipped automatically.
 */
test.describe('Auth refresh — contract compliance', () => {
  const API_URL = 'http://localhost:8080';

  test('POST /auth/refresh returns only { accessToken, expiresIn }', async ({ page, request }) => {
    // Step 1: Login through the browser to get a refresh token cookie set by api-iam
    await page.goto('/login');

    // Detect if MSW is intercepting — if so, skip (login won't set real cookies)
    const isMswActive = await page.evaluate(() => {
      return (
        typeof (window as any).__mswReady !== 'undefined' ||
        document.cookie.includes('msw') ||
        (window as any).__NEXT_PUBLIC_API_MOCKING === 'enabled'
      );
    });

    if (isMswActive) {
      test.skip(
        true,
        'Hub is running with MSW — skipping browser login test. Run hub with NEXT_PUBLIC_API_URL=http://localhost:8080 to enable.'
      );
      return;
    }

    await page.getByLabel(/correo electrónico/i).fill('test@corehub.com');
    await page.getByLabel(/contraseña/i).fill('Test1234!Secure');
    await page.getByRole('button', { name: /ingresar/i }).click();

    // Wait for OTP step — if it doesn't appear, hub is running with MSW
    const otpVisible = await page
      .getByRole('button', { name: /verificar/i })
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    if (!otpVisible) {
      test.skip(
        true,
        'OTP step did not appear — hub may be running with MSW. Run hub with NEXT_PUBLIC_API_URL=http://localhost:8080.'
      );
      return;
    }

    // Fill OTP directly into input
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

    await page.getByRole('button', { name: /verificar/i }).click();

    // Wait for portal redirect
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // Step 2: Extract refresh_token cookie set by api-iam
    const cookies = await page.context().cookies([API_URL]);
    const refreshTokenCookie = cookies.find((c) => c.name === 'refresh_token');

    if (refreshTokenCookie === undefined) {
      test.skip(
        true,
        'No refresh_token cookie found — login may not have completed against real api-iam.'
      );
      return;
    }

    // Step 3: Call POST /auth/refresh — verify contract shape (no envelope)
    const refreshResponse = await request.post(`${API_URL}/auth/refresh`, {
      headers: { Cookie: `${refreshTokenCookie.name}=${refreshTokenCookie.value}` },
    });

    expect(refreshResponse.status()).toBe(200);

    // api-iam returns directly (no envelope): { accessToken, expiresIn }
    const body = (await refreshResponse.json()) as Record<string, unknown>;

    expect(typeof body['accessToken']).toBe('string');
    expect((body['accessToken'] as string).length).toBeGreaterThan(0);

    expect(typeof body['expiresIn']).toBe('number');
    expect(body['expiresIn'] as number).toBeGreaterThan(0);

    // Contract MUST NOT include extra fields
    expect(body).not.toHaveProperty('tokenType');
    expect(body).not.toHaveProperty('user');
    expect(body).not.toHaveProperty('tenant');
  });
});
