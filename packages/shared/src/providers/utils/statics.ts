import { themeRegistry, defaultThemeName } from '@core/config/styles/themes/registry';

import type { ColorThemeType } from '../types/ThemeProvider.types';

/**
 * All available color themes (derived from registry)
 */
export const COLOR_THEMES = themeRegistry.map((t) => t.name) as readonly string[];

/**
 * Default color theme
 */
export const DEFAULT_COLOR_THEME: ColorThemeType = defaultThemeName;

/**
 * LocalStorage key for persisting theme selection
 */
export const COLOR_THEME_STORAGE_KEY = 'color-theme';
