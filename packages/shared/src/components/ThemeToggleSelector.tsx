'use client';

import { Button } from '@core/ui';
import { useTheme } from 'next-themes';

/**
 * ThemeToggle Component
 *
 * Minimalist sun/moon toggle button with smooth transitions.
 * Cycles through: light → dark → system
 *
 * Features:
 * - Inline SVG icons (no external dependencies)
 * - Smooth rotation animations
 * - Accessible (keyboard navigation, ARIA labels)
 * - Shows current theme state
 *
 * Usage:
 * <ThemeToggle />
 */
export default function ThemeToggleSelector() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    if (theme === 'dark') {
      return <MoonIcon />;
    }
    if (theme === 'system') {
      return <SystemIcon />;
    }
    return <SunIcon />;
  };

  const getLabel = () => {
    if (theme === 'dark') return 'Modo oscuro';
    if (theme === 'system') return 'Tema del sistema';
    return 'Modo claro';
  };

  return (
    <Button
      variant="ghost-border"
      size="icon-sm"
      onClick={cycleTheme}
      aria-label={`Cambiar a ${theme === 'light' ? 'Modo oscuro' : theme === 'dark' ? 'Tema del sistema' : 'Modo claro'}. Actual: ${getLabel()}`}
      title={getLabel()}
    >
      <div className="transition-transform duration-300 ease-in-out">{getIcon()}</div>
    </Button>
  );
}

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-in spin-in-0 duration-300"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-in spin-in-180 duration-300"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-in zoom-in-50 duration-300"
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}
