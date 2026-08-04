'use client';

import { useEffect, useState } from 'react';

import type { AvailableProduct } from '../services/products.service';
import { getAvailableProducts } from '../services/products.service';

interface UseProductsResult {
  products: AvailableProduct[];
  isLoading: boolean;
  error: Error | null;
}

export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<AvailableProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getAvailableProducts()
      .then((result) => {
        if (!cancelled) {
          setProducts(result);
          setIsLoading(false);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { products, isLoading, error };
}
