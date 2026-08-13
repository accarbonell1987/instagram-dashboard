'use client';

import type { JSX } from 'react';

import { useProducts } from '../hooks/use-products';
import { resolveProductUrl } from '../lib/resolve-url';

import { ModuleFrame } from './module-frame';
import { ProductNotAvailable } from './product-not-available';

interface ProductShellProps {
  productId: string;
}

/**
 * A product opened as a whole screen. The token handshake and the origin
 * checks live in ModuleFrame, shared with the settings panels that products
 * contribute — see /settings/products/[sectionKey].
 */
export function ProductShell({ productId }: ProductShellProps): JSX.Element {
  const { products, isLoading } = useProducts();

  const product = products.find((p) => p.id === productId);
  const productUrl =
    product?.defaultUrl !== undefined ? resolveProductUrl(productId, product.defaultUrl) : null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (product === undefined || productUrl === null) {
    return <ProductNotAvailable productId={productId} />;
  }

  return <ModuleFrame src={productUrl} title={productId} sizing="fill" />;
}
