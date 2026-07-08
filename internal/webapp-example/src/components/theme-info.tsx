'use client';

import { getTheme } from '@core/config/styles/themes/registry';
import { useColorTheme } from '@core/shared/providers';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { themeConfig } from '../styles/theme';

const COLOR_VARS = [
  'primary',
  'secondary',
  'accent',
  'destructive',
  'muted',
  'background',
  'foreground',
] as const;

/**
 * Reads current CSS custom property values from the document root.
 * Must only be called on the client after mount.
 */
function readCssColors(): Record<string, string> {
  const styles = getComputedStyle(document.documentElement);
  const colors: Record<string, string> = {};
  for (const varName of COLOR_VARS) {
    const value = styles.getPropertyValue(`--${varName}`).trim();
    if (value) {
      colors[varName] = `hsl(${value})`;
    }
  }
  return colors;
}

export function ThemeInfo() {
  const { colorTheme } = useColorTheme();
  const { theme: darkMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Derive colors during render instead of storing in state (rerender-derived-state-no-effect).
  // Reading computed styles is synchronous and cheap for 7 properties.
  // This runs after mount, so `document` is guaranteed to exist.
  const currentColors = readCssColors();
  const themeDefinition = getTheme(colorTheme);
  const mode = darkMode === 'dark' ? 'dark' : 'light';

  return (
    <div className="bg-card rounded-2xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">
            {themeDefinition?.label ?? colorTheme} Theme
          </h3>
          <p className="text-muted-foreground text-sm">
            {themeDefinition?.description ?? 'Custom theme'}
          </p>
        </div>
        <div className="bg-background rounded-xl border px-3 py-1.5 text-sm">
          {mode === 'light' ? '☀️ Light' : '🌙 Dark'} Mode
        </div>
      </div>

      {/* Theme Metadata */}
      <div className="mb-4 grid gap-2 text-sm">
        <div className="flex gap-2">
          <span className="text-muted-foreground">Active Theme:</span>
          <span className="font-medium capitalize">{colorTheme}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground">Source:</span>
          <span className="font-medium capitalize">{themeDefinition?.source ?? 'custom'}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground">Primary Color:</span>
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 rounded border"
              style={{ backgroundColor: `hsl(${themeDefinition?.primaryHsl ?? '0 0% 50%'})` }}
            />
            <code className="bg-muted rounded px-2 py-0.5 font-mono text-xs">
              hsl({themeDefinition?.primaryHsl})
            </code>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground">Border Radius:</span>
          <code className="bg-muted rounded px-2 py-0.5 font-mono text-xs">
            {themeDefinition?.radius ?? '0.5rem'}
          </code>
        </div>
      </div>

      {/* Color Palette */}
      {Object.keys(currentColors).length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-semibold">Active Color Palette ({mode} mode)</h4>
          <div className="grid gap-2">
            {Object.entries(currentColors).map(([name, value]) => (
              <div key={name} className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-lg border shadow-sm"
                  style={{ backgroundColor: value }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium capitalize">{name}</div>
                </div>
                <code className="bg-muted rounded-lg px-2 py-0.5 text-xs">{value}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-muted/50 rounded-xl p-3 text-xs">
        <p className="text-muted-foreground">
          💡 Switch themes using the selector in the top-right corner. Your selection will be
          persisted in localStorage.
        </p>
      </div>

      {/* Font Configuration */}
      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold">Typography</h4>
        <div className="grid gap-2 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16">Sans:</span>
            <span className="font-sans">{themeConfig.fonts.sans}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16">Serif:</span>
            <span className="font-serif">{themeConfig.fonts.serif}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16">Mono:</span>
            <span className="font-mono">{themeConfig.fonts.mono}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
