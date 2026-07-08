import { render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setSessionState } from '../session/store';

import { RequireAuth } from './require-auth';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

afterEach(() => {
  mockPush.mockReset();
  act(() => {
    setSessionState({ status: 'unauthenticated', session: null });
  });
});

const session = {
  user: { id: 'u1', email: 'a@a.com', fullName: 'Alice' },
  tenant: { id: 't1', slug: 'acme' },
  role: 'User',
  accessToken: 'tok',
  expiresAt: Date.now() + 60_000,
};

describe('RequireAuth', () => {
  it('renders children when authenticated', () => {
    act(() => {
      setSessionState({ status: 'authenticated', session });
    });

    render(
      <RequireAuth>
        <div data-testid="content">Protected</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('content')).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('calls router.push("/login") when unauthenticated', () => {
    act(() => {
      setSessionState({ status: 'unauthenticated', session: null });
    });

    render(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>
    );

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('renders fallback when refreshing', () => {
    act(() => {
      setSessionState({ status: 'refreshing', session: null });
    });

    render(
      <RequireAuth fallback={<div data-testid="loading">Loading...</div>}>
        <div>Protected</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('loading')).toBeDefined();
    expect(screen.queryByText('Protected')).toBeNull();
  });
});
