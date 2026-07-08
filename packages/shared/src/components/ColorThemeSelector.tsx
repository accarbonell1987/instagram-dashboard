'use client';

import { useColorTheme, type ColorThemeType } from '../providers';

/**
 * Color theme metadata for display
 */
const themes: { value: ColorThemeType; label: string; color: string }[] = [
  { value: 'zinc', label: 'Zinc', color: 'hsl(240 5.9% 10%)' },
  { value: 'slate', label: 'Slate', color: 'hsl(222.2 47.4% 11.2%)' },
  { value: 'stone', label: 'Stone', color: 'hsl(24 9.8% 10%)' },
  { value: 'gray', label: 'Gray', color: 'hsl(220.9 39.3% 11%)' },
  { value: 'neutral', label: 'Neutral', color: 'hsl(0 0% 9%)' },
  { value: 'red', label: 'Red', color: 'hsl(0 72.2% 50.6%)' },
  { value: 'rose', label: 'Rose', color: 'hsl(346.8 77.2% 49.8%)' },
  { value: 'orange', label: 'Orange', color: 'hsl(24.6 95% 53.1%)' },
  { value: 'green', label: 'Green', color: 'hsl(142.1 76.2% 36.3%)' },
  { value: 'blue', label: 'Blue', color: 'hsl(221.2 83.2% 53.3%)' },
  { value: 'yellow', label: 'Yellow', color: 'hsl(47.9 95.8% 53.1%)' },
  { value: 'violet', label: 'Violet', color: 'hsl(262.1 83.3% 57.8%)' },
];

interface ColorThemeSelectorProps {
  /**
   * Display variant
   * - "grid": Shows all colors in a grid (default)
   * - "select": Dropdown select
   * - "buttons": Horizontal button row
   */
  variant?: 'grid' | 'select' | 'buttons';
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ColorThemeSelector Component
 *
 * Allows users to select a color theme from the available options.
 *
 * Usage:
 * ```tsx
 * <ColorThemeSelector />
 * <ColorThemeSelector variant="select" />
 * <ColorThemeSelector variant="buttons" />
 * ```
 */
const ColorThemeSelector = ({ variant = 'grid', className = '' }: ColorThemeSelectorProps) => {
  const { colorTheme, setColorTheme } = useColorTheme();

  if (variant === 'select') {
    return (
      <select
        value={colorTheme}
        onChange={(e) => {
          setColorTheme(e.target.value);
        }}
        className={`border-input bg-background ring-offset-background focus:ring-ring h-10 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
        aria-label="Select color theme"
      >
        {themes.map((theme) => (
          <option key={theme.value} value={theme.value}>
            {theme.label}
          </option>
        ))}
      </select>
    );
  }

  if (variant === 'buttons') {
    return (
      <div
        className={`flex flex-wrap gap-2 ${className}`}
        role="radiogroup"
        aria-label="Color theme"
      >
        {themes.map((theme) => (
          <button
            key={theme.value}
            onClick={() => {
              setColorTheme(theme.value);
            }}
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm transition-colors ${
              colorTheme === theme.value
                ? 'border-primary bg-primary/10'
                : 'border-input bg-background hover:bg-accent'
            }`}
            role="radio"
            aria-checked={colorTheme === theme.value}
            aria-label={theme.label}
          >
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.color }} />
            <span>{theme.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-6 gap-2 ${className}`}
      role="radiogroup"
      aria-label="Color theme"
    >
      {themes.map((theme) => (
        <button
          key={theme.value}
          onClick={() => {
            setColorTheme(theme.value);
          }}
          className={`group relative flex h-10 w-10 items-center justify-center rounded-md border-2 transition-all ${
            colorTheme === theme.value
              ? 'border-primary ring-primary ring-offset-background ring-2 ring-offset-2'
              : 'hover:border-muted-foreground/50 border-transparent'
          }`}
          role="radio"
          aria-checked={colorTheme === theme.value}
          aria-label={theme.label}
          title={theme.label}
        >
          <span
            className="h-6 w-6 rounded-full shadow-sm"
            style={{ backgroundColor: theme.color }}
          />
          {colorTheme === theme.value && (
            <span className="absolute -right-1 -top-1">
              <CheckIcon />
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-primary"
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="M9 12l2 2 4-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default ColorThemeSelector;
