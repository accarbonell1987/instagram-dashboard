export function resolveModuleUrl(moduleId: string, defaultUrl: string): string {
  const envKey = `NEXT_PUBLIC_MODULE_URL_${moduleId.toUpperCase().replace(/-/g, '_')}`;
  const envOverride = process.env[envKey];
  return envOverride ?? defaultUrl;
}
