import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/ui/Logo';
import { LinkedInIcon, TwitterIcon, GitHubIcon } from '@/components/icons';

const PRODUCT_LINKS = [
  { href: '#solucion', key: 'solution' },
  { href: '#capacidades', key: 'capabilities' },
  { href: '#privacy-security', key: 'guardian' },
  { href: '#pricing', key: 'pricing' },
] as const;

const RESOURCE_LINKS = [
  { href: '#', key: 'docs' },
  { href: '#', key: 'api' },
  { href: '#', key: 'useCases' },
  { href: '#', key: 'blog' },
] as const;

const COMPANY_LINKS = [
  { href: '#', key: 'about' },
  { href: '#', key: 'contact' },
  { href: '#', key: 'terms' },
  { href: '#', key: 'privacy' },
] as const;

export async function Footer() {
  const t = await getTranslations('footer');

  return (
    <footer className="border-border-default mt-auto border-t">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)] py-16">
        {/* Link grid */}
        <div className="mb-12 grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand column */}
          <div className="sm:col-span-2 md:col-span-1">
            <a href="#" aria-label="InstaMetrics home" className="mb-4 inline-flex items-center gap-3">
              <Logo idPrefix="footer" width={36} height={24} />
              <span className="font-display text-text-default text-lg leading-none font-bold">
                InstaMetrics
              </span>
            </a>
            <p className="text-text-mute font-display max-w-[260px] text-sm leading-relaxed">
              {t('tagline')}
            </p>
          </div>

          {/* Product links */}
          <nav aria-label="Footer navigation — product">
            <h5 className="text-text-default font-display mb-4 text-sm font-semibold">
              {t('product')}
            </h5>
            <ul className="flex flex-col gap-3">
              {PRODUCT_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <a
                    href={href}
                    className="text-text-dim hover:text-text-default font-display text-sm transition-colors"
                  >
                    {t(`links.${key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Resource links */}
          <nav aria-label="Footer navigation — resources">
            <h5 className="text-text-default font-display mb-4 text-sm font-semibold">
              {t('resources')}
            </h5>
            <ul className="flex flex-col gap-3">
              {RESOURCE_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <a
                    href={href}
                    className="text-text-dim hover:text-text-default font-display text-sm transition-colors"
                  >
                    {t(`links.${key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company links */}
          <nav aria-label="Footer navigation — company">
            <h5 className="text-text-default font-display mb-4 text-sm font-semibold">
              {t('company')}
            </h5>
            <ul className="flex flex-col gap-3">
              {COMPANY_LINKS.map(({ href, key }) => (
                <li key={key}>
                  <a
                    href={href}
                    className="text-text-dim hover:text-text-default font-display text-sm transition-colors"
                  >
                    {t(`links.${key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="border-border-default flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <p className="text-text-mute font-display text-sm">{t('copyright')}</p>

          {/* Social icons */}
          <div className="flex items-center gap-4">
            <a
              href="https://linkedin.com"
              aria-label="LinkedIn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-mute hover:text-text-default transition-colors"
            >
              <LinkedInIcon size={18} aria-hidden />
            </a>
            <a
              href="https://twitter.com"
              aria-label="X / Twitter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-mute hover:text-text-default transition-colors"
            >
              <TwitterIcon size={18} aria-hidden />
            </a>
            <a
              href="https://github.com"
              aria-label="GitHub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-mute hover:text-text-default transition-colors"
            >
              <GitHubIcon size={18} aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
