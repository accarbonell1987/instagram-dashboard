export type TenantMode = 'subdomain' | 'path';

/**
 * Reads NEXT_PUBLIC_TENANT_MODE from the environment.
 * Defaults to 'path' in development (no DNS setup required).
 * Defaults to 'subdomain' in production (set NEXT_PUBLIC_TENANT_MODE=subdomain).
 */
export function getTenantMode(): TenantMode {
  const mode = process.env['NEXT_PUBLIC_TENANT_MODE'];
  if (mode === 'subdomain') return 'subdomain';
  return 'path';
}

/**
 * Extracts the tenant slug from the `host` header in subdomain mode.
 *
 * Rules:
 * - host must be `{slug}.{baseDomain}` with exactly one subdomain label
 * - 'www' is excluded (it is not a tenant slug)
 * - If host equals baseDomain exactly, returns null (no tenant subdomain)
 *
 * @param host       The Host header value, e.g. "acme.corehub.com"
 * @param mode       Must be 'subdomain'; returns null for 'path'
 * @param baseDomain The root domain, e.g. "corehub.com"
 */
export function resolveTenantFromHost(
  host: string,
  mode: TenantMode,
  baseDomain: string
): string | null {
  if (mode !== 'subdomain') return null;

  // Strip port if present
  const hostWithoutPort = host.split(':')[0] ?? host;
  const base = baseDomain.split(':')[0] ?? baseDomain;

  if (!hostWithoutPort.endsWith(`.${base}`)) return null;

  const subdomain = hostWithoutPort.slice(0, hostWithoutPort.length - base.length - 1);

  // Reject multi-label subdomains (e.g. "a.b.corehub.com") and 'www'
  if (subdomain.includes('.') || subdomain === 'www' || subdomain === '') return null;

  return subdomain;
}

/**
 * Extracts the tenant slug from the pathname in path mode.
 *
 * Matches: /app/{slug}/...
 * Returns: { slug, rest } where rest is everything after /{slug}.
 * If the path does not match, slug is null and rest is the original pathname.
 */
export function resolveTenantFromPath(pathname: string): { slug: string | null; rest: string } {
  const match = /^\/app\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!match) return { slug: null, rest: pathname };

  const slug = match[1] ?? null;
  const rest = match[2] ?? '/';
  return { slug, rest };
}
