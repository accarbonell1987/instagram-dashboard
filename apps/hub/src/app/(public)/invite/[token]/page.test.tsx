/**
 * Integration test — InvitePage 409 (invitation already used).
 *
 * Verifies that when GET /invitations/:token returns 409 (Conflict),
 * the page renders the "ya fue usada" view and hides the accept button.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, it, expect, vi } from 'vitest';

import InvitePage from './page';

import { applyScenario } from '@/lib/mocks/seed';

// Mock next/navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function renderWithProviders(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<div role="status" aria-label="Cargando..." />}>
        {element}
      </Suspense>
    </QueryClientProvider>
  );
}

describe('InvitePage', () => {
  it('muestra "ya fue usada" cuando la API retorna 409', async () => {
    applyScenario('invitation-used');

    await act(async () => {
      renderWithProviders(
        <InvitePage params={Promise.resolve({ token: 'test-token' })} />
      );
    });

    // Wait for the loading spinner to disappear and content to appear
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /Verificando invitación/i })).not.toBeInTheDocument();
    });

    // Assert the "already used" view is shown
    expect(screen.getByText(/ya fue usada/i)).toBeInTheDocument();

    // Assert the "Aceptar invitación" button is NOT shown
    expect(screen.queryByRole('button', { name: /Aceptar invitación/i })).not.toBeInTheDocument();
  });
});
