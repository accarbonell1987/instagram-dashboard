import type { Metadata } from 'next';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Toaster } from '@core/ui';
import { Providers } from '../providers';
import '../globals.css';

// TODO: Create /public/og-image.png (1200×630px) — currently missing!
// Social crawlers will 404 on this. Design a branded OG image with:
// - "InstaMetrics — Instagram Analytics Dashboard" branding
// - Dashboard mockup or visual element
// - Company logo

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'InstaMetrics',
  description: 'Instagram analytics dashboard — track, analyze, and grow your Instagram presence',
  url: 'https://corehub.rasen.solutions',
  logo: 'https://corehub.rasen.solutions/og-image.png',
  sameAs: [
    'https://linkedin.com/company/instametrics',
    'https://twitter.com/instametrics',
    'https://github.com/instametrics',
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    title: {
      default: t('title'),
      template: `%s | InstaMetrics`,
    },
    description: t('description'),
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://corehub.rasen.solutions'),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        es: '/es',
        en: '/en',
        pt: '/pt',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: `/${locale}`,
      siteName: 'InstaMetrics',
      locale: locale === 'es' ? 'es_ES' : locale === 'pt' ? 'pt_BR' : 'en_US',
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'InstaMetrics — Instagram Analytics Dashboard',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: ['/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function generateStaticParams() {
  return [{ locale: 'es' }, { locale: 'en' }, { locale: 'pt' }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        {/* Skip-to-content for keyboard / screen-reader users */}
        <a
          href="#main"
          className="focus:rounded-btn focus:bg-accent focus:text-bg sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:font-semibold"
        >
          Skip to content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <main id="main">{children}</main>
            <Toaster />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
