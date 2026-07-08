import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import PortalLayout from '../layout';

import { setSessionState } from '@/modules/iam/identity/session/store';


const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Mock Header and Footer so they don't need full auth context
vi.mock('@/components/header.js', () => ({
  Header: () => <header data-testid="portal-header">Header</header>,
}));
vi.mock('@/components/footer.js', () => ({
  Footer: () => <footer data-testid="portal-footer">Footer</footer>,
}));

beforeEach(() => {
  pushMock.mockReset();
});

afterEach(() => {
  cleanup();
  act(() => {
    setSessionState({ status: 'unauthenticated', session: null });
  });
});

describe('PortalLayout — auth gate', () => {
  it('redirects to /login when unauthenticated', () => {
    act(() => {
      setSessionState({ status: 'unauthenticated', session: null });
    });

    render(
      <PortalLayout>
        <div data-testid="portal-content">Contenido protegido</div>
      </PortalLayout>
    );

    expect(pushMock).toHaveBeenCalledWith('/login');
    expect(screen.queryByTestId('portal-content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    act(() => {
      setSessionState({
        status: 'authenticated',
        session: {
          user: { id: 'u1', email: 'admin@empresa.com', fullName: 'Admin' },
          tenant: { id: 't1', slug: 'empresa' },
          role: 'TenantAdmin',
          accessToken: 'fake-token',
          expiresAt: Date.now() + 900_000,
        },
      });
    });

    render(
      <PortalLayout>
        <div data-testid="portal-content">Contenido protegido</div>
      </PortalLayout>
    );

    expect(screen.getByTestId('portal-content')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
