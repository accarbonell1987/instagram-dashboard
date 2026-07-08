import { render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { setSessionState } from '../session/store';

import { RequireRole } from './require-role';

function makeSession(role: string) {
  return {
    status: 'authenticated' as const,
    session: {
      user: { id: 'u1', email: 'a@a.com', fullName: 'Alice' },
      tenant: { id: 't1', slug: 'acme' },
      role,
      accessToken: 'tok',
      expiresAt: Date.now() + 60_000,
    },
  };
}

afterEach(() => {
  act(() => {
    setSessionState({ status: 'unauthenticated', session: null });
  });
});

describe('RequireRole', () => {
  it('renders children when role matches (string)', () => {
    act(() => { setSessionState(makeSession('TenantAdmin')); });

    render(
      <RequireRole role="TenantAdmin">
        <div data-testid="protected">Content</div>
      </RequireRole>
    );

    expect(screen.getByTestId('protected')).toBeDefined();
  });

  it('renders fallback when role does not match', () => {
    act(() => { setSessionState(makeSession('User')); });

    render(
      <RequireRole role="SuperAdmin" fallback={<div data-testid="denied">Denied</div>}>
        <div>Content</div>
      </RequireRole>
    );

    expect(screen.getByTestId('denied')).toBeDefined();
    expect(screen.queryByText('Content')).toBeNull();
  });

  it('renders children when role is in allowed array', () => {
    act(() => { setSessionState(makeSession('TenantAdmin')); });

    render(
      <RequireRole role={['SuperAdmin', 'TenantAdmin']}>
        <div data-testid="protected">Content</div>
      </RequireRole>
    );

    expect(screen.getByTestId('protected')).toBeDefined();
  });

  it('renders fallback when role is not in allowed array', () => {
    act(() => { setSessionState(makeSession('User')); });

    render(
      <RequireRole
        role={['SuperAdmin', 'TenantAdmin']}
        fallback={<div data-testid="denied">Denied</div>}
      >
        <div>Content</div>
      </RequireRole>
    );

    expect(screen.getByTestId('denied')).toBeDefined();
  });

  it('renders fallback when unauthenticated (no session)', () => {
    // unauthenticated state — session is null
    render(
      <RequireRole role="User" fallback={<div data-testid="denied">Denied</div>}>
        <div>Content</div>
      </RequireRole>
    );

    expect(screen.getByTestId('denied')).toBeDefined();
  });
});
