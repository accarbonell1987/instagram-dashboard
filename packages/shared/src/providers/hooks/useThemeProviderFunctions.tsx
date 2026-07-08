import { COLOR_THEMES } from '../ThemeProvider';
import type { ColorThemeType } from '../types/ThemeProvider.types';

const useThemeProviderFunctions = () => {
  const isValidColorTheme = (value: string): value is ColorThemeType =>
    COLOR_THEMES.includes(value);

  const getStoredTheme = (key: string): ColorThemeType | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(key);
      return stored && isValidColorTheme(stored) ? stored : null;
    } catch {
      return null;
    }
  };

  const applyThemeClass = (theme: ColorThemeType) => {
    // Apply theme class to both <html> and <body>.
    // Radix UI Portals (Select, Popover, Dialog, etc.) mount on document.body.
    // CSS selectors like `.dark .theme-orange` require theme-orange to be a
    // descendant of .dark — i.e. on body (child of html.dark), not on html itself.
    // html.dark > body.theme-orange satisfies `.dark .theme-orange { }` ✓
    [document.documentElement, document.body].forEach((target) => {
      Array.from(target.classList)
        .filter((cls) => cls.startsWith('theme-'))
        .forEach((cls) => target.classList.remove(cls));
      target.classList.add(`theme-${theme}`);
    });
  };

  return { getStoredTheme, applyThemeClass };
};

export default useThemeProviderFunctions;
