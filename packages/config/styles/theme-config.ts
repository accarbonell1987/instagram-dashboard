/**
 * Theme Configuration Utility
 *
 * Provides type-safe theme selection and configuration for webapps.
 * Use this to explicitly choose between DS tokens, shadcn themes, or custom themes.
 *
 * @example
 * ```typescript
 * // In your app's theme config
 * import { createThemeConfig } from '@core/config/styles/theme-config';
 *
 * export const themeConfig = createThemeConfig({
 *   strategy: 'shadcn-fixed',
 *   theme: 'blue',
 * });
 * ```
 */

export type ThemeStrategy =
  | 'ds-tokens' // Use Design System tokens (default)
  | 'shadcn-fixed' // Use a single shadcn theme
  | 'shadcn-dynamic' // Enable theme switching with multiple shadcn themes
  | 'custom' // Use custom theme CSS
  | 'hybrid'; // shadcn base + custom overrides

/**
 * All available theme names (shadcn + custom)
 */
export type ThemeName =
  | 'ambar'
  | 'zinc'
  | 'slate'
  | 'stone'
  | 'gray'
  | 'neutral'
  | 'red'
  | 'rose'
  | 'orange'
  | 'green'
  | 'blue'
  | 'yellow'
  | 'violet';

/**
 * @deprecated Use ThemeName instead
 */
export type ShadcnTheme = ThemeName;

/**
 * Theme configuration for a webapp
 */
export interface ThemeConfig {
  /**
   * Theme strategy to use
   * @default 'ds-tokens'
   */
  strategy: ThemeStrategy;

  /**
   * shadcn theme name (required for 'shadcn-fixed' and 'hybrid' strategies)
   */
  theme?: ShadcnTheme;

  /**
   * Path to custom theme CSS (required for 'custom' strategy)
   * Relative to the app's src directory
   * @example '../styles/theme.css'
   */
  customThemePath?: string;

  /**
   * Enable dark mode support
   * @default true
   */
  darkMode?: boolean;

  /**
   * Description of the theme choice (for documentation)
   */
  description?: string;
}

/**
 * Creates a type-safe theme configuration
 */
export function createThemeConfig(config: ThemeConfig): ThemeConfig {
  // Validation
  if (config.strategy === 'shadcn-fixed' && !config.theme) {
    throw new Error('shadcn-fixed strategy requires a theme name');
  }

  if (config.strategy === 'hybrid' && !config.theme) {
    throw new Error('hybrid strategy requires a base shadcn theme name');
  }

  if (config.strategy === 'custom' && !config.customThemePath) {
    throw new Error('custom strategy requires customThemePath');
  }

  return {
    darkMode: true,
    ...config,
  };
}

/**
 * Gets the CSS imports needed for a theme config
 */
export function getThemeImports(config: ThemeConfig): string[] {
  const imports: string[] = [
    '@import "tailwindcss";',
    '@import "@core/config/styles/globals.css";',
  ];

  switch (config.strategy) {
    case 'ds-tokens':
      // No additional imports needed
      break;

    case 'shadcn-fixed':
      imports.push(`@import "@core/config/styles/themes/${config.theme}.css";`);
      break;

    case 'shadcn-dynamic':
      imports.push('@import "@core/config/styles/themes.css";');
      break;

    case 'custom':
      imports.push(`@import "${config.customThemePath}";`);
      break;

    case 'hybrid':
      imports.push(`@import "@core/config/styles/themes/${config.theme}.css";`);
      imports.push(`@import "${config.customThemePath}";`);
      break;
  }

  return imports;
}

/**
 * Generates globals.css content based on theme config
 */
export function generateGlobalsCss(config: ThemeConfig): string {
  const imports = getThemeImports(config);
  const header = `/**
 * Global Styles
 *
 * Theme Strategy: ${config.strategy}
 * ${config.theme ? `Theme: ${config.theme}` : ''}
 * ${config.description ? `\n * ${config.description}` : ''}
 */\n\n`;

  return header + imports.join('\n') + '\n';
}

/**
 * Preset theme configurations for common use cases
 */
