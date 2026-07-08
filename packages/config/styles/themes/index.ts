/**
 * Theme System
 *
 * Re-exports theme registry and provides backward-compatible APIs.
 *
 * @example
 * ```typescript
 * import { colorThemes, getThemeMetadata, defaultColorTheme } from '@core/config/styles/themes';
 * ```
 */

// Re-export everything from registry
export {
  themeRegistry,
  themeNames,
  defaultThemeName,
  getTheme,
  getAllThemes,
  getThemesBySource,
  getThemesByCategory,
  isValidTheme,
  getThemeClassName,
  getThemesGroupedBySource,
  getThemesGroupedByCategory,
} from './registry';

export type {
  ThemeSource,
  ThemeCategory,
  ThemeDefinition,
  ThemeName,
} from './registry';

// ============================================
// Backward-compatible exports
// ============================================

import {
  themeRegistry,
  defaultThemeName,
  getTheme,
  type ThemeDefinition,
  type ThemeName,
} from './registry';

/**
 * @deprecated Use `themeRegistry` or `themeNames` instead
 */
export const colorThemes = themeRegistry.map((t) => t.name) as readonly string[];

/**
 * @deprecated Use `ThemeName` instead
 */
export type ColorTheme = ThemeName;

/**
 * @deprecated Use `ThemeDefinition` instead
 */
export interface ThemeMetadata {
  name: string;
  label: string;
  description: string;
  primaryColor: string;
  radius: string;
}

/**
 * @deprecated Use `themeRegistry` instead
 */
export const themeMetadata: Record<string, ThemeMetadata> = Object.fromEntries(
  themeRegistry.map((t) => [
    t.name,
    {
      name: t.name,
      label: t.label,
      description: t.description,
      primaryColor: t.primaryHsl,
      radius: t.radius,
    },
  ])
);

/**
 * @deprecated Use `defaultThemeName` instead
 */
export const defaultColorTheme = defaultThemeName;

/**
 * @deprecated Use `isValidTheme` instead
 */
export function isValidColorTheme(value: string): value is ColorTheme {
  return themeRegistry.some((t) => t.name === value);
}

/**
 * @deprecated Use `getTheme` instead
 */
export function getThemeMetadata(theme: string): ThemeMetadata {
  const t = getTheme(theme);
  if (!t) {
    // Return default for backward compatibility
    return {
      name: theme,
      label: theme,
      description: '',
      primaryColor: '0 0% 50%',
      radius: '0.5rem',
    };
  }
  return {
    name: t.name,
    label: t.label,
    description: t.description,
    primaryColor: t.primaryHsl,
    radius: t.radius,
  };
}

/**
 * @deprecated Use `getAllThemes` instead
 */
export function getAllThemesMetadata(): ThemeMetadata[] {
  return themeRegistry.map((t) => ({
    name: t.name,
    label: t.label,
    description: t.description,
    primaryColor: t.primaryHsl,
    radius: t.radius,
  }));
}
