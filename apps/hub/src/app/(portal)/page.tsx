'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type JSX } from 'react';

import { AppCard } from '@/components/app-card';
import { AppCardSkeleton } from '@/components/app-card-skeleton';
import { getProductVisuals } from '@/lib/apps-config';
import { useProducts } from '@/modules/shared/modules/index';
import { useAuth } from '@/providers/index';

export default function HomePage(): JSX.Element {
  const { session } = useAuth();
  const router = useRouter();
  const { products, isLoading: isLoadingProducts } = useProducts();
  const [isAnimating, setIsAnimating] = useState(true);
  const firstName = session.session?.user.fullName ?? '';

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const isLoading = isAnimating || isLoadingProducts;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h2 className="text-foreground mb-2 text-2xl font-semibold sm:text-3xl">
          Bienvenido, {firstName}
        </h2>
        <p className="text-muted-foreground">Selecciona un producto para continuar</p>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="min-w-0 max-w-md flex-1 basis-72">
                <AppCardSkeleton />
              </div>
            ))
          : products.map((product, index) => {
              const visuals = getProductVisuals(product.id);
              const moduleCount = product.modules.length;

              return (
                <div
                  key={product.id}
                  className="min-w-0 max-w-md flex-1 basis-72 [animation:fade-in_0.3s_ease-out]"
                  style={{
                    animationDelay: `${String(index * 80)}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  <AppCard
                    name={product.name}
                    description={
                      product.description ??
                      `${String(moduleCount)} ${moduleCount === 1 ? 'módulo' : 'módulos'}`
                    }
                    icon={visuals.icon}
                    color={visuals.color}
                    onClick={() => {
                      router.push(`/products/${product.id}`);
                    }}
                  />
                </div>
              );
            })}
      </div>

      {!isLoading && products.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No hay productos disponibles.</p>
        </div>
      )}
    </div>
  );
}
