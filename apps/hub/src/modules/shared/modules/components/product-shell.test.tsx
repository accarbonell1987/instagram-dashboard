import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { AvailableProduct } from '../services/products.service';

import { ProductShell } from './product-shell';

import { clearAccessToken, setAccessToken } from '@/modules/iam/identity/session/token';

const mockUseProducts = vi.fn();
vi.mock('../hooks/use-products', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock returns the vi.fn() result, typed any
  useProducts: () => mockUseProducts(),
}));

function product(overrides: Partial<AvailableProduct> = {}): AvailableProduct {
  return {
    id: 'instagram-dashboard',
    name: 'Instagram Dashboard',
    description: 'Panel de métricas',
    defaultUrl: 'https://ig.example.com',
    modules: [],
    ...overrides,
  };
}

function productWithoutUrl(): AvailableProduct {
  const { defaultUrl: _defaultUrl, ...rest } = product();
  return rest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  clearAccessToken();
});

describe('ProductShell', () => {
  it('shows a spinner while products are loading', () => {
    mockUseProducts.mockReturnValue({ products: [], isLoading: true });

    render(<ProductShell productId="instagram-dashboard" />);

    expect(screen.queryByTitle('instagram-dashboard')).not.toBeInTheDocument();
  });

  it('falls back to "not available" when the product has no defaultUrl', async () => {
    mockUseProducts.mockReturnValue({
      products: [productWithoutUrl()],
      isLoading: false,
    });

    render(<ProductShell productId="instagram-dashboard" />);

    expect(await screen.findByText('Acceso no disponible')).toBeInTheDocument();
  });

  it('falls back to "not available" when the product is unreachable for this tenant', async () => {
    mockUseProducts.mockReturnValue({ products: [], isLoading: false });

    render(<ProductShell productId="instagram-dashboard" />);

    expect(await screen.findByText('Acceso no disponible')).toBeInTheDocument();
  });

  it('resolves the product URL into the iframe src', async () => {
    mockUseProducts.mockReturnValue({ products: [product()], isLoading: false });

    render(<ProductShell productId="instagram-dashboard" />);

    const iframe = await waitFor(() => screen.getByTitle('instagram-dashboard'));
    expect(iframe).toHaveAttribute('src', 'https://ig.example.com');
  });

  it('answers the module ready handshake with the current token', async () => {
    mockUseProducts.mockReturnValue({ products: [product()], isLoading: false });
    setAccessToken({ raw: 'fake-jwt', expiresAt: Date.now() + 60_000 });

    render(<ProductShell productId="instagram-dashboard" />);
    const iframe = await waitFor(() => screen.getByTitle('instagram-dashboard'));

    const postMessageSpy = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: postMessageSpy },
      configurable: true,
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://ig.example.com',
          data: { type: 'corehub.module.v1.ready' },
        })
      );
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'corehub.hub.v1.token', token: 'fake-jwt' },
      'https://ig.example.com'
    );
  });
});
