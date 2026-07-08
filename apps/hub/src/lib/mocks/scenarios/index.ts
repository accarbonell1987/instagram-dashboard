/**
 * Scenario manager.
 * - URL ?msw=<scenario> overrides + persists to localStorage
 * - Otherwise reads localStorage
 * - Otherwise defaults to 'happy'
 *
 * In Node (Vitest/Playwright), localStorage/window are unavailable.
 * The active scenario is tracked in a module-level variable that
 * `applyScenario()` (in seed.ts) updates directly.
 */

export type Scenario =
  | 'happy'
  | 'otp-failure'
  | 'payment-cancelled'
  | 'payment-timeout'
  | 'session-expired'
  | 'invitation-expired'
  | 'invitation-used'
  | 'device-trusted'
  | 'billing-empty';

export interface ScenarioMeta {
  id: Scenario;
  label: string;
  description: string;
}

export const SCENARIOS: readonly ScenarioMeta[] = [
  {
    id: 'happy',
    label: 'Happy path',
    description: 'Todo funciona correctamente. Login, OTP, onboarding y pago exitosos.',
  },
  {
    id: 'otp-failure',
    label: 'OTP inválido',
    description: 'El código OTP siempre es rechazado con 422.',
  },
  {
    id: 'payment-cancelled',
    label: 'Pago cancelado',
    description: 'El pago Bancard devuelve estado "declined".',
  },
  {
    id: 'payment-timeout',
    label: 'Pago timeout',
    description: 'El pago queda pendiente indefinidamente.',
  },
  {
    id: 'session-expired',
    label: 'Sesión expirada',
    description: 'El refresh token devuelve 401. Usuario debe volver a loguearse.',
  },
  {
    id: 'invitation-expired',
    label: 'Invitación expirada',
    description: 'El token de invitación devuelve 410.',
  },
  {
    id: 'invitation-used',
    label: 'Invitación ya usada',
    description: 'El token de invitación devuelve 409 (ya fue aceptada).',
  },
  {
    id: 'device-trusted',
    label: 'Dispositivo confiable',
    description: 'El login retorna otpRequired=false (bypass OTP por device trust).',
  },
  {
    id: 'billing-empty',
    label: 'Billing vacío',
    description: 'Sin método de pago ni facturas.',
  },
];

const STORAGE_KEY = 'msw:scenario';

// Module-level active scenario — works in both browser AND Node (Vitest)
let activeScenarioState: Scenario = 'happy';

function isValidScenario(value: string): value is Scenario {
  return SCENARIOS.some((s) => s.id === value);
}

function isNode(): boolean {
  return typeof window === 'undefined';
}

function readUrlParam(): Scenario | null {
  if (isNode()) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('msw');
    if (value !== null && isValidScenario(value)) return value;
  } catch {
    // SSR or invalid URL
  }
  return null;
}

function readStorage(): Scenario | null {
  if (isNode()) return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value !== null && isValidScenario(value)) return value;
  } catch {
    // Private browsing / blocked storage
  }
  return null;
}

export function getActiveScenario(): Scenario {
  // In Node, use the module-level state (set by applyScenario/setActiveScenario)
  if (isNode()) return activeScenarioState;

  const fromUrl = readUrlParam();
  if (fromUrl !== null) {
    setActiveScenario(fromUrl);
    return fromUrl;
  }
  return readStorage() ?? activeScenarioState;
}

export function setActiveScenario(scenario: Scenario): void {
  activeScenarioState = scenario;
  if (!isNode()) {
    try {
      localStorage.setItem(STORAGE_KEY, scenario);
    } catch {
      // ignore
    }
  }
}

export function resetScenario(): void {
  activeScenarioState = 'happy';
  if (!isNode()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
