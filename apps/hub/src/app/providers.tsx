'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode, type ReactElement } from 'react';

import { AuthProvider } from '@/providers';

// Singleton QueryClient — created once per browser session.
// staleTime 30s balances freshness with network efficiency.
// retry: false on 4xx to avoid hammering the API on auth errors.
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof Error && 'status' in error) {
            const status = (error as unknown as { status: number }).status;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 2;
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Starts MSW browser worker and applies the active scenario before rendering children.
 * Only active when NEXT_PUBLIC_API_MOCKING === 'enabled'.
 * Production builds tree-shake the dynamic imports completely.
 */
function useMswReady(): boolean {
  // If mocking is disabled, mark as ready immediately (no-op).
  const [ready, setReady] = useState(
    process.env['NEXT_PUBLIC_API_MOCKING'] !== 'enabled',
  );

  useEffect(() => {
    if (process.env['NEXT_PUBLIC_API_MOCKING'] !== 'enabled') return;

    const controller = { cancelled: false };
    void (async () => {
      const { worker } = await import('@/lib/mocks/browser');
      const { applyScenario } = await import('@/lib/mocks/seed');
      const { getActiveScenario } = await import('@/lib/mocks/scenarios/index');
      applyScenario(getActiveScenario());
      await worker.start({ onUnhandledRequest: 'bypass' });
      if (!controller.cancelled) {
        setReady(true);
        document.body.setAttribute('data-msw-ready', 'true');
      }
    })();

    return () => {
      controller.cancelled = true;
    };
  }, []);

  return ready;
}

export function Providers({ children }: ProvidersProps): ReactElement {
  const mswReady = useMswReady();

  if (!mswReady) {
    // Render nothing while MSW is bootstrapping to avoid fetch calls before handlers are set up.
    return <></>;
  }

  // Stable QueryClient instance (singleton per browser session)
  browserQueryClient ??= createQueryClient();

  const content = (
    <QueryClientProvider client={browserQueryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  if (process.env['NEXT_PUBLIC_API_MOCKING'] === 'enabled') {
    // Lazy import to ensure tree-shaking in production
    const MswWidget = () => {
      const [Widget, setWidget] = useState<React.ComponentType | null>(null);
      useEffect(() => {
        void import('@/lib/mocks/dev-widget').then((mod) => {
          setWidget(() => mod.MswDevWidget as React.ComponentType);
        });
      }, []);
      return Widget !== null ? <Widget /> : null;
    };

    return (
      <>
        {content}
        <MswWidget />
      </>
    );
  }

  return content;
}
