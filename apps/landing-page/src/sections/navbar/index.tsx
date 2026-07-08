'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@core/ui';
import { cn } from '@core/ui/lib';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { BrandButton } from '@/components/ui/BrandButton';
import { MobileNav } from './mobile-nav';
import { SunIcon, MoonIcon, GlobeIcon, MenuIcon } from '@/components/icons';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import type { Locale } from '@/lib/types';

const NAV_LINKS = [
  { id: 'solucion', labelKey: 'solution' },
  { id: 'capacidades', labelKey: 'capabilities' },
  { id: 'use-cases', labelKey: 'industries' },
  { id: 'pricing', labelKey: 'pricing' },
  { id: 'cta-final', labelKey: 'demo' },
] as const;

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
];

export function Navbar() {
  const t = useTranslations('nav');
  const { theme, setTheme } = useTheme();
  const { scrollTo } = useSmoothScroll();
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = theme === 'dark';

  const handleLocaleChange = (locale: Locale) => {
    router.replace(pathname, { locale });
  };

  return (
    <>
      <header className="bg-bg/80 border-border-default fixed top-0 right-0 left-0 z-50 h-[68px] border-b backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[var(--width-content)] items-center justify-between gap-6 px-[var(--spacing-pad)]">
          {/* Logo */}
          <a href="#" aria-label="InstaMetrics home" className="flex shrink-0 items-center gap-3">
            <Logo idPrefix="nav" width={36} height={24} />
            <span className="font-display text-text-default text-lg leading-none font-bold">
              InstaMetrics
            </span>
          </a>

          {/* Desktop nav links */}
          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="rounded-btn text-text-dim hover:text-text-default font-display px-4 py-2 text-sm transition-colors"
              >
                {t(link.labelKey)}
              </button>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Language switcher — desktop */}
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Change language"
                    className="rounded-btn text-text-dim hover:text-text-default hover:bg-surface font-display flex items-center gap-1.5 px-3 py-2 text-sm transition-colors"
                  >
                    <GlobeIcon size={15} aria-hidden />
                    <span className="uppercase">{currentLocale}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-bg-elev border-border-default min-w-[120px]"
                >
                  {LOCALES.map(({ code, label }) => (
                    <DropdownMenuItem
                      key={code}
                      onClick={() => handleLocaleChange(code)}
                      className={cn(
                        'font-display cursor-pointer text-sm',
                        currentLocale === code
                          ? 'text-accent bg-surface'
                          : 'text-text-dim hover:text-text-default',
                      )}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mode toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={
                !mounted ? 'Toggle theme' : isDark ? 'Switch to light mode' : 'Switch to dark mode'
              }
              className="rounded-btn text-text-dim hover:text-text-default hover:bg-surface p-2 transition-colors"
            >
              {!mounted ? (
                <SunIcon size={17} aria-hidden />
              ) : isDark ? (
                <SunIcon size={17} aria-hidden />
              ) : (
                <MoonIcon size={17} aria-hidden />
              )}
            </button>

            {/* CTA button — desktop */}
            <BrandButton
              variant="primary"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => scrollTo('cta-final')}
            >
              {t('cta')}
            </BrandButton>

            {/* Hamburger — mobile */}
            <button
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-btn text-text-dim hover:text-text-default hover:bg-surface p-2 transition-colors md:hidden"
            >
              <MenuIcon size={20} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <MobileNav isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
    </>
  );
}
