import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://corehub.rasen.solutions';

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ['es', 'en', 'pt'];

  return locales.map((locale) => ({
    url: `${BASE_URL}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: locale === 'es' ? 1.0 : 0.8,
  }));
}
