"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { cn } from "@core/ui/lib";
import { useRouter, usePathname } from "@/i18n/navigation";
import { XIcon, SunIcon, MoonIcon } from "@/components/icons";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import type { Locale } from "@/lib/types";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_LINKS = [
  { id: "solucion", labelKey: "solution" },
  { id: "capacidades", labelKey: "capabilities" },
  { id: "use-cases", labelKey: "industries" },
  { id: "pricing", labelKey: "pricing" },
  { id: "cta-final", labelKey: "demo" },
] as const;

const LOCALES: { code: Locale; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "pt", label: "PT" },
];

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const t = useTranslations("nav");
  const { theme, setTheme } = useTheme();
  const { scrollTo } = useSmoothScroll();
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const firstLinkRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Focus first link when opened
  useEffect(() => {
    if (isOpen) {
      firstLinkRef.current?.focus();
    }
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape key closes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleLinkClick = (sectionId: string) => {
    scrollTo(sectionId);
    onClose();
  };

  const handleLocaleChange = (locale: Locale) => {
    router.replace(pathname, { locale });
    onClose();
  };

  const isDark = theme === "dark";

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-bg/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[280px] bg-bg-elev border-l border-border-default flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Close button */}
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="p-2 rounded-btn text-text-dim hover:text-text-default hover:bg-surface transition-colors"
          >
            <XIcon size={20} aria-hidden />
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Mobile navigation" className="flex-1 px-6 py-4">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link, index) => (
              <li key={link.id}>
                <button
                  ref={index === 0 ? firstLinkRef : undefined}
                  onClick={() => handleLinkClick(link.id)}
                  className="w-full text-left py-3 px-3 rounded-btn text-text-dim hover:text-text-default hover:bg-surface transition-colors text-base font-display"
                >
                  {t(link.labelKey)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom controls */}
        <div className="px-6 py-6 border-t border-border-default flex flex-col gap-4">
          {/* Language switcher */}
          <div className="flex gap-2">
            {LOCALES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => handleLocaleChange(code)}
                className={cn(
                  "flex-1 py-2 rounded-btn text-sm font-display font-semibold transition-colors",
                  currentLocale === code
                    ? "bg-accent text-bg-elev"
                    : "bg-surface text-text-dim hover:bg-surface-hi hover:text-text-default",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mode toggle */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={!mounted ? "Toggle theme" : isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center gap-3 py-3 px-3 rounded-btn text-text-dim hover:text-text-default hover:bg-surface transition-colors w-full"
          >
            {!mounted || isDark ? (
              <>
                <SunIcon size={18} aria-hidden />
                <span className="text-sm font-display">Light mode</span>
              </>
            ) : (
              <>
                <MoonIcon size={18} aria-hidden />
                <span className="text-sm font-display">Dark mode</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
