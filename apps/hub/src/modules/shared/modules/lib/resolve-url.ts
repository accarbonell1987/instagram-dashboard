export function resolveProductUrl(productId: string, defaultUrl: string): string {
  const envKey = `NEXT_PUBLIC_PRODUCT_URL_${productId.toUpperCase().replace(/-/g, '_')}`;
  const envOverride = process.env[envKey];
  return envOverride ?? defaultUrl;
}

/**
 * The absolute address of a settings screen a product contributes.
 *
 * The section stores its path relative to the product, so the same env override
 * that points the launcher at a local product also points its settings screens
 * there. Joining with `new URL` keeps a path like `/admin/x` anchored to the
 * product's origin instead of being concatenated blindly.
 */
export function resolveSectionUrl(productId: string, productUrl: string, path: string): string {
  return new URL(path, resolveProductUrl(productId, productUrl)).toString();
}
