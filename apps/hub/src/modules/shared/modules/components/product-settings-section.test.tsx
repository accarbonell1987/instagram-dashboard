import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';

import { ProductSettingsSection } from './product-settings-section';

import { server } from '@/lib/mocks/server';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

function section(overrides: Record<string, unknown> = {}) {
  return {
    key: 'linked-accounts',
    label: 'Cuentas de Instagram',
    description: 'Las cuentas vinculadas de tu organización.',
    productId: 'instagram-dashboard',
    productName: 'Dashboard Instagram',
    productUrl: 'http://localhost:3004',
    path: '/admin/linked-accounts',
    moduleId: null,
    ...overrides,
  };
}

function respondWith(sections: Record<string, unknown>[]) {
  server.use(
    http.get(`${BASE}/tenants/current/admin-sections`, () => HttpResponse.json({ sections })),
  );
}

// The panel, not the default export: that one only unwraps the route params
// with `use()`, which suspends and would need a boundary staged here for no
// behavioural gain.
function renderPage(sectionKey = 'linked-accounts') {
  return render(<ProductSettingsSection sectionKey={sectionKey} />);
}

describe('ProductSettingsSection', () => {
  /**
   * The point of the mechanism: the hub mounts a screen it knows nothing about,
   * at the address the section declares.
   */
  it('mounts the product page the section points at', async () => {
    respondWith([section()]);
    renderPage();

    const frame = await screen.findByTitle('Cuentas de Instagram');
    expect(frame).toHaveAttribute('src', 'http://localhost:3004/admin/linked-accounts');
  });

  it('heads the panel with the section label and description', async () => {
    respondWith([section()]);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cuentas de Instagram' })).toBeInTheDocument();
    expect(screen.getByText(/Las cuentas vinculadas/)).toBeInTheDocument();
  });

  /**
   * Unknown key, product not contracted, module not entitled, role too low —
   * the API filtered it out, and which of those it was is not the customer's
   * problem. What must not happen is an empty frame pointed at nothing.
   */
  it('says the section is unavailable rather than framing nothing', async () => {
    respondWith([]);
    renderPage();

    expect(await screen.findByText(/no existe o no está disponible/)).toBeInTheDocument();
    expect(screen.queryByTitle('Cuentas de Instagram')).toBeNull();
  });

  it('does not mount a section the caller did not ask for', async () => {
    respondWith([section()]);
    renderPage('otra-cosa');

    expect(await screen.findByText(/no existe o no está disponible/)).toBeInTheDocument();
  });

  // A failed load must not look like an empty frame either.
  it('degrades to unavailable when the section list cannot be read', async () => {
    server.use(
      http.get(`${BASE}/tenants/current/admin-sections`, () =>
        HttpResponse.json({ title: 'Server error', status: 500 }, { status: 500 }),
      ),
    );
    renderPage();

    expect(await screen.findByText(/no existe o no está disponible/)).toBeInTheDocument();
  });
});
