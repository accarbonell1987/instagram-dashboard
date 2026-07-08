import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';


import { AuthProvider, useAuth } from './auth-context';

import { setSessionState, getSessionState } from '@/modules/iam/identity/session/store';
import { clearAccessToken } from '@/modules/iam/identity/session/token';

// ─── Mock dependencies ──────────────────────────────────

vi.mock('@/modules/iam/identity/session/refresh', () => ({
  refreshSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/iam/identity/session/broadcast', () => ({
  startSessionBroadcast: vi.fn().mockReturnValue(() => undefined),
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ────────────────────────────────────────────

function renderWithProvider(ui: ReactNode) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

function ConsumerComponent() {
  const { session } = useAuth();
  return (
    <div>
      <div data-testid="status">{session.status}</div>
    </div>
  );
}

beforeEach(() => {
  clearAccessToken();
  act(() => {
    setSessionState({ status: 'unauthenticated', session: null });
  });
});

afterEach(() => {
  vi.clearAllMocks();
  act(() => {
    setSessionState({ status: 'unauthenticated', session: null });
  });
});

// ─── Tests ──────────────────────────────────────────────

describe('useAuth outside provider', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress React error output during this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => {
      render(
        <div>
          <ConsumerComponent />
        </div>
      );
    }).toThrow('useAuth must be used inside AuthProvider');

    consoleSpy.mockRestore();
  });
});

describe('AuthProvider', () => {
  it('initial session state reflects getSessionState()', () => {
    renderWithProvider(<ConsumerComponent />);
    expect(screen.getByTestId('status').textContent).toBe('refreshing');
  });

  it('provides subscribeToToken function', () => {
    let capturedSubscribe: unknown;
    function CaptureComponent() {
      const { subscribeToToken: subscribe } = useAuth();
      capturedSubscribe = subscribe;
      return null;
    }
    renderWithProvider(<CaptureComponent />);
    expect(typeof capturedSubscribe).toBe('function');
  });
});

describe('signOut', () => {
  it('clears session state to unauthenticated', async () => {
    act(() => {
      setSessionState({
        status: 'authenticated',
        session: {
          user: { id: 'u1', email: 'a@a.com', fullName: 'Alice' },
          tenant: { id: 't1', slug: 'acme' },
          role: 'User',
          accessToken: 'tok',
          expiresAt: Date.now() + 60_000,
        },
      });
    });

    function SignOutButton() {
      const { signOut } = useAuth();
      return <button onClick={() => void signOut()}>Sign out</button>;
    }

    const { getByText } = renderWithProvider(<SignOutButton />);

    await act(async () => {
      getByText('Sign out').click();
      await Promise.resolve();
    });

    expect(getSessionState().status).toBe('unauthenticated');
  });
});
