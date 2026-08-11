import { render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { TenantThemeSync } from './tenant-theme-sync';

import { server } from '@/lib/mocks/server';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

const setColorTheme = vi.fn();
vi.mock('@core/shared/providers', () => ({
  useColorTheme: () => ({ colorTheme: 'orange', setColorTheme }),
}));

const sessionStatus = { current: 'authenticated' as string };
vi.mock('@/modules/iam/identity/hooks/use-session', () => ({
  useSession: () => ({ status: sessionStatus.current, session: null }),
}));

function respondWithTheme(colorTheme: string | null): void {
  server.use(
    http.get(`${BASE}/auth/me`, () =>
      HttpResponse.json({
        user: { id: 'u1', email: 'a@b.com', fullName: 'Ana', phone: null, picture: null },
        tenant: {
          id: 't1',
          slug: 'acme',
          name: 'Acme',
          planId: 'starter',
          status: 'active',
          colorTheme,
        },
        role: 'User',
      })
    )
  );
}

describe('TenantThemeSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStatus.current = 'authenticated';
  });

  it("applies the tenant's stored theme", async () => {
    respondWithTheme('violet');
    render(<TenantThemeSync />);

    await waitFor(() => {
      expect(setColorTheme).toHaveBeenCalledWith('violet');
    });
  });

  it('leaves the theme alone when the tenant has not chosen one', async () => {
    respondWithTheme(null);
    render(<TenantThemeSync />);

    // Give the fetch a chance to resolve before asserting the negative.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(setColorTheme).not.toHaveBeenCalled();
  });

  // A theme name with no generated stylesheet would leave the app unstyled,
  // so an unknown value must be ignored rather than applied blindly.
  it('ignores a theme name the registry does not know', async () => {
    respondWithTheme('purpel');
    render(<TenantThemeSync />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(setColorTheme).not.toHaveBeenCalled();
  });

  it('does not call the API when the user is not authenticated', async () => {
    sessionStatus.current = 'unauthenticated';
    let called = false;
    server.use(
      http.get(`${BASE}/auth/me`, () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    render(<TenantThemeSync />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(called).toBe(false);
    expect(setColorTheme).not.toHaveBeenCalled();
  });

  it('keeps the current theme when the lookup fails', async () => {
    server.use(
      http.get(`${BASE}/auth/me`, () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Unauthorized', status: 401 },
          { status: 401, headers: { 'Content-Type': 'application/problem+json' } }
        )
      )
    );

    render(<TenantThemeSync />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(setColorTheme).not.toHaveBeenCalled();
  });
});
