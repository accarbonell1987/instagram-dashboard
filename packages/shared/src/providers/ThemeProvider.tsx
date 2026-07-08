'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';

import { ColorThemeContext } from './hooks/useColorTheme';
import useThemeProviderFunctions from './hooks/useThemeProviderFunctions';
import type { ColorThemeType } from './types/ThemeProvider.types';
import { COLOR_THEME_STORAGE_KEY, COLOR_THEMES, DEFAULT_COLOR_THEME } from './utils/statics';

export type ThemeProviderProps = ComponentProps<typeof NextThemesProvider> & {
  defaultColorTheme?: ColorThemeType;
  colorThemeStorageKey?: string;
};

export function ThemeProvider({
  children,
  defaultColorTheme = DEFAULT_COLOR_THEME,
  colorThemeStorageKey = COLOR_THEME_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [colorTheme, setColorThemeState] = useState<ColorThemeType>(defaultColorTheme);
  const [mounted, setMounted] = useState(false);

  const { getStoredTheme, applyThemeClass } = useThemeProviderFunctions();

  // Initialize from storage
  useEffect(() => {
    setMounted(true);
    const stored = getStoredTheme(colorThemeStorageKey);
    if (stored) setColorThemeState(stored);
  }, [colorThemeStorageKey, getStoredTheme]);

  // Apply theme class to DOM
  useEffect(() => {
    if (mounted) applyThemeClass(colorTheme);
  }, [colorTheme, mounted, applyThemeClass]);

  const setColorTheme = useCallback(
    (theme: ColorThemeType) => {
      setColorThemeState(theme);
      try {
        localStorage.setItem(colorThemeStorageKey, theme);
      } catch {
        // Silently fail in private browsing or when storage is full
      }
    },
    [colorThemeStorageKey]
  );

  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
    </ColorThemeContext.Provider>
  );
}

export { COLOR_THEMES };
