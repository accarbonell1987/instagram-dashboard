import { NextResponse, type NextRequest } from 'next/server';

import {
  getTenantMode,
  resolveTenantFromHost,
  resolveTenantFromPath,
} from '@/modules/iam/identity/tenant/resolve';

// ─── Public routes ──────────────────────────────────────
// These routes never require tenant resolution or auth.

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/invite',
  '/first-login',
  '/recover',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// ─── Middleware ─────────────────────────────────────────
//
// Auth decision strategy (v2):
// - Middleware does NOT verify JWT signature (no public key on the edge).
// - Tenant resolution and x-tenant-slug header injection happen here.
// - Cookie-presence check: the api-iam sets a `hub_session=1` cookie (not
//   httpOnly, path='/') whenever it issues or refreshes a session, and clears
//   it on logout. If this cookie is absent on a portal route, the user cannot
//   have a valid refresh_token, so we redirect to /login immediately — before
//   any RSC renders, eliminating the FOUC flash on cold loads.
// - Note: `refresh_token` has path='/auth/refresh' so the browser only sends
//   it to that endpoint; the middleware cannot read it directly. `hub_session`
//   is the lightweight presence signal that the middleware CAN read.
// - The actual auth gate (full JWT validation + refresh) is still handled by
//   <AuthProvider> + refreshSession() on the client. The middleware redirect is
//   a UX optimisation, not a security boundary.

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const mode = getTenantMode();
  const baseDomain = process.env['NEXT_PUBLIC_BASE_DOMAIN'] ?? 'corehub.com';

  // Resolve tenant slug
  let tenantSlug: string | null = null;

  if (mode === 'subdomain') {
    const host = request.headers.get('host') ?? '';
    tenantSlug = resolveTenantFromHost(host, mode, baseDomain);
  } else {
    const resolved = resolveTenantFromPath(pathname);
    tenantSlug = resolved.slug;
  }

  // Public routes — always pass through
  if (isPublicRoute(pathname)) {
    const headers = new Headers(request.headers);
    headers.set('x-tenant-slug', tenantSlug ?? '');
    return NextResponse.next({ request: { headers } });
  }

  // Portal / authenticated routes — fast redirect if no session cookie present.
  // hub_session=1 is set by api-iam on every login/refresh and cleared on logout.
  // Absence means the user definitely has no valid refresh_token → send to /login.
  const hubSession = request.cookies.get('hub_session');
  if (!hubSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie present — inject tenant header and let the request proceed.
  // AuthProvider will do the actual refresh + JWT validation on mount.
  const headers = new Headers(request.headers);
  headers.set('x-tenant-slug', tenantSlug ?? '');
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    // Run on all routes EXCEPT Next.js internals, static assets, and MSW service worker
    '/((?!_next/static|_next/image|favicon.ico|mockServiceWorker\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
