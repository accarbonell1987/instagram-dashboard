'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type JSX } from 'react';

import { AppCard } from '@/components/app-card';
import { AppCardSkeleton } from '@/components/app-card-skeleton';
import { moduleVisuals, isLocalModule } from '@/lib/apps-config';
import { useModules } from '@/modules/shared/modules/index';
import { useAuth } from '@/providers/index';

export default function HomePage(): JSX.Element {
  const { session } = useAuth();
  const router = useRouter();
  const { modules, isLoading: isLoadingModules } = useModules();
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

  const isLoading = isAnimating || isLoadingModules;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h2 className="text-foreground mb-2 text-2xl font-semibold sm:text-3xl">
          Bienvenido, {firstName}
        </h2>
        <p className="text-muted-foreground">Selecciona una aplicación para continuar</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index}>
                <AppCardSkeleton />
              </div>
            ))
          : modules.map((module, index) => {
              const visuals = moduleVisuals[module.id];
              if (visuals === undefined) return null;

                              return (
                <div
                  key={module.id}
                  className="[animation:fade-in_0.3s_ease-out]"
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
                      const href = isLocalModule(module.defaultUrl)
                        ? module.defaultUrl
                        : `/apps/${module.id}`
                      router.push(href)
                    }}
                  />
                </div>
              );
            })}
      </div>

      {!isLoading && modules.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No hay aplicaciones disponibles.</p>
        </div>
      )}
    </div>
  );
}
