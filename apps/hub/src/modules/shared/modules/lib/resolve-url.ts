export function resolveProductUrl(productId: string, defaultUrl: string): string {
  const envKey = `NEXT_PUBLIC_PRODUCT_URL_${productId.toUpperCase().replace(/-/g, '_')}`;
  const envOverride = process.env[envKey];
  return envOverride ?? defaultUrl;
}
