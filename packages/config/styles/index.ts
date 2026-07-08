/**
 * Design System Styles
 *
 * Re-exports for programmatic token access
 */

// Base tokens and theme utilities
export {
  baseTokens,
  createThemeTokens,
  cssVar,
  hslVar,
  primitiveColorVar,
  getThemeColor,
  hasCustomColors,
  getThemePalette,
  generateThemeVars,
} from './tokens';

export type {
  BaseTokens,
  ThemeTokens,
  ThemeConfig,
  ThemeColorPalette,
  ColorDefinition,
  SemanticColorToken,
  ChartColorToken,
  SidebarColorToken,
  ColorScale,
  ColorStep,
} from './tokens';

// Theme system exports
export {
  colorThemes,
  themeMetadata,
  defaultColorTheme,
  getThemeClassName,
  isValidColorTheme,
  getThemeMetadata,
  getAllThemes,
} from './themes';
export type { ColorTheme, ThemeMetadata } from './themes';

// Theme configuration and selection utilities
export {
  createThemeConfig,
  getThemeImports,
  generateGlobalsCss,
  themePresets,
  validateThemeConfig,
  shadcnThemeMetadata,
} from './theme-config';

export type {
  ThemeStrategy,
  ShadcnTheme,
  ThemeConfig as AppThemeConfig,
  ThemeMetadata as ShadcnThemeMetadata,
} from './theme-config';
