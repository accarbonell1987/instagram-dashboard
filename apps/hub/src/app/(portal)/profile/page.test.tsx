import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';

import ProfilePage from './page';

import { server } from '@/lib/mocks/server';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

/**
 * El perfil se hidrata desde GET /auth/me, no desde los claims del JWT. El
 * token no lleva el teléfono — si volviera a leerse de ahí, el campo aparecería
 * vacío en cada login nuevo aunque la base tenga el dato guardado.
 */
describe('ProfilePage', () => {
  it('loads name and phone from /auth/me', async () => {
    server.use(
      http.get(`${BASE}/auth/me`, () => {
        return HttpResponse.json({
          user: {
            id: 'user-1',
            email: 'ana@empresa-acme.com',
            fullName: 'Ana Pereira',
            phone: '+595981000000',
            picture: null,
            status: 'active',
          },
          tenant: { id: 't-1', slug: 'acme', name: 'Acme', planId: 'starter', status: 'active' },
          role: 'TenantAdmin',
        });
      })
    );

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Pereira');
    });
    // El dial code sale a un Select y el resto a los slots del InputOTP.
    expect(screen.getByLabelText('Número local')).toHaveValue('981000000');
  });

  it('keeps the phone field empty when the user has none stored', async () => {
    server.use(
      http.get(`${BASE}/auth/me`, () => {
        return HttpResponse.json({
          user: {
            id: 'user-2',
            email: 'sin-tel@empresa-acme.com',
            fullName: 'Beto Duarte',
            phone: null,
            picture: null,
            status: 'active',
          },
          tenant: { id: 't-1', slug: 'acme', name: 'Acme', planId: 'starter', status: 'active' },
          role: 'User',
        });
      })
    );

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Nombre completo')).toHaveValue('Beto Duarte');
    });
    expect(screen.getByLabelText('Número local')).toHaveValue('');
  });

  it('surfaces an error when the profile cannot be loaded', async () => {
    server.use(
      http.get(`${BASE}/auth/me`, () => {
        return HttpResponse.json(
          { type: 'about:blank', title: 'Unauthorized', status: 401 },
          { status: 401, headers: { 'Content-Type': 'application/problem+json' } }
        );
      })
    );

    render(<ProfilePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar tu perfil. Recargá la página.'
    );
  });
});
