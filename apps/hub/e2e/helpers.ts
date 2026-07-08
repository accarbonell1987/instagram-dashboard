import { expect, type Page } from '@playwright/test';

export const MOCK_OTP = '000000';

/**
 * Waits for MSW browser worker to finish bootstrapping.
 * providers.tsx sets data-msw-ready on body once the worker is started.
 */
export async function waitForMsw(page: Page): Promise<void> {
  await page.waitForSelector('body[data-msw-ready]', { timeout: 20_000 });
}

/**
 * Sets an MSW scenario via localStorage before navigating to a URL.
 * The providers.tsx reads the scenario on mount via getActiveScenario().
 */
export async function setScenario(page: Page, scenario: string): Promise<void> {
  await page.addInitScript((s) => {
    localStorage.setItem('msw:scenario', s);
  }, scenario);
}

/**
 * Clears MSW scenario and all draft/payment localStorage keys.
 */
export async function clearMswState(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('msw:') || key.startsWith('draft:') || key.startsWith('idem:')) {
        localStorage.removeItem(key);
      }
    }
  });
}

/**
 * Fills the OTP input and submits it by clicking the verify button.
 * input-otp v1.4 renders the native <input> with opacity:0 !important, so normal
 * Playwright fill/type fail. We use the nativeInputValueSetter trick (bypasses React's
 * intercepted setter) + input event to trigger input-otp's onChange → setCode().
 * We then wait for the button to become enabled (React state flush) before clicking.
 */
export async function fillOtp(page: Page, code: string = MOCK_OTP): Promise<void> {
  await page.waitForSelector('input[data-input-otp]', { state: 'attached', timeout: 5_000 });

  await page.evaluate((otpCode) => {
    const input = document.querySelector<HTMLInputElement>('input[data-input-otp]');
    if (!input) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!nativeSetter) return;
    nativeSetter.call(input, otpCode);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, code);

  const verifyButton = page.getByRole('button', { name: /verificar código/i });
  await verifyButton.waitFor({ state: 'visible', timeout: 3_000 });
  await expect(verifyButton).toBeEnabled({ timeout: 3_000 });
  await verifyButton.click();
}