export const themePresets = {
  /**
   * Default Design System theme
   * No additional configuration needed
   */
  dsTokens: (): ThemeConfig => ({
    strategy: 'ds-tokens',
    description: 'Uses the default Design System tokens',
  }),

  /**
   * Professional blue theme (shadcn)
   */
  professional: (): ThemeConfig => ({
    strategy: 'shadcn-fixed',
    theme: 'blue',
    description: 'Professional blue theme for corporate apps',
  }),

  /**
   * Neutral zinc theme (shadcn)
   */
  neutral: (): ThemeConfig => ({
    strategy: 'shadcn-fixed',
    theme: 'zinc',
    description: 'Neutral theme with subtle warmth',
  }),

  /**
   * Vibrant theme for creative apps (shadcn)
   */
  creative: (): ThemeConfig => ({
    strategy: 'shadcn-fixed',
    theme: 'violet',
    description: 'Vibrant violet theme for creative apps',
  }),

  /**
   * Theme switcher with multiple options
   */
  themeSwitcher: (): ThemeConfig => ({
    strategy: 'shadcn-dynamic',
    description: 'Enables theme switching with multiple shadcn themes',
  }),

  /**
   * Custom branded theme
   */
  customBrand: (themePath: string, description?: string): ThemeConfig => ({
    strategy: 'custom',
    customThemePath: themePath,
    description: description || 'Custom branded theme',
  }),

  /**
   * shadcn base with custom overrides
   */
  customizeTheme: (baseTheme: ShadcnTheme, overridesPath: string): ThemeConfig => ({
    strategy: 'hybrid',
    theme: baseTheme,
    customThemePath: overridesPath,
    description: `${baseTheme} theme with custom overrides`,
  }),
} as const;

/**
 * Validates theme configuration
 */
export function validateThemeConfig(config: ThemeConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.strategy) {
    errors.push('strategy is required');
  }

  if (config.strategy === 'shadcn-fixed' && !config.theme) {
    errors.push('theme is required for shadcn-fixed strategy');
  }

  if (config.strategy === 'hybrid' && !config.theme) {
    errors.push('theme is required for hybrid strategy');
  }

  if ((config.strategy === 'custom' || config.strategy === 'hybrid') && !config.customThemePath) {
    errors.push('customThemePath is required for custom/hybrid strategy');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Theme metadata for documentation and UI
 */
export interface ThemeMetadata {
  name: string;
  displayName: string;
  description: string;
  primaryColor: string;
  category: 'neutral' | 'vibrant' | 'custom' | 'brand';
}

export const shadcnThemeMetadata: Record<ThemeName, ThemeMetadata> = {
  ambar: {
    name: 'ambar',
    displayName: 'Ambar',
    description: 'Warm amber/gold brand theme',
    primaryColor: 'hsl(38, 92%, 50%)',
    category: 'brand',
  },
  zinc: {
    name: 'zinc',
    displayName: 'Zinc',
    description: 'Neutral gray with subtle warmth',
    primaryColor: 'hsl(240, 5.9%, 10%)',
    category: 'neutral',
  },
  slate: {
    name: 'slate',
    displayName: 'Slate',
    description: 'Cool blue-gray, professional',
    primaryColor: 'hsl(222.2, 47.4%, 11.2%)',
    category: 'neutral',
  },
  stone: {
    name: 'stone',
    displayName: 'Stone',
    description: 'Warm earthy tones',
    primaryColor: 'hsl(24, 9.8%, 10%)',
    category: 'neutral',
  },
  gray: {
    name: 'gray',
    displayName: 'Gray',
    description: 'Balanced blue-gray',
    primaryColor: 'hsl(220.9, 39.3%, 11%)',
    category: 'neutral',
  },
  neutral: {
    name: 'neutral',
    displayName: 'Neutral',
    description: 'Pure black and white',
    primaryColor: 'hsl(0, 0%, 9%)',
    category: 'neutral',
  },
  red: {
    name: 'red',
    displayName: 'Red',
    description: 'Bold and vibrant',
    primaryColor: 'hsl(0, 72.2%, 50.6%)',
    category: 'vibrant',
  },
  rose: {
    name: 'rose',
    displayName: 'Rose',
    description: 'Soft pink/magenta',
    primaryColor: 'hsl(346.8, 77.2%, 49.8%)',
    category: 'vibrant',
  },
  orange: {
    name: 'orange',
    displayName: 'Orange',
    description: 'Warm and energetic',
    primaryColor: 'hsl(24.6, 95%, 53.1%)',
    category: 'vibrant',
  },
  green: {
    name: 'green',
    displayName: 'Green',
    description: 'Fresh and natural',
    primaryColor: 'hsl(142.1, 76.2%, 36.3%)',
    category: 'vibrant',
  },
  blue: {
    name: 'blue',
    displayName: 'Blue',
    description: 'Bright and trustworthy',
    primaryColor: 'hsl(221.2, 83.2%, 53.3%)',
    category: 'vibrant',
  },
  yellow: {
    name: 'yellow',
    displayName: 'Yellow',
    description: 'Cheerful and optimistic',
    primaryColor: 'hsl(47.9, 95.8%, 53.1%)',
    category: 'vibrant',
  },
  violet: {
    name: 'violet',
    displayName: 'Violet',
    description: 'Creative and imaginative',
    primaryColor: 'hsl(262.1, 83.3%, 57.8%)',
    category: 'vibrant',
  },
};
