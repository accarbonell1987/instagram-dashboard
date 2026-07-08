import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line import-x/order
import { MswDevWidget } from './dev-widget';

// Mock the scenario module
vi.mock('./scenarios/index.js', () => ({
  SCENARIOS: [
    { id: 'happy', label: 'Happy path', description: 'Todo funciona.' },
    { id: 'otp-failure', label: 'OTP inválido', description: 'OTP falla.' },
  ],
  getActiveScenario: vi.fn(() => 'happy'),
  setActiveScenario: vi.fn(),
  resetScenario: vi.fn(),
}));

vi.mock('./seed.js', () => ({
  applyScenario: vi.fn(),
  seedDb: vi.fn(),
  SEED: {},
}));

import { setActiveScenario } from './scenarios/index';
import { applyScenario } from './seed';

describe('MswDevWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when NEXT_PUBLIC_API_MOCKING is not enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'disabled');
    const { container } = render(<MswDevWidget />);
    expect(container.firstChild).toBeNull();
    vi.unstubAllEnvs();
  });

  it('renders the toggle button when NEXT_PUBLIC_API_MOCKING is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    render(<MswDevWidget />);
    expect(screen.getByTestId('msw-toggle-button')).toBeDefined();
    vi.unstubAllEnvs();
  });

  it('opens the scenario panel when button is clicked', () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    render(<MswDevWidget />);
    const button = screen.getByTestId('msw-toggle-button');
    fireEvent.click(button);
    expect(screen.getByTestId('msw-scenario-list')).toBeDefined();
    vi.unstubAllEnvs();
  });

  it('calls setActiveScenario and applyScenario when scenario is selected', () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    render(<MswDevWidget />);
    // Open panel
    fireEvent.click(screen.getByTestId('msw-toggle-button'));
    // Click otp-failure option
    fireEvent.click(screen.getByTestId('msw-scenario-option-otp-failure'));
    expect(setActiveScenario).toHaveBeenCalledWith('otp-failure');
    expect(applyScenario).toHaveBeenCalledWith('otp-failure');
    vi.unstubAllEnvs();
  });
});
