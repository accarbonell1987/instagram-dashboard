import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const mockUseProducts = vi.fn();
vi.mock('@/modules/shared/modules/index', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock returns the vi.fn() result, typed any
  useProducts: () => mockUseProducts(),
}));

vi.mock('@/providers/index', () => ({
  useAuth: () => ({
    session: {
      status: 'authenticated',
      session: { user: { fullName: 'Ana' } },
    },
  }),
}));

import HomePage from './page';

import type { AvailableProduct } from '@/modules/shared/modules/index';

function product(overrides: Partial<AvailableProduct> = {}): AvailableProduct {
  return {
    id: 'instagram-dashboard',
    name: 'Instagram Dashboard',
    description: 'Panel de métricas',
    modules: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomePage', () => {
  it('links a product card straight to its shell (/apps/{id})', async () => {
    mockUseProducts.mockReturnValue({ products: [product()], isLoading: false });

    render(<HomePage />);

    const card = await waitFor(() => screen.getByText('Instagram Dashboard'));
    card.closest('button')?.click();

    expect(pushMock).toHaveBeenCalledWith('/apps/instagram-dashboard');
  });

  it('routes a hub-relative defaultUrl directly, bypassing the iframe shell', async () => {
    mockUseProducts.mockReturnValue({
      products: [product({ id: 'lab', name: 'Lab', defaultUrl: '/lab' })],
      isLoading: false,
    });

    render(<HomePage />);

    const card = await waitFor(() => screen.getByText('Lab'));
    card.closest('button')?.click();

    expect(pushMock).toHaveBeenCalledWith('/lab');
  });

  it('does not show a module count anymore', async () => {
    mockUseProducts.mockReturnValue({ products: [product()], isLoading: false });

    render(<HomePage />);

    await waitFor(() => screen.getByText('Instagram Dashboard'));
    expect(screen.queryByText(/módulo/i)).not.toBeInTheDocument();
  });
});
