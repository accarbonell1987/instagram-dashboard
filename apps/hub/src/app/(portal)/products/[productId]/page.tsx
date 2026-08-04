'use client';

import { Button } from '@core/ui';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, type JSX } from 'react';

import { AppCard } from '@/components/app-card';
import { AppCardSkeleton } from '@/components/app-card-skeleton';
import { getModuleVisuals, isLocalModule } from '@/lib/apps-config';
import { useProducts } from '@/modules/shared/modules/index';

export default function ProductModulesPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}): JSX.Element {
  const { productId } = use(params);
  const router = useRouter();
  const { products, isLoading } = useProducts();

  const product = products.find((candidate) => candidate.id === productId);

  // Modules and their sub-modules are both entry points — flatten so every
  // functionality the tenant can reach gets its own card.
  const entries = (product?.modules ?? []).flatMap((module) => [module, ...module.subModules]);

  function openModule(defaultUrl: string, moduleId: string): void {
    router.push(isLocalModule(defaultUrl) ? defaultUrl : `/apps/${moduleId}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-start gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Volver a productos"
          onClick={() => {
            router.push('/');
          }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div>
          <h2 className="text-foreground mb-2 text-2xl font-semibold sm:text-3xl">
            {product?.name ?? 'Producto'}
          </h2>
          <p className="text-muted-foreground">
            {product?.description ?? 'Selecciona un módulo para continuar'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="min-w-0 max-w-md flex-1 basis-72">
                <AppCardSkeleton />
              </div>
            ))
          : entries.map((module, index) => {
              const visuals = getModuleVisuals(module.id);

              return (
                <div
                  key={module.id}
                  className="min-w-0 max-w-md flex-1 basis-72 [animation:fade-in_0.3s_ease-out]"
                  style={{
                    animationDelay: `${String(index * 80)}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  <AppCard
                    name={module.name}
                    description={module.description ?? ''}
                    icon={visuals.icon}
                    color={visuals.color}
                    onClick={() => {
                      openModule(module.defaultUrl, module.id);
                    }}
                  />
                </div>
              );
            })}
      </div>

      {!isLoading && product === undefined && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Este producto no está disponible para tu cuenta.</p>
        </div>
      )}
    </div>
  );
}
