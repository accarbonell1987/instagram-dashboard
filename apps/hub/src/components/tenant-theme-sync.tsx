'use client';

import { isValidTheme } from '@core/config/styles/themes/registry';
import { useColorTheme } from '@core/shared/providers';
import { useEffect } from 'react';

import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { SchemaTenant } from '@/lib/api/types';
import { useSession } from '@/modules/iam/identity/hooks/use-session';

/**
 * Applies the tenant's visual style to every user of that tenant.
 *
 * The theme is read from GET /auth/me rather than a JWT claim: it is mutable
 * tenant data, and a claim would keep showing the old style to everyone whose
 * token was issued before an admin changed it.
 *
 * ThemeProvider still seeds itself from localStorage on mount, which is what
 * makes this flicker-free on the second load: that cached value is the tenant
 * theme this component wrote last time, and the fetch below corrects it if the
 * admin has since changed it.
 */
export function TenantThemeSync(): null {
  const { status } = useSession();
  const { setColorTheme } = useColorTheme();

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;
    apiFetchWithInterceptors<{ tenant: SchemaTenant }>('/auth/me')
      .then(({ tenant }) => {
        // The registry is the authority on which theme names exist. Anything
        // it does not recognise leaves the current theme alone rather than
        // dropping the user onto a stylesheet that was never generated.
        if (cancelled || !tenant.colorTheme || !isValidTheme(tenant.colorTheme)) return;
        setColorTheme(tenant.colorTheme);
      })
      .catch(() => {
        // A failed lookup is not worth interrupting the app for — the user
        // keeps the default style and the next load retries.
      });

    return () => {
      cancelled = true;
    };
  }, [status, setColorTheme]);

  return null;
}
