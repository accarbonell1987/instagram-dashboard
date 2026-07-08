import type { ThemeName } from '@core/config/styles/themes/registry';

/**
 * Color theme type (all available themes)
 */
export type ColorThemeType = ThemeName;

/**
 * Context value for color theme
 */
export interface ColorThemeContextValueInterface {
  colorTheme: ColorThemeType;
  setColorTheme: (theme: ColorThemeType) => void;
}
